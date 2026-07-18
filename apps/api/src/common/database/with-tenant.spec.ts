import { PrismaService } from './prisma.service';

describe('PrismaService.withTenant', () => {
  it('sets app.current_tenant with SET LOCAL inside the transaction callback', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const tx = { $executeRaw: executeRaw };
    const service = Object.create(PrismaService.prototype) as PrismaService;
    (service as any).$transaction = jest.fn(async (fn: any) => fn(tx));

    const result = await service.withTenant('tenant-a', async (client) => {
      expect(client).toBe(tx);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(executeRaw).toHaveBeenCalled();
    const sqlChunks = String(executeRaw.mock.calls[0][0]?.strings?.join('') || executeRaw.mock.calls[0][0]);
    expect(sqlChunks).toContain("set_config('app.current_tenant'");
  });
});
