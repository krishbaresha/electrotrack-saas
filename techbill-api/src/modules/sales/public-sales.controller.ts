import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Public controller — no auth required.
 * Exposes a single endpoint to fetch a sale by its UUID for the QR code
 * verification flow. Uses non-guessable UUIDs, preventing IDOR attacks.
 */
@Controller('public/sales')
export class PublicSalesController {
  constructor(private prisma: PrismaService) {}

  @Get(':id')
  async getPublicInvoice(@Param('id') id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id },
      include: {
        items: {
          include: {
            inventoryUnit: {
              select: {
                id: true,
                serialNumber: true,
                product: {
                  select: {
                    name: true,
                    brand: true,
                    warrantyMonths: true,
                  },
                },
              },
            },
          },
        },
        customer: { select: { name: true, phone: true } },
        soldBy: { select: { name: true } },
        tenant: { select: { name: true } },
        returns: { where: { status: 'approved' }, select: { inventoryUnitId: true } },
      },
    });

    if (!sale) throw new NotFoundException('Invoice not found');

    const returnedUnitIds = new Set(sale.returns?.map((r) => r.inventoryUnitId) || []);
    const isSaleVoided = sale.status === 'voided' || sale.shippingStatus === 'returned';

    // Compute warranty info for each item inline
    const saleDate = sale.createdAt;
    const items = sale.items.map((item) => {
      const isReturned = isSaleVoided || returnedUnitIds.has(item.inventoryUnit.id);
      const warrantyMonths = item.inventoryUnit.product.warrantyMonths;
      let warrantyExpiresAt: Date | null = null;
      let warrantyDaysLeft: number | null = null;

      if (warrantyMonths > 0 && !isReturned) {
        warrantyExpiresAt = new Date(saleDate);
        warrantyExpiresAt.setMonth(
          warrantyExpiresAt.getMonth() + warrantyMonths,
        );
        const msLeft = warrantyExpiresAt.getTime() - Date.now();
        warrantyDaysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      }

      return {
        id: item.id,
        sellingPrice: Number(item.sellingPrice),
        serialNumber: item.inventoryUnit.serialNumber,
        productName: item.inventoryUnit.product.name,
        productBrand: item.inventoryUnit.product.brand,
        warrantyMonths,
        warrantyExpiresAt,
        warrantyDaysLeft,
        isReturned,
      };
    });

    return {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      createdAt: sale.createdAt,
      paymentMethod: sale.paymentMethod,
      subtotal: Number(sale.subtotal),
      discountAmount: Number(sale.discountAmount),
      additionalCharges: Number(sale.additionalCharges ?? 0),
      description: sale.description,
      totalAmount: Number(sale.totalAmount),
      status: sale.status,
      shippingStatus: sale.shippingStatus,
      customerName: sale.customer?.name ?? null,
      customerPhone: sale.customer?.phone ?? null,
      cashierName: sale.soldBy?.name ?? null,
      shopName: sale.tenant?.name ?? 'TechBill',
      items,
    };
  }
}
