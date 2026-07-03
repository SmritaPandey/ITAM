import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Helper: bulk asset generator ───────────────────────────────────────────
function genAssets(opts: {
  tenantId: string;
  typeId: string;
  prefix: string;
  models: { mfr: string; model: string }[];
  sites: string[];
  deptId?: string;
  count: number;
  costRange: [number, number];
  hasNetwork?: boolean;
  category?: string;
}) {
  const siteNames = ['NDBK-MUM', 'NDBK-TRS', 'NDBK-BLR', 'NDBK-DEL', 'NDBK-HYD', 'NDBK-PUN', 'NDBK-CHE', 'NDBK-KOL'];
  return Array.from({ length: opts.count }, (_, i) => {
    const pick = opts.models[i % opts.models.length];
    const status =
      i % 20 === 0
        ? ('RETIRED' as const)
        : i % 15 === 0
          ? ('IN_MAINTENANCE' as const)
          : i % 10 === 0
            ? ('IN_STORAGE' as const)
            : ('ACTIVE' as const);
    const tag = `${opts.prefix}-${String(i + 1).padStart(3, '0')}`;
    const siteSuffix = siteNames[i % opts.sites.length] || 'NDBK';
    return {
      tenantId: opts.tenantId,
      assetTag: tag,
      name: `${pick.mfr} ${pick.model}`,
      notes: opts.hasNetwork
        ? `${pick.mfr} ${pick.model} — ${opts.category || 'IT Asset'} deployed at ${siteSuffix}. Asset tag ${tag}.`
        : `${pick.mfr} ${pick.model} — ${opts.category || 'Asset'} at ${siteSuffix}. Tag ${tag}.`,
      category: opts.category || undefined,
      assetTypeId: opts.typeId,
      manufacturer: pick.mfr,
      model: pick.model,
      serialNumber: `SN${opts.prefix}${String(Math.random()).slice(2, 10)}`,
      siteId: opts.sites[i % opts.sites.length],
      departmentId: opts.deptId || undefined,
      status,
      purchasePrice: opts.costRange[0] + Math.floor(Math.random() * (opts.costRange[1] - opts.costRange[0])),
      procurementDate: new Date(2023 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)),
      warrantyExpiry: new Date(2026 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 12), 1),
      ...(opts.hasNetwork
        ? {
            hostname: `${siteSuffix}-${opts.prefix}-${String(i + 1).padStart(3, '0')}`,
            ipAddress: `10.${10 + Math.floor(i / 254)}.${(i % 254) + 1}.${1 + Math.floor(Math.random() * 250)}`,
            macAddress: Array.from({ length: 6 }, () =>
              Math.floor(Math.random() * 256)
                .toString(16)
                .padStart(2, '0'),
            ).join(':'),
          }
        : {}),
    };
  });
}

