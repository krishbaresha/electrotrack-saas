import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesSummaryQueryDto } from './dto/sales-summary-query.dto';
import { ReconciliationDto } from './dto/reconciliation.dto';
import { FilterReconciliationDto } from './dto/filter-reconciliation.dto';
import { SaleStatus, UnitStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ─── Sales Summary ────────────────────────────────────────────────────────────

  async salesSummary(query: SalesSummaryQueryDto, tenantId: string) {
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    const start = new Date(date + 'T00:00:00+05:00');
    const end = new Date(date + 'T23:59:59+05:00');
    const expenseStart = new Date(date + 'T00:00:00Z');
    const expenseEnd = new Date(date + 'T00:00:00Z');
    return this.buildSummary(start, end, expenseStart, expenseEnd, date, tenantId);
  }

  async salesSummaryRange(query: SalesSummaryQueryDto, tenantId: string) {
    const from = query.from ?? new Date().toISOString().slice(0, 10);
    const to = query.to ?? from;
    const start = new Date(from + 'T00:00:00+05:00');
    const end = new Date(to + 'T23:59:59+05:00');
    const expenseStart = new Date(from + 'T00:00:00Z');
    const expenseEnd = new Date(to + 'T00:00:00Z');
    return this.buildSummary(start, end, expenseStart, expenseEnd, `${from} to ${to}`, tenantId);
  }

  private async buildSummary(
    start: Date,
    end: Date,
    expenseStart: Date,
    expenseEnd: Date,
    label: string,
    tenantId: string,
  ) {
    const where = {
      tenantId,
      status: { in: [SaleStatus.completed, SaleStatus.partial_return] },
      createdAt: { gte: start, lte: end },
    };

    const [totals, byPayment, items] = await Promise.all([
      this.prisma.sale.aggregate({
        where,
        _count: { id: true },
        _sum: { totalAmount: true, discountAmount: true },
      }),
      this.prisma.sale.groupBy({
        by: ['paymentMethod'],
        where,
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.saleItem.findMany({
        where: {
          sale: {
            tenantId,
            status: { in: [SaleStatus.completed, SaleStatus.partial_return] },
            createdAt: { gte: start, lte: end },
          },
        },
        select: {
          sellingPrice: true,
          inventoryUnit: {
            select: {
              purchasePrice: true,
              product: { select: { id: true, name: true } },
            },
          },
          sale: { select: { isOnline: true } },
        },
      }),
    ]);

    const productMap = new Map<
      string,
      { name: string; units: number; revenue: number; onlineUnits: number }
    >();
    for (const item of items) {
      const pid = item.inventoryUnit.product.id;
      const isOnline = item.sale?.isOnline;
      const entry = productMap.get(pid) ?? {
        name: item.inventoryUnit.product.name,
        units: 0,
        revenue: 0,
        onlineUnits: 0,
      };
      productMap.set(pid, {
        ...entry,
        units: entry.units + 1,
        revenue: entry.revenue + Number(item.sellingPrice),
        onlineUnits: entry.onlineUnits + (isOnline ? 1 : 0),
      });
    }

    const soldProducts = [...productMap.entries()]
      .map(([productId, d]) => ({ productId, ...d }))
      .sort((a, b) => b.revenue - a.revenue);

    let totalCost = 0;
    for (const item of items) {
      const cost =
        item.inventoryUnit.purchasePrice ??
        0;
      totalCost += Number(cost);
    }
    const salesList = await this.prisma.sale.findMany({
      where,
      select: {
        isOnline: true,
        totalAmount: true,
        advanceAmount: true,
        codAmount: true,
        payoutReceivedAt: true,
        discountAmount: true,
      },
    });

    let totalRevenue = 0;
    let totalDiscounts = 0;
    let offlineRevenue = 0;
    let onlineRevenue = 0;
    let offlineSalesCount = 0;
    let onlineSalesCount = 0;

    for (const s of salesList) {
      totalDiscounts += Number(s.discountAmount ?? 0);
      if (s.isOnline) {
        onlineRevenue += Number(s.advanceAmount ?? 0);
        onlineSalesCount += 1;
      } else {
        offlineRevenue += Number(s.totalAmount ?? 0);
        offlineSalesCount += 1;
      }
    }

    // Add Courier Payouts to Revenue for this period
    const payouts = await this.prisma.courierPayout.aggregate({
      where: {
        tenantId,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });
    const courierPayouts = Number(payouts._sum.amount ?? 0);
    onlineRevenue += courierPayouts;

    totalRevenue = offlineRevenue + onlineRevenue;

    const approvedReturns = await this.prisma.return.findMany({
      where: {
        tenantId,
        status: 'approved',
        resolvedAt: { gte: start, lte: end },
      },
      select: {
        refundAmount: true,
        inventoryUnit: {
          select: { purchasePrice: true }
        }
      }
    });

    let totalRefundValue = 0;
    let totalReturnCost = 0;
    for (const r of approvedReturns) {
      totalRefundValue += Number(r.refundAmount ?? 0);
      totalReturnCost += Number(r.inventoryUnit?.purchasePrice ?? 0);
    }
    
    totalRevenue -= totalRefundValue;
    totalCost -= totalReturnCost;

    let totalGrossProfit = totalRevenue - totalCost;

    // Deduct Purchase Order costs (only received POs create expense records)
    const poExpenses = await this.prisma.expense.aggregate({
      where: {
        tenantId,
        category: 'purchase_order',
        date: { gte: expenseStart, lte: expenseEnd },
      },
      _sum: { amount: true },
    });
    const totalPurchaseCost = Number(poExpenses._sum.amount ?? 0);

    // Standard Daily Expenses (excluding POs)
    const standardExpenses = await this.prisma.expense.aggregate({
      where: {
        tenantId,
        category: { not: 'purchase_order' },
        date: { gte: expenseStart, lte: expenseEnd },
      },
      _sum: { amount: true },
    });
    let totalExpenses = Number(standardExpenses._sum.amount ?? 0);

    // Credit Payments Integration
    const creditPayments = await this.prisma.creditPayment.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
      },
      include: { creditRecord: { select: { type: true } } },
    });

    let totalCreditCollected = 0;
    let totalCreditPaid = 0;

    for (const cp of creditPayments) {
      if (cp.creditRecord.type === 'CUSTOMER') {
        totalCreditCollected += Number(cp.amount);
      } else if (cp.creditRecord.type === 'SUPPLIER') {
        totalCreditPaid += Number(cp.amount);
      }
    }

    // Apply logic: Customer owe payments add to Revenue
    totalRevenue += totalCreditCollected;
    // Supplier owe payments add to Expenses
    totalExpenses += totalCreditPaid;

    totalGrossProfit = totalRevenue - totalCost;

    const pendingOnlineOrders = await this.prisma.sale.count({
      where: {
        tenantId,
        isOnline: true,
        shippingStatus: 'pending',
        createdAt: { gte: start, lte: end },
      },
    });

    return {
      period: label,
      totalRevenue,
      totalGrossProfit: totalGrossProfit - totalPurchaseCost,
      totalPurchaseCost,
      totalExpenses,
      netProfit: totalGrossProfit - totalPurchaseCost - totalExpenses,
      totalSales: totals._count.id,
      totalItems: items.length,
      totalDiscounts,
      offlineRevenue,
      onlineRevenue,
      courierPayouts,
      totalCreditCollected,
      totalCreditPaid,
      onlineSalesCount,
      offlineSalesCount,
      pendingOnlineOrders,
      byPaymentMethod: byPayment.map((g) => ({
        method: g.paymentMethod,
        count: g._count.id,
        revenue: Number(g._sum.totalAmount ?? 0),
      })),
      soldProducts,
    };
  }

  // ─── Stock Valuation ──────────────────────────────────────────────────────────

  async stockValuation(tenantId: string) {
    // Compute totals via aggregation (O(1) DB, no memory spike)
    const [costAgg, inStockByProduct] = await Promise.all([
      this.prisma.inventoryUnit.aggregate({
        where: { status: UnitStatus.in_stock, tenantId },
        _sum: { purchasePrice: true },
        _count: { id: true },
      }),
      // Per-product in-stock counts for retail value and breakdown
      this.prisma.inventoryUnit.groupBy({
        by: ['productId'],
        where: { status: UnitStatus.in_stock, tenantId },
        _count: { id: true },
        _sum: { purchasePrice: true },
      }),
    ]);

    // Fetch product info only for products that have in-stock units
    const productIds = inStockByProduct.map((r) => r.productId);
    const products =
      productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
              id: true,
              name: true,
              brand: true,
              category: true,
              sellingPrice: true,
            },
          })
        : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    const breakdown = inStockByProduct
      .map((row) => {
        const product = productMap.get(row.productId);
        if (!product) return null;
        const inStockCount = row._count.id;
        const costValue = Number(row._sum.purchasePrice ?? 0);
        const sellingValue = Number(product.sellingPrice) * inStockCount;
        return {
          productId: row.productId,
          productName: product.name,
          brand: product.brand,
          category: product.category,
          inStockCount,
          costValue,
          sellingValue,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.sellingValue - a.sellingValue);

    const totalCostValue = Number(costAgg._sum.purchasePrice ?? 0);
    const totalSellingValue = breakdown.reduce((s, p) => s + p.sellingValue, 0);

    return {
      totalUnits: costAgg._count.id,
      totalCostValue,
      totalSellingValue,
      potentialProfit: totalSellingValue - totalCostValue,
      breakdown,
    };
  }

  // ─── Low-Stock Report ─────────────────────────────────────────────────────────

  async lowStockReport(tenantId: string) {
    const settings = await this.prisma.shopSettings.findFirst({
      where: { tenantId },
    });
    const threshold = settings?.lowStockThreshold ?? 2;

    const products = await this.prisma.product.findMany({
      where: { isActive: true, tenantId },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        sellingPrice: true,
        _count: {
          select: {
            inventoryUnits: {
              where: { status: UnitStatus.in_stock, tenantId },
            },
          },
        },
      },
    });

    const lowStock = products
      .filter((p) => p._count.inventoryUnits <= threshold)
      .map((p) => ({
        productId: p.id,
        productName: p.name,
        brand: p.brand,
        category: p.category,
        inStockCount: p._count.inventoryUnits,
        sellingPrice: Number(p.sellingPrice),
      }))
      .sort((a, b) => a.inStockCount - b.inStockCount);

    return { threshold, products: lowStock };
  }

  // ─── Cash Reconciliation ──────────────────────────────────────────────────────

  async getTodayReconciliationState(tenantId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const start = new Date(today + 'T00:00:00+05:00');
    const end = new Date(today + 'T23:59:59+05:00');
    const expenseDate = new Date(today + 'T00:00:00Z');

    // 1. Get latest actual cash from previous reconciliations
    const lastRecon = await this.prisma.cashReconciliation.findFirst({
      where: { tenantId, date: { lt: expenseDate } },
      orderBy: { date: 'desc' },
    });
    const defaultOpeningBalance = lastRecon?.actualCash
      ? Number(lastRecon.actualCash)
      : 0;

    // 2. Get today's cash sales
    const cashSales = await this.prisma.sale.aggregate({
      where: {
        tenantId,
        status: SaleStatus.completed,
        paymentMethod: PaymentMethod.cash,
        isOnline: false,
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
    });
    const totalCashSales = Number(cashSales._sum.totalAmount ?? 0);

    // 3. Get today's expenses
    const expenses = await this.prisma.expense.aggregate({
      where: {
        tenantId,
        date: { gte: expenseDate, lte: expenseDate },
      },
      _sum: { amount: true },
    });
    const totalOutflows = Number(expenses._sum.amount ?? 0);

    return {
      defaultOpeningBalance,
      cashSales: totalCashSales,
      totalOutflows,
      expectedCash: defaultOpeningBalance + totalCashSales - totalOutflows,
    };
  }

  async submitReconciliation(
    dto: ReconciliationDto,
    userId: string,
    tenantId: string,
  ) {
    const start = new Date(dto.date + 'T00:00:00+05:00');
    const end = new Date(dto.date + 'T23:59:59+05:00');
    const expenseDate = new Date(dto.date + 'T00:00:00Z');

    const cashSales = await this.prisma.sale.aggregate({
      where: {
        tenantId,
        status: SaleStatus.completed,
        paymentMethod: PaymentMethod.cash,
        isOnline: false,
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
    });

    const expenses = await this.prisma.expense.aggregate({
      where: {
        tenantId,
        date: { gte: expenseDate, lte: expenseDate },
      },
      _sum: { amount: true },
    });

    const cashIn = Number(cashSales._sum.totalAmount ?? 0);
    const outflows = Number(expenses._sum.amount ?? 0);
    const expectedCash = dto.openingBalance + cashIn - outflows;
    const variance = dto.actualCash - expectedCash;

    // Handle Opening Balance Adjustment
    const lastRecon = await this.prisma.cashReconciliation.findFirst({
      where: { tenantId, date: { lt: expenseDate } },
      orderBy: { date: 'desc' },
    });
    const prevClosing = lastRecon?.actualCash
      ? Number(lastRecon.actualCash)
      : 0;

    if (dto.openingBalance < prevClosing) {
      await this.prisma.expense.create({
        data: {
          amount: prevClosing - dto.openingBalance,
          category: 'adjustment',
          description: `Opening balance adjustment: ${dto.notes || 'No reason provided'}`,
          date: new Date(dto.date),
          createdById: userId,
          tenantId,
        },
      });
    }

    const record = await this.prisma.cashReconciliation.create({
      data: {
        date: new Date(dto.date),
        openingBalance: dto.openingBalance,
        expectedCash,
        actualCash: dto.actualCash,
        variance,
        submittedById: userId,
        notes: dto.notes,
        tenantId,
      },
      include: { submittedBy: { select: { id: true, name: true } } },
    });

    this.eventEmitter.emit('cash.submitted', {
      date: dto.date,
      expected: expectedCash,
      actual: dto.actualCash,
      variance,
      tenantId,
    });

    return record;
  }

  // ─── Staff Performance ────────────────────────────────────────────────────────

  async staffPerformance(from?: string, to?: string, tenantId?: string) {
    const start = from ? new Date(from + 'T00:00:00+05:00') : undefined;
    const end = to ? new Date(to + 'T23:59:59+05:00') : undefined;
    const dateFilter = start || end ? { gte: start, lte: end } : undefined;

    const sales = await this.prisma.sale.findMany({
      where: {
        status: SaleStatus.completed,
        tenantId,
        ...(dateFilter && { createdAt: dateFilter }),
      },
      select: {
        soldById: true,
        totalAmount: true,
        soldBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    });

    const staffMap = new Map<
      string,
      { name: string; totalSales: number; totalRevenue: number }
    >();
    for (const sale of sales) {
      const id = sale.soldById;
      if (!id || !sale.soldBy) {
        continue;
      }
      const entry = staffMap.get(id) ?? {
        name: sale.soldBy.name,
        totalSales: 0,
        totalRevenue: 0,
      };
      staffMap.set(id, {
        ...entry,
        totalSales: entry.totalSales + 1,
        totalRevenue: entry.totalRevenue + Number(sale.totalAmount),
      });
    }

    return [...staffMap.entries()].map(([staffId, d]) => ({
      staffId,
      staffName: d.name,
      totalSales: d.totalSales,
      totalRevenue: d.totalRevenue,
      avgTransactionValue: d.totalSales > 0 ? d.totalRevenue / d.totalSales : 0,
    }));
  }

  // ─── Top Products ─────────────────────────────────────────────────────────────

  async topProducts(limit = 10, from?: string, to?: string, tenantId?: string) {
    const start = from ? new Date(from + 'T00:00:00+05:00') : undefined;
    const end = to ? new Date(to + 'T23:59:59+05:00') : undefined;
    const dateFilter = start || end ? { gte: start, lte: end } : undefined;

    const items = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          tenantId,
          status: SaleStatus.completed,
          ...(dateFilter && { createdAt: dateFilter }),
        },
      },
      select: {
        sellingPrice: true,
        inventoryUnit: {
          select: {
            product: { select: { id: true, name: true, brand: true } },
          },
        },
      },
    });

    const productMap = new Map<
      string,
      { name: string; brand: string | null; unitsSold: number; revenue: number }
    >();
    for (const item of items) {
      const pid = item.inventoryUnit.product.id;
      const entry = productMap.get(pid) ?? {
        name: item.inventoryUnit.product.name,
        brand: item.inventoryUnit.product.brand,
        unitsSold: 0,
        revenue: 0,
      };
      productMap.set(pid, {
        ...entry,
        unitsSold: entry.unitsSold + 1,
        revenue: entry.revenue + Number(item.sellingPrice),
      });
    }

    return [...productMap.entries()]
      .map(([productId, d]) => ({ productId, ...d }))
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, limit);
  }

  // ─── Dead Stock ───────────────────────────────────────────────────────────────

  async deadStock(days = 60, tenantId: string) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const units = await this.prisma.inventoryUnit.findMany({
      where: {
        status: UnitStatus.in_stock,
        receivedAt: { lte: cutoff },
        tenantId,
      },
      select: {
        id: true,
        serialNumber: true,
        condition: true,
        receivedAt: true,
        product: {
          select: { id: true, name: true, brand: true, category: true },
        },
      },
      orderBy: { receivedAt: 'asc' },
    });

    const now = new Date();
    return units.map((u) => ({
      unitId: u.id,
      serialNumber: u.serialNumber,
      condition: u.condition,
      productId: u.product.id,
      productName: u.product.name,
      brand: u.product.brand,
      category: u.product.category,
      receivedAt: u.receivedAt,
      daysInStock: Math.floor(
        (now.getTime() - u.receivedAt.getTime()) / 86_400_000,
      ),
    }));
  }

  // ─── Return Analytics ─────────────────────────────────────────────────────────

  async returnAnalytics(from?: string, to?: string, tenantId?: string) {
    const start = from ? new Date(from + 'T00:00:00+05:00') : undefined;
    const end = to ? new Date(to + 'T23:59:59+05:00') : undefined;
    const dateFilter = start || end ? { gte: start, lte: end } : undefined;

    const returns = await this.prisma.return.findMany({
      where: {
        tenantId,
        ...(dateFilter && { createdAt: dateFilter }),
      },
      select: {
        reason: true,
        refundAmount: true,
        suspiciousFlag: true,
        inventoryUnit: {
          select: { product: { select: { id: true, name: true } } },
        },
        sale: {
          select: {
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });

    // Also fetch returned online orders
    const returnedOnlineSales = await this.prisma.sale.findMany({
      where: {
        tenantId,
        isOnline: true,
        status: SaleStatus.voided,
        shippingStatus: 'returned',
        ...(dateFilter && { createdAt: dateFilter }),
      },
      select: {
        totalAmount: true,
        customer: { select: { id: true, name: true, phone: true } },
        items: {
          select: {
            inventoryUnit: {
              select: { product: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    let totalRefundValue = returns.reduce(
      (s, r) => s + Number(r.refundAmount ?? 0),
      0,
    );

    const productMap = new Map<string, { name: string; count: number }>();
    const reasonMap = new Map<string, number>();
    const customerMap = new Map<
      string,
      { name: string; phone: string; count: number }
    >();

    for (const r of returns) {
      const pid = r.inventoryUnit.product.id;
      const pname = r.inventoryUnit.product.name;
      const prev = productMap.get(pid) ?? { name: pname, count: 0 };
      productMap.set(pid, { ...prev, count: prev.count + 1 });

      const reason = r.reason ?? 'unspecified';
      reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);

      if (r.suspiciousFlag && r.sale?.customer) {
        const cid = r.sale.customer.id;
        const cprev = customerMap.get(cid) ?? {
          name: r.sale.customer.name,
          phone: r.sale.customer.phone,
          count: 0,
        };
        customerMap.set(cid, { ...cprev, count: cprev.count + 1 });
      }
    }

    // Process online returned sales
    for (const s of returnedOnlineSales) {
      totalRefundValue += Number(s.totalAmount ?? 0);
      reasonMap.set('courier_return', (reasonMap.get('courier_return') ?? 0) + s.items.length);
      
      for (const item of s.items) {
        if (!item.inventoryUnit) continue;
        const pid = item.inventoryUnit.product.id;
        const pname = item.inventoryUnit.product.name;
        const prev = productMap.get(pid) ?? { name: pname, count: 0 };
        productMap.set(pid, { ...prev, count: prev.count + 1 });
      }
    }

    return {
      totalReturns: returns.length + returnedOnlineSales.length,
      totalRefundValue,
      mostReturnedProducts: [...productMap.entries()]
        .map(([productId, d]) => ({
          productId,
          productName: d.name,
          returnCount: d.count,
        }))
        .sort((a, b) => b.returnCount - a.returnCount)
        .slice(0, 10),
      returnReasons: [...reasonMap.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
      suspiciousReturnCustomers: [...customerMap.entries()]
        .map(([customerId, d]) => ({
          customerId,
          customerName: d.name,
          phone: d.phone,
          returnCount: d.count,
        }))
        .sort((a, b) => b.returnCount - a.returnCount),
    };
  }

  async reviewReconciliation(id: string, reviewerId: string, tenantId: string) {
    const record = await this.prisma.cashReconciliation.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException(`Reconciliation not found`);

    return this.prisma.cashReconciliation.update({
      where: { id },
      data: { reviewedById: reviewerId },
      include: {
        submittedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
  }

  async listReconciliations(filter: FilterReconciliationDto, tenantId: string) {
    const { from, to, page = 1, limit = 50 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(from || to
        ? {
            date: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.cashReconciliation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          submittedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.cashReconciliation.count({ where }),
    ]);

    return { data: records, meta: { total, page, limit } };
  }

  async deleteReconciliation(id: string, tenantId: string) {
    const record = await this.prisma.cashReconciliation.findUnique({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Reconciliation not found');

    const today = new Date();
    const isToday =
      record.date.getFullYear() === today.getFullYear() &&
      record.date.getMonth() === today.getMonth() &&
      record.date.getDate() === today.getDate();

    if (!isToday) {
      throw new BadRequestException(
        'You can only delete reconciliation records for today.',
      );
    }

    return this.prisma.cashReconciliation.delete({
      where: { id, tenantId },
    });
  }
}
