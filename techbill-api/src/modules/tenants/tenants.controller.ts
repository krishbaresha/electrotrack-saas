import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

// ─── Typed request user shape from JWT strategy ──────────────────────────────
interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
  permissions: string[];
}

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.platform_admin)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  // ─── Public tenant config endpoint (any authenticated role) ──────────────────
  /**
   * GET /tenants/me/config
   * Accessible by any authenticated tenant user (not just platform_admin).
   * Returns feature flags gated by tenant's subscription state.
   * Response: { isWarehouseEnabled: boolean, role: string }
   */
  @Get('me/config')
  @Roles()                    // Empty @Roles() overrides the class-level platform_admin restriction
  @HttpCode(HttpStatus.OK)
  async getMyConfig(@Req() req: Request) {
    const user = (req as Request & { user: AuthUser }).user;

    if (!user.tenantId) {
      // platform_admin users have no tenant — return a superadmin config
      return { isWarehouseEnabled: true, role: user.role };
    }

    return this.tenantsService.getTenantConfig(user.tenantId, user.role);
  }

  // ─── Platform Admin — Tenant management endpoints ─────────────────────────

  @Get()
  listTenants() {
    return this.tenantsService.listTenants();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTenant(
    @Body()
    dto: {
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
    },
  ) {
    return this.tenantsService.createTenant(dto);
  }

  @Get(':id')
  getTenant(@Param('id') id: string) {
    return this.tenantsService.getTenant(id);
  }

  @Patch(':id')
  updateTenant(
    @Param('id') id: string,
    @Body()
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
    return this.tenantsService.updateTenant(id, dto);
  }

  @Delete(':id')
  deleteTenant(@Param('id') id: string, @Body('force') force: boolean) {
    return this.tenantsService.deleteTenant(id, force);
  }

  @Patch(':id/restore')
  restoreTenant(@Param('id') id: string) {
    return this.tenantsService.restoreTenant(id);
  }

  @Post(':id/renew')
  @HttpCode(HttpStatus.OK)
  renewTenant(@Param('id') id: string, @Body('startDate') startDate?: string) {
    return this.tenantsService.renewTenant(id, startDate);
  }

  @Post(':id/reset-owner-password')
  @HttpCode(HttpStatus.OK)
  resetOwnerPassword(@Param('id') id: string, @Body('password') password: string) {
    return this.tenantsService.resetOwnerPassword(id, password);
  }

  @Patch(':id/app-access')
  @HttpCode(HttpStatus.OK)
  toggleAppAccess(
    @Param('id') id: string,
    @Body('appAccessEnabled') appAccessEnabled: boolean,
  ) {
    return this.tenantsService.toggleAppAccess(id, appAccessEnabled);
  }

  @Patch(':id/warehouse-access')
  @HttpCode(HttpStatus.OK)
  toggleWarehouseAccess(
    @Param('id') id: string,
    @Body('isWarehouseEnabled') isWarehouseEnabled: boolean,
  ) {
    return this.tenantsService.toggleWarehouseAccess(id, isWarehouseEnabled);
  }
}
