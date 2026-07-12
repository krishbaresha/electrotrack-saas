import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreatePoDto } from './dto/create-po.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  // ─── Suppliers ────────────────────────────────────────────────────────────────

  listSuppliers(search: string | undefined, tenantId: string) {
    return this.prisma.supplier.findMany({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { contactName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { purchaseOrders: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getSupplier(id: string, tenantId: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { _count: { select: { items: true } } },
        },
      },
    });
    if (!s) throw new NotFoundException(`Supplier ${id} not found`);
    return s;
  }

  createSupplier(dto: CreateSupplierDto, tenantId: string) {
    return this.prisma.supplier.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async updateSupplier(
    id: string,
    dto: Partial<CreateSupplierDto>,
    tenantId: string,
  ) {
    await this.getSupplier(id, tenantId);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  // ─── Purchase Orders ──────────────────────────────────────────────────────────

  listPurchaseOrders(supplierId: string | undefined, tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        ...(supplierId && { supplierId }),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getPurchaseOrder(id: string, tenantId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        items: {
          include: {
            product: { select: { id: true, name: true, brand: true } },
          },
        },
        grns: {
          include: {
            receivedBy: { select: { id: true, name: true } },
            _count: { select: { inventoryUnits: true } },
          },
        },
      },
    });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);
    return po;
  }

  async createPurchaseOrder(
    dto: CreatePoDto,
    userId: string,
    tenantId: string,
  ) {
    const totalAmount = dto.items.reduce(
      (sum, item) => sum + item.quantityOrdered * item.unitCostPrice,
      0,
    );

    // Auto-create supplier if name is given but no ID
    let supplierId = dto.supplierId;
    if (!supplierId && dto.newSupplierName?.trim()) {
      const newSupplier = await this.prisma.supplier.create({
        data: { name: dto.newSupplierName.trim(), tenantId },
      });
      supplierId = newSupplier.id;
    }

    return this.prisma.purchaseOrder.create({
      data: {
        supplierId,
        notes: dto.notes,
        createdById: userId,
        totalAmount,
        tenantId,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            quantityOrdered: item.quantityOrdered,
            unitCostPrice: item.unitCostPrice,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });
  }

  /**
   * Mark a Purchase Order as received.
   * Creates an Expense record (category = "purchase_order") so the cost is
   * automatically deducted from gross profit in the reports for that day.
   */
  async receivePurchaseOrder(id: string, userId: string, tenantId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
    });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);
    if (po.status === 'received') {
      throw new BadRequestException('Purchase order is already marked as received');
    }
    if (po.status === 'cancelled') {
      throw new BadRequestException('Cannot receive a cancelled purchase order');
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Mark PO as received
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'received', receivedAt: now },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true } } } },
        },
      });

      // Create expense record so reports can deduct this purchase cost
      if (po.totalAmount && Number(po.totalAmount) > 0) {
        await tx.expense.create({
          data: {
            amount: po.totalAmount,
            category: 'purchase_order',
            description: `Purchase Order received (PO: ${id})`,
            date: now,
            createdById: userId,
            tenantId,
          },
        });
      }

      return updated;
    });
  }
}
