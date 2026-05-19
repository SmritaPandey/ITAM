import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
          // Append connection pool limits if not already in URL
          url: PrismaService.buildConnectionUrl(),
        },
      },
    });
  }

  /**
   * Build DATABASE_URL with connection pool limits for production stability.
   * Prevents pool exhaustion under heavy concurrent load.
   */
  private static buildConnectionUrl(): string {
    const url = process.env.DATABASE_URL || '';
    if (!url) return url;

    const separator = url.includes('?') ? '&' : '?';
    const params: string[] = [];

    // Connection pool size (default Prisma is num_cpus * 2 + 1, cap it)
    if (!url.includes('connection_limit')) params.push('connection_limit=20');
    // Pool timeout — how long to wait for a connection (ms)
    if (!url.includes('pool_timeout')) params.push('pool_timeout=15');
    // Statement timeout — kill queries running longer than 30s
    if (!url.includes('statement_timeout')) params.push('statement_timeout=30000');

    return params.length > 0 ? `${url}${separator}${params.join('&')}` : url;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting database...');
    await this.$disconnect();
  }

  /**
   * Set the tenant context for RLS-like queries.
   * All queries in services should use this to filter by tenant.
   */
  tenantScope(tenantId: string) {
    return {
      where: { tenantId },
    };
  }
}

