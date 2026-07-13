import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['CAB_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
  CAB_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['IN_PROGRESS', 'CANCELLED'],
  REJECTED: ['DRAFT'],
  IN_PROGRESS: ['COMPLETED', 'FAILED', 'ROLLED_BACK'],
  COMPLETED: [],
  FAILED: ['DRAFT'],
  ROLLED_BACK: ['DRAFT'],
  CANCELLED: [],
};

/** SSDLC 9-step checklist keys (must all be truthy before APPROVED). */
export const SSDLC_GATE_KEYS = [
  'request',
  'review',
  'approval',
  'build',
  'uat',
  'vapt',
  'patchWindow',
  'deploy',
  'complianceLogging',
] as const;

@Injectable()
export class ChangesService {
  private readonly logger = new Logger(ChangesService.name);

  constructor(private prisma: PrismaService) {}

  isSsdlc(change: { type?: string | null; category?: string | null }) {
    const t = (change.type || '').toUpperCase();
    const c = (change.category || '').toUpperCase();
    return t === 'SSDLC' || c === 'SSDLC';
  }

  validateSsdlcGates(gates: any, uatEvidence?: string | null, vaptEvidence?: string | null) {
    const g = gates && typeof gates === 'object' ? gates : {};
    const missing = SSDLC_GATE_KEYS.filter((k) => !g[k]);
    if (missing.length) {
      throw new BadRequestException(
        `SSDLC change requires all 9 checklist gates before approval. Missing: ${missing.join(', ')}`,
      );
    }
    const uatOk =
      !!uatEvidence?.trim() ||
      (Array.isArray(g.uatAttachments) && g.uatAttachments.length > 0) ||
      !!g.uatAttachmentUrl;
    const vaptOk =
      !!vaptEvidence?.trim() ||
      (Array.isArray(g.vaptAttachments) && g.vaptAttachments.length > 0) ||
      !!g.vaptAttachmentUrl;
    if (!uatOk) {
      throw new BadRequestException(
        'SSDLC change requires uatEvidence text or uatAttachments before approval',
      );
    }
    if (!vaptOk) {
      throw new BadRequestException(
        'SSDLC change requires vaptEvidence text or vaptAttachments before approval',
      );
    }
  }

