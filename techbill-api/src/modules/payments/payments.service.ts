import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inserts a new transaction record with status PENDING.
   */
  async createPendingTransaction(orderId: string, amount: number, tenantId: string) {
    this.logger.log(
      `[Tenant: ${tenantId}] Creating pending transaction for Order ID: ${orderId}, Amount: ${amount}`,
    );

    // Ensure we don't duplicate orderIds
    const existing = await this.prisma.transaction.findUnique({
      where: { orderId },
    });
    if (existing) {
      throw new ConflictException(`Transaction with Order ID ${orderId} already exists`);
    }

    return this.prisma.transaction.create({
      data: {
        orderId,
        amount,
        status: TransactionStatus.PENDING,
        tenantId,
      },
    });
  }

  /**
   * Parses the webhook payload, validates transaction details,
   * updates status to SUCCESS or FAILED, and logs with tenant context.
   */
  async handleWebhook(payload: any) {
    this.logger.log(`Received payment webhook payload: ${JSON.stringify(payload)}`);

    // Flexible extraction of webhook fields
    const orderId = payload?.order_id || payload?.orderId;
    const status = payload?.status || payload?.payment_status;
    const amount = payload?.amount || payload?.payment_amount;

    if (!orderId) {
      const errorMsg = 'Webhook processing failed: orderId is missing in payload';
      this.logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (!status) {
      const errorMsg = `Webhook processing failed for Order ID ${orderId}: status is missing in payload`;
      this.logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (amount === undefined || amount === null) {
      const errorMsg = `Webhook processing failed for Order ID ${orderId}: amount is missing in payload`;
      this.logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Query transaction to automatically fetch the database and tenant context
    const transaction = await this.prisma.transaction.findUnique({
      where: { orderId },
    });

    if (!transaction) {
      const errorMsg = `Webhook processing failed: Transaction not found for Order ID ${orderId}`;
      this.logger.warn(errorMsg);
      return { success: false, error: errorMsg };
    }

    const tenantId = transaction.tenantId;

    // Verify amount to prevent amount spoofing
    const expectedAmount = Math.round(Number(transaction.amount) * 100) / 100;
    const receivedAmount = Math.round(Number(amount) * 100) / 100;
    if (expectedAmount !== receivedAmount) {
      const errorMsg = `[Tenant: ${tenantId}] Webhook rejected: Amount mismatch for Order ID ${orderId}. Expected ${expectedAmount}, received ${receivedAmount}`;
      this.logger.error(errorMsg);

      // Update status to FAILED in case of spoofing attempt
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.FAILED },
      });

      return { success: false, error: 'Amount mismatch' };
    }

    // Map incoming status safely to TransactionStatus enum
    const normalizedStatus = String(status).toUpperCase();
    let finalStatus: TransactionStatus = TransactionStatus.FAILED;

    if (['SUCCESS', 'SUCCESSFUL', 'PAID', 'COMPLETED', 'APPROVED', 'OK'].includes(normalizedStatus)) {
      finalStatus = TransactionStatus.SUCCESS;
    }

    // Update status in the database
    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: finalStatus },
    });

    this.logger.log(
      `[Tenant: ${tenantId}] Webhook verified successfully. Transaction ID: ${updatedTransaction.id} ` +
        `(Order ID: ${orderId}) status updated from PENDING to ${finalStatus}`,
    );

    return {
      success: true,
      transactionId: updatedTransaction.id,
      orderId: updatedTransaction.orderId,
      status: updatedTransaction.status,
      tenantId: updatedTransaction.tenantId,
    };
  }
}
