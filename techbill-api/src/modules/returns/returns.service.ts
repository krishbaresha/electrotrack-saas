import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReviewReturnDto } from './dto/review-return.dto';
import { FilterReturnsDto } from './dto/filter-returns.dto';
import { ReturnStatus, UnitStatus, SaleStatus } from '@prisma/client';

@Injectable()
export class ReturnsService {
  private readonly fraudWindowDays: number;
  private readonly fraudCountThreshold: number;

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
  ) {
    this.fraudWindowDays = parseInt(
      configService.get('RETURN_FRAUD_WINDOW_DAYS', '30'),
    );
    this.fraudCountThreshold = parseInt(
      configService.get('RETURN_FRAUD_COUNT_THRESHOLD', '2'),
    );
  }

  async createReturn(
    dto: CreateReturnDto,
    userId: string,
    tenantId: string,
    ipAddress?: string,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: dto.saleId, tenantId },
      include: { items: { include: { inventoryUnit: true } } },
    });
    if (!sale) throw new NotFoundException(`Sale ${dto.saleId} not found`);

    const unitMap = new Map(
      sale.items.map((i) => [i.inventoryUnit.serialNumber, i.inventoryUnit]),
    );

    const unitsToReturn = dto.serialNumbers.map((serial) => {
      const unit = unitMap.get(serial);
      if (!unit) {
        throw new BadRequestException(
          `Serial "${serial}" was not part of sale ${dto.saleId}`,
        );
      }
      if (unit.status !== UnitStatus.sold) {
        throw new BadRequestException(
          `Unit "${serial}" is not in sold status (current: ${unit.status})`,
        );
      }
      return unit;
    });

    const fraudWindowStart = new Date();
    fraudWindowStart.setDate(fraudWindowStart.getDate() - this.fraudWindowDays);

    const returns = await this.prisma.$transaction(async (tx) => {
      return Promise.all(
        unitsToReturn.map(async (unit) => {
          const recentCount = await tx.return.count({
            where: {
              tenantId,
              inventoryUnitId: unit.id,
              createdAt: { gte: fraudWindowStart },
            },
          });

          const ret = await tx.return.create({
            data: {
              saleId: dto.saleId,
              inventoryUnitId: unit.id,
              requestedById: userId,
              reason: dto.reason,
              returnType: dto.returnType,
              suspiciousFlag: recentCount >= this.fraudCountThreshold,
              tenantId,
            },
          });

          await tx.inventoryUnit.update({
            where: { id: unit.id },
            data: { status: UnitStatus.return_pending },
          });

          return ret;
        }),
      );
    });

    this.eventEmitter.emit('return.created', {
      returnIds: returns.map((r) => r.id),
      saleId: dto.saleId,
      serialNumbers: dto.serialNumbers,
      hasSuspiciousFlag: returns.some((r) => r.suspiciousFlag),
      tenantId,
      ipAddress,
    });

    for (const ret of returns) {
      const unit = unitsToReturn.find((u) => u.id === ret.inventoryUnitId);
      let productName = 'Unknown Product';
      if (unit) {
        const prod = await this.prisma.product.findUnique({
          where: { id: unit.productId },
          select: { name: true },
        });
        if (prod) productName = prod.name;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      this.eventEmitter.emit('return.requested', {
        returnId: ret.id,
        userId,
        saleId: dto.saleId,
        reason: dto.reason,
        productName,
        requestedByName: user?.name,
        tenantId,
        ipAddress,
      });
    }

    return returns;
  }

  async listReturns(filter: FilterReturnsDto, tenantId: string) {
    const { status, from, to, page = 1, limit = 50 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to + 'T23:59:59.999Z') }),
            },
          }
        : {}),
    };

    const [returns, total] = await this.prisma.$transaction([
      this.prisma.return.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          inventoryUnit: {
            select: {
              serialNumber: true,
              product: { select: { name: true, brand: true } },
            },
          },
          requestedBy: { select: { id: true, name: true } },
          sale: { select: { invoiceNumber: true } },
        },
      }),
      this.prisma.return.count({ where }),
    ]);

    return { data: returns, meta: { total, page, limit } };
  }

  async getReturn(id: string, tenantId: string) {
    const ret = await this.prisma.return.findFirst({
      where: { id, tenantId },
      include: {
        inventoryUnit: {
          include: { product: { select: { name: true, brand: true } } },
        },
        sale: { select: { invoiceNumber: true, totalAmount: true } },
        requestedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    if (!ret) throw new NotFoundException(`Return ${id} not found`);
    return ret;
  }

  async approveReturn(
    id: string,
    dto: ReviewReturnDto,
    userId: string,
    tenantId: string,
    ipAddress?: string,
  ) {
    const ret = await this.prisma.return.findFirst({ where: { id, tenantId } });
    if (!ret) throw new NotFoundException(`Return ${id} not found`);
    if (ret.status !== ReturnStatus.pending) {
      throw new BadRequestException(`Return is already ${ret.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.return.update({
        where: { id },
        data: {
          status: ReturnStatus.approved,
          reviewedById: userId,
          reviewNotes: dto.reviewNotes,
          refundAmount: dto.refundAmount,
          resolvedAt: new Date(),
        },
      });

      await tx.inventoryUnit.update({
        where: { id: ret.inventoryUnitId },
        data: { status: UnitStatus.in_stock },
      });

      if (ret.saleId) {
        await tx.sale.update({
          where: { id: ret.saleId },
          data: { status: SaleStatus.partial_return },
        });
      }

      return updated;
    });

    this.eventEmitter.emit('return.approved', {
      returnId: id,
      userId,
      refundAmount: dto.refundAmount,
      tenantId,
      ipAddress,
    });

    return updated;
  }

  async rejectReturn(
    id: string,
    dto: ReviewReturnDto,
    userId: string,
    tenantId: string,
    ipAddress?: string,
  ) {
    const ret = await this.prisma.return.findFirst({ where: { id, tenantId } });
    if (!ret) throw new NotFoundException(`Return ${id} not found`);
    if (ret.status !== ReturnStatus.pending) {
      throw new BadRequestException(`Return is already ${ret.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.return.update({
        where: { id },
        data: {
          status: ReturnStatus.rejected,
          reviewedById: userId,
          reviewNotes: dto.reviewNotes,
          resolvedAt: new Date(),
        },
      });

      await tx.inventoryUnit.update({
        where: { id: ret.inventoryUnitId },
        data: { status: UnitStatus.sold },
      });

      return updated;
    });

    this.eventEmitter.emit('return.rejected', {
      returnId: id,
      userId,
      reviewNotes: dto.reviewNotes,
      tenantId,
      ipAddress,
    });

    return updated;
  }

  async deleteReturn(id: string, tenantId: string) {
    const returnRecord = await this.prisma.return.findFirst({
      where: { id, tenantId },
    });
    if (!returnRecord) {
      throw new NotFoundException(`Return ${id} not found`);
    }

    const hoursSinceCreation =
      (Date.now() - returnRecord.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      throw new BadRequestException(
        'Cannot delete returns older than 24 hours',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Revert the inventory unit back to "sold"
      await tx.inventoryUnit.update({
        where: { id: returnRecord.inventoryUnitId },
        data: { status: 'sold' },
      });

      // Delete the return
      const deletedReturn = await tx.return.delete({
        where: { id },
      });

      // Recalculate sale status
      if (deletedReturn.saleId) {
        const remainingReturns = await tx.return.count({
          where: { saleId: deletedReturn.saleId, status: { not: 'rejected' } },
        });
        if (remainingReturns === 0) {
          await tx.sale.update({
            where: { id: deletedReturn.saleId },
            data: { status: 'completed' },
          });
        }
      }

      return deletedReturn;
    });
  }
}