  async list(tenantId: string, status?: string, page = 1, limit = 50) {
    const where: any = { tenantId };
    if (status) where.status = status;
    const _page = Number(page) || 1;
    const _limit = Number(limit) || 20;
    const skip = (_page - 1) * _limit;
    const [data, total] = await Promise.all([
      this.prisma.changeRequest.findMany({
        where,
        include: {
          approvals: { orderBy: [{ level: 'asc' }, { createdAt: 'asc' }] },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: _limit,
      }),
      this.prisma.changeRequest.count({ where }),
    ]);
    return { data, total, page: _page, limit: _limit, totalPages: Math.ceil(total / _limit) };
  }

  async getById(id: string, tenantId: string) {
    const change = await this.prisma.changeRequest.findFirst({
      where: { id, tenantId },
      include: {
        approvals: { orderBy: [{ level: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!change) throw new NotFoundException('Change request not found');
    return change;
  }

  private async generateChangeNumber(tenantId: string): Promise<string> {
    const last = await this.prisma.changeRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { changeNumber: true },
    });
    const lastNum = last.length > 0
      ? parseInt(last[0].changeNumber.replace('CHG-', ''), 10) || 0
      : 0;
    return `CHG-${String(lastNum + 1).padStart(5, '0')}`;
  }

  async create(tenantId: string, userId: string, data: any) {
    const { approvalLevels, ...rest } = data || {};
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const changeNumber = await this.generateChangeNumber(tenantId);
        const change = await this.prisma.changeRequest.create({
          data: {
            tenantId,
            changeNumber,
            requestedById: userId,
            ...rest,
            ssdlcGates: rest.ssdlcGates || {},
          },
        });
        // If created already as SUBMITTED, seed approvals
        if (change.status === 'SUBMITTED' || rest.status === 'SUBMITTED') {
          await this.createPendingApprovals(change.id, tenantId, approvalLevels);
          return this.getById(change.id, tenantId);
        }
        return this.getById(change.id, tenantId);
      } catch (error: any) {
        if (error?.code === 'P2002' && attempt < MAX_RETRIES - 1) continue;
        throw error;
      }
    }
    throw new Error('Failed to generate unique change number after maximum retries');
  }

  async update(id: string, tenantId: string, data: any) {
    await this.getById(id, tenantId);
    const { approvalLevels, ...rest } = data || {};
    await this.prisma.changeRequest.update({ where: { id }, data: rest });
    return this.getById(id, tenantId);
  }

  /**
   * Submit DRAFT → SUBMITTED (or CAB_REVIEW for high-risk / explicit flag).
   * Creates pending multi-level ChangeApproval rows.
   */
  async submit(
    id: string,
    tenantId: string,
    userId: string,
    opts?: { approvalLevels?: { level: number; approverId: string }[]; requireCab?: boolean },
  ) {
    const change = await this.getById(id, tenantId);
    if (change.status !== 'DRAFT' && change.status !== 'REJECTED') {
      throw new BadRequestException(`Cannot submit change in status ${change.status}`);
    }

    const needsCab =
      opts?.requireCab ||
      ['HIGH', 'CRITICAL'].includes((change.risk || '').toUpperCase()) ||
      (change.type || '').toUpperCase() === 'EMERGENCY';

    const status = needsCab ? 'CAB_REVIEW' : 'SUBMITTED';

    await this.prisma.changeRequest.update({
      where: { id },
      data: { status },
    });

    // Clear prior pending approvals on re-submit
    await this.prisma.changeApproval.deleteMany({
      where: { changeRequestId: id, status: 'PENDING' },
    });

    await this.createPendingApprovals(id, tenantId, opts?.approvalLevels);
    this.logger.log(`Change ${change.changeNumber} submitted → ${status}`);
    return this.getById(id, tenantId);
  }

  private async createPendingApprovals(
    changeRequestId: string,
    tenantId: string,
    approvalLevels?: { level: number; approverId: string }[],
  ) {
    let levels = approvalLevels;
    if (!levels?.length) {
      const admins = await this.prisma.user.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          role: { name: { in: ['Tenant Admin', 'IT Admin'] } },
        },
        select: { id: true, role: { select: { name: true } } },
        take: 6,
      });
      const tenantAdmins = admins.filter((a) => a.role.name === 'Tenant Admin');
      const itAdmins = admins.filter((a) => a.role.name === 'IT Admin');
      levels = [];
      if (tenantAdmins[0]) levels.push({ level: 1, approverId: tenantAdmins[0].id });
      if (itAdmins[0]) levels.push({ level: 2, approverId: itAdmins[0].id });
      else if (tenantAdmins[1]) levels.push({ level: 2, approverId: tenantAdmins[1].id });
      // Single-admin tenants: one approval level is enough
      if (levels.length === 0 && admins[0]) {
        levels.push({ level: 1, approverId: admins[0].id });
      }
    }

    if (!levels.length) {
      this.logger.warn(`No approvers found for change ${changeRequestId}; leaving without approvals`);
      return;
    }

