import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreatePoDto } from './dto/create-po.dto';
import { ReceivePoDto } from './dto/receive-po.dto';

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
  async receivePurchaseOrder(
    id: string,
    dto: ReceivePoDto,
    userId: string,
    tenantId: string,
  ) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);
    if (po.status === 'received') {
      throw new BadRequestException(
        'Purchase order is already marked as received',
      );
    }
    if (po.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot receive a cancelled purchase order',
      );
    }

    const now = new Date();
    const ts = Date.now();

    return this.prisma.$transaction(async (tx) => {
      // Create inventory units for each item
      const newUnits: any[] = [];
      let snIndex = 0;

      for (const item of po.items) {
        if (dto.snGenerationMethod === 'manual') {
          const manualItem = dto.items?.find(
            (i) => i.productId === item.productId,
          );
          const serialNumbers = manualItem?.serialNumbers || [];
          if (serialNumbers.length !== item.quantityOrdered) {
            throw new BadRequestException(
              `Expected ${item.quantityOrdered} serial numbers for product ${item.productId}, but got ${serialNumbers.length}`,
            );
          }
          for (const sn of serialNumbers) {
            newUnits.push({
              tenantId,
              productId: item.productId,
              serialNumber: sn,
              purchasePrice: item.unitCostPrice,
              status: 'in_stock',
              condition: 'new',
              notes: `Received from PO ${po.id.slice(-8).toUpperCase()}`,
            });
          }
        } else {
          // Auto-generate
          for (let i = 0; i < item.quantityOrdered; i++) {
            snIndex++;
            newUnits.push({
              tenantId,
              productId: item.productId,
              serialNumber: `AUTOSN-${ts}-${snIndex}`,
              purchasePrice: item.unitCostPrice,
              status: 'in_stock',
              condition: 'new',
              notes: `Received from PO ${po.id.slice(-8).toUpperCase()}`,
            });
          }
        }
      }

      if (newUnits.length > 0) {
        // Prisma createMany does not return the created records, but that's fine
        // If there's a unique constraint violation on SNs, it will throw
        try {
          await tx.inventoryUnit.createMany({
            data: newUnits,
            skipDuplicates: false,
          });
        } catch (error: any) {
          if (error.code === 'P2002') {
            throw new BadRequestException(
              'One or more serial numbers already exist in the inventory.',
            );
          }
          throw error;
        }
      }

      // Mark PO as received
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'received' },
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
            description: `Purchase Order received (PO: ${id.slice(-8).toUpperCase()})`,
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
