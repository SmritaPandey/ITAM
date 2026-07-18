import { AssetsService } from './assets.service';

/**
 * Depreciation math coverage for AssetsService.calculateDepreciation.
 * We invoke the real service method with a mocked PrismaService — findById()
 * resolves through prisma.withTenant(), so we only need to stub that.
 */
describe('AssetsService.calculateDepreciation', () => {
  const TENANT = 'tenant-1';

  const monthsAgo = (months: number) =>
    new Date(Date.now() - months * 30.44 * 24 * 3600 * 1000);

  function makeService(asset: any) {
    const prisma: any = {
      withTenant: jest.fn((_tenantId: string, fn: any) =>
        fn({ asset: { findFirst: jest.fn().mockResolvedValue(asset) } }),
      ),
    };
    // metering + jobQueue are unused by calculateDepreciation
    const service = new AssetsService(prisma, {} as any, {} as any);
    return { service, prisma };
  }

  it('straight-line: at t=0 book value equals purchase price', async () => {
    const asset = {
      id: 'a1',
      name: 'Laptop',
      purchasePrice: 1200,
      salvageValue: 200,
      usefulLifeMonths: 50,
      depreciationMethod: 'STRAIGHT_LINE',
      procurementDate: new Date(),
      createdAt: new Date(),
      status: 'ACTIVE',
      assetTag: 'AT-1',
    };
    const { service } = makeService(asset);

    const result = await service.calculateDepreciation('a1', TENANT);

    // monthly = (1200 - 200) / 50 = 20
    expect(result.method).toBe('STRAIGHT_LINE');
    expect(result.monthsElapsed).toBe(0);
    expect(result.monthlyDepreciation).toBeCloseTo(20, 2);
    expect(result.currentBookValue).toBeCloseTo(1200, 2);
    expect(result.percentDepreciated).toBeCloseTo(0, 1);
    expect(result.fullyDepreciated).toBe(false);
    expect(result.remainingMonths).toBe(50);
  });

  it('straight-line: partial elapse follows price - monthly*elapsed', async () => {
    const purchasePrice = 6000;
    const salvageValue = 0;
    const usefulLifeMonths = 60;
    const asset = {
      id: 'a2',
      name: 'Server',
      purchasePrice,
      salvageValue,
      usefulLifeMonths,
      depreciationMethod: 'STRAIGHT_LINE',
      procurementDate: monthsAgo(12),
      createdAt: monthsAgo(12),
      status: 'ACTIVE',
      assetTag: 'AT-2',
    };
    const { service } = makeService(asset);

    const result = await service.calculateDepreciation('a2', TENANT);

    // Derive the expectation from the service's own monthsElapsed so the test
    // is not sensitive to the exact 30.44-day rounding boundary.
    const monthly = (purchasePrice - salvageValue) / usefulLifeMonths;
    const elapsed = Math.min(result.monthsElapsed, usefulLifeMonths);
    const expectedBook = Math.max(purchasePrice - monthly * elapsed, salvageValue);

    expect(result.monthsElapsed).toBeGreaterThan(0);
    expect(result.monthlyDepreciation).toBeCloseTo(monthly, 2);
    expect(result.currentBookValue).toBeCloseTo(expectedBook, 0);
    expect(result.fullyDepreciated).toBe(false);
  });

  it('declining-balance: book value follows price*(1-rate)^elapsed', async () => {
    const purchasePrice = 10000;
    const salvageValue = 500;
    const usefulLifeMonths = 60;
    const asset = {
      id: 'a3',
      name: 'Switch',
      purchasePrice,
      salvageValue,
      usefulLifeMonths,
      depreciationMethod: 'DECLINING_BALANCE',
      procurementDate: monthsAgo(24),
      createdAt: monthsAgo(24),
      status: 'ACTIVE',
      assetTag: 'AT-3',
    };
    const { service } = makeService(asset);

    const result = await service.calculateDepreciation('a3', TENANT);

    const rate = 2 / usefulLifeMonths;
    const elapsed = Math.min(result.monthsElapsed, usefulLifeMonths);
    const expectedBook = Math.max(
      purchasePrice * Math.pow(1 - rate, elapsed),
      salvageValue,
    );
    const expectedMonthly = expectedBook * rate;

    expect(result.method).toBe('DECLINING_BALANCE');
    expect(result.currentBookValue).toBeCloseTo(expectedBook, 0);
    expect(result.monthlyDepreciation).toBeCloseTo(expectedMonthly, 0);
    // Declining balance depreciates faster than straight-line early on
    expect(result.currentBookValue).toBeLessThan(purchasePrice);
  });

  it('clamps to salvage value once fully depreciated', async () => {
    const asset = {
      id: 'a4',
      name: 'Old PC',
      purchasePrice: 2000,
      salvageValue: 150,
      usefulLifeMonths: 36,
      depreciationMethod: 'STRAIGHT_LINE',
      procurementDate: monthsAgo(600), // way past useful life
      createdAt: monthsAgo(600),
      status: 'ACTIVE',
      assetTag: 'AT-4',
    };
    const { service } = makeService(asset);

    const result = await service.calculateDepreciation('a4', TENANT);

    expect(result.fullyDepreciated).toBe(true);
    expect(result.remainingMonths).toBe(0);
    expect(result.currentBookValue).toBeCloseTo(150, 2);
    expect(result.projectedEolValue).toBe(150);
  });

  it('handles assets without a purchase price (percent = 0)', async () => {
    const asset = {
      id: 'a5',
      name: 'No price',
      purchasePrice: null,
      salvageValue: null,
      usefulLifeMonths: null,
      depreciationMethod: null,
      procurementDate: new Date(),
      createdAt: new Date(),
      status: 'ACTIVE',
      assetTag: 'AT-5',
    };
    const { service } = makeService(asset);

    const result = await service.calculateDepreciation('a5', TENANT);

    expect(result.purchasePrice).toBe(0);
    expect(result.method).toBe('STRAIGHT_LINE'); // default
    expect(result.usefulLifeMonths).toBe(60); // default 5 years
    expect(result.percentDepreciated).toBe(0);
  });
});
