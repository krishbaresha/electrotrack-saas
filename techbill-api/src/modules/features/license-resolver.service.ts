import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantStatus, FeatureAccess, FeatureStatus } from '@prisma/client';

export interface ResolvedLicense {
  status: TenantStatus;
  plan: string;
  expiresAt: Date | null;
  isExpired: boolean;
  isReadOnly: boolean;
  features: Record<string, FeatureAccess>;
  navigation: Array<{
    key: string;
    title: string;
    icon: string;
    route: string;
    menuOrder: number;
    category: string;
  }>;
}

@Injectable()
export class LicenseResolverService {
  constructor(private prisma: PrismaService) {}

  async resolve(tenantId: string): Promise<ResolvedLicense> {
    // 1. Fetch tenant with subscription plan, overrides, and features
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscriptionPlan: {
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
        },
        overrides: {
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

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // 2. Fetch all system features to build a complete capability map
    const allFeatures = await this.prisma.feature.findMany({
      include: {
        category: true,
      },
    });

    // 3. Determine expiration and read-only states (Phase 1 basic logic)
    const isExpired = 
      tenant.status === TenantStatus.EXPIRED ||
      (tenant.subscriptionExpiresAt ? new Date() > tenant.subscriptionExpiresAt : false);
    const isReadOnly = false; // Phase 1 isReadOnly defaults to false (Phase 3 full grace period checker)

    const resolvedFeatures: Record<string, FeatureAccess> = {};
    const navigationItems: Array<{
      key: string;
      title: string;
      icon: string;
      route: string;
      menuOrder: number;
      category: string;
    }> = [];

    // 4. Check if tenant is fully blocked or suspended
    const isTenantBlocked = 
      tenant.status === TenantStatus.BLOCKED || 
      tenant.status === TenantStatus.SUSPENDED ||
      tenant.status === TenantStatus.CANCELLED ||
      isExpired;

    // 5. Populate feature access mapping
    for (const feature of allFeatures) {
      let resolvedAccess: FeatureAccess = FeatureAccess.NONE;

      if (!isTenantBlocked && feature.globalEnabled) {
        // Find override if exists
        const override = tenant.overrides.find(o => o.featureId === feature.id);
        if (override) {
          resolvedAccess = override.access;
        } else {
          // Fallback to subscription plan default
          const planFeature = tenant.subscriptionPlan?.planFeatures.find(
            pf => pf.featureId === feature.id
          );
          if (planFeature) {
            resolvedAccess = planFeature.access;
          }
        }
      }

      resolvedFeatures[feature.key] = resolvedAccess;

      // Add to dynamic sidebar navigation if visible and access is enabled
      if (feature.sidebarVisible && resolvedAccess !== FeatureAccess.NONE && feature.route) {
        navigationItems.push({
          key: feature.key,
          title: feature.name,
          icon: feature.icon || 'Package',
          route: feature.route,
          menuOrder: feature.menuOrder,
          category: feature.category.name,
        });
      }
    }

    // Sort navigation by menuOrder
    navigationItems.sort((a, b) => a.menuOrder - b.menuOrder);

    return {
      status: tenant.status,
      plan: tenant.subscriptionPlan?.name || 'Free/None',
      expiresAt: tenant.subscriptionExpiresAt,
      isExpired,
      isReadOnly,
      features: resolvedFeatures,
      navigation: navigationItems,
    };
  }
}
