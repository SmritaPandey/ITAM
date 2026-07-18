import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Tenant RLS: Postgres policies on assets/tickets/agents read
 * `current_setting('app.current_tenant')`. Prefer `withTenant()` so SET LOCAL
 * stays on the same connection inside a transaction. Migrations/seeds should
 * run as a role that bypasses RLS, or call `setRlsBypass(true)` in-process.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error', 'warn'],
      datasources: {
        db: {
          url: PrismaService.buildConnectionUrl(),
        },
      },
    });
  }

  private static buildConnectionUrl(): string {
    const url = process.env.DATABASE_URL || '';
    if (!url) return url;

    const separator = url.includes('?') ? '&' : '?';
    const params: string[] = [];

    // Keep pool small on single Railway instances to avoid exhausting Postgres
    if (!url.includes('connection_limit')) params.push('connection_limit=10');
    if (!url.includes('pool_timeout')) params.push('pool_timeout=10');
    if (!url.includes('connect_timeout')) params.push('connect_timeout=5');
    if (!url.includes('statement_timeout')) params.push('statement_timeout=15000');

    return params.length > 0 ? `${url}${separator}${params.join('&')}` : url;
  }

  async onModuleInit() {
    const connectMs = 10_000;
    try {
      await Promise.race([
        this.$connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Prisma $connect timed out after ${connectMs}ms`)), connectMs),
        ),
      ]);
      this.logger.log('Database connected');
    } catch (err: any) {
      // Do not crash the process — /health/live must stay up for orchestration.
      // /health and /health/ready will report degraded until the DB recovers.
      this.logger.error(
        `Database connect failed (continuing in degraded mode): ${err?.message || err}`,
      );
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting database...');
    await this.$disconnect();
  }

  /**
   * App-level filter helper (defense in depth alongside Postgres RLS).
   */
  tenantScope(tenantId: string) {
    return {
      where: { tenantId },
    };
  }

  /**
   * Set session GUC for RLS on the current connection.
   * Must be paired with clear (null) after each request — see TenantRlsInterceptor —
   * because Prisma connection pooling would otherwise leak tenant context.
   * Prefer withTenant() for transactional SET LOCAL when possible.
   */
  async setCurrentTenant(tenantId: string | null): Promise<void> {
    if (tenantId) {
      await this.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, false)`;
    } else {
      await this.$executeRaw`SELECT set_config('app.current_tenant', '', false)`;
    }
  }

  async setRlsBypass(enabled: boolean): Promise<void> {
    await this.$executeRaw`SELECT set_config('app.rls_bypass', ${enabled ? 'on' : ''}, false)`;
  }

  /**
   * Run work inside a transaction with SET LOCAL app.current_tenant so RLS policies apply.
   */
  async withTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
      return fn(tx);
    });
  }
}
