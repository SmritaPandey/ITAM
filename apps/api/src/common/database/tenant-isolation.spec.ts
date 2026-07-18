import { PrismaService } from './prisma.service';

describe('tenant isolation via withTenant', () => {
  it('sets app.current_tenant inside the transactional callback', async () => {
    const executeRaw = jest.fn().mockResolvedValue(undefined);
    const tx = { $executeRaw: executeRaw };
    const service = Object.create(PrismaService.prototype) as PrismaService;
    (service as any).$transaction = jest.fn(async (fn: any) => fn(tx));

    await service.withTenant('11111111-1111-1111-1111-111111111111', async (client) => {
      expect(client).toBe(tx);
      return 'ok';
    });

    expect(executeRaw).toHaveBeenCalled();
    expect((service as any).$transaction).toHaveBeenCalledTimes(1);
  });
});
