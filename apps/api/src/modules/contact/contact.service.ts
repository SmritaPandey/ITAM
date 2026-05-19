import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new contact form submission (public, rate-limited)
   */
  async create(dto: {
    name: string;
    email: string;
    subject: string;
    message: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Check rate limit: max 3 submissions per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.prisma.contactSubmission.count({
      where: {
        email: dto.email.toLowerCase(),
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentCount >= 3) {
      throw new Error('Too many submissions. Please try again later.');
    }

    const submission = await this.prisma.contactSubmission.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        subject: dto.subject,
        message: dto.message.trim(),
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      },
    });

    this.logger.log(`New contact submission from ${dto.email} — subject: ${dto.subject}`);
    return submission;
  }

  /**
   * List all submissions (admin only)
   */
  async findAll(filters?: { status?: string; limit?: number; offset?: number }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.contactSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.contactSubmission.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Update submission status / reply (admin only)
   */
  async update(id: string, dto: { status?: string; reply?: string }) {
    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.reply) {
      data.reply = dto.reply;
      data.repliedAt = new Date();
      data.status = 'REPLIED';
    }

    return this.prisma.contactSubmission.update({
      where: { id },
      data,
    });
  }
}
