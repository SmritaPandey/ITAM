import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class KnowledgeBaseService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, search?: string, category?: string, page = 1, limit = 20) {
    const where: any = { tenantId, status: 'PUBLISHED' };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [data, total] = await Promise.all([
      this.prisma.knowledgeArticle.findMany({
        where,
        orderBy: { viewCount: 'desc' },
        skip,
        take,
      }),
      this.prisma.knowledgeArticle.count({ where }),
    ]);

    const categories = await this.prisma.knowledgeArticle.groupBy({
      by: ['category'],
      where: { tenantId, status: 'PUBLISHED' },
      _count: true,
    });

    return { data, categories, total, page: Number(page), limit: take };
  }

  async findById(id: string, tenantId: string) {
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id, tenantId },
    });
    if (!article) throw new NotFoundException('Article not found');
    // Increment view count atomically (no fetch-then-update race condition)
    await this.prisma.knowledgeArticle.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    return article;
  }

  async create(tenantId: string, userId: string, data: {
    title: string; content: string; category?: string; tags?: string[]; status?: string;
  }) {
    return this.prisma.knowledgeArticle.create({
      data: {
        tenantId,
        authorId: userId,
        title: data.title,
        content: data.content,
        category: data.category || 'General',
        tags: data.tags || [],
        status: data.status || 'PUBLISHED',
      },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    const existing = await this.prisma.knowledgeArticle.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Article not found');

    // Whitelist allowed fields — reject unknown properties
    const allowedFields = ['title', 'content', 'category', 'tags', 'status'];
    const sanitized: Record<string, any> = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        sanitized[key] = data[key];
      }
    }

    return this.prisma.knowledgeArticle.update({ where: { id }, data: sanitized });
  }

  async markHelpful(id: string, tenantId: string) {
    const existing = await this.prisma.knowledgeArticle.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Article not found');
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
    });
  }

  async delete(id: string, tenantId: string) {
    const existing = await this.prisma.knowledgeArticle.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Article not found');
    return this.prisma.knowledgeArticle.delete({ where: { id } });
  }
}
