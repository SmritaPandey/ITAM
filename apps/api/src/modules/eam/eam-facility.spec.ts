import { EamService } from './eam.service';

/**
 * EAM facility dashboard aggregation + PM auto work-order generation.
 * Both paths use prisma directly, so we stub only the tables each touches.
 */
describe('EamService.getFacilityDashboard', () => {
  const TENANT = 'tenant-1';

  function makeService() {
    const prisma: any = {
      site: { count: jest.fn().mockResolvedValue(3) },
      maintenanceSchedule: {
        count: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      sparePart: { findMany: jest.fn().mockResolvedValue([]) },
      consumable: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceWorkOrder: { count: jest.fn().mockResolvedValue(2) },
      asset: { count: jest.fn().mockResolvedValue(5) },
    };
    const service = new EamService(prisma);
    return { service, prisma };
  }

  it('aggregates PM counts, low stock and pinned assets', async () => {
    const { service, prisma } = makeService();
    // pmDueSoon then pmOverdue (two count calls in order)
    prisma.maintenanceSchedule.count
      .mockResolvedValueOnce(4) // pmDue
      .mockResolvedValueOnce(1); // pmOverdue
    prisma.sparePart.findMany.mockResolvedValue([
      { id: 'sp1', sku: 'SKU1', name: 'Belt', quantityOnHand: 1, minStock: 5 }, // low
      { id: 'sp2', sku: 'SKU2', name: 'Bolt', quantityOnHand: 10, minStock: 5 }, // ok
    ]);
    prisma.consumable.findMany.mockResolvedValue([
      { id: 'c1', sku: 'C1', name: 'Oil', quantityOnHand: 0, reorderPoint: 3, reorderQty: 10 }, // low
    ]);
    prisma.maintenanceSchedule.findMany.mockResolvedValue([
      { id: 'ms1', nextDueAt: new Date(), asset: { id: 'a1', name: 'Pump', assetTag: 'AT-1', status: 'ACTIVE' } },
    ]);

    const result = await service.getFacilityDashboard(TENANT);

    expect(result.sitesWithFloorPlans).toBe(3);
    expect(result.pmDueSoon).toBe(4);
    expect(result.pmOverdue).toBe(1);
    expect(result.openPmWorkOrders).toBe(2);
    expect(result.pinnedAssets).toBe(5);
    // only under-min spare parts / consumables are surfaced
    expect(result.lowSpareParts).toHaveLength(1);
    expect(result.lowSpareParts[0].sku).toBe('SKU1');
    expect(result.lowConsumables).toHaveLength(1);
    expect(result.lowConsumables[0].sku).toBe('C1');
    expect(result.upcomingPm).toHaveLength(1);

    // every query is tenant-scoped
    expect(prisma.site.count.mock.calls[0][0].where.tenantId).toBe(TENANT);
    expect(prisma.asset.count.mock.calls[0][0].where.tenantId).toBe(TENANT);
  });
});

describe('EamService.createWorkOrdersForDueSchedules', () => {
  const TENANT = 'tenant-1';

  function makeService(calendarDue: any[], conditionSchedules: any[] = []) {
    const created: any[] = [];
    const prisma: any = {
      maintenanceSchedule: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(calendarDue) // CALENDAR/METER due
          .mockResolvedValueOnce(conditionSchedules), // CONDITION schedules
        update: jest.fn().mockResolvedValue({}),
      },
      maintenanceWorkOrder: {
        findFirst: jest.fn().mockResolvedValue(null), // no open WO
        findMany: jest.fn().mockResolvedValue([]), // for WO number generation
        create: jest.fn((args: any) => {
          const wo = { id: `wo-${created.length + 1}`, ...args.data };
          created.push(wo);
          return Promise.resolve(wo);
        }),
      },
      agent: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new EamService(prisma);
    return { service, prisma };
  }

  it('creates one PM work order per due calendar schedule and advances nextDueAt', async () => {
    const { service, prisma } = makeService([
      {
        id: 'sched-1',
        tenantId: TENANT,
        assetId: 'a1',
        name: 'Filter change',
        intervalDays: 30,
        asset: { id: 'a1', name: 'HVAC', assetTag: 'AT-1' },
      },
    ]);

    const result = await service.createWorkOrdersForDueSchedules(TENANT);

    expect(result.created).toBe(1);
    expect(result.workOrders).toHaveLength(1);
    expect(prisma.maintenanceWorkOrder.create).toHaveBeenCalledTimes(1);

    const woData = prisma.maintenanceWorkOrder.create.mock.calls[0][0].data;
    expect(woData.tenantId).toBe(TENANT);
    expect(woData.scheduleId).toBe('sched-1');
    expect(woData.status).toBe('OPEN');
    expect(woData.title).toContain('Filter change');
    expect(woData.workOrderNumber).toMatch(/^MWO-\d{5}$/);

    // schedule advanced by intervalDays and marked completed
    const updateData = prisma.maintenanceSchedule.update.mock.calls[0][0].data;
    expect(updateData.lastCompletedAt).toBeInstanceOf(Date);
    expect(updateData.nextDueAt).toBeInstanceOf(Date);
  });

  it('skips schedules that already have an open work order', async () => {
    const { service, prisma } = makeService([
      { id: 'sched-1', tenantId: TENANT, assetId: 'a1', name: 'PM', intervalDays: 7, asset: { name: 'X', assetTag: 'AT' } },
    ]);
    prisma.maintenanceWorkOrder.findFirst.mockResolvedValue({ id: 'existing-wo' });

    const result = await service.createWorkOrdersForDueSchedules(TENANT);

    expect(result.created).toBe(0);
    expect(prisma.maintenanceWorkOrder.create).not.toHaveBeenCalled();
  });

  it('creates nothing when no schedules are due', async () => {
    const { service } = makeService([]);

    const result = await service.createWorkOrdersForDueSchedules(TENANT);

    expect(result.created).toBe(0);
    expect(result.workOrders).toHaveLength(0);
  });
});
