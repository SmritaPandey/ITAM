import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import AdmZip from 'adm-zip';

/**
 * Air-gapped patch bundle export/import using ZIP (adm-zip).
 * Bundle contains catalog items + patch metadata as JSON — no mock data.
 */
@Injectable()
export class PatchBundleService {
  private readonly logger = new Logger(PatchBundleService.name);

  constructor(private prisma: PrismaService) {}

  async exportBundle(tenantId: string): Promise<Buffer> {
    const [catalog, patches, policies] = await Promise.all([
      this.prisma.patchCatalogItem.findMany({
        where: { OR: [{ tenantId }, { tenantId: null }] },
        take: 5000,
      }),
      this.prisma.patch.findMany({ where: { tenantId }, take: 2000 }),
      this.prisma.patchDeployPolicy.findMany({ where: { tenantId } }),
    ]);

    const zip = new AdmZip();
    const manifest = {
      format: 'qs-patch-bundle',
      version: 1,
      exportedAt: new Date().toISOString(),
      tenantId,
      counts: {
        catalog: catalog.length,
        patches: patches.length,
        policies: policies.length,
      },
    };

    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
    zip.addFile('catalog.json', Buffer.from(JSON.stringify(catalog, null, 2), 'utf8'));
    zip.addFile('patches.json', Buffer.from(JSON.stringify(patches, null, 2), 'utf8'));
    zip.addFile('policies.json', Buffer.from(JSON.stringify(policies, null, 2), 'utf8'));

    this.logger.log(
      `Exported patch bundle for tenant ${tenantId}: ${catalog.length} catalog, ${patches.length} patches`,
    );
    return zip.toBuffer();
  }

  async importBundle(tenantId: string, zipBuffer: Buffer) {
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch {
      throw new BadRequestException('Invalid ZIP file');
    }

    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) throw new BadRequestException('Missing manifest.json');
    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    if (manifest.format !== 'qs-patch-bundle') {
      throw new BadRequestException('Unrecognized patch bundle format');
    }

    const catalogEntry = zip.getEntry('catalog.json');
    const patchesEntry = zip.getEntry('patches.json');
    const policiesEntry = zip.getEntry('policies.json');

    let catalogImported = 0;
    let patchesImported = 0;
    let policiesImported = 0;

    if (catalogEntry) {
      const items: any[] = JSON.parse(catalogEntry.getData().toString('utf8'));
      for (const item of items) {
        const version = item.version || '';
        try {
          await this.prisma.patchCatalogItem.upsert({
            where: {
              source_packageId_version: {
                source: item.source,
                packageId: item.packageId,
                version,
              },
            },
            create: {
              tenantId,
              source: item.source,
              packageId: item.packageId,
              name: item.name,
              version: item.version || null,
              publisher: item.publisher || null,
              metadata: item.metadata || {},
              syncedAt: new Date(),
            },
            update: {
              name: item.name,
              publisher: item.publisher || null,
              metadata: item.metadata || {},
              syncedAt: new Date(),
              tenantId,
            },
          });
          catalogImported++;
        } catch (err: any) {
          this.logger.warn(`Catalog import skip ${item.packageId}: ${err.message}`);
        }
      }
    }

    if (patchesEntry) {
      const patches: any[] = JSON.parse(patchesEntry.getData().toString('utf8'));
      for (const p of patches) {
        try {
          const existing = await this.prisma.patch.findFirst({
            where: { tenantId, patchId: p.patchId },
          });
          if (existing) {
            await this.prisma.patch.update({
              where: { id: existing.id },
              data: {
                title: p.title,
                severity: p.severity,
                category: p.category,
                notes: p.notes,
                deployRing: p.deployRing || existing.deployRing,
                catalogItemId: p.catalogItemId || existing.catalogItemId,
              },
            });
          } else {
            await this.prisma.patch.create({
              data: {
                tenantId,
                patchId: p.patchId,
                title: p.title,
                severity: p.severity || 'Medium',
                status: 'Pending',
                category: p.category || 'Security',
                notes: p.notes,
                deployRing: p.deployRing || 'ALL',
                scanSource: 'AIRGAP_IMPORT',
                catalogItemId: p.catalogItemId || null,
              },
            });
          }
          patchesImported++;
        } catch (err: any) {
          this.logger.warn(`Patch import skip ${p.patchId}: ${err.message}`);
        }
      }
    }

    if (policiesEntry) {
      const policies: any[] = JSON.parse(policiesEntry.getData().toString('utf8'));
      for (const pol of policies) {
        try {
          const existing = await this.prisma.patchDeployPolicy.findFirst({
            where: { tenantId, name: pol.name },
          });
          if (existing) {
            await this.prisma.patchDeployPolicy.update({
              where: { id: existing.id },
              data: {
                pilotAssetIds: pol.pilotAssetIds || [],
                stagedAssetIds: pol.stagedAssetIds || [],
                scheduleCron: pol.scheduleCron || null,
                autoPromote: !!pol.autoPromote,
              },
            });
          } else {
            await this.prisma.patchDeployPolicy.create({
              data: {
                tenantId,
                name: pol.name,
                pilotAssetIds: pol.pilotAssetIds || [],
                stagedAssetIds: pol.stagedAssetIds || [],
                scheduleCron: pol.scheduleCron || null,
                autoPromote: !!pol.autoPromote,
              },
            });
          }
          policiesImported++;
        } catch (err: any) {
          this.logger.warn(`Policy import skip ${pol.name}: ${err.message}`);
        }
      }
    }

    return {
      status: 'ok',
      catalogImported,
      patchesImported,
      policiesImported,
      sourceExportedAt: manifest.exportedAt,
    };
  }
}