    await this.prisma.changeApproval.createMany({
      data: levels.map((l) => ({
        tenantId,
        changeRequestId,
        approverId: l.approverId,
        level: l.level,
        status: 'PENDING',
      })),
    });
  }

  async decideApproval(
    changeId: string,
    tenantId: string,
    userId: string,
    decision: 'APPROVED' | 'REJECTED',
    comment?: string,
  ) {
    const change = await this.getById(changeId, tenantId);
    if (!['SUBMITTED', 'CAB_REVIEW'].includes(change.status)) {
      throw new BadRequestException(`Cannot approve/reject change in status ${change.status}`);
    }

    const approval = await this.prisma.changeApproval.findFirst({
      where: {
        changeRequestId: changeId,
        tenantId,
        approverId: userId,
        status: 'PENDING',
      },
      orderBy: { level: 'asc' },
    });

    if (!approval) {
      // Allow Tenant Admin to decide any pending level if they are not listed
      const isAdmin = await this.prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
          role: { name: { in: ['Tenant Admin', 'IT Admin'] } },
        },
      });
      if (!isAdmin) throw new ForbiddenException('No pending approval assigned to you');

      const anyPending = await this.prisma.changeApproval.findFirst({
        where: { changeRequestId: changeId, status: 'PENDING' },
        orderBy: { level: 'asc' },
      });
      if (!anyPending) throw new BadRequestException('No pending approvals');

      await this.prisma.changeApproval.update({
        where: { id: anyPending.id },
        data: { status: decision, comment, decidedAt: new Date(), approverId: userId },
      });
    } else {
      // Enforce sequential levels: lower levels must be done first
      const blocked = await this.prisma.changeApproval.findFirst({
        where: {
          changeRequestId: changeId,
          status: 'PENDING',
          level: { lt: approval.level },
        },
      });
      if (blocked) {
        throw new BadRequestException(`Level ${blocked.level} must be approved first`);
      }
      await this.prisma.changeApproval.update({
        where: { id: approval.id },
        data: { status: decision, comment, decidedAt: new Date() },
      });
    }

    if (decision === 'REJECTED') {
      await this.prisma.changeRequest.update({
        where: { id: changeId },
        data: { status: 'REJECTED', closureNotes: comment || 'Rejected' },
      });
      return this.getById(changeId, tenantId);
    }

    // If all approvals APPROVED → move to APPROVED (after SSDLC checks)
    const remaining = await this.prisma.changeApproval.count({
      where: { changeRequestId: changeId, status: 'PENDING' },
    });
    if (remaining === 0) {
      if (this.isSsdlc(change)) {
        this.validateSsdlcGates(change.ssdlcGates, change.uatEvidence, change.vaptEvidence);
      }
      await this.prisma.changeRequest.update({
        where: { id: changeId },
        data: { status: 'APPROVED', approvedById: userId },
      });
    }

    return this.getById(changeId, tenantId);
  }

  async transition(id: string, tenantId: string, userId: string, newStatus: string, notes?: string) {
    const change = await this.getById(id, tenantId);
    const allowed = VALID_TRANSITIONS[change.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Cannot transition from ${change.status} to ${newStatus}`);
    }

    // Route SUBMITTED → APPROVED through approval chain when approvals exist
    if (newStatus === 'APPROVED' && ['SUBMITTED', 'CAB_REVIEW'].includes(change.status)) {
      const pending = await this.prisma.changeApproval.count({
        where: { changeRequestId: id, status: 'PENDING' },
      });
      if (pending > 0) {
        return this.decideApproval(id, tenantId, userId, 'APPROVED', notes);
      }
      if (this.isSsdlc(change)) {
        this.validateSsdlcGates(change.ssdlcGates, change.uatEvidence, change.vaptEvidence);
      }
    }

    if (newStatus === 'REJECTED' && ['SUBMITTED', 'CAB_REVIEW'].includes(change.status)) {
      const pending = await this.prisma.changeApproval.count({
        where: { changeRequestId: id, status: 'PENDING' },
      });
      if (pending > 0) {
        return this.decideApproval(id, tenantId, userId, 'REJECTED', notes);
      }
    }

    if (newStatus === 'SUBMITTED' && change.status === 'DRAFT') {
      return this.submit(id, tenantId, userId);
    }

    const updates: any = { status: newStatus };
    if (newStatus === 'APPROVED') {
      if (this.isSsdlc(change)) {
        this.validateSsdlcGates(change.ssdlcGates, change.uatEvidence, change.vaptEvidence);
      }
      updates.approvedById = userId;
    }
    if (newStatus === 'IN_PROGRESS') {
      updates.actualStart = new Date();
      updates.implementedById = userId;
    }
    if (['COMPLETED', 'FAILED', 'ROLLED_BACK'].includes(newStatus)) {
      updates.actualEnd = new Date();
    }
    if (notes) updates.closureNotes = notes;

    await this.prisma.changeRequest.update({ where: { id }, data: updates });
    return this.getById(id, tenantId);
  }

  async updateSsdlcGates(
    id: string,
    tenantId: string,
    data: {
      ssdlcGates?: Record<string, any>;
      uatEvidence?: string;
      vaptEvidence?: string;
      uatAttachments?: string[];
      vaptAttachments?: string[];
    },
  ) {
    const change = await this.getById(id, tenantId);
    const merged: any = {
      ...((change.ssdlcGates as object) || {}),
      ...(data.ssdlcGates || {}),
    };
    if (data.uatAttachments?.length) {
      merged.uatAttachments = [
        ...new Set([...(merged.uatAttachments || []), ...data.uatAttachments]),
      ];
    }
    if (data.vaptAttachments?.length) {
      merged.vaptAttachments = [
        ...new Set([...(merged.vaptAttachments || []), ...data.vaptAttachments]),
      ];
    }
    await this.prisma.changeRequest.update({
      where: { id },
      data: {
        ssdlcGates: merged,
        ...(data.uatEvidence !== undefined ? { uatEvidence: data.uatEvidence } : {}),
        ...(data.vaptEvidence !== undefined ? { vaptEvidence: data.vaptEvidence } : {}),
      },
    });
    return this.getById(id, tenantId);
  }

  async getCalendar(tenantId: string) {
    return this.prisma.changeRequest.findMany({
      where: {
        tenantId,
        status: { in: ['APPROVED', 'IN_PROGRESS', 'CAB_REVIEW', 'SUBMITTED'] },
        scheduledStart: { not: null },
      },
      select: {
        id: true,
        changeNumber: true,
        title: true,
        type: true,
        priority: true,
        risk: true,
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
        cabMeetingId: true,
      },
      orderBy: { scheduledStart: 'asc' },
    });
  }

  async getStats(tenantId: string) {
    const stats = await this.prisma.changeRequest.groupBy({ by: ['status'], where: { tenantId }, _count: true });
    const byType = await this.prisma.changeRequest.groupBy({ by: ['type'], where: { tenantId }, _count: true });
    return { byStatus: stats, byType };
  }

  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId);
    await this.prisma.changeApproval.deleteMany({ where: { changeRequestId: id } });
    await this.prisma.changeRequest.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── CAB Meetings ──────────────────────────────────────────────

  async listCabMeetings(tenantId: string, from?: string, to?: string) {
    const where: any = { tenantId };
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }
    return this.prisma.cabMeeting.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getCabMeeting(id: string, tenantId: string) {
    const m = await this.prisma.cabMeeting.findFirst({ where: { id, tenantId } });
    if (!m) throw new NotFoundException('CAB meeting not found');
    const agendaIds = Array.isArray(m.agenda) ? (m.agenda as string[]) : [];
    const changes = agendaIds.length
      ? await this.prisma.changeRequest.findMany({
          where: { tenantId, id: { in: agendaIds } },
          select: { id: true, changeNumber: true, title: true, status: true, risk: true, type: true },
        })
      : [];
    return { ...m, changes };
  }

  async createCabMeeting(tenantId: string, data: {
    title: string;
    scheduledAt: string | Date;
    location?: string;
    agenda?: string[];
    minutes?: string;
    status?: string;
  }) {
    const agenda = data.agenda || [];
    const meeting = await this.prisma.cabMeeting.create({
      data: {
        tenantId,
        title: data.title,
        scheduledAt: new Date(data.scheduledAt),
        location: data.location,
        agenda,
        minutes: data.minutes,
        status: data.status || 'SCHEDULED',
      },
    });
    if (agenda.length) {
      await this.prisma.changeRequest.updateMany({
        where: { tenantId, id: { in: agenda } },
        data: { cabMeetingId: meeting.id, status: 'CAB_REVIEW' },
      });
    }
    return meeting;
  }

  async updateCabMeeting(id: string, tenantId: string, data: any) {
    await this.getCabMeeting(id, tenantId);
    const updates: any = { ...data };
    if (data.scheduledAt) updates.scheduledAt = new Date(data.scheduledAt);
    const meeting = await this.prisma.cabMeeting.update({ where: { id }, data: updates });
    if (Array.isArray(data.agenda)) {
      await this.prisma.changeRequest.updateMany({
        where: { tenantId, cabMeetingId: id, id: { notIn: data.agenda } },
        data: { cabMeetingId: null },
      });
      if (data.agenda.length) {
        await this.prisma.changeRequest.updateMany({
          where: { tenantId, id: { in: data.agenda } },
          data: { cabMeetingId: id },
        });
      }
    }
    return this.getCabMeeting(id, tenantId);
  }

  async deleteCabMeeting(id: string, tenantId: string) {
    await this.getCabMeeting(id, tenantId);
    await this.prisma.changeRequest.updateMany({
      where: { tenantId, cabMeetingId: id },
      data: { cabMeetingId: null },
    });
    await this.prisma.cabMeeting.delete({ where: { id } });
    return { deleted: true };
  }

  async attachChangesToCab(meetingId: string, tenantId: string, changeIds: string[]) {
    const meeting = await this.getCabMeeting(meetingId, tenantId);
    const existing = Array.isArray(meeting.agenda) ? (meeting.agenda as string[]) : [];
    const merged = Array.from(new Set([...existing, ...changeIds]));
    await this.prisma.cabMeeting.update({
      where: { id: meetingId },
      data: { agenda: merged },
    });
    await this.prisma.changeRequest.updateMany({
      where: { tenantId, id: { in: changeIds } },
      data: { cabMeetingId: meetingId, status: 'CAB_REVIEW' },
    });
    return this.getCabMeeting(meetingId, tenantId);
  }
}
