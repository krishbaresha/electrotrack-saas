import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreatePoDto } from './dto/create-po.dto';
import { ReceivePoDto } from './dto/receive-po.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

interface RequestWithUser extends Request {
  user: {
    id: string;
    tenantId: string;
    role: string;
    permissions: string[];
  };
}

@Controller()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  // ─── Suppliers ────────────────────────────────────────────────────────────────

  @Get('suppliers')
  @Permissions('suppliers.read')
  listSuppliers(
    @Query('search') search: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.suppliersService.listSuppliers(search, req.user.tenantId);
  }

  @Get('suppliers/:id')
  @Permissions('suppliers.read')
  getSupplier(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.suppliersService.getSupplier(id, req.user.tenantId);
  }

  @Post('suppliers')
  @Permissions('suppliers.write')
  @HttpCode(HttpStatus.CREATED)
  createSupplier(@Body() dto: CreateSupplierDto, @Req() req: RequestWithUser) {
    return this.suppliersService.createSupplier(dto, req.user.tenantId);
  }

  @Patch('suppliers/:id')
  @Permissions('suppliers.write')
  updateSupplier(
    @Param('id') id: string,
    @Body() dto: CreateSupplierDto,
    @Req() req: RequestWithUser,
  ) {
    return this.suppliersService.updateSupplier(id, dto, req.user.tenantId);
  }

  // ─── Purchase Orders ──────────────────────────────────────────────────────────

  @Get('purchase-orders')
  @Permissions('suppliers.read')
  listPurchaseOrders(
    @Query('supplierId') supplierId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.suppliersService.listPurchaseOrders(
      supplierId,
      req.user.tenantId,
    );
  }

  @Get('purchase-orders/:id')
  @Permissions('suppliers.read')
  getPurchaseOrder(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.suppliersService.getPurchaseOrder(id, req.user.tenantId);
  }

  @Post('purchase-orders')
  @Permissions('suppliers.write')
  @HttpCode(HttpStatus.CREATED)
  createPurchaseOrder(@Body() dto: CreatePoDto, @Req() req: RequestWithUser) {
    return this.suppliersService.createPurchaseOrder(
      dto,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Patch('purchase-orders/:id/receive')
  @Permissions('suppliers.write')
  receivePurchaseOrder(
    @Param('id') id: string,
    @Body() dto: ReceivePoDto,
    @Req() req: RequestWithUser,
  ) {
    return this.suppliersService.receivePurchaseOrder(
      id,
      dto,
      req.user.id,
      req.user.tenantId,
    );
  }
}
