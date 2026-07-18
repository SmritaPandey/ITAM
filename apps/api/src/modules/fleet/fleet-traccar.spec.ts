import { FleetService } from './fleet.service';

/**
 * Traccar / OsmAnd GPS webhook ingest. ingestTraccarOrOsmand() parses the
 * provider payload, maps the device key → asset (via settings map or asset
 * identifiers), and delegates persistence to ingestTelemetry (spied here so we
 * focus on parsing + device resolution).
 */
describe('FleetService.ingestTraccarOrOsmand', () => {
  const TENANT = 'tenant-1';

  function makeService(tenantSettings: any, asset: any) {
    const prisma: any = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: TENANT, settings: tenantSettings }) },
      asset: { findFirst: jest.fn().mockResolvedValue(asset) },
    };
    const service = new FleetService(prisma, {} as any);
    const ingestSpy = jest
      .spyOn(service, 'ingestTelemetry')
      .mockResolvedValue({ id: 'tel-1' } as any);
    return { service, prisma, ingestSpy };
  }

  it('maps a device via settings.fleet.traccarDeviceMap and ingests telemetry', async () => {
    const { service, ingestSpy } = makeService(
      { fleet: { traccarDeviceMap: { 'device-abc': 'asset-1' } } },
      null,
    );

    const result = await service.ingestTraccarOrOsmand(TENANT, {
      uniqueId: 'device-abc',
      latitude: 12.9,
      longitude: 77.5,
      speed: 42,
    });

    expect(result).toEqual({ ok: true, assetId: 'asset-1', telemetryId: 'tel-1', speed: 42 });
    expect(ingestSpy).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ assetId: 'asset-1', latitude: 12.9, longitude: 77.5, speed: 42 }),
    );
  });

  it('falls back to matching an asset by identifier when unmapped', async () => {
    const { service, prisma, ingestSpy } = makeService({}, { id: 'asset-2' });

    const result = await service.ingestTraccarOrOsmand(TENANT, {
      deviceId: 'VH-002',
      lat: 1,
      lon: 2,
    });

    expect(result.ok).toBe(true);
    expect(result.assetId).toBe('asset-2');
    // asset lookup is tenant-scoped and matches on multiple identifier fields
    const where = prisma.asset.findFirst.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT);
    expect(where.OR).toEqual(
      expect.arrayContaining([{ id: 'VH-002' }, { assetTag: 'VH-002' }, { hostname: 'VH-002' }]),
    );
    expect(ingestSpy).toHaveBeenCalled();
  });

  it('errors on missing coordinates without ingesting', async () => {
    const { service, ingestSpy } = makeService({}, null);

    const result = await service.ingestTraccarOrOsmand(TENANT, { uniqueId: 'x' });

    expect(result).toEqual({ error: 'latitude/longitude required' });
    expect(ingestSpy).not.toHaveBeenCalled();
  });

  it('errors when no asset can be mapped for the device', async () => {
    const { service, ingestSpy } = makeService({}, null);

    const result = await service.ingestTraccarOrOsmand(TENANT, {
      uniqueId: 'unknown-device',
      latitude: 1,
      longitude: 2,
    });

    expect(result.error).toContain('No asset mapped');
    expect(result.deviceKey).toBe('unknown-device');
    expect(ingestSpy).not.toHaveBeenCalled();
  });
});
