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
import { SaleStatus, UnitStatus } from '@prisma/client';

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

  async createSale(dto: CreateSaleDto, userId: string, tenantId: string) {
    const uniqueSerials = [...new Set(dto.serials)];
    if (uniqueSerials.length !== dto.serials.length) {
      throw new BadRequestException('Duplicate serial numbers in sale');
    }

    // Auto-upsert customer from name+phone if no explicit customerId
    let resolvedCustomerId = dto.customerId;
    if (!resolvedCustomerId && dto.customerPhone) {
      const customer = await this.prisma.customer.upsert({
        where: {
          tenantId_phone: {
            tenantId,
            phone: dto.customerPhone,
          },
        },
        create: {
          name: dto.customerName ?? dto.customerPhone,
          phone: dto.customerPhone,
          tenantId,
        },
        update: dto.customerName ? { name: dto.customerName } : {},
      });
      resolvedCustomerId = customer.id;
    }

    const units = await this.prisma.inventoryUnit.findMany({
      where: {
        tenantId,
        serialNumber: { in: uniqueSerials },
      },
      include: { product: { select: { sellingPrice: true } } },
    });

    if (units.length !== uniqueSerials.length) {
      const found = units.map((u) => u.serialNumber);
      const missing = uniqueSerials.filter((s) => !found.includes(s));
      throw new NotFoundException(
        `Serial numbers not found: ${missing.join(', ')}`,
      );
    }

    const unavailable = units.filter((u) => u.status !== UnitStatus.in_stock);
    if (unavailable.length > 0) {
      throw new BadRequestException(
        `Units not available: ${unavailable.map((u) => `${u.serialNumber} (${u.status})`).join(', ')}`,
      );
    }

    const subtotal = units.reduce(
      (sum, u) => sum + Number(u.product.sellingPrice),
      0,
    );
    const discount = dto.discountAmount ?? 0;
    const total = subtotal - discount;

    if (total < 0) throw new BadRequestException('Discount exceeds subtotal');

    if (discount > 0) {
      this.eventEmitter.emit('discount.requested', {
        userId,
        amount: discount,
        tenantId,
      });
    }

    // Enforce OTP for discounts above configured threshold
    const settings = await this.prisma.shopSettings.findFirst({
      where: { tenantId },
    });
    const maxNoOtp = Number(settings?.maxDiscountWithoutOtp ?? 500);
    if (discount > maxNoOtp) {
      if (!dto.otpToken) {
        throw new BadRequestException(
          `OTP required for discounts above Rs ${maxNoOtp}. Call /auth/request-otp first.`,
        );
      }
      try {
        this.jwtService.verify(dto.otpToken, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
      } catch {
        throw new BadRequestException('Invalid or expired OTP token');
      }
    }

    const invoiceNumber = this.generateInvoiceNumber();

    const sale = await this.prisma.$transaction(async (tx) => {
      // 1. Strict Concurrency Verification inside transaction lock
      const txUnits = await tx.inventoryUnit.findMany({
        where: {
          tenantId,
          id: { in: units.map((u) => u.id) },
        },
      });

      const unavailableTx = txUnits.filter((u) => u.status !== UnitStatus.in_stock);
      if (unavailableTx.length > 0) {
        throw new ConflictException(
          `Transaction aborted. Serial numbers already sold: ${unavailableTx.map((u) => u.serialNumber).join(', ')}`,
        );
      }

      const created = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: resolvedCustomerId,
          soldById: userId,
          paymentMethod: dto.paymentMethod,
          subtotal,
          discountAmount: discount,
          totalAmount: total,
          tenantId,
          items: {
            create: units.map((u) => ({
              inventoryUnitId: u.id,
              sellingPrice: u.product.sellingPrice,
              discount: 0,
            })),
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

      await tx.inventoryUnit.updateMany({
        where: {
          tenantId,
          id: { in: units.map((u) => u.id) },
        },
        data: { status: UnitStatus.sold },
      });

      return created;
    }, { maxWait: 10000, timeout: 20000 });

    this.eventEmitter.emit('sale.created', {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      totalAmount: Number(sale.totalAmount),
      itemCount: units.length,
      cashierId: userId,
      tenantId,
    });

    if (discount > 0) {
      this.eventEmitter.emit('discount.approved', {
        saleId: sale.id,
        userId,
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
  }

  async listSales(filter: FilterSalesDto, tenantId: string) {
    const {
      search,
      status,
      soldById,
      customerId,
      from,
      to,
      page = 1,
      limit = 50,
    } = filter;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(soldById && { soldById }),
      ...(customerId && { customerId }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to + 'T23:59:59.999Z') }),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                customer: {
                  name: { contains: search, mode: 'insensitive' as const },
                },
              },
              { customer: { phone: { contains: search } } },
            ],
          }
        : {}),
    };

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
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return { data: sales, meta: { total, page, limit } };
  }

  async getSale(id: string, tenantId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            inventoryUnit: {
              select: {
                serialNumber: true,
                condition: true,
                product: {
                  select: { name: true, brand: true, warrantyMonths: true },
                },
              },
            },
          },
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
      tenantId,
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
}
