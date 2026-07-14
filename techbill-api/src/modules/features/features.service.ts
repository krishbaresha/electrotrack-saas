import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LicenseResolverService, ResolvedLicense } from './license-resolver.service';
import { FeatureAccess, FeatureStatus, BillingCycle } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class FeaturesService {
  private readonly licenseCache = new Map<string, ResolvedLicense>();

  constructor(
    private prisma: PrismaService,
    private licenseResolver: LicenseResolverService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ─── Cache Management ──────────────────────────────────────────────────────

  async getResolvedLicense(tenantId: string): Promise<ResolvedLicense> {
    const cached = this.licenseCache.get(tenantId);
    if (cached) return cached;

    const resolved = await this.licenseResolver.resolve(tenantId);
    this.licenseCache.set(tenantId, resolved);
    return resolved;
  }

  async getUserLicense(
    tenantId: string,
    role: string,
    permissions: string[],
  ): Promise<ResolvedLicense> {
    const tenantLicense = await this.getResolvedLicense(tenantId);

    if (role === 'owner' || role === 'platform_admin') {
      return tenantLicense;
    }

    const filteredFeatures: Record<string, FeatureAccess> = {};
    const filteredNavigation: typeof tenantLicense.navigation = [];

    const FEATURE_PERMISSION_MAP: Record<string, string[]> = {
      pos: ['pos.read', 'pos.sell', 'pos.discount', 'pos.void'],
      online_orders: ['pos.online_sell'],
      inventory: ['inventory.read', 'inventory.write', 'inventory.delete'],
      suppliers: ['suppliers.read', 'suppliers.write'],
      purchase_orders: ['suppliers.read', 'suppliers.write'],
      customers: ['customers.read', 'customers.write'],
      returns: ['returns.read', 'returns.create', 'returns.review'],
      return_analytics: ['returns.read'],
      reports: ['reports.read'],
      dashboard: ['reports.read'],
      cash_reconciliation: ['reports.cash_reconciliation'],
      expenses: ['reports.read'],
      credit: ['reports.read'],
      users_staff: ['users.read', 'users.manage', 'users.permissions'],
      shop_settings: ['settings.read', 'settings.manage'],
      audit_logs: ['audit.read'],
      notifications: ['notifications.read', 'notifications.manage'],
      warranty: ['warranty.read'],
      loyalty_rewards: ['loyalty.read', 'loyalty.manage'],
      invoices: ['invoices.read'],
    };

    for (const [key, access] of Object.entries(tenantLicense.features)) {
      if (access === FeatureAccess.NONE) {
        filteredFeatures[key] = FeatureAccess.NONE;
        continue;
      }

      const mappedPerms = FEATURE_PERMISSION_MAP[key];
      let hasAccess = false;

      if (mappedPerms) {
        hasAccess = mappedPerms.some((p) => permissions.includes(p));
      } else {
        hasAccess = permissions.some((p) => p.startsWith(`${key}.`));
      }

      filteredFeatures[key] = hasAccess ? access : FeatureAccess.NONE;
    }

    for (const nav of tenantLicense.navigation) {
      if (filteredFeatures[nav.key] !== FeatureAccess.NONE) {
        filteredNavigation.push(nav);
      }
    }

    return {
      ...tenantLicense,
      features: filteredFeatures,
      navigation: filteredNavigation,
    };
  }

  invalidate(tenantId: string) {
    this.licenseCache.delete(tenantId);
    // Emit internal event which will trigger WebSocket broadcast
    this.eventEmitter.emit('subscription.updated', { tenantId });
  }

  // ─── Plans & Features CRUD ─────────────────────────────────────────────────

  async listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      include: {
        planFeatures: {
          include: {
            feature: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });
  }

  async listFeatures() {
    return this.prisma.feature.findMany({
      orderBy: { key: 'asc' },
      include: {
        category: true,
      },
    });
  }

  async getFeature(id: string) {
    const feature = await this.prisma.feature.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!feature) throw new NotFoundException(`Feature not found`);
    return feature;
  }

  async createFeature(dto: {
    key: string;
    name: string;
    description?: string;
    categoryKey: string;
    icon?: string;
    route?: string;
    menuOrder?: number;
    sidebarVisible?: boolean;
    parentFeatureKey?: string;
    version?: string;
    minimumBuild?: number;
    status?: FeatureStatus;
    globalEnabled?: boolean;
  }) {
    // Check key
    const existing = await this.prisma.feature.findUnique({ where: { key: dto.key } });
    if (existing) throw new ConflictException(`Feature key "${dto.key}" already exists`);

    // Category
    const category = await this.prisma.featureCategory.findUnique({
      where: { key: dto.categoryKey },
    });
    if (!category) throw new NotFoundException(`Feature Category "${dto.categoryKey}" not found`);

    // Parent
    let parentFeatureId: string | undefined;
    if (dto.parentFeatureKey) {
      const parent = await this.prisma.feature.findUnique({ where: { key: dto.parentFeatureKey } });
      if (!parent) throw new NotFoundException(`Parent feature "${dto.parentFeatureKey}" not found`);
      parentFeatureId = parent.id;
    }

    return this.prisma.feature.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        categoryId: category.id,
        icon: dto.icon,
        route: dto.route,
        menuOrder: dto.menuOrder ?? 0,
        sidebarVisible: dto.sidebarVisible ?? true,
        parentFeatureId,
        version: dto.version ?? 'v1',
        minimumBuild: dto.minimumBuild ?? 1,
        status: dto.status ?? FeatureStatus.STABLE,
        globalEnabled: dto.globalEnabled ?? true,
      },
    });
  }

  async updateFeature(
    id: string,
    dto: {
      name?: string;
      description?: string;
      icon?: string;
      route?: string;
      menuOrder?: number;
      sidebarVisible?: boolean;
      status?: FeatureStatus;
      globalEnabled?: boolean;
    },
  ) {
    const feature = await this.prisma.feature.findUnique({ where: { id } });
    if (!feature) throw new NotFoundException(`Feature not found`);

    const updated = await this.prisma.feature.update({
      where: { id },
      data: dto,
    });

    // Invalidate all caches since global configs changed
    this.licenseCache.clear();
    this.eventEmitter.emit('subscription.updated', { tenantId: '*' });

    return updated;
  }

  async deleteFeature(id: string) {
    const feature = await this.prisma.feature.findUnique({ where: { id } });
    if (!feature) throw new NotFoundException(`Feature not found`);

    if (feature.isSystemFeature) {
      throw new ConflictException(`System features cannot be deleted`);
    }

    await this.prisma.feature.delete({ where: { id } });
    this.licenseCache.clear();
    this.eventEmitter.emit('subscription.updated', { tenantId: '*' });
  }

  // ─── Tenant License Modification Operations ───────────────────────────────

  async updateTenantPlan(tenantId: string, planId: string, changedBy?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscriptionPlan: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant not found`);

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Subscription Plan not found`);

    // Determine expiration date
    let expiresAt: Date | null = null;
    const now = new Date();
    if (plan.billingCycle === BillingCycle.MONTHLY) {
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else if (plan.billingCycle === BillingCycle.YEARLY) {
      expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    } else if (plan.billingCycle === BillingCycle.TRIAL) {
      expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    }

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionPlanId: plan.id,
        subscriptionStartAt: now,
        subscriptionExpiresAt: expiresAt,
        subscriptionRenewedAt: now,
      },
    });

    // Log history
    await this.prisma.tenantLicenseHistory.create({
      data: {
        tenantId,
        action: 'change_plan',
        oldPlanName: tenant.subscriptionPlan?.name || 'None',
        newPlanName: plan.name,
        changedBy: changedBy || 'system',
        details: {
          price: plan.price.toString(),
          billingCycle: plan.billingCycle,
          expiresAt: expiresAt?.toISOString(),
        },
      },
    });

    this.invalidate(tenantId);
    return updatedTenant;
  }

  async updateTenantOverrides(
    tenantId: string,
    overrides: Array<{ featureKey: string; access: FeatureAccess }>,
    changedBy?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant not found`);

    const details: Record<string, string> = {};

    const processedFeatureIds: string[] = [];

    for (const item of overrides) {
      const feature = await this.prisma.feature.findUnique({ where: { key: item.featureKey } });
      if (!feature) throw new NotFoundException(`Feature "${item.featureKey}" not found`);

      await this.prisma.tenantFeatureOverride.upsert({
        where: {
          tenantId_featureId: {
            tenantId,
            featureId: feature.id,
          },
        },
        update: {
          access: item.access,
          enabledBy: changedBy || 'system',
        },
        create: {
          tenantId,
          featureId: feature.id,
          access: item.access,
          enabledBy: changedBy || 'system',
        },
      });

      details[item.featureKey] = item.access;
      processedFeatureIds.push(feature.id);
    }

    if (processedFeatureIds.length > 0) {
      await this.prisma.tenantFeatureOverride.deleteMany({
        where: {
          tenantId,
          featureId: {
            notIn: processedFeatureIds,
          },
        },
      });
    } else {
      await this.prisma.tenantFeatureOverride.deleteMany({
        where: {
          tenantId,
        },
      });
    }

    await this.prisma.tenantLicenseHistory.create({
      data: {
        tenantId,
        action: 'update_overrides',
        changedBy: changedBy || 'system',
        details,
      },
    });

    this.invalidate(tenantId);
    return { success: true };
  }

  async resetTenantOverrides(tenantId: string, changedBy?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant not found`);

    await this.prisma.tenantFeatureOverride.deleteMany({
      where: { tenantId },
    });

    await this.prisma.tenantLicenseHistory.create({
      data: {
        tenantId,
        action: 'reset_overrides',
        changedBy: changedBy || 'system',
      },
    });

    this.invalidate(tenantId);
    return { success: true };
  }
}
