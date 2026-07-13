import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Meilisearch, Index } from 'meilisearch';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: Meilisearch | null = null;
  private ready = false;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Defer so HTTP can accept traffic before Meilisearch handshake
    setImmediate(() => {
      this.connect().catch((err) =>
        this.logger.warn(`Deferred Meilisearch connect failed: ${err?.message || err}`),
      );
    });
  }

  private async connect() {
    const host = process.env.MEILI_HOST?.trim();
    const key = process.env.MEILI_MASTER_KEY?.trim() || process.env.MEILI_KEY?.trim();
    if (!host) {
      this.logger.warn('MEILI_HOST not set — global search will use Prisma fallback');
      return;
    }
    try {
      this.client = new Meilisearch({ host, apiKey: key });
      await this.client.health();
      this.ready = true;
      this.logger.log(`Meilisearch connected at ${host}`);
      await this.ensureIndexes();
    } catch (err: any) {
      this.logger.warn(`Meilisearch unavailable: ${err?.message || err}`);
      this.client = null;
      this.ready = false;
    }
  }

  private indexName(tenantId: string, entity: string) {
    return `t_${tenantId.replace(/-/g, '').slice(0, 12)}_${entity}`;
  }

  private async ensureIndexes() {
    if (!this.client) return;
    // Indexes are created per-tenant on first reindex
  }

  private async getIndex(tenantId: string, entity: string): Promise<Index | null> {
    if (!this.client) return null;
    const uid = this.indexName(tenantId, entity);
    try {
      return this.client.index(uid);
    } catch {
      await this.client.createIndex(uid, { primaryKey: 'id' });
      return this.client.index(uid);
    }
  }

  async reindexTenant(tenantId: string) {
    const [assets, tickets, users, services] = await Promise.all([
      this.prisma.asset.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          assetTag: true,
          hostname: true,
          ipAddress: true,
          serialNumber: true,
          status: true,
          category: true,
        },
        take: 5000,
      }),
      this.prisma.ticket.findMany({
        where: { tenantId },
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
          category: true,
        },
        take: 5000,
      }),
      this.prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
        take: 2000,
      }),
      this.prisma.businessService.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          criticality: true,
        },
        take: 2000,
      }),
    ]);

    if (!this.ready || !this.client) {
      return {
        status: 'fallback',
        message: 'Meilisearch not configured; search uses DB',
        counts: {
          assets: assets.length,
          tickets: tickets.length,
          users: users.length,
          services: services.length,
        },
      };
    }

    for (const [entity, docs, searchable] of [
      [
        'assets',
        assets.map((a) => ({ ...a, entity: 'asset' })),
        ['name', 'assetTag', 'hostname', 'ipAddress', 'serialNumber'],
      ],
      [
        'tickets',
        tickets.map((t) => ({ ...t, entity: 'ticket' })),
        ['ticketNumber', 'subject', 'category'],
      ],
      [
        'users',
        users.map((u) => ({
          ...u,
          entity: 'user',
          name: `${u.firstName} ${u.lastName}`,
        })),
        ['name', 'email', 'firstName', 'lastName'],
      ],
      [
        'services',
        services.map((s) => ({ ...s, entity: 'service', category: 'CI' })),
        ['name', 'description', 'criticality', 'status'],
      ],
    ] as [string, any[], string[]][]) {
      try {
        await this.client.createIndex(this.indexName(tenantId, entity), { primaryKey: 'id' }).catch(() => undefined);
        const index = this.client.index(this.indexName(tenantId, entity));
        await index.updateFilterableAttributes(['entity', 'status', 'priority', 'category', 'criticality']);
        await index.updateSearchableAttributes(searchable);
        if (docs.length) await index.addDocuments(docs);
        await this.prisma.searchIndexJob.create({
          data: {
            tenantId,
            entity,
            entityId: tenantId,
            action: 'INDEX',
            status: 'DONE',
          },
        });
      } catch (err: any) {
        this.logger.warn(`Reindex ${entity} failed: ${err?.message}`);
      }
    }

    return {
      status: 'ok',
      counts: {
        assets: assets.length,
        tickets: tickets.length,
        users: users.length,
        services: services.length,
      },
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processIndexJobs() {
    if (process.env.DISABLE_CRON_JOBS === 'true') return;
    if (!this.ready) return;
    const jobs = await this.prisma.searchIndexJob.findMany({
      where: { status: 'PENDING' },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });
    for (const job of jobs) {
      try {
        await this.reindexTenant(job.tenantId);
        await this.prisma.searchIndexJob.update({
          where: { id: job.id },
          data: { status: 'DONE' },
        });
      } catch {
        await this.prisma.searchIndexJob.update({
          where: { id: job.id },
          data: { status: 'FAILED' },
        });
      }
    }
  }

  async search(tenantId: string, q: string, limit = 10) {
    const query = (q || '').trim();
    if (query.length < 2) {
      return { assets: [], tickets: [], users: [], services: [], source: 'none' };
    }

    if (this.ready && this.client) {
      try {
        const [assets, tickets, users, services] = await Promise.all([
          this.searchIndex(tenantId, 'assets', query, limit),
          this.searchIndex(tenantId, 'tickets', query, limit),
          this.searchIndex(tenantId, 'users', query, limit),
          this.searchIndex(tenantId, 'services', query, limit),
        ]);
        const totalHits = assets.length + tickets.length + users.length + services.length;
        // Empty Meili indexes → fall back to Prisma so Cmd+K stays useful before reindex
        if (totalHits === 0) {
          return this.prismaFallback(tenantId, query, limit);
        }
        return { assets, tickets, users, services, source: 'meilisearch', q: query };
      } catch (err: any) {
        this.logger.warn(`Meili search failed, falling back: ${err?.message}`);
      }
    }

    return this.prismaFallback(tenantId, query, limit);
  }

  private async searchIndex(tenantId: string, entity: string, q: string, limit: number) {
    if (!this.client) return [];
    const uid = this.indexName(tenantId, entity);
    try {
      const result = await this.client.index(uid).search(q, { limit });
      return result.hits || [];
    } catch {
      return [];
    }
  }

  private async prismaFallback(tenantId: string, q: string, limit: number) {
    const [assets, tickets, users, services] = await Promise.all([
      this.prisma.asset.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { assetTag: { contains: q, mode: 'insensitive' } },
            { hostname: { contains: q, mode: 'insensitive' } },
            { ipAddress: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          assetTag: true,
          hostname: true,
          status: true,
        },
      }),
      this.prisma.ticket.findMany({
        where: {
          tenantId,
          OR: [
            { subject: { contains: q, mode: 'insensitive' } },
            { ticketNumber: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
        },
      }),
      this.prisma.user.findMany({
        where: {
          tenantId,
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      }),
      this.prisma.businessService.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          criticality: true,
          description: true,
        },
      }),
    ]);
    return { assets, tickets, users, services, source: 'prisma', q };
  }
}
