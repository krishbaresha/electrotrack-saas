import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { CreatePaymentTransactionDto } from './dto/create-payment-transaction.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

interface RequestWithUser extends Request {
  user: {
    id: string;
    tenantId: string;
    role: string;
    permissions: string[];
  };
}

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Public webhook endpoint called by the payment gateway.
   * Signature validation is performed if PAYMENT_WEBHOOK_SECRET is configured.
   * Returns HTTP 200 OK regardless of failures to prevent gateway retry storms.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any, @Req() req: Request) {
    try {
      this.logger.log('Payment gateway webhook callback received.');

      // Validate webhook secret signature/token if configured in environment
      const webhookSecret = this.configService.get<string>('PAYMENT_WEBHOOK_SECRET');
      if (webhookSecret) {
        const signature = req.headers['x-webhook-signature'] || req.query['token'];
        if (signature !== webhookSecret) {
          this.logger.error('[Webhook Security] Unauthorized callback attempt. Signature or token mismatch.');
          return { processed: false, error: 'Unauthorized signature mismatch' };
        }
      }

      // Delegate processing to service layer
      const result = await this.paymentsService.handleWebhook(payload);

      if (!result.success) {
        return { processed: false, error: result.error };
      }

      return { processed: true, transactionId: result.transactionId };
    } catch (err: any) {
      // Keep app crash-free and return 200 OK to the gateway even on server processing failure
      this.logger.error('Unexpected error processing webhook callback', err?.stack);
      return { processed: false, error: 'Internal processing error' };
    }
  }

  /**
   * Protected endpoint for testing or local simulation to register a PENDING transaction.
   */
  @Post('test-create')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTestTransaction(
    @Body() dto: CreatePaymentTransactionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.paymentsService.createPendingTransaction(
      dto.orderId,
      dto.amount,
      req.user.tenantId,
    );
  }
}
