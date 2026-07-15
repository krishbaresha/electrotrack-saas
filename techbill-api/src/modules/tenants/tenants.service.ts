import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { Role, Tenant, TenantStatus } from '.prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { FeaturesService } from '../features/features.service';

const BCRYPT_ROUNDS = 12;

const ALL_PERMISSIONS = [
  'pos.read',
  'pos.sell',
  'pos.discount',
  'pos.void',
  'pos.online_sell',
  'inventory.read',
  'inventory.write',
  'inventory.delete',
  'suppliers.read',
  'suppliers.write',
  'customers.read',
  'customers.write',
  'returns.read',
  'returns.create',
  'returns.review',
  'reports.read',
  'reports.cash_reconciliation',
  'users.read',
  'users.manage',
  'users.permissions',
  'settings.read',
  'settings.manage',
  'audit.read',
  'notifications.read',
  'notifications.manage',
  'warranty.read',
  'loyalty.read',
  'loyalty.manage',
];

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private featuresService: FeaturesService,
  ) {}

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    const owners = await this.prisma.user.findMany({
      where: {
        role: Role.owner,
      },
      select: {
        email: true,
        tenantId: true,
      },
    });

    return tenants.map((t) => {
      const owner = owners.find((o) => o.tenantId === t.id);
      return {
        ...t,
        ownerEmail: owner?.email,
      };
    });
  }

  async createTenant(dto: {
    name: string;
    slug: string;
    username?: string;
    ownerEmail?: string;
    plan?: string;
    maxUsers?: number;
    ownerName: string;
    ownerPasswordHashOrText: string;
    isWarehouseEnabled?: boolean;
    subscriptionExpiresAt?: string;
  }) {
    const slug = dto.slug || dto.name.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const username = dto.username || dto.ownerEmail || 'owner';
    const ownerEmail = `${username}@${slug}.techbill.app`;

    // 1. Check if tenant slug or owner email already exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (existingTenant) {
      throw new ConflictException(`Tenant slug "${slug}" is already in use`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
    });
    if (existingUser) {
      throw new ConflictException(`Email "${ownerEmail}" is already in use`);
    }

    const passwordHash = await bcrypt.hash(
      dto.ownerPasswordHashOrText,
      BCRYPT_ROUNDS,
    );

    // Create tenant, initial owner user, and default shop settings inside a transaction
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          plan: dto.plan || 'trial',
          maxUsers: dto.maxUsers || 5,
          isWarehouseEnabled: dto.isWarehouseEnabled ?? false,
          subscriptionExpiresAt: dto.subscriptionExpiresAt
            ? new Date(dto.subscriptionExpiresAt)
            : null,
        },
      });

      const owner = await tx.user.create({
        data: {
          name: dto.ownerName,
          email: ownerEmail,
          passwordHash,
          role: Role.owner,
          tenantId: tenant.id,
          permissions: ALL_PERMISSIONS,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      // Seed default shop settings for the new tenant
      await tx.shopSettings.create({
        data: {
          tenantId: tenant.id,
          shopName: dto.name,
          maxDiscountWithoutOtp: 500,
        },
      });

      return { tenant, owner };
    });
  }

  async updateTenant(
    id: string,
    dto: {
      status?: string;
      plan?: string;
      maxUsers?: number;
      onlineSellingEnabled?: boolean;
      appAccessEnabled?: boolean;
      isWarehouseEnabled?: boolean;
      subscriptionExpiresAt?: string | null;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    const { subscriptionExpiresAt, status, ...rest } = dto;

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...rest,
        ...(status ? { status: status.toUpperCase() as TenantStatus } : {}),
        // Only include subscriptionExpiresAt in the update payload if it was explicitly provided
        ...(subscriptionExpiresAt !== undefined
          ? {
              subscriptionExpiresAt: subscriptionExpiresAt
                ? new Date(subscriptionExpiresAt)
                : null,
            }
          : {}),
      },
    });
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }
    return tenant;
  }

  /**
   * Returns the dynamic feature-flag configuration for the calling user's tenant.
   * Used by GET /tenants/me/config — accessible by any authenticated tenant user.
   */
  async getTenantConfig(
    tenantId: string,
    userRole: string,
  ): Promise<{ isWarehouseEnabled: boolean; role: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isWarehouseEnabled: true, subscriptionExpiresAt: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found`);
    }

    // If a subscription expiry date is set, gate warehouse access on active subscription
    const now = new Date();
    const warehouseEnabled =
      tenant.isWarehouseEnabled &&
      (!tenant.subscriptionExpiresAt || tenant.subscriptionExpiresAt > now);

    return {
      isWarehouseEnabled: warehouseEnabled,
      role: userRole,
    };
  }

  async deleteTenant(id: string, force: boolean) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    let result: Tenant;
    if (force) {
      result = await this.prisma.tenant.delete({ where: { id } });
    } else {
      result = await this.prisma.tenant.update({
        where: { id },
        data: { status: TenantStatus.PENDING_DELETION },
      });
    }
    this.featuresService.invalidate(id);
    return result;
  }

  async restoreTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    const result = await this.prisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.ACTIVE },
    });
    this.featuresService.invalidate(id);
    return result;
  }

  async renewTenant(id: string, startDate?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    const base = startDate ? new Date(startDate) : new Date();
    const newPeriodEnd = new Date(base);
    newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

    const result = await this.prisma.tenant.update({
      where: { id },
      data: {
        currentPeriodEnd: newPeriodEnd,
        subscriptionExpiresAt: newPeriodEnd,
        // If tenant was suspended or expired, reactivate on renewal
        ...(tenant.status === TenantStatus.SUSPENDED ||
        tenant.status === TenantStatus.EXPIRED
          ? { status: TenantStatus.ACTIVE }
          : {}),
      },
    });
    this.featuresService.invalidate(id);
    return result;
  }

  async resetOwnerPassword(tenantId: string, newPassword: string) {
    const owner = await this.prisma.user.findFirst({
      where: { tenantId, role: Role.owner },
    });

    if (!owner) {
      throw new NotFoundException(`Owner for tenant "${tenantId}" not found`);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: owner.id },
      data: { passwordHash },
    });

    return { message: 'Password reset successfully' };
  }

  async toggleAppAccess(id: string, appAccessEnabled: boolean) {
    return this.prisma.tenant.update({
      where: { id },
      data: { appAccessEnabled },
    });
  }

  async toggleWarehouseAccess(id: string, isWarehouseEnabled: boolean) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }
    return this.prisma.tenant.update({
      where: { id },
      data: { isWarehouseEnabled },
    });
  }

  private readonly logger = new Logger(TenantsService.name);

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCleanupPendingDeletions() {
    this.logger.log('Running daily cleanup for pending_deletion tenants...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const tenantsToDelete = await this.prisma.tenant.findMany({
      where: {
        status: TenantStatus.PENDING_DELETION,
        updatedAt: { lte: thirtyDaysAgo },
      },
    });

    for (const tenant of tenantsToDelete) {
      try {
        await this.prisma.tenant.delete({ where: { id: tenant.id } });
        this.logger.log(`Hard deleted tenant ${tenant.id} (${tenant.name})`);
      } catch (err) {
        this.logger.error(`Failed to delete tenant ${tenant.id}`, err);
      }
    }
  }
}
