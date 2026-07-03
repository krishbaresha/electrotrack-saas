import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma connection pool timeout (P2024) mitigation:
 *
 *  - pool parameters are set via DATABASE_URL query-string flags
 *    (`connection_limit` & `pool_timeout`) so they propagate to every
 *    PrismaClient instance without touching constructor options.
 *  - onModuleInit retries $connect() up to MAX_RETRIES times with
 *    exponential back-off to survive transient Supabase pooler warm-up.
 *  - All errors are logged with structured context so the root cause is
 *    immediately visible in the terminal instead of an opaque 500.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_BACKOFF_MS = 1500; // 1.5 s → 3 s → 6 s

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from database …');
    try {
      await this.$disconnect();
      this.logger.log('Database connection closed cleanly.');
    } catch (err) {
      this.logger.error('Error during $disconnect()', (err as Error).stack);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async connectWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= PrismaService.MAX_RETRIES; attempt++) {
      try {
        this.logger.log(`[Attempt ${attempt}/${PrismaService.MAX_RETRIES}] Connecting to database …`);
        await this.$connect();
        this.logger.log('✅ Database connection established successfully.');
        return;
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string; stack?: string };
        const isPoolTimeout = error.code === 'P2024';

        this.logger.error(
          `❌ DB connect attempt ${attempt} failed` +
            (error.code ? ` [${error.code}]` : '') +
            `: ${error.message ?? 'Unknown error'}`,
        );

        if (attempt < PrismaService.MAX_RETRIES) {
          const backoffMs = PrismaService.BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
          this.logger.warn(
            isPoolTimeout
              ? `P2024 pool timeout — connection pool exhausted. ` +
                  `Waiting ${backoffMs}ms before retry …`
              : `Retrying in ${backoffMs}ms …`,
          );
          await this.sleep(backoffMs);
        } else {
          // All retries exhausted — log a diagnostic summary but do NOT
          // rethrow, so the NestJS application context still boots and other
          // modules (health-check, metrics) remain accessible.
          this.logger.error(
            '🔴 All database connection attempts failed. ' +
              'The application will start in a degraded state. ' +
              'Check DATABASE_URL, Supabase project status, and pool limits.',
            error.stack,
          );
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
