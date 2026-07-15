import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { VoidSaleDto } from './dto/void-sale.dto';
import { FilterSalesDto } from './dto/filter-sales.dto';
import { UpsertCustomerDto } from './dto/upsert-customer.dto';
import { Prisma, SaleStatus, UnitStatus } from '@prisma/client';

@Injectable()
export class SalesService {
  private readonly stockLowThreshold: number;

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {
    this.stockLowThreshold = parseInt(
      configService.get('STOCK_LOW_THRESHOLD', '3'),
    );
  }

  async createSale(
    dto: CreateSaleDto,
    cashierId: string,
    tenantId: string,
    ipAddress?: string,
  ) {
    // 1. Scenario E: Idempotency catch block — idempotencyKey field removed from schema
    try {
      // 2. Scenario C: Session validation — cashDrawerSession removed, skip session logic

      // 3. Scenario D: Custom Pricing Authorization
      const user = await this.prisma.user.findUnique({
        where: { id: cashierId },
      });
      const canOverridePrice =
        user?.role === 'owner' ||
        user?.role === 'platform_admin' ||
        user?.role === 'inventory_manager';

      const serialCounts = dto.serials.reduce(
        (acc, serial) => {
          acc[serial] = (acc[serial] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Auto-upsert customer from name+phone if no explicit customerId
      let resolvedCustomerId = dto.customerId;
      if (!resolvedCustomerId && dto.customerPhone) {
        const customer = await this.prisma.customer.upsert({
          where: { tenantId_phone: { tenantId, phone: dto.customerPhone } },
          create: {
            name: dto.customerName ?? dto.customerPhone,
            phone: dto.customerPhone,
            tenantId,
          },
          update: dto.customerName ? { name: dto.customerName } : {},
        });
        resolvedCustomerId = customer.id;
      }

      const invoiceNumber = this.generateInvoiceNumber();

      const txResult = await this.prisma.$transaction(
        async (tx) => {
          const allSelectedUnits: {
            id: string;
            serialNumber: string;
            productId: string;
          }[] = [];

          for (const [serial, count] of Object.entries(serialCounts)) {
            // Scenario B (Generic Pool) & A (Race Condition): Select exact 'count' of available rows, lock them using updateMany
            const availableUnits = await tx.inventoryUnit.findMany({
              where: {
                tenantId,
                serialNumber: serial,
                status: UnitStatus.in_stock,
              },
              take: count,
              select: { id: true, serialNumber: true, productId: true },
            });

            if (availableUnits.length < count) {
              throw new ConflictException(
                `Stock exhaustion for serial/generic: ${serial}`,
              );
            }

            const unitIds = availableUnits.map((u) => u.id);

            // Scenario A: Atomic decrement/status update
            const updateResult = await tx.inventoryUnit.updateMany({
              where: {
                tenantId,
                id: { in: unitIds },
                status: UnitStatus.in_stock,
              },
              data: { status: UnitStatus.sold },
            });

            if (updateResult.count !== count) {
              throw new ConflictException(
                `Race condition detected for ${serial}. Item claimed by another transaction.`,
              );
            }

            allSelectedUnits.push(...availableUnits);
          }

          // Fetch product prices
          const products = await tx.product.findMany({
            where: {
              id: {
                in: [...new Set(allSelectedUnits.map((u) => u.productId))],
              },
            },
            select: { id: true, sellingPrice: true },
          });
          const productPriceMap = new Map(
            products.map((p) => [p.id, Number(p.sellingPrice)]),
          );

          let subtotal = 0;
          const saleItemsData = allSelectedUnits.map((u) => {
            const defaultPrice = productPriceMap.get(u.productId) ?? 0;
            const finalPrice =
              canOverridePrice && dto.customPrices?.[u.serialNumber]
                ? dto.customPrices[u.serialNumber]
                : defaultPrice;
            subtotal += finalPrice;
            return {
              inventoryUnitId: u.id,
              sellingPrice: finalPrice,
              discount: 0,
            };
          });

          const discount = dto.discountAmount ?? 0;
          const deliveryCharge = dto.deliveryCharge ?? 0;
          const additionalCharges = dto.additionalCharges ?? 0;
          const total =
            subtotal - discount + deliveryCharge + additionalCharges;

          if (total < 0)
            throw new BadRequestException('Discount exceeds subtotal');

          const created = await tx.sale.create({
            data: {
              invoiceNumber,
              customerId: resolvedCustomerId,
              soldById: cashierId,
              paymentMethod: dto.paymentMethod,
              subtotal,
              discountAmount: discount,
              totalAmount: total,
              tenantId,
              isOnline: dto.isOnline ?? false,
              customerCity: dto.customerCity,
              trackingId: dto.trackingId,
              deliveryCharge,
              additionalCharges,
              description: dto.description,
              advanceAmount: dto.advanceAmount ?? 0,
              codAmount: dto.codAmount ?? 0,
              items: {
                create: saleItemsData,
              },
            },
            include: {
              items: {
                include: {
                  inventoryUnit: {
                    select: {
                      serialNumber: true,
                      product: { select: { name: true, brand: true } },
                    },
                  },
                },
              },
              customer: { select: { id: true, name: true, phone: true } },
              soldBy: { select: { id: true, name: true } },
            },
          });

          return { created, allSelectedUnits, discount };
        },
        { maxWait: 10000, timeout: 20000 },
      );

      const sale = txResult.created;
      const units = txResult.allSelectedUnits;
      const discount = txResult.discount;

      this.eventEmitter.emit('sale.created', {
        id: sale.id,
        cashierId,
        totalAmount: Number(sale.totalAmount),
        itemCount: units.length,
        paymentMethod: sale.paymentMethod,
        tenantId,
        ipAddress,
        isOnline: sale.isOnline,
        shippingStatus: sale.shippingStatus,
      });

      if (discount > 0) {
        this.eventEmitter.emit('discount.approved', {
          saleId: sale.id,
          userId: cashierId,
          amount: discount,
          tenantId,
        });
      }

      const productIds = [...new Set(units.map((u) => u.productId))];
      for (const productId of productIds) {
        const stockCount = await this.prisma.inventoryUnit.count({
          where: { productId, status: UnitStatus.in_stock, tenantId },
        });
        if (stockCount <= this.stockLowThreshold) {
          const product = await this.prisma.product.findFirst({
            where: { id: productId, tenantId },
            select: { name: true },
          });
          this.eventEmitter.emit('stock.low', {
            productId,
            productName: product?.name ?? 'Unknown',
            stockCount,
            tenantId,
          });
        }
      }

      return sale;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Unique constraint violation — fall through and let caller retry
        throw error;
      }
      throw error;
    }
  }

  async listSales(dto: FilterSalesDto, tenantId: string) {
    const {
      search,
      status,
      isOnline,
      shippingStatus,
      soldById,
      customerId,
      from,
      to,
      page = 1,
      limit = 50,
    } = dto;
    const skip = (page - 1) * limit;

    const conditions: Prisma.SaleWhereInput[] = [{ tenantId }];

    if (status) conditions.push({ status });
    if (shippingStatus) conditions.push({ shippingStatus });
    if (soldById) conditions.push({ soldById });
    if (customerId) conditions.push({ customerId });
    if (from || to) {
      conditions.push({
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to + 'T23:59:59.999Z') }),
        },
      });
    }

    if (isOnline !== undefined) {
      conditions.push({ isOnline });
    } else {
      conditions.push({
        OR: [
          { isOnline: false },
          { isOnline: true, shippingStatus: { in: ['delivered', 'returned'] } },
        ],
      });
    }

    if (search) {
      conditions.push({
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
          {
            customer: {
              name: { contains: search, mode: 'insensitive' as const },
            },
          },
          { customer: { phone: { contains: search } } },
        ],
      });
    }

    const where: Prisma.SaleWhereInput = { AND: conditions };

    const [sales, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          soldBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
          returns: {
            where: { status: 'approved' },
            select: { id: true },
          },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return { data: sales, meta: { total, page, limit } };
  }

  async deleteSale(id: string, tenantId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);

    // Check if within 24 hours
    const hoursSinceCreation =
      (Date.now() - sale.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      throw new BadRequestException('Cannot delete sales older than 24 hours');
    }

    const unitIds = sale.items.map((i) => i.inventoryUnitId);

    return this.prisma.$transaction(async (tx) => {
      // Restore inventory units to 'in_stock'
      await tx.inventoryUnit.updateMany({
        where: { tenantId, id: { in: unitIds } },
        data: { status: 'in_stock' },
      });

      // Delete the sale (cascades to sale_items, etc.)
      const deleted = await tx.sale.delete({
        where: { id },
      });
      return deleted;
    });
  }

  async getSale(id: string, tenantId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            inventoryUnit: {
              select: {
                id: true,
                serialNumber: true,
                condition: true,
                product: {
                  select: { name: true, brand: true, warrantyMonths: true },
                },
              },
            },
          },
        },
        returns: {
          where: { status: 'approved' },
          select: { inventoryUnitId: true },
        },
        customer: true,
        soldBy: { select: { id: true, name: true } },
      },
    });
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return sale;
  }

  async lookupByInvoice(invoiceNumber: string, tenantId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { invoiceNumber, tenantId },
      include: {
        items: {
          include: {
            inventoryUnit: {
              select: {
                id: true,
                serialNumber: true,
                status: true,
                product: { select: { id: true, name: true, brand: true } },
              },
            },
          },
        },
        returns: {
          where: { status: 'approved' },
          select: { inventoryUnitId: true },
        },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!sale)
      throw new NotFoundException(`Invoice "${invoiceNumber}" not found`);
    return sale;
  }

  async voidSale(
    id: string,
    dto: VoidSaleDto,
    userId: string,
    tenantId: string,
    ipAddress?: string,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    if (sale.status === SaleStatus.voided) {
      throw new BadRequestException('Sale is already voided');
    }

    const unitIds = sale.items.map((i) => i.inventoryUnitId);

    const voided = await this.prisma.$transaction(async (tx) => {
      const voided = await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.voided,
          voidReason: dto.reason,
          voidedById: userId,
        },
        include: { items: true },
      });

      await tx.inventoryUnit.updateMany({
        where: {
          tenantId,
          id: { in: unitIds },
        },
        data: { status: UnitStatus.in_stock },
      });

      return voided;
    });

    this.eventEmitter.emit('sale.voided', {
      saleId: id,
      userId,
      reason: dto.reason,
      tenantId,
      ipAddress,
    });

    return voided;
  }

  async upsertCustomer(dto: UpsertCustomerDto, tenantId: string) {
    return this.prisma.customer.upsert({
      where: {
        tenantId_phone: {
          tenantId,
          phone: dto.phone,
        },
      },
      create: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        tenantId,
      },
      update: { name: dto.name, email: dto.email },
    });
  }

  async getCustomers(search: string | undefined, tenantId: string) {
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { phone: { contains: search } },
                { name: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        sales: {
          where: { tenantId, status: { not: 'voided' as const } },
          select: { id: true, totalAmount: true, createdAt: true },
        },
      },
      orderBy: { name: 'asc' },
      take: search ? 20 : 100,
    });
  }

  private generateInvoiceNumber(): string {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const tick = now.getTime().toString(36).toUpperCase().slice(-6);
    return `INV-${date}-${tick}`;
  }

  async dispatchSale(
    id: string,
    trackingId: string,
    tenantId: string,
    userId: string,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (!sale.isOnline) throw new BadRequestException('Not an online sale');

    // Create an expense for the delivery charge if there is one
    if (sale.deliveryCharge && sale.deliveryCharge.toNumber() > 0) {
      await this.prisma.expense.create({
        data: {
          tenantId,
          createdById: userId,
          amount: sale.deliveryCharge,
          category: 'Courier Delivery',
          description: `Delivery charge for online order #${sale.invoiceNumber}`,
          date: new Date(),
        },
      });
    }

    return this.prisma.sale.update({
      where: { id },
      data: {
        trackingId,
        shippingStatus: 'dispatched',
      },
    });
  }

  async markDelivered(id: string, tenantId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (!sale.isOnline) throw new BadRequestException('Not an online sale');

    return this.prisma.sale.update({
      where: { id },
      data: {
        shippingStatus: 'delivered',
      },
    });
  }

  async getCourierLedger(tenantId: string) {
    const deliveredSales = await this.prisma.sale.aggregate({
      where: { tenantId, isOnline: true, shippingStatus: 'delivered' },
      _sum: { codAmount: true },
    });
    const payouts = await this.prisma.courierPayout.aggregate({
      where: { tenantId },
      _sum: { amount: true },
    });
    const totalDeliveredCod = Number(deliveredSales._sum.codAmount ?? 0);
    const totalPayouts = Number(payouts._sum.amount ?? 0);
    return {
      totalDeliveredCod,
      totalPayouts,
      dueFromCouriers: totalDeliveredCod - totalPayouts,
    };
  }

  async recordCourierPayout(
    tenantId: string,
    userId: string,
    amount: number,
    courierName: string,
    date: string,
  ) {
    return this.prisma.courierPayout.create({
      data: {
        tenantId,
        createdById: userId,
        amount,
        courierName,
        date: new Date(date),
      },
    });
  }

  async returnOnlineOrder(
    id: string,
    refundLossAmount: number,
    tenantId: string,
    userId: string,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (!sale.isOnline) throw new BadRequestException('Not an online sale');

    // Return the items to stock
    const itemIds = sale.items.map((i) => i.inventoryUnitId);
    await this.prisma.inventoryUnit.updateMany({
      where: { id: { in: itemIds }, tenantId },
      data: { status: 'in_stock' },
    });

    // Void the sale to remove it from regular revenue completely
    await this.prisma.sale.update({
      where: { id },
      data: {
        status: 'voided',
        shippingStatus: 'returned',
        refundLossAmount,
        voidReason: 'Online order returned by courier',
        voidedById: userId,
      },
    });

    // Record the loss as an expense if applicable
    if (refundLossAmount > 0) {
      await this.prisma.expense.create({
        data: {
          tenantId,
          createdById: userId,
          amount: refundLossAmount,
          category: 'Courier Return Loss',
          description: `Wasted delivery/return charge for online order #${sale.invoiceNumber}`,
          date: new Date(),
        },
      });
    }

    return { success: true };
  }
}