async function main() {
  console.log('🧹 Cleaning existing data...');

  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.notificationChannel.deleteMany();
  await prisma.endpointChange.deleteMany();
  await prisma.endpointPolicy.deleteMany();
  await prisma.scanResult.deleteMany();
  await prisma.scanJob.deleteMany();
  await prisma.scanCredential.deleteMany();
  await prisma.scheduledScan.deleteMany();
  await prisma.scheduledReport.deleteMany();
  await prisma.agentBaseline.deleteMany();
  await prisma.deviceMetricsHistory.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.patchDeployment.deleteMany();
  await prisma.patch.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.slaPolicy.deleteMany();
  await prisma.automationExecution.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.licenseAssignment.deleteMany();
  await prisma.license.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticketAsset.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.changeRequest.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.serviceCatalogItem.deleteMany();
  await prisma.gpsTelemetry.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.userTelemetry.deleteMany();
  await prisma.monitoredDevice.deleteMany();
  await prisma.discoveredDevice.deleteMany();
  await prisma.networkConfig.deleteMany();
  await prisma.hardwareDetail.deleteMany();
  await prisma.osDetail.deleteMany();
  await prisma.softwareInstallation.deleteMany();
  await prisma.softwareCatalog.deleteMany();
  await prisma.securityPosture.deleteMany();
  await prisma.assetAttestation.deleteMany();
  await prisma.assetCheckout.deleteMany();
  await prisma.assetHistory.deleteMany();
  await prisma.assetRelationship.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.assetType.deleteMany();
  await prisma.scriptLibrary.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.contactSubmission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.department.deleteMany();
  await prisma.site.deleteMany();
  await prisma.tenant.deleteMany();

  console.log('✅ Database cleaned');

  // ─── 2. TENANTS ────────────────────────────────────────────────────────────
  const bankTenant = await prisma.tenant.create({
    data: {
      name: 'National Digital Bank',
      slug: 'national-digital-bank',
      domain: 'nationaldigitalbank.com',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      settings: {
        currency: 'INR',
        dateFormat: 'DD/MM/YYYY',
        fiscalYearStart: 'April',
        mfaEnforced: true,
        assetTagPrefix: 'NDB',
        ticketAutoAssign: true,
      },
    },
  });

  const platformTenant = await prisma.tenant.create({
    data: {
      name: 'QS Asset Platform',
      slug: 'qs-asset-platform',
      domain: 'qsasset.com',
      plan: 'ON_PREMISE',
      status: 'ACTIVE',
      settings: { platformMode: true, multiTenant: true, maxTenants: 500 },
    },
  });

  // ─── 3. SITES ──────────────────────────────────────────────────────────────
  const siteMumbaiHQ = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Mumbai HQ', address: 'Bandra Kurla Complex, G Block', city: 'Mumbai', state: 'Maharashtra', country: 'India', zipCode: '400051', isHq: true },
  });
  const siteTreasury = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Treasury Mumbai', address: 'Nariman Point, Marine Drive', city: 'Mumbai', state: 'Maharashtra', country: 'India', zipCode: '400021', isHq: false },
  });
  const siteBangalore = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Bangalore Tech Hub', address: 'Whitefield, ITPL Road', city: 'Bangalore', state: 'Karnataka', country: 'India', zipCode: '560066', isHq: false },
  });
  const siteDelhi = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Delhi Regional Office', address: 'Connaught Place, Block A', city: 'New Delhi', state: 'Delhi', country: 'India', zipCode: '110001', isHq: false },
  });
  const siteChennai = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Chennai DR Center', address: 'Tidel Park, Taramani', city: 'Chennai', state: 'Tamil Nadu', country: 'India', zipCode: '600113', isHq: false },
  });

  const allSiteIds = [siteMumbaiHQ.id, siteTreasury.id, siteBangalore.id, siteDelhi.id, siteChennai.id];

  // ─── 4. DEPARTMENTS ────────────────────────────────────────────────────────
  const deptIT = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'IT Infrastructure', code: 'IT-INFRA' } });
  const deptCyber = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Cybersecurity', code: 'CYBER' } });
  const deptCoreBanking = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteBangalore.id, name: 'Core Banking', code: 'CORE-BNK' } });
  const deptRetail = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteDelhi.id, name: 'Retail Banking', code: 'RETAIL' } });
  const deptFacilities = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Facilities', code: 'FACILITIES' } });

  // ─── 5. ROLES ──────────────────────────────────────────────────────────────
  const roleTenantAdmin = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Tenant Admin', isSystem: true, permissions: { '*': ['*'] } },
  });
  const roleSecurityAdmin = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Security Admin', isSystem: false, permissions: { assets: ['read'], security: ['*'], scans: ['*'] } },
  });
  const roleITAdmin = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'IT Admin', isSystem: false, permissions: { assets: ['*'], tickets: ['*'] } },
  });
  const roleEmployee = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Employee', isSystem: false, permissions: { assets: ['read'], tickets: ['create', 'read'] } },
  });
  const rolePlatformOwner = await prisma.role.create({
    data: { tenantId: platformTenant.id, name: 'Platform Owner', isSystem: true, permissions: { '*': ['*'] } },
  });

  // ─── 6. USERS ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo@2026', 12);

  const userDirector = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'director@demobank.com', passwordHash, firstName: 'Rajesh', lastName: 'Kapoor', roleId: roleTenantAdmin.id, departmentId: deptIT.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' },
  });
  const userCISO = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'ciso@demobank.com', passwordHash, firstName: 'Priya', lastName: 'Sharma', roleId: roleSecurityAdmin.id, departmentId: deptCyber.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' },
  });
  const userITSupport = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'itsupport@demobank.com', passwordHash, firstName: 'Amit', lastName: 'Patel', roleId: roleITAdmin.id, departmentId: deptIT.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' },
  });
  const userNetworkEng = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'network.eng@demobank.com', passwordHash, firstName: 'Deepak', lastName: 'Nair', roleId: roleITAdmin.id, departmentId: deptIT.id, siteId: siteBangalore.id, status: 'ACTIVE' },
  });
  const userEmployee = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'employee@demobank.com', passwordHash, firstName: 'Vikram', lastName: 'Singh', roleId: roleEmployee.id, departmentId: deptCoreBanking.id, siteId: siteBangalore.id, status: 'ACTIVE' },
  });
  const userPlatformOwner = await prisma.user.create({
    data: { tenantId: platformTenant.id, email: 'owner@qsasset.com', passwordHash, firstName: 'Admin', lastName: 'QS', roleId: rolePlatformOwner.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE', isSuperAdmin: true },
  });

  // ─── 7. ASSET TYPES ───────────────────────────────────────────────────────
  const typeHardware = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Hardware', isItAsset: true, icon: 'Monitor', color: '#2563EB' } });
  const typeNetwork = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Network', isItAsset: true, icon: 'Wifi', color: '#7C3AED' } });
  const typeSecurity = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Security', isItAsset: true, icon: 'Shield', color: '#DC2626' } });
  
  const typeLaptop = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Laptop', parentId: typeHardware.id, isItAsset: true, icon: 'Laptop', color: '#3B82F6' } });
  const typeServer = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Server', parentId: typeHardware.id, isItAsset: true, icon: 'Server', color: '#1D4ED8' } });
  const typeSwitch = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Switch', parentId: typeNetwork.id, isItAsset: true, icon: 'GitBranch', color: '#8B5CF6' } });
  const typeFirewall = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Firewall', parentId: typeNetwork.id, isItAsset: true, icon: 'ShieldCheck', color: '#6D28D9' } });
  const typeCCTV = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'CCTV', parentId: typeSecurity.id, isItAsset: true, icon: 'Camera', color: '#EF4444' } });
  const typeUPS = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'UPS', isItAsset: true, icon: 'Zap', color: '#34D399' } });

  // ─── 8. ASSETS ────────────────────────────────────────────────────────────
  // Laptops
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeLaptop.id, prefix: 'LPT', count: 100, costRange: [70000, 150000], hasNetwork: true, category: 'Laptop',
      models: [{ mfr: 'Dell', model: 'Latitude 5540' }, { mfr: 'Lenovo', model: 'ThinkPad T14' }],
      sites: allSiteIds, deptId: deptIT.id,
    }),
  });

  // Servers
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeServer.id, prefix: 'SRV', count: 30, costRange: [400000, 2000000], hasNetwork: true, category: 'Server',
      models: [{ mfr: 'Dell', model: 'PowerEdge R760' }, { mfr: 'HPE', model: 'ProLiant DL380' }],
      sites: [siteMumbaiHQ.id, siteChennai.id], deptId: deptIT.id,
    }),
  });

  // Network
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeSwitch.id, prefix: 'NSW', count: 20, costRange: [100000, 500000], hasNetwork: true, category: 'Switch',
      models: [{ mfr: 'Cisco', model: 'Catalyst 9300' }, { mfr: 'Aruba', model: 'CX 6300' }],
      sites: allSiteIds,
    }),
  });

  // ─── 9. MONITORED DEVICES ────────────────────────────────────────────────
  const itAssets = await prisma.asset.findMany({
    where: { tenantId: bankTenant.id, ipAddress: { not: null } },
    include: { assetType: true },
  });

  const monitoredData = itAssets.map(asset => {
    const isNetwork = asset.assetType?.name === 'Switch' || asset.assetType?.name === 'Firewall';
    const isCCTV = asset.assetType?.name === 'CCTV';
    
    return {
      tenantId: bankTenant.id,
      name: asset.name,
      ipAddress: asset.ipAddress,
      type: isCCTV ? 'CAMERA' : isNetwork ? 'NETWORK_DEVICE' : 'VIRTUAL_MACHINE',
      status: Math.random() > 0.1 ? 'ONLINE' : 'WARNING',
      lastSeen: new Date(),
      metrics: {
        cpu: 10 + Math.floor(Math.random() * 40),
        memory: 20 + Math.floor(Math.random() * 50),
        latency: 1 + Math.floor(Math.random() * 5),
      },
      config: isNetwork ? { snmpCommunity: 'public', snmpVersion: 'v2c' } : {},
    };
  });

  await prisma.monitoredDevice.createMany({ data: monitoredData as any });

  // ─── 10. METRICS HISTORY (24h) ───────────────────────────────────────────
  const monitored = await prisma.monitoredDevice.findMany({ where: { tenantId: bankTenant.id }, take: 20 });
  const history: any[] = [];
  const now = new Date();

  for (const dev of monitored) {
    for (let h = 0; h < 24; h++) {
      history.push({
        tenantId: bankTenant.id,
        deviceId: dev.id,
        collectedAt: new Date(now.getTime() - h * 3600000),
        metrics: {
          cpu: 10 + Math.floor(Math.random() * 60),
          memory: 30 + Math.floor(Math.random() * 40),
          latency: 1 + Math.floor(Math.random() * 10),
        },
      });
    }
  }
  await prisma.deviceMetricsHistory.createMany({ data: history });

  // ─── 11. TOPOLOGY ────────────────────────────────────────────────────────
  const coreSwitch = await prisma.asset.findFirst({ where: { assetTag: 'NSW-001' } });
  const edgeSwitch = await prisma.asset.findFirst({ where: { assetTag: 'NSW-002' } });
  
  if (coreSwitch && edgeSwitch) {
    await prisma.assetRelationship.create({
      data: {
        tenantId: bankTenant.id,
        sourceAssetId: coreSwitch.id,
        targetAssetId: edgeSwitch.id,
        relationshipType: 'CONNECTED_TO',
        properties: { port: 'Gi1/0/24' },
      },
    });
  }

  // ─── 12. AGENTS ──────────────────────────────────────────────────────────
  const agentAssets = await prisma.asset.findMany({ where: { assetTypeId: typeLaptop.id }, take: 10 });
  await prisma.agent.createMany({
    data: agentAssets.map(a => ({
      tenantId: bankTenant.id,
      assetId: a.id,
      status: 'ONLINE',
      agentVersion: '1.2.0',
      hostname: a.hostname || `AGENT-${a.assetTag}`,
      platform: 'windows',
      lastHeartbeat: new Date(),
      ipAddress: a.ipAddress || '',
    })),
  });

  // ─── 13. NOTIFICATIONS ───────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { tenantId: bankTenant.id, userId: userDirector.id, title: 'Compliance Alert', message: 'Unauthorized device detected in Mumbai HQ.', type: 'SECURITY' },
      { tenantId: bankTenant.id, userId: userDirector.id, title: 'System Info', message: 'Weekly asset report generated.', type: 'INFO' },
    ],
  });

  console.log('🏦 Bank Demo Seed Complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
