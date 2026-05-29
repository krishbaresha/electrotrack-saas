import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReportsService } from './reports.service';
import { SalesSummaryQueryDto } from './dto/sales-summary-query.dto';
import { ReconciliationDto } from './dto/reconciliation.dto';
import { FilterReconciliationDto } from './dto/filter-reconciliation.dto';
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

@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('sales-summary')
  @Permissions('reports.read')
  salesSummary(
    @Query() query: SalesSummaryQueryDto,
    @Req() req: RequestWithUser,
  ) {
    return this.reportsService.salesSummary(query, req.user.tenantId);
  }

  @Get('sales-summary/range')
  @Permissions('reports.read')
  salesSummaryRange(
    @Query() query: SalesSummaryQueryDto,
    @Req() req: RequestWithUser,
  ) {
    return this.reportsService.salesSummaryRange(query, req.user.tenantId);
  }

  @Get('stock-valuation')
  @Permissions('reports.read')
  stockValuation(@Req() req: RequestWithUser) {
    return this.reportsService.stockValuation(req.user.tenantId);
  }

  @Get('low-stock')
  @Permissions('reports.read')
  lowStockReport(@Req() req: RequestWithUser) {
    return this.reportsService.lowStockReport(req.user.tenantId);
  }

  @Get('staff-performance')
  @Permissions('reports.read')
  staffPerformance(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.reportsService.staffPerformance(from, to, req.user.tenantId);
  }

  @Get('top-products')
  @Permissions('reports.read')
  topProducts(
    @Query('limit') limit: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.reportsService.topProducts(
      limit ? parseInt(limit) : 10,
      from,
      to,
      req.user.tenantId,
    );
  }

  @Get('dead-stock')
  @Permissions('reports.read')
  deadStock(
    @Query('days') days: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    const daysNum = days ? parseInt(days, 10) : 60;
    return this.reportsService.deadStock(
      Number.isNaN(daysNum) ? 60 : daysNum,
      req.user.tenantId,
    );
  }

  @Get('return-analytics')
  @Permissions('returns.read')
  returnAnalytics(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.reportsService.returnAnalytics(from, to, req.user.tenantId);
  }

  @Post('cash-reconciliation')
  @Permissions('reports.cash_reconciliation')
  @HttpCode(HttpStatus.CREATED)
  submitReconciliation(
    @Body() dto: ReconciliationDto,
    @Req() req: RequestWithUser,
  ) {
    return this.reportsService.submitReconciliation(
      dto,
      req.user.id,
      req.user.tenantId,
    );
  }

  @Get('cash-reconciliation')
  @Permissions('reports.read')
  listReconciliations(
    @Query() filter: FilterReconciliationDto,
    @Req() req: RequestWithUser,
  ) {
    return this.reportsService.listReconciliations(filter, req.user.tenantId);
  }

  @Patch('cash-reconciliation/:id/review')
  @Permissions('reports.cash_reconciliation')
  reviewReconciliation(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.reportsService.reviewReconciliation(
      id,
      req.user.id,
      req.user.tenantId,
    );
  }
}
