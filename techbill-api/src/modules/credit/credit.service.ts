import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCreditDto } from './dto/create-credit.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreditType, CreditStatus } from '@prisma/client';

@Injectable()
export class CreditService {
  constructor(private prisma: PrismaService) {}

  async createCredit(dto: CreateCreditDto, tenantId: string) {
    return this.prisma.creditRecord.create({
      data: {
        type: dto.type,
        amount: dto.amount,
        dueAmount: dto.amount,
        paidAmount: 0,
        description: dto.description,
        date: new Date(dto.date),
        personName: dto.personName,
        customerId: dto.type === CreditType.CUSTOMER ? (dto.customerId ?? null) : null,
        supplierId: dto.type === CreditType.SUPPLIER ? (dto.supplierId ?? null) : null,
        tenantId,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        supplier: { select: { id: true, name: true, phone: true } },
      },
    });
  }

  async listCredits(tenantId: string, type?: CreditType, status?: CreditStatus) {
    return this.prisma.creditRecord.findMany({
      where: {
        tenantId,
        ...(type && { type }),
        ...(status && { status }),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        supplier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async recordPayment(id: string, dto: RecordPaymentDto, tenantId: string) {
    const record = await this.prisma.creditRecord.findFirst({
      where: { id, tenantId },
    });

    if (!record) {
      throw new NotFoundException('Credit record not found');
    }

    const currentPaid = Number(record.paidAmount);
    const totalAmount = Number(record.amount);
    const newPaid = currentPaid + dto.amount;

    if (newPaid > totalAmount) {
      throw new BadRequestException(`Payment exceeds remaining due amount: ₨ ${(totalAmount - currentPaid).toFixed(2)}`);
    }

    const newDue = totalAmount - newPaid;
    const newStatus = newDue <= 0 ? CreditStatus.PAID : CreditStatus.PENDING;

    const [updatedRecord, payment] = await this.prisma.$transaction([
      this.prisma.creditRecord.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          dueAmount: newDue,
          status: newStatus,
        },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          supplier: { select: { id: true, name: true, phone: true } },
        },
      }),
      this.prisma.creditPayment.create({
        data: {
          creditRecordId: id,
          amount: dto.amount,
          tenantId,
          // date will default to now()
        }
      })
    ]);

    return updatedRecord;
  }

  async deleteCredit(id: string, tenantId: string) {
    const record = await this.prisma.creditRecord.findFirst({
      where: { id, tenantId },
    });

    if (!record) {
      throw new NotFoundException('Credit record not found');
    }

    return this.prisma.creditRecord.delete({
      where: { id },
    });
  }
}
