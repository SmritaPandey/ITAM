import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

const REQUEST_TYPES = ['ACCESS', 'CORRECTION', 'ERASURE', 'PORTABILITY', 'CONSENT_WITHDRAWAL'];
const REQUEST_STATUSES = ['OPEN', 'IN_REVIEW', 'COMPLETED', 'REJECTED'];

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    tenantId: string,
    userId: string | undefined,
    body: { type: string; subjectEmail: string; details?: string },
  ) {
    const type = String(body.type || '').toUpperCase();
    if (!REQUEST_TYPES.includes(type)) throw new BadRequestException('Invalid data subject request type');
    if (!body.subjectEmail?.trim()) throw new BadRequestException('subjectEmail is required');
    return this.prisma.dataSubjectRequest.create({
      data: {
        tenantId,
        userId: userId || null,
        type,
        subjectEmail: body.subjectEmail.trim().toLowerCase(),
        details: body.details?.trim() || null,
      },
    });
  }

  list(tenantId: string, userId?: string, ownOnly = false) {
    return this.prisma.dataSubjectRequest.findMany({
      where: { tenantId, ...(ownOnly && userId ? { userId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    tenantId: string,
    id: string,
    body: { status?: string; resolution?: string },
  ) {
    const existing = await this.prisma.dataSubjectRequest.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Data subject request not found');
    const status = body.status ? String(body.status).toUpperCase() : undefined;
    if (status && !REQUEST_STATUSES.includes(status)) {
      throw new BadRequestException('Invalid data subject request status');
    }
    return this.prisma.dataSubjectRequest.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(body.resolution !== undefined ? { resolution: body.resolution.trim() || null } : {}),
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
    });
  }
}
