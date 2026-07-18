import { BadRequestException } from '@nestjs/common';
import { PatchPolicyService } from './patch-policy.service';
import { PatchesService } from './patches.service';

describe('PatchesService deploy rings', () => {
  let patch: any;
  let prisma: any;
  let policies: PatchPolicyService;
  let service: PatchesService;

  beforeEach(() => {
    patch = {
      id: 'patch-1',
      tenantId: 'tenant-1',
      patchId: 'KB-1',
      deployRing: 'PILOT',
      status: 'PENDING_DEPLOYMENT',
    };
    prisma = {
      patch: {
        findFirst: jest.fn(async () => ({ ...patch })),
        update: jest.fn(async ({ data }: any) => {
          patch = { ...patch, ...data };
          return { ...patch };
        }),
      },
      patchDeployPolicy: {
        findFirst: jest.fn(async () => ({
          id: 'policy-1',
          tenantId: 'tenant-1',
          name: 'Controlled rollout',
          autoPromote: true,
          pilotAssetIds: [],
          stagedAssetIds: [],
        })),
      },
      asset: { findMany: jest.fn(async () => []) },
      patchDeployment: {
        updateMany: jest.fn(async () => ({ count: 0 })),
        upsert: jest.fn(),
      },
    };
    policies = new PatchPolicyService(prisma);
    service = new PatchesService(prisma, {} as any, {} as any, policies);
  });

  it('promotes only PILOT → STAGED → ALL', async () => {
    const staged = await policies.promoteRing('tenant-1', 'patch-1');
    expect(staged).toMatchObject({ promoted: true, from: 'PILOT', to: 'STAGED' });

    const all = await policies.promoteRing('tenant-1', 'patch-1');
    expect(all).toMatchObject({ promoted: true, from: 'STAGED', to: 'ALL' });

    const unchanged = await policies.promoteRing('tenant-1', 'patch-1');
    expect(unchanged).toMatchObject({ promoted: false, message: 'Already at ALL ring' });
  });

  it('rejects ALL when a controlled policy has not completed PILOT and STAGED', async () => {
    patch = { ...patch, deployRing: 'ALL', status: 'Pending' };

    await expect(
      service.deploy('patch-1', 'tenant-1', {
        ring: 'ALL',
        policyId: 'policy-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.patch.update).not.toHaveBeenCalled();
  });

  it('allows the next policy ring after the prior ring', async () => {
    const result = await service.deploy('patch-1', 'tenant-1', {
      ring: 'STAGED',
      policyId: 'policy-1',
    });

    expect(result).toMatchObject({ deployRing: 'STAGED', ring: 'STAGED' });
  });
});
