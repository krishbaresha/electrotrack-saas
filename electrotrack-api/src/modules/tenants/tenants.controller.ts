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
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.platform_admin)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

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
      username: string;
      plan?: string;
      maxUsers?: number;
      ownerName: string;
      ownerPasswordHashOrText: string;
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
}
