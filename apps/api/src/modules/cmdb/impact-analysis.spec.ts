import { NotFoundException } from '@nestjs/common';
import { CmdbService } from './cmdb.service';

/**
 * CMDB impact analysis BFS. getImpactAnalysis() walks DEPENDS_ON / COMPONENT_OF
 * relationships breadth-first. We feed a small mocked graph and assert depth
 * assignment, dedup (visited set), and tenant scoping.
 */
describe('CmdbService.getImpactAnalysis', () => {
  const TENANT = 'tenant-1';

  const node = (id: string, status = 'ACTIVE') => ({
    id,
    name: `Asset ${id}`,
    assetTag: `AT-${id}`,
    status,
  });

  /**
   * Graph:  A --DEPENDS_ON--> B --COMPONENT_OF--> C
   *         B --DEPENDS_ON--> A   (back-edge to test the visited set / cycles)
   */
  function makeService(rels: any[]) {
    const prisma: any = {
      asset: {
        findFirst: jest.fn().mockResolvedValue(node('A')),
      },
      assetRelationship: {
        findMany: jest.fn(({ where }: any) => {
          const frontier: string[] = where.OR[0].sourceAssetId.in;
          return Promise.resolve(
            rels.filter(
              (r) =>
                frontier.includes(r.sourceAssetId) ||
                frontier.includes(r.targetAssetId),
            ),
          );
        }),
      },
    };
    const service = new CmdbService(prisma);
    return { service, prisma };
  }

  const graph = [
    {
      sourceAssetId: 'A',
      targetAssetId: 'B',
      relationshipType: 'DEPENDS_ON',
      sourceAsset: node('A'),
      targetAsset: node('B'),
    },
    {
      sourceAssetId: 'B',
      targetAssetId: 'C',
      relationshipType: 'COMPONENT_OF',
      sourceAsset: node('B'),
      targetAsset: node('C', 'OFFLINE'),
    },
    {
      sourceAssetId: 'B',
      targetAssetId: 'A',
      relationshipType: 'DEPENDS_ON',
      sourceAsset: node('B'),
      targetAsset: node('A'),
    },
  ];

  it('walks the graph breadth-first assigning depths', async () => {
    const { service } = makeService(graph);

    const result = await service.getImpactAnalysis('A', TENANT);

    expect(result.rootAssetId).toBe('A');
    expect(result.impactedCount).toBe(2);

    const b = result.impacted.find((i) => i.assetId === 'B');
    const c = result.impacted.find((i) => i.assetId === 'C');
    expect(b).toMatchObject({ depth: 1, via: 'DEPENDS_ON' });
    expect(c).toMatchObject({ depth: 2, via: 'COMPONENT_OF' });
    expect(result.maxDepth).toBe(2);
  });

  it('does not revisit the root (cycle-safe)', async () => {
    const { service } = makeService(graph);

    const result = await service.getImpactAnalysis('A', TENANT);

    // A is the root and must never appear in the impacted list
    expect(result.impacted.some((i) => i.assetId === 'A')).toBe(false);
  });

  it('scopes relationship queries to the tenant', async () => {
    const { service, prisma } = makeService(graph);

    await service.getImpactAnalysis('A', TENANT);

    for (const call of prisma.assetRelationship.findMany.mock.calls) {
      expect(call[0].where.tenantId).toBe(TENANT);
      expect(call[0].where.relationshipType.in).toEqual(
        expect.arrayContaining(['DEPENDS_ON', 'COMPONENT_OF']),
      );
    }
  });

  it('returns an empty impact set for an isolated asset', async () => {
    const { service } = makeService([]);

    const result = await service.getImpactAnalysis('A', TENANT);

    expect(result.impactedCount).toBe(0);
    expect(result.maxDepth).toBe(0);
  });

  it('throws when the root asset is missing', async () => {
    const { service, prisma } = makeService(graph);
    prisma.asset.findFirst.mockResolvedValue(null);

    await expect(service.getImpactAnalysis('ghost', TENANT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
