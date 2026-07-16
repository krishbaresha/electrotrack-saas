import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { LicenseService } from './license.service';
import { CreateLicenseDto, RenewLicenseDto, SetUserPermissionsDto } from './dto/create-license.dto';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { CheckinDto } from './dto/checkin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

interface RequestWithUser extends Request {
  user: { id: string; tenantId: string; role: string; permissions: string[] };
}

/**
 * /admin/licenses  — Super Admin–only license management.
 * /license         — Desktop client endpoints (rate-limited, not admin-guarded).
 */
@Controller()
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  // ─── Super Admin: license CRUD ───────────────────────────────────────────────

  @Post('admin/licenses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  @HttpCode(HttpStatus.CREATED)
  createLicense(
    @Body() dto: CreateLicenseDto,
    @Req() req: RequestWithUser,
  ) {
    return this.licenseService.createLicense(dto, req.user.id);
  }

  @Post('admin/licenses/:id/regenerate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  regenerateLicense(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.licenseService.regenerateLicense(id, req.user.id);
  }

  @Post('admin/licenses/:id/renew')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  renewLicense(
    @Param('id') id: string,
    @Body() dto: RenewLicenseDto,
    @Req() req: RequestWithUser,
  ) {
    return this.licenseService.renewLicense(id, dto, req.user.id);
  }

  @Post('admin/licenses/:id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  @HttpCode(HttpStatus.OK)
  revokeLicense(@Param('id') id: string) {
    return this.licenseService.revokeLicense(id);
  }

  @Post('admin/licenses/:id/suspend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  @HttpCode(HttpStatus.OK)
  suspendLicense(@Param('id') id: string) {
    return this.licenseService.suspendLicense(id);
  }

  @Get('admin/licenses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  listLicenses(@Query('userId') userId?: string) {
    return this.licenseService.listLicenses(userId);
  }

  @Get('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  listAllUsers() {
    return this.licenseService.listAllUsers();
  }

  @Post('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  @HttpCode(HttpStatus.CREATED)
  adminCreateUser(
    @Body() dto: {
      name: string;
      username: string;
      password: string;
      role: any;
      tenantId: string;
      permissions?: string[];
    },
  ) {
    return this.licenseService.adminCreateUser(dto);
  }

  @Patch('admin/users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  adminUpdateUser(
    @Param('id') id: string,
    @Body() dto: {
      name?: string;
      role?: any;
      isActive?: boolean;
      permissions?: string[];
      password?: string;
    },
  ) {
    return this.licenseService.adminUpdateUser(id, dto);
  }



  // ─── Super Admin: user permissions ──────────────────────────────────────────

  @Post('admin/users/:id/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  setUserPermissions(
    @Param('id') userId: string,
    @Body() dto: SetUserPermissionsDto,
  ) {
    return this.licenseService.setUserPermissions(userId, dto);
  }

  @Get('admin/users/:id/permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('platform_admin')
  getUserPermissions(@Param('id') userId: string) {
    return this.licenseService.getUserPermissions(userId);
  }

  // ─── Desktop client (public, rate-limited by ThrottlerGuard globally) ────────

  @Post('license/activate')
  @HttpCode(HttpStatus.OK)
  activate(@Body() dto: ActivateLicenseDto) {
    return this.licenseService.activateLicense(dto);
  }

  @Post('license/checkin')
  @HttpCode(HttpStatus.OK)
  checkin(@Body() dto: CheckinDto) {
    return this.licenseService.checkin(dto);
  }
}
