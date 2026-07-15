import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FeaturesService } from './features.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, FeatureAccess, TenantStatus } from '.prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
  permissions: string[];
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeaturesController {
  constructor(
    private featuresService: FeaturesService,
    private prisma: PrismaService,
  ) {}

  // ─── Client Endpoint ───────────────────────────────────────────────────────

  @Get('tenant/me/license')
  async getMyLicense(@Req() req: Request) {
    const user = (req as Request & { user: AuthUser }).user;

    // Platform Super Admin logic — bypass standard tenant checks
    if (!user.tenantId) {
      const allFeatures = await this.prisma.feature.findMany({
        include: { category: true },
      });
      const featuresMap: Record<string, FeatureAccess> = {};
      const navigation: any[] = [];

      for (const f of allFeatures) {
        featuresMap[f.key] = FeatureAccess.FULL;
      }

      return {
        status: TenantStatus.ACTIVE,
        plan: 'SuperAdmin Console',
        expiresAt: null,
        isExpired: false,
        isReadOnly: false,
        features: featuresMap,
        navigation,
      };
    }

    return this.featuresService.getUserLicense(
      user.tenantId,
      user.role,
      user.permissions || [],
    );
  }

  // ─── Super Admin Endpoints ────────────────────────────────────────────────

  @Get('plans')
  @Roles(Role.platform_admin)
  listPlans() {
    return this.featuresService.listPlans();
  }

  @Get('features')
  @Roles(Role.platform_admin)
  listFeatures() {
    return this.featuresService.listFeatures();
  }

  @Get('tenant/:id/features')
  @Roles(Role.platform_admin)
  getTenantOverrides(@Param('id') tenantId: string) {
    return this.prisma.tenantFeatureOverride.findMany({
      where: { tenantId },
      include: { feature: true },
    });
  }

  @Put('tenant/:id/plan')
  @Roles(Role.platform_admin)
  @HttpCode(HttpStatus.OK)
  async updateTenantPlan(
    @Param('id') tenantId: string,
    @Body('planId') planId: string,
    @Req() req: Request,
  ) {
    const user = (req as Request & { user: AuthUser }).user;
    return this.featuresService.updateTenantPlan(tenantId, planId, user.email);
  }

  @Put('tenant/:id/features')
  @Roles(Role.platform_admin)
  @HttpCode(HttpStatus.OK)
  async updateTenantOverrides(
    @Param('id') tenantId: string,
    @Body('overrides')
    overrides: Array<{ featureKey: string; access: FeatureAccess }>,
    @Req() req: Request,
  ) {
    const user = (req as Request & { user: AuthUser }).user;
    return this.featuresService.updateTenantOverrides(
      tenantId,
      overrides,
      user.email,
    );
  }

  @Post('tenant/:id/reset-overrides')
  @Roles(Role.platform_admin)
  @HttpCode(HttpStatus.OK)
  async resetTenantOverrides(
    @Param('id') tenantId: string,
    @Req() req: Request,
  ) {
    const user = (req as Request & { user: AuthUser }).user;
    return this.featuresService.resetTenantOverrides(tenantId, user.email);
  }
}
