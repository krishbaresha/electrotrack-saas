import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IntegrityService } from './integrity.service.js';
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

@Controller('integrity')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class IntegrityController {
  constructor(private integrityService: IntegrityService) {}

  @Get('scan')
  @Permissions('inventory.read')
  async runScan(
    @Query('type') type: 'quick' | 'deep' = 'quick',
    @Req() req: RequestWithUser,
  ) {
    return this.integrityService.runScan(req.user.tenantId, type);
  }

  @Get('history')
  @Permissions('inventory.read')
  async getHistory(@Req() req: RequestWithUser) {
    return this.integrityService.getHistory(req.user.tenantId);
  }

  @Post('repair/:issueId')
  @Permissions('inventory.write')
  @HttpCode(HttpStatus.OK)
  async executeRepair(
    @Param('issueId') issueId: string,
    @Body('dryRun') dryRun = false,
    @Req() req: RequestWithUser,
  ) {
    return this.integrityService.executeRepair(
      req.user.tenantId,
      issueId,
      dryRun,
      req.user.id,
      req.ip,
    );
  }

  @Post('recalculate')
  @Permissions('inventory.write')
  @HttpCode(HttpStatus.OK)
  async recalculate(@Req() req: RequestWithUser) {
    return this.integrityService.recalculate(req.user.tenantId);
  }

  @Get('export')
  @Permissions('inventory.read')
  async exportReport(
    @Query('scanId') scanId: string,
    @Query('format') format: 'csv' | 'json' = 'json',
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const data = await this.integrityService.getExportData(
      req.user.tenantId,
      scanId,
      format,
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="integrity-report-${scanId}.csv"`,
      );
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="integrity-report-${scanId}.json"`,
      );
    }

    return res.send(data);
  }
}
