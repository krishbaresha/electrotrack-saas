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
  Delete,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { VoidSaleDto } from './dto/void-sale.dto';
import { FilterSalesDto } from './dto/filter-sales.dto';
import { UpsertCustomerDto } from './dto/upsert-customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';

interface RequestWithUser extends Request {
  user: {
    id: string;
    tenantId: string;
    role: string;
    permissions: string[];
  };
}

@Controller('sales')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Get()
  @Permissions('pos.read')
  listSales(@Query() filter: FilterSalesDto, @Req() req: RequestWithUser) {
    return this.salesService.listSales(filter, req.user.tenantId);
  }

  @Get('customers')
  @Permissions('customers.read')
  getCustomers(
    @Query('search') search: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.salesService.getCustomers(search, req.user.tenantId);
  }

  @Get('by-invoice/:invoiceNumber')
  @Permissions('pos.read')
  lookupByInvoice(
    @Param('invoiceNumber') invoiceNumber: string,
    @Req() req: RequestWithUser,
  ) {
    return this.salesService.lookupByInvoice(invoiceNumber, req.user.tenantId);
  }

  @Get(':id')
  @Permissions('pos.read')
  getSale(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.salesService.getSale(id, req.user.tenantId);
  }

  @Post()
  @Permissions('pos.sell')
  @UseGuards(SubscriptionGuard)
  @HttpCode(HttpStatus.CREATED)
  createSale(@Body() dto: CreateSaleDto, @Req() req: RequestWithUser) {
    return this.salesService.createSale(
      dto,
      req.user.id,
      req.user.tenantId,
      req.ip,
    );
  }

  @Post('customers')
  @Permissions('customers.write')
  upsertCustomer(@Body() dto: UpsertCustomerDto, @Req() req: RequestWithUser) {
    return this.salesService.upsertCustomer(dto, req.user.tenantId);
  }

  @Post(':id/void')
  @Permissions('pos.void')
  @HttpCode(HttpStatus.OK)
  voidSale(
    @Param('id') id: string,
    @Body() dto: VoidSaleDto,
    @Req() req: RequestWithUser,
  ) {
    return this.salesService.voidSale(
      id,
      dto,
      req.user.id,
      req.user.tenantId,
      req.ip,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteSale(@Param('id') id: string, @Req() req: RequestWithUser) {
    // Only owner should be able to hard delete
    if (req.user.role !== 'owner') {
      throw new ForbiddenException('Only owners can delete sales');
    }
    return this.salesService.deleteSale(id, req.user.tenantId);
  }

  @Patch(':id/dispatch')
  @Permissions('pos.online_sell')
  dispatchSale(
    @Param('id') id: string,
    @Body('trackingId') trackingId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.salesService.dispatchSale(
      id,
      trackingId,
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/deliver')
  @Permissions('pos.online_sell')
  markDelivered(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.salesService.markDelivered(id, req.user.tenantId);
  }

  @Get('payouts/ledger')
  @Permissions('pos.online_sell')
  getCourierLedger(@Req() req: RequestWithUser) {
    return this.salesService.getCourierLedger(req.user.tenantId);
  }

  @Post('payouts')
  @Permissions('pos.online_sell')
  recordCourierPayout(
    @Body('amount') amount: number,
    @Body('courierName') courierName: string,
    @Body('date') date: string,
    @Req() req: RequestWithUser,
  ) {
    return this.salesService.recordCourierPayout(
      req.user.tenantId,
      req.user.id,
      Number(amount),
      courierName,
      date,
    );
  }

  @Patch(':id/return')
  @Permissions('pos.online_sell')
  returnOnlineOrder(
    @Param('id') id: string,
    @Body('refundLossAmount') refundLossAmount: number,
    @Req() req: RequestWithUser,
  ) {
    return this.salesService.returnOnlineOrder(
      id,
      Number(refundLossAmount) || 0,
      req.user.tenantId,
      req.user.id,
    );
  }
}
