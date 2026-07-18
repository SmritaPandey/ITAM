import { BadRequestException } from '@nestjs/common';
import { ChangesService } from './changes.service';

describe('ChangesService CAB approval gates', () => {
  let change: any;
  let approvals: any[];
  let prisma: any;
  let service: ChangesService;

  beforeEach(() => {
    change = {
      id: 'change-1',
      tenantId: 'tenant-1',
      changeNumber: 'CHG-00001',
      status: 'DRAFT',
      risk: 'HIGH',
      type: 'NORMAL',
      cabMeetingId: null,
    };
    approvals = [];
    prisma = {
      changeRequest: {
        findFirst: jest.fn(async () => ({ ...change, approvals: [...approvals] })),
        update: jest.fn(async ({ data }: any) => {
          change = { ...change, ...data };
          return { ...change };
        }),
      },
      changeApproval: {
        deleteMany: jest.fn(async () => {
          approvals = approvals.filter((approval) => approval.status !== 'PENDING');
          return { count: 0 };
        }),
        createMany: jest.fn(async ({ data }: any) => {
          approvals.push(
            ...data.map((approval: any, index: number) => ({
              id: `approval-${index + 1}`,
              ...approval,
            })),
          );
          return { count: data.length };
        }),
        findFirst: jest.fn(async ({ where }: any) =>
          approvals.find(
            (approval) =>
              approval.status === where.status &&
              (!where.approverId || approval.approverId === where.approverId) &&
              (!where.level?.lt || approval.level < where.level.lt),
          ),
        ),
        update: jest.fn(async ({ where, data }: any) => {
          const approval = approvals.find((item) => item.id === where.id);
          Object.assign(approval, data);
          return approval;
        }),
        count: jest.fn(async ({ where }: any) =>
          approvals.filter((approval) => approval.status === where.status).length,
        ),
      },
      user: { findMany: jest.fn(async () => []), findFirst: jest.fn() },
    };
    service = new ChangesService(prisma);
  });

  it('routes a high-risk submission to CAB_REVIEW with pending approvals', async () => {
    const submitted = await service.submit('change-1', 'tenant-1', 'requester-1', {
      approvalLevels: [
        { level: 1, approverId: 'approver-1' },
        { level: 2, approverId: 'approver-2' },
      ],
    });

    expect(submitted.status).toBe('CAB_REVIEW');
    expect(submitted.approvals).toEqual([
      expect.objectContaining({ level: 1, status: 'PENDING' }),
      expect.objectContaining({ level: 2, status: 'PENDING' }),
    ]);
  });

  it('blocks implementation after an approval rejects the change', async () => {
    change.status = 'CAB_REVIEW';
    approvals = [
      {
        id: 'approval-1',
        changeRequestId: change.id,
        tenantId: change.tenantId,
        approverId: 'approver-1',
        level: 1,
        status: 'PENDING',
      },
    ];

    await service.decideApproval(
      change.id,
      change.tenantId,
      'approver-1',
      'REJECTED',
      'Risk not accepted',
    );

    await expect(
      service.transition(change.id, change.tenantId, 'implementer-1', 'IN_PROGRESS'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(change.status).toBe('REJECTED');
  });

  it('requires completed approvals and a CAB meeting before high-risk implementation', async () => {
    change.status = 'APPROVED';
    approvals = [{ id: 'approval-1', status: 'APPROVED', level: 1 }];

    await expect(
      service.transition(change.id, change.tenantId, 'implementer-1', 'IN_PROGRESS'),
    ).rejects.toThrow('without CAB review');

    change.cabMeetingId = 'cab-1';
    await service.transition(change.id, change.tenantId, 'implementer-1', 'IN_PROGRESS');
    expect(change.status).toBe('IN_PROGRESS');
  });
});
