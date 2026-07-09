import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { BulkCreateUnitsDto } from './dto/bulk-create-units.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { FilterUnitsDto } from './dto/filter-units.dto';
import { UnitStatus } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ─── Products ────────────────────────────────────────────────────────────────

  async listProducts(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            inventoryUnits: {
              where: { status: UnitStatus.in_stock, tenantId },
            },
          },
        },
      },
    });

    return products.map((p) => ({
      ...p,
      stockCount: p._count.inventoryUnits,
      _count: undefined,
    }));
  }

  async listCategories(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { tenantId, isActive: true, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category as string);
  }

  async getDashboard(tenantId: string) {
    // 1. Fetch lowStockThreshold from ShopSettings (default 2 if not configured)
    const settings = await this.prisma.shopSettings.findFirst({
      where: { tenantId },
      select: { lowStockThreshold: true },
    });
    const lowStockThreshold = settings?.lowStockThreshold ?? 2;

    // 2. Fetch all active products
    const products = await this.prisma.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Fetch per-product unit status counts via groupBy
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const unitCounts = await this.prisma.inventoryUnit.groupBy({
      by: ['productId', 'status'],
      where: { tenantId },
      _count: { id: true },
    });

    // 4. Build Map<productId, { in_stock, sold, returned }>
    const countMap = new Map<
      string,
      { in_stock: number; sold: number; returned: number }
    >();
    for (const row of unitCounts) {
      const entry = countMap.get(row.productId) ?? {
        in_stock: 0,
        sold: 0,
        returned: 0,
      };
      if (row.status === UnitStatus.in_stock) {
        entry.in_stock = row._count.id;
      } else if (row.status === UnitStatus.sold) {
        entry.sold = row._count.id;
      } else if (row.status === UnitStatus.returned) {
        entry.returned = row._count.id;
      }
      countMap.set(row.productId, entry);
    }

    // 5. Fetch sold counts for last 30 days only (for fastSelling)
    const recentSoldCounts = await this.prisma.inventoryUnit.groupBy({
      by: ['productId'],
      where: {
        tenantId,
        status: UnitStatus.sold,
        saleItems: {
          some: {
            sale: { createdAt: { gte: thirtyDaysAgo } },
          },
        },
      },
      _count: { id: true },
    });
    const recentSoldMap = new Map<string, number>(
      recentSoldCounts.map((r) => [r.productId, r._count.id]),
    );

    // 6. Build ProductCard shape for each product
    interface ProductCard {
      id: string;
      name: string;
      brand: string | null;
      category: string | null;
      sellingPrice: number;
      inStockCount: number;
      soldCount: number;
      returnedCount: number;
    }

    const cards: ProductCard[] = products.map((p) => {
      const counts = countMap.get(p.id) ?? {
        in_stock: 0,
        sold: 0,
        returned: 0,
      };
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        sellingPrice: Number(p.sellingPrice),
        inStockCount: counts.in_stock,
        soldCount: counts.sold,
        returnedCount: counts.returned,
      };
    });

    // 7. Derive dashboard slices
    const categories = [
      ...new Set(
        products.map((p) => p.category).filter((c): c is string => c !== null),
      ),
    ].sort();

    const lowStock = cards.filter((c) => c.inStockCount <= lowStockThreshold);

    const createdAtMap = new Map(
      products.map((p) => [p.id, p.createdAt.getTime()]),
    );
    const recentlyAdded = [...cards]
      .sort(
        (a, b) => (createdAtMap.get(b.id) ?? 0) - (createdAtMap.get(a.id) ?? 0),
      )
      .slice(0, 6);

    const fastSelling = [...cards]
      .sort(
        (a, b) =>
          (recentSoldMap.get(b.id) ?? 0) - (recentSoldMap.get(a.id) ?? 0),
      )
      .slice(0, 6);

    // 8. Aggregate stats
    const totalInStock = cards.reduce((s, c) => s + c.inStockCount, 0);
    const totalSold = cards.reduce((s, c) => s + c.soldCount, 0);

    return {
      categories,
      lowStock,
      recentlyAdded,
      fastSelling,
      stats: {
        totalProducts: cards.length,
        totalInStock,
        totalSold,
        totalLowStock: lowStock.length,
      },
    };
  }

  async createProduct(dto: CreateProductDto, userId: string, tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const duplicateConditions: any[] = [{ name: dto.name }];
      if (dto.sku) {
        duplicateConditions.push({ sku: dto.sku });
      }

      const existingProduct = await tx.product.findFirst({
        where: {
          tenantId,
          OR: duplicateConditions,
        },
      });

      if (existingProduct) {
        throw new ConflictException(
          'A product with this name or SKU already exists in your store inventory.',
        );
      }

      return tx.product.create({
        data: {
          name: dto.name,
          sku: dto.sku,
          brand: dto.brand,
          category: dto.category,
          description: dto.description,
          shortDescription: dto.shortDescription,
          aiSummary: dto.aiSummary,
          imageUrl: dto.imageUrl,
          tags: dto.tags ?? [],
          specifications: dto.specifications ?? undefined,
          sellingPrice: dto.sellingPrice,
          costPrice: dto.costPrice,
          comparePrice: dto.comparePrice,
          warrantyMonths: dto.warrantyMonths ?? 0,
          createdById: userId,
          tenantId,
        },
      });
    });
  }

  async enrichProduct(id: string, tenantId: string) {
    const product = await this.findProductOrThrow(id, tenantId);
    const result = await this.aiService.enrichProduct({
      name: product.name,
      brand: product.brand,
      category: product.category,
      specifications: product.specifications as Record<string, string> | null,
    });
    if (!result)
      return { message: 'AI enrichment unavailable — GROQ_API_KEY not set' };
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        shortDescription: result.shortDescription,
        aiSummary: result.aiSummary,
        tags: result.tags,
        category: result.category,
      },
    });
    return updated;
  }

  async updateProduct(id: string, dto: UpdateProductDto, tenantId: string) {
    await this.findProductOrThrow(id, tenantId);
    return this.prisma.product.update({ where: { id }, data: { ...dto } });
  }

  async getProduct(id: string, tenantId: string) {
    const product = await this.findProductOrThrow(id, tenantId);
    const stockCount = await this.prisma.inventoryUnit.count({
      where: { productId: id, status: UnitStatus.in_stock, tenantId },
    });
    return { ...product, stockCount };
  }

  private async findProductOrThrow(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  // ─── Units ───────────────────────────────────────────────────────────────────

  async listUnits(filter: FilterUnitsDto, tenantId: string) {
    const { status, productId, condition, page = 1, limit = 50 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(productId && { productId }),
      ...(condition && { condition }),
    };

    const [units, total] = await this.prisma.$transaction([
      this.prisma.inventoryUnit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receivedAt: 'desc' },
        include: {
          product: {
            select: { id: true, name: true, brand: true, sellingPrice: true },
          },
        },
      }),
      this.prisma.inventoryUnit.count({ where }),
    ]);

    return { data: units, meta: { total, page, limit } };
  }

  async lookupBySerial(
    serialNumber: string,
    tenantId: string,
    anyStatus = false,
  ) {
    const unit = await this.prisma.inventoryUnit.findUnique({
      where: {
        tenantId_serialNumber: {
          tenantId,
          serialNumber,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            category: true,
            sellingPrice: true,
            warrantyMonths: true,
          },
        },
        saleItems: {
          take: 1,
          orderBy: { sale: { createdAt: 'desc' } },
          include: {
            sale: {
              select: { createdAt: true },
            },
          },
        },
      },
    });

    if (!unit)
      throw new NotFoundException(`Serial number "${serialNumber}" not found`);

    if (!anyStatus && unit.status !== UnitStatus.in_stock) {
      throw new BadRequestException(
        `Unit "${serialNumber}" is not available — current status: ${unit.status}`,
      );
    }

    // Attach soldAt from the most recent sale for warranty calculation
    const soldAt = unit.saleItems[0]?.sale?.createdAt ?? null;

    const { saleItems: _si, ...unitWithoutSaleItems } = unit;
    return { ...unitWithoutSaleItems, soldAt };
  }

  async createUnit(dto: CreateUnitDto, userId: string, tenantId: string) {
    const existing = await this.prisma.inventoryUnit.findUnique({
      where: {
        tenantId_serialNumber: {
          tenantId,
          serialNumber: dto.serialNumber,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Serial number "${dto.serialNumber}" already exists`,
      );
    }

    await this.findProductOrThrow(dto.productId, tenantId);

    const unit = await this.prisma.inventoryUnit.create({
      data: {
        serialNumber: dto.serialNumber,
        productId: dto.productId,
        condition: dto.condition,
        purchasePrice: dto.purchasePrice,
        notes: dto.notes,
        grnId: dto.grnId,
        tenantId,
      },
      include: {
        product: { select: { id: true, name: true, sellingPrice: true } },
      },
    });

    this.eventEmitter.emit('inventory.unit_added', {
      unitId: unit.id,
      userId,
      serialNumber: unit.serialNumber,
      productId: unit.productId,
      tenantId,
    });

    return unit;
  }

  async bulkCreateUnits(dto: BulkCreateUnitsDto, userId: string, tenantId: string) {
    const serials = dto.units.map((u) => u.serialNumber);
    const duplicates = serials.filter((s, i) => serials.indexOf(s) !== i);
    if (duplicates.length > 0) {
      throw new BadRequestException(
        `Duplicate serials in request: ${duplicates.join(', ')}`,
      );
    }

    const existing = await this.prisma.inventoryUnit.findMany({
      where: {
        tenantId,
        serialNumber: { in: serials },
      },
      select: { serialNumber: true },
    });
    if (existing.length > 0) {
      throw new ConflictException(
        `Serial numbers already exist: ${existing.map((e) => e.serialNumber).join(', ')}`,
      );
    }

    const createdUnits = await this.prisma.inventoryUnit.createManyAndReturn({
      data: dto.units.map((u) => ({
        serialNumber: u.serialNumber,
        productId: u.productId,
        condition: u.condition,
        purchasePrice: u.purchasePrice,
        notes: u.notes,
        grnId: u.grnId,
        tenantId,
      })),
    });

    for (const unit of createdUnits) {
      this.eventEmitter.emit('inventory.unit_added', {
        unitId: unit.id,
        userId,
        serialNumber: unit.serialNumber,
        productId: unit.productId,
        tenantId,
      });
    }

    return { created: createdUnits.length };
  }

  async updateUnit(id: string, dto: UpdateUnitDto, userId: string, tenantId: string) {
    const unit = await this.prisma.inventoryUnit.findFirst({
      where: { id, tenantId },
    });
    if (!unit) throw new NotFoundException(`Unit ${id} not found`);

    const oldStatus = unit.status;

    const updated = await this.prisma.inventoryUnit.update({
      where: { id },
      data: { ...dto },
      include: {
        product: { select: { id: true, name: true, sellingPrice: true } },
      },
    });

    if (dto.status && dto.status !== oldStatus) {
      this.eventEmitter.emit('inventory.status_changed', {
        unitId: id,
        userId,
        oldStatus,
        newStatus: dto.status,
        tenantId,
      });
    }

    return updated;
  }

  async softDeleteProduct(id: string, tenantId: string) {
    await this.findProductOrThrow(id, tenantId);
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Product deactivated' };
  }

  // ─── Suppliers ───────────────────────────────────────────────────────────────

  async listSuppliers(tenantId: string) {
    return this.prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createSupplier(
    data: {
      name: string;
      contactName?: string;
      phone?: string;
      email?: string;
      address?: string;
    },
    tenantId: string,
  ) {
    return this.prisma.supplier.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  // ─── Purchase Orders ─────────────────────────────────────────────────────────

  async listPurchaseOrders(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    });
  }

  async createPurchaseOrder(
    data: {
      supplierId?: string;
      notes?: string;
      items: {
        productId: string;
        quantityOrdered: number;
        unitCostPrice: number;
      }[];
    },
    userId: string,
    tenantId: string,
  ) {
    const totalAmount = data.items.reduce(
      (sum, i) => sum + i.quantityOrdered * i.unitCostPrice,
      0,
    );

    return this.prisma.purchaseOrder.create({
      data: {
        supplierId: data.supplierId,
        notes: data.notes,
        totalAmount,
        createdById: userId,
        tenantId,
        items: { create: data.items },
      },
      include: { items: true, supplier: true },
    });
  }

  // ─── Goods Received Notes ─────────────────────────────────────────────────────

  async getGrn(id: string, tenantId: string) {
    const grn = await this.prisma.goodsReceivedNote.findFirst({
      where: { id, tenantId },
      include: {
        inventoryUnits: {
          include: { product: { select: { id: true, name: true } } },
        },
        receivedBy: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true } },
      },
    });
    if (!grn) throw new NotFoundException(`GRN ${id} not found`);
    return grn;
  }

  async createGrn(
    data: {
      purchaseOrderId?: string;
      notes?: string;
      units: {
        serialNumber: string;
        productId: string;
        purchasePrice?: number;
      }[];
    },
    userId: string,
    tenantId: string,
  ) {
    const serials = data.units.map((u) => u.serialNumber);
    const existing = await this.prisma.inventoryUnit.findMany({
      where: {
        tenantId,
        serialNumber: { in: serials },
      },
      select: { serialNumber: true },
    });
    if (existing.length > 0) {
      throw new ConflictException(
        `Serial numbers already exist: ${existing.map((e) => e.serialNumber).join(', ')}`,
      );
    }

    const grn = await this.prisma.goodsReceivedNote.create({
      data: {
        purchaseOrderId: data.purchaseOrderId,
        receivedById: userId,
        notes: data.notes,
        tenantId,
        inventoryUnits: {
          create: data.units.map((u) => ({
            serialNumber: u.serialNumber,
            productId: u.productId,
            purchasePrice: u.purchasePrice,
            status: UnitStatus.in_stock,
            tenantId,
          })),
        },
      },
      include: {
        inventoryUnits: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });

    if (data.purchaseOrderId) {
      await this.prisma.purchaseOrder.updateMany({
        where: { id: data.purchaseOrderId, tenantId },
        data: { status: 'received' },
      });
    }

    return grn;
  }
}
