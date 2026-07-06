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

  // Delete in reverse dependency order
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
  await prisma.discoveredDevice.deleteMany();
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. TENANTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🏦 Seeding Tenants...');
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
  console.log('  ✓ 2 Tenants');

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SITES (8)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🏢 Seeding Sites...');
  const siteMumbaiHQ = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Mumbai HQ', address: 'Bandra Kurla Complex, G Block', city: 'Mumbai', state: 'Maharashtra', country: 'India', zipCode: '400051', isHq: true, latitude: 19.0596, longitude: 72.8656 },
  });
  const siteTreasury = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Treasury Mumbai', address: 'Nariman Point, Marine Drive', city: 'Mumbai', state: 'Maharashtra', country: 'India', zipCode: '400021', latitude: 18.9256, longitude: 72.8242 },
  });
  const siteBangalore = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Bangalore Tech Hub', address: 'Whitefield, ITPL Road', city: 'Bangalore', state: 'Karnataka', country: 'India', zipCode: '560066', latitude: 12.9698, longitude: 77.7500 },
  });
  const siteDelhi = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Delhi Regional Office', address: 'Connaught Place, Block A', city: 'New Delhi', state: 'Delhi', country: 'India', zipCode: '110001', latitude: 28.6315, longitude: 77.2167 },
  });
  const siteHyderabad = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Hyderabad Branch', address: 'HITEC City, Madhapur', city: 'Hyderabad', state: 'Telangana', country: 'India', zipCode: '500081', latitude: 17.4435, longitude: 78.3772 },
  });
  const sitePune = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Pune Branch', address: 'Hinjewadi Phase 2', city: 'Pune', state: 'Maharashtra', country: 'India', zipCode: '411057', latitude: 18.5912, longitude: 73.7388 },
  });
  const siteChennai = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Chennai DR Center', address: 'Tidel Park, Taramani', city: 'Chennai', state: 'Tamil Nadu', country: 'India', zipCode: '600113', latitude: 12.9855, longitude: 80.2422 },
  });
  const siteKolkata = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Kolkata Branch', address: 'Salt Lake Sector V', city: 'Kolkata', state: 'West Bengal', country: 'India', zipCode: '700091', latitude: 22.5726, longitude: 88.4379 },
  });

  const allSiteIds = [siteMumbaiHQ.id, siteTreasury.id, siteBangalore.id, siteDelhi.id, siteHyderabad.id, sitePune.id, siteChennai.id, siteKolkata.id];
  console.log('  ✓ 8 Sites');

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. DEPARTMENTS (12)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🏬 Seeding Departments...');
  const deptIT = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'IT Infrastructure', code: 'IT-INFRA', costCenter: 'CC-1001' } });
  const deptCyber = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Cybersecurity', code: 'CYBER', costCenter: 'CC-1002' } });
  const deptCoreBanking = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteBangalore.id, name: 'Core Banking', code: 'CORE-BNK', costCenter: 'CC-2001' } });
  const deptTreasury = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteTreasury.id, name: 'Treasury', code: 'TREASURY', costCenter: 'CC-3001' } });
  const deptRetail = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteDelhi.id, name: 'Retail Banking', code: 'RETAIL', costCenter: 'CC-4001' } });
  const deptCorporate = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Corporate Lending', code: 'CORP-LEND', costCenter: 'CC-5001' } });
  const deptRisk = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Risk & Compliance', code: 'RISK-COMP', costCenter: 'CC-6001' } });
  const deptHR = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'HR', code: 'HR', costCenter: 'CC-7001' } });
  const deptFacilities = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Facilities', code: 'FACILITIES', costCenter: 'CC-8001' } });
  const deptAudit = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Internal Audit', code: 'INT-AUDIT', costCenter: 'CC-9001' } });
  const deptLegal = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Legal', code: 'LEGAL', costCenter: 'CC-9002' } });
  const deptDigital = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteBangalore.id, name: 'Digital Banking', code: 'DIGITAL', costCenter: 'CC-2002' } });
  console.log('  ✓ 12 Departments');

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ROLES (7)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔑 Seeding Roles...');
  const roleTenantAdmin = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Tenant Admin', isSystem: true, permissions: { '*': ['*'] } },
  });
  const roleITAdmin = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'IT Admin', isSystem: false, permissions: { assets: ['*'], tickets: ['*'], scans: ['*'], patches: ['*'] } },
  });
  const roleSecurityAdmin = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Security Admin', isSystem: false, permissions: { assets: ['read'], security: ['*'], scans: ['*'], compliance: ['*'] } },
  });
  const roleBranchMgr = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Branch Manager', isSystem: false, permissions: { assets: ['read', 'update'], tickets: ['*'], reports: ['read'] } },
  });
  const roleEmployee = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Employee', isSystem: false, permissions: { assets: ['read'], tickets: ['create', 'read'] } },
  });
  const roleFleetMgr = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Fleet Manager', isSystem: false, permissions: { assets: ['*'], fleet: ['*'], reports: ['read'] } },
  });
  const rolePlatformOwner = await prisma.role.create({
    data: { tenantId: platformTenant.id, name: 'Platform Owner', isSystem: true, permissions: { '*': ['*'] } },
  });
  console.log('  ✓ 7 Roles');

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. USERS (16)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('👥 Seeding Users...');
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
  const userBranchMgr = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'branchmgr@demobank.com', passwordHash, firstName: 'Sunita', lastName: 'Verma', roleId: roleBranchMgr.id, departmentId: deptRetail.id, siteId: siteDelhi.id, status: 'ACTIVE' },
  });
  const userEmployee = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'employee@demobank.com', passwordHash, firstName: 'Vikram', lastName: 'Singh', roleId: roleEmployee.id, departmentId: deptCoreBanking.id, siteId: siteBangalore.id, status: 'ACTIVE' },
  });
  const userPlatformOwner = await prisma.user.create({
    data: { tenantId: platformTenant.id, email: 'owner@qsasset.com', passwordHash, firstName: 'Admin', lastName: 'QS', roleId: rolePlatformOwner.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE', isSuperAdmin: true },
  });
  const userNetworkEng = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'network.eng@demobank.com', passwordHash, firstName: 'Deepak', lastName: 'Nair', roleId: roleITAdmin.id, departmentId: deptIT.id, siteId: siteBangalore.id, status: 'ACTIVE' },
  });
  const userDBA = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'dba@demobank.com', passwordHash, firstName: 'Kavitha', lastName: 'Ramasamy', roleId: roleITAdmin.id, departmentId: deptCoreBanking.id, siteId: siteBangalore.id, status: 'ACTIVE' },
  });
  const userSecAnalyst = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'secanalyst@demobank.com', passwordHash, firstName: 'Arjun', lastName: 'Menon', roleId: roleSecurityAdmin.id, departmentId: deptCyber.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' },
  });
  const userTreasuryMgr = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'treasury.mgr@demobank.com', passwordHash, firstName: 'Neha', lastName: 'Gupta', roleId: roleBranchMgr.id, departmentId: deptTreasury.id, siteId: siteTreasury.id, status: 'ACTIVE' },
  });
  const userRiskOfficer = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'risk.officer@demobank.com', passwordHash, firstName: 'Suresh', lastName: 'Iyer', roleId: roleBranchMgr.id, departmentId: deptRisk.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' },
  });
  const userHRManager = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'hr.manager@demobank.com', passwordHash, firstName: 'Ananya', lastName: 'Das', roleId: roleBranchMgr.id, departmentId: deptHR.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' },
  });
  const userFleetMgr = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'fleet.mgr@demobank.com', passwordHash, firstName: 'Ravi', lastName: 'Kumar', roleId: roleFleetMgr.id, departmentId: deptFacilities.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' },
  });
  const userDigitalLead = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'digital.lead@demobank.com', passwordHash, firstName: 'Meera', lastName: 'Joshi', roleId: roleITAdmin.id, departmentId: deptDigital.id, siteId: siteBangalore.id, status: 'ACTIVE' },
  });
  const userAuditor = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'auditor@demobank.com', passwordHash, firstName: 'Karthik', lastName: 'Pillai', roleId: roleEmployee.id, departmentId: deptAudit.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' },
  });
  const userLegal = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'legal@demobank.com', passwordHash, firstName: 'Divya', lastName: 'Reddy', roleId: roleEmployee.id, departmentId: deptLegal.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' },
  });
  console.log('  ✓ 16 Users');

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. ASSET TYPES (22 with parent/child hierarchy)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📦 Seeding Asset Types...');
  // Parents
  const typeHardware = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Hardware', isItAsset: true, icon: 'Monitor', color: '#2563EB' } });
  const typeNetwork = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Network', isItAsset: true, icon: 'Wifi', color: '#7C3AED' } });
  const typeSecurity = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Security', isItAsset: true, icon: 'Shield', color: '#DC2626' } });
  const typePeripheral = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Peripheral', isItAsset: true, icon: 'Printer', color: '#059669' } });
  const typeFacility = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Facility', isItAsset: false, icon: 'Building', color: '#D97706' } });
  const typeVehicle = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Vehicle', isItAsset: false, icon: 'Truck', color: '#0891B2' } });

  // Children — Hardware
  const typeLaptop = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Laptop', parentId: typeHardware.id, isItAsset: true, icon: 'Laptop', color: '#3B82F6' } });
  const typeDesktop = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Desktop', parentId: typeHardware.id, isItAsset: true, icon: 'Monitor', color: '#2563EB' } });
  const typeServer = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Server', parentId: typeHardware.id, isItAsset: true, icon: 'Server', color: '#1D4ED8' } });
  const typeThinClient = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Thin Client', parentId: typeHardware.id, isItAsset: true, icon: 'Tv', color: '#1E40AF' } });
  const typeATM = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'ATM', parentId: typeHardware.id, isItAsset: true, icon: 'CreditCard', color: '#1E3A8A' } });

  // Children — Network
  const typeSwitch = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Switch', parentId: typeNetwork.id, isItAsset: true, icon: 'GitBranch', color: '#8B5CF6' } });
  const typeRouter = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Router', parentId: typeNetwork.id, isItAsset: true, icon: 'Router', color: '#7C3AED' } });
  const typeFirewall = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Firewall', parentId: typeNetwork.id, isItAsset: true, icon: 'ShieldCheck', color: '#6D28D9' } });
  const typeAP = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Access Point', parentId: typeNetwork.id, isItAsset: true, icon: 'Radio', color: '#5B21B6' } });

  // Children — Security
  const typeCCTV = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'CCTV', parentId: typeSecurity.id, isItAsset: true, icon: 'Camera', color: '#EF4444' } });
  const typeBiometric = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Biometric', parentId: typeSecurity.id, isItAsset: true, icon: 'Fingerprint', color: '#B91C1C' } });

  // Children — Peripheral
  const typePrinter = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Printer', parentId: typePeripheral.id, isItAsset: true, icon: 'Printer', color: '#10B981' } });
  const typeUPS = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'UPS', parentId: typePeripheral.id, isItAsset: true, icon: 'Zap', color: '#34D399' } });
  const typeScanner = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Scanner', parentId: typePeripheral.id, isItAsset: true, icon: 'Scan', color: '#6EE7B7' } });

  // Children — Facility
  const typeFurniture = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Furniture', parentId: typeFacility.id, isItAsset: false, icon: 'Armchair', color: '#F59E0B' } });
  const typeAC = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'AC', parentId: typeFacility.id, isItAsset: false, icon: 'Wind', color: '#FBBF24' } });

  console.log('  ✓ 22 Asset Types');

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. ASSETS (520+)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('💻 Seeding Assets...');

  // Laptops (120)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeLaptop.id, prefix: 'LPT', count: 120, costRange: [70000, 150000], hasNetwork: true, category: 'Laptop',
      models: [{ mfr: 'Dell', model: 'Latitude 5540' }, { mfr: 'Lenovo', model: 'ThinkPad T14' }, { mfr: 'HP', model: 'EliteBook 840' }],
      sites: allSiteIds, deptId: deptIT.id,
    }) as any,
  });

  // Desktops (80)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeDesktop.id, prefix: 'DSK', count: 80, costRange: [50000, 100000], hasNetwork: true, category: 'Desktop',
      models: [{ mfr: 'Dell', model: 'OptiPlex 7010' }, { mfr: 'Lenovo', model: 'ThinkCentre M70q' }, { mfr: 'HP', model: 'ProDesk 400' }],
      sites: allSiteIds, deptId: deptIT.id,
    }) as any,
  });

  // Servers (40)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeServer.id, prefix: 'SRV', count: 40, costRange: [400000, 2000000], hasNetwork: true, category: 'Server',
      models: [{ mfr: 'Dell', model: 'PowerEdge R760' }, { mfr: 'HPE', model: 'ProLiant DL380' }, { mfr: 'Lenovo', model: 'ThinkSystem SR650' }],
      sites: [siteMumbaiHQ.id, siteChennai.id, siteBangalore.id], deptId: deptIT.id,
    }) as any,
  });

  // Thin Clients (35)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeThinClient.id, prefix: 'TCL', count: 35, costRange: [25000, 45000], hasNetwork: true, category: 'Thin Client',
      models: [{ mfr: 'Dell', model: 'Wyse 5070' }, { mfr: 'HP', model: 't640 Thin Client' }],
      sites: allSiteIds, deptId: deptRetail.id,
    }) as any,
  });

  // ATMs (30)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeATM.id, prefix: 'ATM', count: 30, costRange: [800000, 1500000], hasNetwork: true, category: 'ATM',
      models: [{ mfr: 'NCR', model: 'SelfServ 80' }, { mfr: 'Diebold Nixdorf', model: 'DN Series 400' }],
      sites: allSiteIds, deptId: deptRetail.id,
    }) as any,
  });

  // Switches (40)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeSwitch.id, prefix: 'NSW', count: 40, costRange: [100000, 500000], hasNetwork: true, category: 'Switch',
      models: [{ mfr: 'Cisco', model: 'Catalyst 9300' }, { mfr: 'Aruba', model: 'CX 6300' }, { mfr: 'Juniper', model: 'EX4400' }],
      sites: allSiteIds,
    }) as any,
  });

  // Routers (15)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeRouter.id, prefix: 'RTR', count: 15, costRange: [200000, 800000], hasNetwork: true, category: 'Router',
      models: [{ mfr: 'Cisco', model: 'ISR 4431' }, { mfr: 'Juniper', model: 'MX204' }],
      sites: allSiteIds,
    }) as any,
  });

  // Firewalls (10)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeFirewall.id, prefix: 'FWL', count: 10, costRange: [500000, 2000000], hasNetwork: true, category: 'Firewall',
      models: [{ mfr: 'Palo Alto', model: 'PA-5260' }, { mfr: 'Fortinet', model: 'FortiGate 600E' }],
      sites: [siteMumbaiHQ.id, siteChennai.id, siteBangalore.id, siteDelhi.id],
    }) as any,
  });

  // Access Points (20)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeAP.id, prefix: 'WAP', count: 20, costRange: [15000, 45000], hasNetwork: true, category: 'Access Point',
      models: [{ mfr: 'Cisco', model: 'Meraki MR46' }, { mfr: 'Aruba', model: 'AP-535' }],
      sites: allSiteIds,
    }) as any,
  });

  // CCTVs (40)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeCCTV.id, prefix: 'CAM', count: 40, costRange: [10000, 50000], hasNetwork: true, category: 'CCTV',
      models: [{ mfr: 'Hikvision', model: 'DS-2CD2T47G2-L' }, { mfr: 'Dahua', model: 'IPC-HFW5442T' }, { mfr: 'Axis', model: 'P3245-LV' }],
      sites: allSiteIds, deptId: deptFacilities.id,
    }) as any,
  });

  // Biometrics (15)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeBiometric.id, prefix: 'BIO', count: 15, costRange: [20000, 60000], hasNetwork: true, category: 'Biometric',
      models: [{ mfr: 'ZKTeco', model: 'SpeedFace-V5L' }, { mfr: 'HID Global', model: 'iCLASS SE' }],
      sites: allSiteIds, deptId: deptFacilities.id,
    }) as any,
  });

  // Printers (25)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typePrinter.id, prefix: 'PRT', count: 25, costRange: [15000, 80000], hasNetwork: true, category: 'Printer',
      models: [{ mfr: 'HP', model: 'LaserJet M507' }, { mfr: 'Canon', model: 'imageRUNNER C3530' }],
      sites: allSiteIds,
    }) as any,
  });

  // UPS (10)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeUPS.id, prefix: 'UPS', count: 10, costRange: [50000, 300000], hasNetwork: true, category: 'UPS',
      models: [{ mfr: 'APC', model: 'Smart-UPS 3000' }, { mfr: 'Vertiv', model: 'Liebert GXT5' }],
      sites: [siteMumbaiHQ.id, siteChennai.id, siteBangalore.id],
    }) as any,
  });

  // Scanners (10)
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeScanner.id, prefix: 'SCN', count: 10, costRange: [10000, 40000], hasNetwork: true, category: 'Scanner',
      models: [{ mfr: 'Fujitsu', model: 'fi-8170' }, { mfr: 'Canon', model: 'DR-C230' }],
      sites: allSiteIds,
    }) as any,
  });

  // Furniture (20) — non-IT
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeFurniture.id, prefix: 'FRN', count: 20, costRange: [5000, 50000], hasNetwork: false, category: 'Furniture',
      models: [{ mfr: 'Godrej', model: 'Ergonomic Desk' }, { mfr: 'Featherlite', model: 'Optima Chair' }, { mfr: 'Steelcase', model: 'Gesture Chair' }],
      sites: allSiteIds, deptId: deptFacilities.id,
    }) as any,
  });

  // AC (5) — non-IT
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeAC.id, prefix: 'ACU', count: 5, costRange: [30000, 150000], hasNetwork: false, category: 'AC',
      models: [{ mfr: 'Daikin', model: 'FTKF50TV' }, { mfr: 'Blue Star', model: 'IC524DBTU' }],
      sites: [siteMumbaiHQ.id, siteBangalore.id, siteChennai.id],
    }) as any,
  });

  // Vehicles (10) — non-IT, fleet
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeVehicle.id, prefix: 'VEH', count: 10, costRange: [500000, 2500000], hasNetwork: false, category: 'Vehicle',
      models: [{ mfr: 'Maruti Suzuki', model: 'Ertiga' }, { mfr: 'Toyota', model: 'Innova Crysta' }, { mfr: 'Tata', model: 'Nexon EV' }],
      sites: [siteMumbaiHQ.id, siteDelhi.id, siteBangalore.id, siteKolkata.id],
    }) as any,
  });

  const totalAssets = await prisma.asset.count({ where: { tenantId: bankTenant.id } });
  console.log(`  ✓ ${totalAssets} Assets`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. MONITORED DEVICES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📡 Seeding Monitored Devices...');
  const itAssets = await prisma.asset.findMany({
    where: { tenantId: bankTenant.id, ipAddress: { not: null } },
    include: { assetType: true },
  });

  const monitoredData = itAssets.map(asset => {
    const isNetwork = ['Switch', 'Router', 'Firewall', 'Access Point'].includes(asset.assetType?.name || '');
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
  const monitoredCount = await prisma.monitoredDevice.count({ where: { tenantId: bankTenant.id } });
  console.log(`  ✓ ${monitoredCount} Monitored Devices`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. DEVICE METRICS HISTORY (24h backfill)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📊 Seeding Metrics History...');
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
  console.log(`  ✓ ${history.length} Metrics History entries`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. TOPOLOGY (Asset Relationships)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔗 Seeding Topology...');
  const coreSwitch = await prisma.asset.findFirst({ where: { assetTag: 'NSW-001' } });
  const edgeSwitch = await prisma.asset.findFirst({ where: { assetTag: 'NSW-002' } });
  const coreRouter = await prisma.asset.findFirst({ where: { assetTag: 'RTR-001' } });
  const fw1 = await prisma.asset.findFirst({ where: { assetTag: 'FWL-001' } });
  const srv1 = await prisma.asset.findFirst({ where: { assetTag: 'SRV-001' } });
  const srv2 = await prisma.asset.findFirst({ where: { assetTag: 'SRV-002' } });

  const topologyData: any[] = [];
  if (coreSwitch && edgeSwitch) {
    topologyData.push({ tenantId: bankTenant.id, sourceAssetId: coreSwitch.id, targetAssetId: edgeSwitch.id, relationshipType: 'CONNECTED_TO', properties: { port: 'Gi1/0/24', bandwidth: '10Gbps' } });
  }
  if (coreRouter && coreSwitch) {
    topologyData.push({ tenantId: bankTenant.id, sourceAssetId: coreRouter.id, targetAssetId: coreSwitch.id, relationshipType: 'CONNECTED_TO', properties: { port: 'Gi0/0', bandwidth: '10Gbps' } });
  }
  if (fw1 && coreRouter) {
    topologyData.push({ tenantId: bankTenant.id, sourceAssetId: fw1.id, targetAssetId: coreRouter.id, relationshipType: 'CONNECTED_TO', properties: { port: 'eth1', zone: 'DMZ' } });
  }
  if (srv1 && coreSwitch) {
    topologyData.push({ tenantId: bankTenant.id, sourceAssetId: srv1.id, targetAssetId: coreSwitch.id, relationshipType: 'CONNECTED_TO', properties: { port: 'eth0', vlan: 100 } });
  }
  if (srv1 && srv2) {
    topologyData.push({ tenantId: bankTenant.id, sourceAssetId: srv2.id, targetAssetId: srv1.id, relationshipType: 'BACKUP_OF', properties: { type: 'DR replica' } });
  }
  if (topologyData.length) {
    await prisma.assetRelationship.createMany({ data: topologyData as any });
  }
  console.log(`  ✓ ${topologyData.length} Asset Relationships`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. AGENTS (10+ laptop agents)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🤖 Seeding Agents...');
  const agentAssets = await prisma.asset.findMany({ where: { assetTypeId: typeLaptop.id }, take: 12 });
  await prisma.agent.createMany({
    data: agentAssets.map((a, i) => ({
      tenantId: bankTenant.id,
      assetId: a.id,
      status: i < 10 ? 'ONLINE' : 'OFFLINE',
      agentVersion: '1.2.0',
      hostname: a.hostname || `AGENT-${a.assetTag}`,
      platform: i % 3 === 0 ? 'linux' : 'windows',
      lastHeartbeat: new Date(now.getTime() - i * 300000),
      ipAddress: a.ipAddress || `10.10.${i}.1`,
      macAddress: a.macAddress || undefined,
      systemInfo: { os: i % 3 === 0 ? 'Ubuntu 22.04' : 'Windows 11 Pro', ram: '16GB', disk: '512GB SSD' },
    })) as any,
  });
  console.log(`  ✓ ${agentAssets.length} Agents`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. AGENT BASELINES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📋 Seeding Agent Baselines...');
  const agents = await prisma.agent.findMany({ where: { tenantId: bankTenant.id } });
  await prisma.agentBaseline.createMany({
    data: agents.map(a => ({
      tenantId: bankTenant.id,
      agentId: a.id,
      snapshot: {
        hostname: a.hostname,
        platform: a.platform,
        installedSoftware: ['Microsoft Office', 'Chrome', 'CrowdStrike Falcon'],
        ramGb: 16,
        diskGb: 512,
      },
      snapshotAt: new Date(),
    })) as any,
  });
  console.log(`  ✓ ${agents.length} Agent Baselines`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. TICKETS (30 banking scenarios)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🎫 Seeding Tickets...');
  // Alias for Facilities tickets — use userFleetMgr as facilities lead
  const userFacilities = userFleetMgr;

  const ticketData = [
    { ticketNumber: 'INC-0001', type: 'INCIDENT', subject: 'Core Banking System - Slow Response Time', description: 'CBS transactions taking over 30 seconds during peak hours. Multiple branches affected.', priority: 'CRITICAL', status: 'IN_PROGRESS', category: 'Application', requesterId: userEmployee.id, assignedToId: userDBA.id },
    { ticketNumber: 'INC-0002', type: 'INCIDENT', subject: 'ATM Cash Dispenser Jam - Delhi Connaught Place', description: 'ATM ATM-005 reporting cash dispenser jam. Customers unable to withdraw cash.', priority: 'HIGH', status: 'OPEN', category: 'Hardware', requesterId: userBranchMgr.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-0003', type: 'INCIDENT', subject: 'CCTV Feed Loss - Mumbai Treasury', description: 'CCTV cameras at Treasury floor showing no feed. Security concern.', priority: 'CRITICAL', status: 'IN_PROGRESS', category: 'Security', requesterId: userCISO.id, assignedToId: userSecAnalyst.id },
    { ticketNumber: 'INC-0004', type: 'INCIDENT', subject: 'Network Switch Failure - Bangalore DC', description: 'Core switch NSW-003 at Bangalore DC is unreachable. 40+ devices affected.', priority: 'CRITICAL', status: 'IN_PROGRESS', category: 'Network', requesterId: userNetworkEng.id, assignedToId: userNetworkEng.id },
    { ticketNumber: 'INC-0005', type: 'INCIDENT', subject: 'Printer Not Responding - HR Department', description: 'HP LaserJet PRT-005 not printing. Print queue stuck.', priority: 'LOW', status: 'OPEN', category: 'Peripheral', requesterId: userHRManager.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-0006', type: 'INCIDENT', subject: 'Email Server Down - Exchange Connectivity', description: 'Users unable to send/receive emails. Exchange server showing offline.', priority: 'HIGH', status: 'RESOLVED', category: 'Application', requesterId: userDirector.id, assignedToId: userITSupport.id, resolvedAt: new Date() },
    { ticketNumber: 'INC-0007', type: 'INCIDENT', subject: 'Biometric Access Failure - Main Entrance', description: 'Biometric reader BIO-001 at main entrance not authenticating employees.', priority: 'HIGH', status: 'OPEN', category: 'Security', requesterId: userFacilities.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-0008', type: 'INCIDENT', subject: 'UPS Battery Warning - Server Room', description: 'UPS-001 in Mumbai HQ server room showing battery low alert. Runtime < 5 min.', priority: 'CRITICAL', status: 'IN_PROGRESS', category: 'Infrastructure', requesterId: userITSupport.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-0009', type: 'INCIDENT', subject: 'Laptop Blue Screen - Treasury Analyst', description: 'Treasury analyst laptop LPT-015 experiencing recurring BSOD with DRIVER_IRQL error.', priority: 'MEDIUM', status: 'OPEN', category: 'Hardware', requesterId: userTreasuryMgr.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-0010', type: 'INCIDENT', subject: 'Ransomware Alert - Endpoint Detection', description: 'CrowdStrike flagged suspicious encryption activity on DSK-022 in Kolkata branch.', priority: 'CRITICAL', status: 'IN_PROGRESS', category: 'Security', requesterId: userCISO.id, assignedToId: userSecAnalyst.id },
    { ticketNumber: 'SR-0001', type: 'SERVICE_REQUEST', subject: 'New Laptop Request - Digital Banking Team', description: 'Request for 5 new Dell Latitude laptops for digital banking development team.', priority: 'MEDIUM', status: 'OPEN', category: 'Procurement', requesterId: userDigitalLead.id, assignedToId: userITSupport.id },
    { ticketNumber: 'SR-0002', type: 'SERVICE_REQUEST', subject: 'VPN Access - Work from Home', description: 'Request VPN access for 10 employees in corporate lending department.', priority: 'MEDIUM', status: 'IN_PROGRESS', category: 'Access', requesterId: userEmployee.id, assignedToId: userNetworkEng.id },
    { ticketNumber: 'SR-0003', type: 'SERVICE_REQUEST', subject: 'Adobe Creative Cloud License', description: 'Need Adobe CC license for marketing material preparation.', priority: 'LOW', status: 'PENDING', category: 'Software', requesterId: userHRManager.id, assignedToId: userITSupport.id },
    { ticketNumber: 'SR-0004', type: 'SERVICE_REQUEST', subject: 'Meeting Room AV Setup', description: 'Install projector and conference system in 3rd floor meeting room.', priority: 'LOW', status: 'NEW', category: 'Facilities', requesterId: userBranchMgr.id, assignedToId: userITSupport.id },
    { ticketNumber: 'SR-0005', type: 'SERVICE_REQUEST', subject: 'Database User Account - New DBA', description: 'Create Oracle DB admin account for new DBA joining Core Banking team.', priority: 'MEDIUM', status: 'IN_PROGRESS', category: 'Access', requesterId: userDBA.id, assignedToId: userDBA.id },
    { ticketNumber: 'INC-0011', type: 'INCIDENT', subject: 'Thin Client Boot Failure - Pune Branch', description: 'Multiple thin clients at Pune branch failing to PXE boot after firmware update.', priority: 'HIGH', status: 'OPEN', category: 'Hardware', requesterId: userBranchMgr.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-0012', type: 'INCIDENT', subject: 'Firewall Rule Blocking Treasury Trades', description: 'New firewall rule on FWL-002 blocking Bloomberg terminal traffic. Urgent trade impact.', priority: 'CRITICAL', status: 'IN_PROGRESS', category: 'Network', requesterId: userTreasuryMgr.id, assignedToId: userNetworkEng.id },
    { ticketNumber: 'INC-0013', type: 'INCIDENT', subject: 'Scanner Malfunction - Loan Processing', description: 'Fujitsu scanner SCN-003 producing garbled output. Loan documents unreadable.', priority: 'MEDIUM', status: 'OPEN', category: 'Peripheral', requesterId: userEmployee.id, assignedToId: userITSupport.id },
    { ticketNumber: 'CHG-0001', type: 'CHANGE', subject: 'Windows 11 Migration - Phase 1', description: 'Migrate 50 workstations from Windows 10 to Windows 11 23H2.', priority: 'MEDIUM', status: 'PENDING', category: 'Infrastructure', requesterId: userITSupport.id, assignedToId: userITSupport.id },
    { ticketNumber: 'CHG-0002', type: 'CHANGE', subject: 'Network Segmentation - PCI DSS Compliance', description: 'Implement VLAN segmentation for cardholder data environment per PCI DSS 4.0.', priority: 'HIGH', status: 'IN_PROGRESS', category: 'Network', requesterId: userCISO.id, assignedToId: userNetworkEng.id },
    { ticketNumber: 'MAINT-0001', type: 'MAINTENANCE', subject: 'Quarterly UPS Battery Test', description: 'Scheduled UPS battery load test for all data center UPS units.', priority: 'MEDIUM', status: 'NEW', category: 'Infrastructure', requesterId: userITSupport.id, assignedToId: userITSupport.id },
    { ticketNumber: 'MAINT-0002', type: 'MAINTENANCE', subject: 'Annual AC Servicing - Server Room', description: 'Scheduled preventive maintenance for precision AC units in server room.', priority: 'LOW', status: 'NEW', category: 'Facilities', requesterId: userFacilities.id, assignedToId: userFacilities.id },
    { ticketNumber: 'INC-0014', type: 'INCIDENT', subject: 'WiFi Dead Zone - 2nd Floor Mumbai HQ', description: 'No WiFi coverage in conference room area. AP WAP-005 may be faulty.', priority: 'MEDIUM', status: 'OPEN', category: 'Network', requesterId: userEmployee.id, assignedToId: userNetworkEng.id },
    { ticketNumber: 'INC-0015', type: 'INCIDENT', subject: 'Server Disk Space Critical - SRV-010', description: 'Application server SRV-010 disk usage at 95%. Log files consuming space.', priority: 'HIGH', status: 'IN_PROGRESS', category: 'Infrastructure', requesterId: userDBA.id, assignedToId: userITSupport.id },
    { ticketNumber: 'SR-0006', type: 'SERVICE_REQUEST', subject: 'Vehicle GPS Tracker Install', description: "Install GPS tracking devices on 5 new fleet vehicles in Mumbai.", priority: 'MEDIUM', status: 'NEW', category: 'Fleet', requesterId: userFleetMgr.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-0016', type: 'INCIDENT', subject: 'Oracle DB Connection Pool Exhaustion', description: 'Core banking Oracle DB showing connection pool exhausted. New connections failing.', priority: 'CRITICAL', status: 'IN_PROGRESS', category: 'Database', requesterId: userDBA.id, assignedToId: userDBA.id },
    { ticketNumber: 'SR-0007', type: 'SERVICE_REQUEST', subject: 'New Employee Onboarding Kit - 8 Joiners', description: 'Provision laptops, badges, and software for 8 new joiners in Digital Banking.', priority: 'MEDIUM', status: 'OPEN', category: 'Onboarding', requesterId: userHRManager.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-0017', type: 'INCIDENT', subject: 'Compliance Scan Failure - PCI Assets', description: 'Scheduled PCI compliance scan failed on 15 assets due to credential issues.', priority: 'HIGH', status: 'OPEN', category: 'Compliance', requesterId: userAuditor.id, assignedToId: userSecAnalyst.id },
    { ticketNumber: 'INC-0018', type: 'INCIDENT', subject: 'Desktop Freeze on Login - Hyderabad Branch', description: 'Desktops DSK-040 through DSK-045 freezing at login screen after patch Tuesday.', priority: 'HIGH', status: 'IN_PROGRESS', category: 'Hardware', requesterId: userBranchMgr.id, assignedToId: userITSupport.id },
    { ticketNumber: 'SR-0008', type: 'SERVICE_REQUEST', subject: 'Decommission Legacy Servers', description: 'Request to decommission 5 legacy Windows Server 2012 machines per EOL policy.', priority: 'LOW', status: 'NEW', category: 'Lifecycle', requesterId: userITSupport.id, assignedToId: userITSupport.id },
  ];



  for (const t of ticketData) {
    await prisma.ticket.create({
      data: {
        tenantId: bankTenant.id,
        ticketNumber: t.ticketNumber,
        type: t.type as any,
        subject: t.subject,
        description: t.description,
        priority: t.priority as any,
        status: t.status as any,
        category: t.category,
        requesterId: t.requesterId,
        assignedToId: t.assignedToId,
        resolvedAt: (t as any).resolvedAt || undefined,
      },
    });
  }
  console.log(`  ✓ ${ticketData.length} Tickets`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. TICKET COMMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('💬 Seeding Ticket Comments...');
  const ticketsForComments = await prisma.ticket.findMany({ where: { tenantId: bankTenant.id }, take: 15 });
  const commentData: any[] = [];
  const commentTemplates = [
    "Investigating the issue. Initial diagnostics in progress.",
    "Escalated to L2 support team for further analysis.",
    "Root cause identified. Working on fix.",
    "Vendor contacted for replacement parts. ETA 2 business days.",
    "Temporary workaround applied. Monitoring for recurrence.",
    "Patch applied successfully. Verifying resolution.",
    "Issue confirmed resolved. Closing ticket.",
    "Updated firewall rules. Testing connectivity now.",
    "Backup completed before proceeding with changes.",
    "Scheduled maintenance window confirmed for this weekend.",
  ];

  for (let i = 0; i < ticketsForComments.length; i++) {
    const ticket = ticketsForComments[i];
    const numComments = 1 + Math.floor(Math.random() * 3);
    for (let c = 0; c < numComments; c++) {
      commentData.push({
        ticketId: ticket.id,
        authorId: [userITSupport.id, userNetworkEng.id, userSecAnalyst.id, userDBA.id][Math.floor(Math.random() * 4)],
        content: commentTemplates[(i + c) % commentTemplates.length],
        isInternal: c > 0,
      });
    }
  }
  await prisma.ticketComment.createMany({ data: commentData });
  console.log(`  ✓ ${commentData.length} Ticket Comments`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. WORK ORDERS (10)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔧 Seeding Work Orders...');
  const workOrderData = [
    { workOrderNumber: 'WO-0001', title: 'Replace UPS Batteries - Server Room A', type: 'REPAIR', priority: 'HIGH', status: 'IN_PROGRESS', laborHours: 4, materialCost: 25000 },
    { workOrderNumber: 'WO-0002', title: 'Install Network Switches - Pune Branch', type: 'INSTALLATION', priority: 'MEDIUM', status: 'CREATED', laborHours: 8, materialCost: 150000 },
    { workOrderNumber: 'WO-0003', title: 'CCTV Camera Realignment - Treasury', type: 'MAINTENANCE', priority: 'MEDIUM', status: 'COMPLETED', laborHours: 2, materialCost: 0 },
    { workOrderNumber: 'WO-0004', title: 'Server Rack Cable Management', type: 'MAINTENANCE', priority: 'LOW', status: 'CREATED', laborHours: 6, materialCost: 5000 },
    { workOrderNumber: 'WO-0005', title: 'ATM Cash Dispenser Repair - ATM-005', type: 'REPAIR', priority: 'HIGH', status: 'ASSIGNED', laborHours: 3, materialCost: 15000 },
    { workOrderNumber: 'WO-0006', title: 'AC Unit Compressor Replacement', type: 'REPAIR', priority: 'MEDIUM', status: 'IN_PROGRESS', laborHours: 5, materialCost: 35000 },
    { workOrderNumber: 'WO-0007', title: 'Biometric Device Firmware Update', type: 'MAINTENANCE', priority: 'LOW', status: 'COMPLETED', laborHours: 1, materialCost: 0 },
    { workOrderNumber: 'WO-0008', title: 'Firewall Module Installation', type: 'INSTALLATION', priority: 'HIGH', status: 'CREATED', laborHours: 4, materialCost: 200000 },
    { workOrderNumber: 'WO-0009', title: 'Floor Wiring Inspection - 5th Floor', type: 'INSPECTION', priority: 'LOW', status: 'CREATED', laborHours: 3, materialCost: 0 },
    { workOrderNumber: 'WO-0010', title: 'Printer Fleet Maintenance', type: 'MAINTENANCE', priority: 'LOW', status: 'ASSIGNED', laborHours: 8, materialCost: 10000 },
  ];

  await prisma.workOrder.createMany({
    data: workOrderData.map(wo => ({
      tenantId: bankTenant.id,
      workOrderNumber: wo.workOrderNumber,
      title: wo.title,
      type: wo.type,
      priority: wo.priority,
      status: wo.status,
      laborHours: wo.laborHours,
      materialCost: wo.materialCost,
    })) as any,
  });
  console.log('  ✓ 10 Work Orders');

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. CHANGE REQUESTS (8)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔄 Seeding Change Requests...');
  await prisma.changeRequest.createMany({
    data: [
      { tenantId: bankTenant.id, changeNumber: 'CR-0001', title: 'Windows 11 23H2 Migration - Phase 1', type: 'NORMAL', category: 'SOFTWARE', priority: 'MEDIUM', risk: 'MEDIUM', status: 'APPROVED', requestedById: userITSupport.id, approvedById: userDirector.id, impactAnalysis: 'Affects 50 workstations across Mumbai HQ. Downtime: 2h per batch.', rollbackPlan: 'WIM image restore from backup. Recovery time: 30 min per device.' },
      { tenantId: bankTenant.id, changeNumber: 'CR-0002', title: 'Network VLAN Segmentation - PCI DSS', type: 'NORMAL', category: 'NETWORK', priority: 'HIGH', risk: 'HIGH', status: 'IN_PROGRESS', requestedById: userCISO.id, approvedById: userDirector.id, implementedById: userNetworkEng.id, impactAnalysis: 'Cardholder data environment isolation. Brief connectivity disruption expected.', rollbackPlan: 'Revert VLAN configs from backup. All switch configs version-controlled.' },
      { tenantId: bankTenant.id, changeNumber: 'CR-0003', title: 'Oracle Database 19c to 21c Upgrade', type: 'NORMAL', category: 'DATABASE', priority: 'HIGH', risk: 'HIGH', status: 'SUBMITTED', requestedById: userDBA.id, impactAnalysis: 'Core Banking DB upgrade. Requires 4-hour maintenance window.', rollbackPlan: 'RMAN full backup before upgrade. Tested restore procedure.' },
      { tenantId: bankTenant.id, changeNumber: 'CR-0004', title: 'Emergency Firewall Rule - Block CVE-2026-1234', type: 'EMERGENCY', category: 'SECURITY', priority: 'CRITICAL', risk: 'LOW', status: 'COMPLETED', requestedById: userCISO.id, approvedById: userDirector.id, implementedById: userNetworkEng.id },
      { tenantId: bankTenant.id, changeNumber: 'CR-0005', title: 'Deploy CrowdStrike Falcon 7.x', type: 'STANDARD', category: 'SOFTWARE', priority: 'MEDIUM', risk: 'LOW', status: 'APPROVED', requestedById: userSecAnalyst.id, approvedById: userCISO.id },
      { tenantId: bankTenant.id, changeNumber: 'CR-0006', title: 'Data Center UPS Capacity Expansion', type: 'NORMAL', category: 'INFRASTRUCTURE', priority: 'MEDIUM', risk: 'MEDIUM', status: 'DRAFT', requestedById: userITSupport.id },
      { tenantId: bankTenant.id, changeNumber: 'CR-0007', title: 'WiFi 6E Access Point Deployment', type: 'STANDARD', category: 'NETWORK', priority: 'LOW', risk: 'LOW', status: 'SUBMITTED', requestedById: userNetworkEng.id },
      { tenantId: bankTenant.id, changeNumber: 'CR-0008', title: 'SAP HANA Migration to Cloud', type: 'NORMAL', category: 'INFRASTRUCTURE', priority: 'HIGH', risk: 'CRITICAL', status: 'DRAFT', requestedById: userDirector.id, impactAnalysis: 'Migration of SAP landscape to cloud. Multi-phase approach over 6 months.' },
    ] as any,
  });
  console.log('  ✓ 8 Change Requests');

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. PROBLEMS (5)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('⚠️ Seeding Problems...');
  await prisma.problem.createMany({
    data: [
      { tenantId: bankTenant.id, problemNumber: 'PRB-0001', title: 'Recurring CBS Slowness During Peak Hours', priority: 'CRITICAL', status: 'ROOT_CAUSE_IDENTIFIED', category: 'Application', rootCause: 'Connection pool exhaustion in Oracle RAC due to unclosed cursors in batch processing module.', workaround: 'Restart connection pool service every 4 hours during peak.', assignedToId: userDBA.id },
      { tenantId: bankTenant.id, problemNumber: 'PRB-0002', title: 'Intermittent WiFi Drops Across Multiple Sites', priority: 'HIGH', status: 'OPEN', category: 'Network', assignedToId: userNetworkEng.id },
      { tenantId: bankTenant.id, problemNumber: 'PRB-0003', title: 'Thin Client PXE Boot Failures After Updates', priority: 'MEDIUM', status: 'KNOWN_ERROR', category: 'Hardware', rootCause: 'BIOS firmware incompatibility with latest PXE server image.', workaround: 'Roll back BIOS to version 1.8.2.', isKnownError: true, assignedToId: userITSupport.id },
      { tenantId: bankTenant.id, problemNumber: 'PRB-0004', title: 'CCTV NVR Storage Filling Up Rapidly', priority: 'MEDIUM', status: 'OPEN', category: 'Security', assignedToId: userSecAnalyst.id },
      { tenantId: bankTenant.id, problemNumber: 'PRB-0005', title: 'Printer Spooler Crash on Windows 11 Devices', priority: 'LOW', status: 'RESOLVED', category: 'Software', rootCause: 'Driver conflict between HP Universal Print Driver 7.0 and Windows 11 23H2.', resolution: 'Updated to HP UPD 7.2 which includes Windows 11 fix.', resolvedAt: new Date(), assignedToId: userITSupport.id },
    ] as any,
  });
  console.log('  ✓ 5 Problems');

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. VENDORS (8)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🏪 Seeding Vendors...');
  const vendorDell = await prisma.vendor.create({ data: { tenantId: bankTenant.id, name: 'Dell Technologies', email: 'enterprise@dell.com', phone: '+91-1800-425-4999', website: 'https://dell.com', category: 'HARDWARE', rating: 4, contactPerson: 'Rahul Mehta', paymentTerms: 'NET_30', status: 'ACTIVE' } });
  const vendorCisco = await prisma.vendor.create({ data: { tenantId: bankTenant.id, name: 'Cisco Systems', email: 'india.sales@cisco.com', phone: '+91-1800-103-8765', website: 'https://cisco.com', category: 'HARDWARE', rating: 5, contactPerson: 'Anil Sharma', paymentTerms: 'NET_30', status: 'ACTIVE' } });
  const vendorMicrosoft = await prisma.vendor.create({ data: { tenantId: bankTenant.id, name: 'Microsoft Corporation', email: 'india.enterprise@microsoft.com', website: 'https://microsoft.com', category: 'SOFTWARE', rating: 4, contactPerson: 'Sanjay Verma', paymentTerms: 'NET_30', status: 'ACTIVE' } });
  const vendorPaloAlto = await prisma.vendor.create({ data: { tenantId: bankTenant.id, name: 'Palo Alto Networks', email: 'india@paloaltonetworks.com', website: 'https://paloaltonetworks.com', category: 'HARDWARE', rating: 5, contactPerson: 'Vivek Kumar', paymentTerms: 'NET_60', status: 'ACTIVE' } });
  const vendorHPE = await prisma.vendor.create({ data: { tenantId: bankTenant.id, name: 'Hewlett Packard Enterprise', email: 'enterprise@hpe.com', website: 'https://hpe.com', category: 'HARDWARE', rating: 4, contactPerson: 'Manoj Desai', paymentTerms: 'NET_30', status: 'ACTIVE' } });
  const vendorLenovo = await prisma.vendor.create({ data: { tenantId: bankTenant.id, name: 'Lenovo', email: 'enterprise@lenovo.com', website: 'https://lenovo.com', category: 'HARDWARE', rating: 4, contactPerson: 'Prashant Singh', paymentTerms: 'NET_30', status: 'ACTIVE' } });
  const vendorOracle = await prisma.vendor.create({ data: { tenantId: bankTenant.id, name: 'Oracle Corporation', email: 'india.sales@oracle.com', website: 'https://oracle.com', category: 'SOFTWARE', rating: 3, contactPerson: 'Ramesh Krishnan', paymentTerms: 'NET_60', status: 'ACTIVE' } });
  const vendorFortinet = await prisma.vendor.create({ data: { tenantId: bankTenant.id, name: 'Fortinet', email: 'india@fortinet.com', website: 'https://fortinet.com', category: 'HARDWARE', rating: 4, contactPerson: 'Ashish Jain', paymentTerms: 'NET_30', status: 'ACTIVE' } });
  console.log('  ✓ 8 Vendors');

  // ═══════════════════════════════════════════════════════════════════════════
  // 19. CONTRACTS (6)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📝 Seeding Contracts...');
  await prisma.contract.createMany({
    data: [
      { tenantId: bankTenant.id, vendorId: vendorDell.id, contractNumber: 'CNT-DELL-001', title: 'Dell Server & Laptop AMC', type: 'AMC', startDate: new Date('2025-04-01'), endDate: new Date('2027-03-31'), value: 5000000, autoRenew: true, status: 'ACTIVE' },
      { tenantId: bankTenant.id, vendorId: vendorCisco.id, contractNumber: 'CNT-CISCO-001', title: 'Cisco Network Infrastructure Support', type: 'SUPPORT', startDate: new Date('2025-01-01'), endDate: new Date('2027-12-31'), value: 8000000, autoRenew: false, status: 'ACTIVE' },
      { tenantId: bankTenant.id, vendorId: vendorMicrosoft.id, contractNumber: 'CNT-MS-001', title: 'Microsoft Enterprise Agreement', type: 'LICENSE', startDate: new Date('2025-07-01'), endDate: new Date('2028-06-30'), value: 15000000, autoRenew: true, status: 'ACTIVE' },
      { tenantId: bankTenant.id, vendorId: vendorPaloAlto.id, contractNumber: 'CNT-PA-001', title: 'Palo Alto Firewall Maintenance', type: 'MAINTENANCE', startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'), value: 3000000, autoRenew: true, status: 'ACTIVE' },
      { tenantId: bankTenant.id, vendorId: vendorOracle.id, contractNumber: 'CNT-ORA-001', title: 'Oracle Database Licensing & Support', type: 'LICENSE', startDate: new Date('2024-04-01'), endDate: new Date('2027-03-31'), value: 25000000, autoRenew: false, status: 'ACTIVE' },
      { tenantId: bankTenant.id, vendorId: vendorHPE.id, contractNumber: 'CNT-HPE-001', title: 'HPE Server Warranty Extension', type: 'WARRANTY', startDate: new Date('2025-01-01'), endDate: new Date('2027-12-31'), value: 2000000, autoRenew: false, status: 'ACTIVE' },
    ] as any,
  });
  console.log('  ✓ 6 Contracts');

  // ═══════════════════════════════════════════════════════════════════════════
  // 20. PURCHASE ORDERS & ITEMS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🛒 Seeding Purchase Orders...');
  const po1 = await prisma.purchaseOrder.create({
    data: { tenantId: bankTenant.id, vendorId: vendorDell.id, poNumber: 'PO-2026-001', status: 'APPROVED', requestedById: userITSupport.id, approvedById: userDirector.id, totalAmount: 1750000, shippingAddress: 'Mumbai HQ, BKC', expectedDelivery: new Date('2026-08-15'), approvedAt: new Date() },
  });
  const po2 = await prisma.purchaseOrder.create({
    data: { tenantId: bankTenant.id, vendorId: vendorCisco.id, poNumber: 'PO-2026-002', status: 'SUBMITTED', requestedById: userNetworkEng.id, totalAmount: 2500000, shippingAddress: 'Bangalore Tech Hub', expectedDelivery: new Date('2026-09-01') },
  });
  const po3 = await prisma.purchaseOrder.create({
    data: { tenantId: bankTenant.id, vendorId: vendorLenovo.id, poNumber: 'PO-2026-003', status: 'RECEIVED', requestedById: userITSupport.id, approvedById: userDirector.id, totalAmount: 525000, shippingAddress: 'Delhi Regional Office', receivedDate: new Date(), approvedAt: new Date('2026-06-15') },
  });
  const po4 = await prisma.purchaseOrder.create({
    data: { tenantId: bankTenant.id, vendorId: vendorPaloAlto.id, poNumber: 'PO-2026-004', status: 'DRAFT', requestedById: userCISO.id, totalAmount: 4000000 },
  });
  const po5 = await prisma.purchaseOrder.create({
    data: { tenantId: bankTenant.id, vendorId: vendorFortinet.id, poNumber: 'PO-2026-005', status: 'APPROVED', requestedById: userNetworkEng.id, approvedById: userDirector.id, totalAmount: 1200000, shippingAddress: 'Chennai DR Center', approvedAt: new Date() },
  });

  await prisma.purchaseOrderItem.createMany({
    data: [
      { poId: po1.id, description: 'Dell Latitude 5540 Laptop', quantity: 10, unitPrice: 95000, totalPrice: 950000 },
      { poId: po1.id, description: 'Dell PowerEdge R760 Server', quantity: 2, unitPrice: 400000, totalPrice: 800000 },
      { poId: po2.id, description: 'Cisco Catalyst 9300-48P Switch', quantity: 5, unitPrice: 350000, totalPrice: 1750000 },
      { poId: po2.id, description: 'Cisco Meraki MR46 Access Point', quantity: 15, unitPrice: 50000, totalPrice: 750000 },
      { poId: po3.id, description: 'Lenovo ThinkPad T14 Gen 4', quantity: 5, unitPrice: 85000, totalPrice: 425000 },
      { poId: po3.id, description: 'Lenovo ThinkCentre M70q Desktop', quantity: 2, unitPrice: 50000, totalPrice: 100000, receivedQty: 2 },
      { poId: po4.id, description: 'Palo Alto PA-5260 Next-Gen Firewall', quantity: 2, unitPrice: 1500000, totalPrice: 3000000 },
      { poId: po4.id, description: 'Palo Alto Panorama Management', quantity: 1, unitPrice: 1000000, totalPrice: 1000000 },
      { poId: po5.id, description: 'Fortinet FortiGate 600E', quantity: 2, unitPrice: 450000, totalPrice: 900000 },
      { poId: po5.id, description: 'FortiAnalyzer 300G', quantity: 1, unitPrice: 300000, totalPrice: 300000 },
    ] as any,
  });
  console.log('  ✓ 5 Purchase Orders, 10 Items');

  // ═══════════════════════════════════════════════════════════════════════════
  // 21. SOFTWARE CATALOG (10)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📀 Seeding Software Catalog...');
  const swCatalog = await Promise.all([
    prisma.softwareCatalog.create({ data: { tenantId: bankTenant.id, name: 'Microsoft 365', publisher: 'Microsoft', category: 'Productivity', isAuthorized: true, authorizationStatus: 'AUTHORIZED', latestVersion: '16.0.17328' } }),
    prisma.softwareCatalog.create({ data: { tenantId: bankTenant.id, name: 'Oracle Database', publisher: 'Oracle', category: 'Database', isAuthorized: true, authorizationStatus: 'AUTHORIZED', latestVersion: '21c' } }),
    prisma.softwareCatalog.create({ data: { tenantId: bankTenant.id, name: 'Adobe Creative Cloud', publisher: 'Adobe', category: 'Design', isAuthorized: true, authorizationStatus: 'AUTHORIZED', latestVersion: '2026.1' } }),
    prisma.softwareCatalog.create({ data: { tenantId: bankTenant.id, name: 'CrowdStrike Falcon', publisher: 'CrowdStrike', category: 'Security', isAuthorized: true, authorizationStatus: 'AUTHORIZED', latestVersion: '7.04' } }),
    prisma.softwareCatalog.create({ data: { tenantId: bankTenant.id, name: 'VMware vSphere', publisher: 'Broadcom', category: 'Virtualization', isAuthorized: true, authorizationStatus: 'AUTHORIZED', latestVersion: '8.0 U3' } }),
    prisma.softwareCatalog.create({ data: { tenantId: bankTenant.id, name: 'Cisco DNA Center', publisher: 'Cisco', category: 'Network', isAuthorized: true, authorizationStatus: 'AUTHORIZED', latestVersion: '2.3.7' } }),
    prisma.softwareCatalog.create({ data: { tenantId: bankTenant.id, name: 'SAP S/4HANA', publisher: 'SAP', category: 'ERP', isAuthorized: true, authorizationStatus: 'AUTHORIZED', latestVersion: '2023 FPS02' } }),
    prisma.softwareCatalog.create({ data: { tenantId: bankTenant.id, name: 'Tally Prime', publisher: 'Tally Solutions', category: 'Accounting', isAuthorized: true, authorizationStatus: 'AUTHORIZED', latestVersion: '4.0' } }),
    prisma.softwareCatalog.create({ data: { tenantId: bankTenant.id, name: 'Google Chrome', publisher: 'Google', category: 'Browser', isAuthorized: true, authorizationStatus: 'AUTHORIZED', latestVersion: '126.0' } }),
    prisma.softwareCatalog.create({ data: { tenantId: bankTenant.id, name: 'BitTorrent', publisher: 'BitTorrent Inc', category: 'P2P', isBlacklisted: true, isAuthorized: false, authorizationStatus: 'BLACKLISTED', description: 'Unauthorized P2P software' } }),
  ]);
  console.log('  ✓ 10 Software Catalog entries');

  // ═══════════════════════════════════════════════════════════════════════════
  // 22. LICENSES (12)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔐 Seeding Licenses...');
  const licenses = await Promise.all([
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'Microsoft 365 E5', softwareCatalogId: swCatalog[0].id, vendor: 'Microsoft', licenseType: 'PER_SEAT', licenseModel: 'ANNUAL', totalSeats: 500, usedSeats: 380, purchaseDate: new Date('2025-07-01'), expiryDate: new Date('2026-06-30'), renewalCost: 4500000, purchaseCost: 4500000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'Oracle Database Enterprise', softwareCatalogId: swCatalog[1].id, vendor: 'Oracle', licenseType: 'PER_DEVICE', licenseModel: 'PERPETUAL', totalSeats: 20, usedSeats: 18, purchaseDate: new Date('2024-04-01'), renewalCost: 5000000, purchaseCost: 25000000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'Adobe Creative Cloud', softwareCatalogId: swCatalog[2].id, vendor: 'Adobe', licenseType: 'PER_SEAT', licenseModel: 'ANNUAL', totalSeats: 15, usedSeats: 12, purchaseDate: new Date('2025-01-01'), expiryDate: new Date('2025-12-31'), renewalCost: 450000, purchaseCost: 450000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'CrowdStrike Falcon Complete', softwareCatalogId: swCatalog[3].id, vendor: 'CrowdStrike', licenseType: 'PER_DEVICE', licenseModel: 'ANNUAL', totalSeats: 600, usedSeats: 520, purchaseDate: new Date('2025-04-01'), expiryDate: new Date('2026-03-31'), renewalCost: 3000000, purchaseCost: 3000000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'VMware vSphere Enterprise Plus', softwareCatalogId: swCatalog[4].id, vendor: 'Broadcom', licenseType: 'PER_DEVICE', licenseModel: 'PERPETUAL', totalSeats: 30, usedSeats: 25, purchaseDate: new Date('2023-07-01'), renewalCost: 1500000, purchaseCost: 8000000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'Cisco DNA Advantage', softwareCatalogId: swCatalog[5].id, vendor: 'Cisco', licenseType: 'PER_DEVICE', licenseModel: 'ANNUAL', totalSeats: 100, usedSeats: 75, purchaseDate: new Date('2025-01-01'), expiryDate: new Date('2027-12-31'), renewalCost: 2000000, purchaseCost: 6000000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'SAP S/4HANA Cloud', softwareCatalogId: swCatalog[6].id, vendor: 'SAP', licenseType: 'ENTERPRISE', licenseModel: 'ANNUAL', totalSeats: 200, usedSeats: 150, purchaseDate: new Date('2025-01-01'), expiryDate: new Date('2027-12-31'), renewalCost: 10000000, purchaseCost: 10000000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'Tally Prime', softwareCatalogId: swCatalog[7].id, vendor: 'Tally Solutions', licenseType: 'SITE', licenseModel: 'PERPETUAL', totalSeats: 50, usedSeats: 30, purchaseDate: new Date('2024-04-01'), purchaseCost: 200000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'Palo Alto Threat Prevention', vendor: 'Palo Alto', licenseType: 'PER_DEVICE', licenseModel: 'ANNUAL', totalSeats: 10, usedSeats: 10, purchaseDate: new Date('2025-04-01'), expiryDate: new Date('2026-03-31'), renewalCost: 800000, purchaseCost: 800000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'FortiAnalyzer', vendor: 'Fortinet', licenseType: 'PER_DEVICE', licenseModel: 'ANNUAL', totalSeats: 5, usedSeats: 3, purchaseDate: new Date('2025-07-01'), expiryDate: new Date('2026-06-30'), renewalCost: 300000, purchaseCost: 300000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'Windows Server 2022 Datacenter', vendor: 'Microsoft', licenseType: 'PER_DEVICE', licenseModel: 'PERPETUAL', totalSeats: 40, usedSeats: 35, purchaseDate: new Date('2023-01-01'), purchaseCost: 4000000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
    prisma.license.create({ data: { tenantId: bankTenant.id, softwareName: 'Zoom Business', vendor: 'Zoom', licenseType: 'PER_SEAT', licenseModel: 'MONTHLY', totalSeats: 100, usedSeats: 85, purchaseDate: new Date('2025-01-01'), expiryDate: new Date('2026-12-31'), renewalCost: 600000, purchaseCost: 600000, status: 'ACTIVE', complianceStatus: 'COMPLIANT' } }),
  ]);
  console.log('  ✓ 12 Licenses');

  // ═══════════════════════════════════════════════════════════════════════════
  // 23. LICENSE ASSIGNMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📋 Seeding License Assignments...');
  const bankUsers = [userDirector, userCISO, userITSupport, userBranchMgr, userEmployee, userNetworkEng, userDBA, userSecAnalyst, userTreasuryMgr, userRiskOfficer, userHRManager, userDigitalLead, userAuditor, userLegal];
  const m365License = licenses[0];
  const assignmentData = bankUsers.map(u => ({
    licenseId: m365License.id,
    userId: u.id,
  }));
  await prisma.licenseAssignment.createMany({ data: assignmentData as any });
  console.log(`  ✓ ${assignmentData.length} License Assignments`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 24. SCAN JOBS (3)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔍 Seeding Scan Jobs...');
  const scanJob1 = await prisma.scanJob.create({
    data: { tenantId: bankTenant.id, name: 'Mumbai HQ Full Scan', scanType: 'FULL_SCAN', subnet: '10.10.0.0/16', status: 'COMPLETED', startedAt: new Date(now.getTime() - 3600000), completedAt: new Date(), devicesFound: 250, newDevices: 5, triggeredById: userITSupport.id },
  });
  await prisma.scanJob.create({
    data: { tenantId: bankTenant.id, name: 'Bangalore Ping Sweep', scanType: 'PING_SWEEP', subnet: '10.11.0.0/16', status: 'COMPLETED', startedAt: new Date(now.getTime() - 7200000), completedAt: new Date(now.getTime() - 5400000), devicesFound: 120, newDevices: 2, triggeredById: userNetworkEng.id },
  });
  await prisma.scanJob.create({
    data: { tenantId: bankTenant.id, name: 'Chennai Port Scan', scanType: 'PORT_SCAN', subnet: '10.12.0.0/24', portRange: '22,80,443,3389,8080', status: 'RUNNING', startedAt: new Date(), devicesFound: 0, triggeredById: userSecAnalyst.id },
  });
  console.log('  ✓ 3 Scan Jobs');

  // ═══════════════════════════════════════════════════════════════════════════
  // 25. DISCOVERED DEVICES (5)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔎 Seeding Discovered Devices...');
  await prisma.discoveredDevice.createMany({
    data: [
      { tenantId: bankTenant.id, scanJobId: scanJob1.id, ipAddress: '10.10.5.201', macAddress: 'aa:bb:cc:dd:ee:01', hostname: 'unknown-device-1', osGuess: 'Linux 5.x', deviceType: 'Server', status: 'PENDING_REVIEW', riskScore: 75 },
      { tenantId: bankTenant.id, scanJobId: scanJob1.id, ipAddress: '10.10.5.202', macAddress: 'aa:bb:cc:dd:ee:02', hostname: 'rogue-ap-01', osGuess: 'Embedded', deviceType: 'Access Point', status: 'PENDING_REVIEW', riskScore: 90, openPorts: '[{"port":80,"service":"HTTP"},{"port":443,"service":"HTTPS"}]' },
      { tenantId: bankTenant.id, scanJobId: scanJob1.id, ipAddress: '10.10.5.203', macAddress: 'aa:bb:cc:dd:ee:03', hostname: 'DESKTOP-GUEST01', osGuess: 'Windows 11', deviceType: 'Workstation', status: 'PENDING_REVIEW', riskScore: 60 },
      { tenantId: bankTenant.id, scanJobId: scanJob1.id, ipAddress: '10.10.5.204', macAddress: 'aa:bb:cc:dd:ee:04', hostname: 'iot-sensor-01', osGuess: 'Embedded Linux', deviceType: 'IoT', status: 'PENDING_REVIEW', riskScore: 85 },
      { tenantId: bankTenant.id, scanJobId: scanJob1.id, ipAddress: '10.10.5.205', hostname: 'nas-backup-01', osGuess: 'Synology DSM', deviceType: 'Storage', status: 'APPROVED', riskScore: 30 },
    ] as any,
  });
  console.log('  ✓ 5 Discovered Devices');

  // ═══════════════════════════════════════════════════════════════════════════
  // 26. SCAN CREDENTIALS (2)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔑 Seeding Scan Credentials...');
  await prisma.scanCredential.createMany({
    data: [
      { tenantId: bankTenant.id, name: 'SNMP v2c - Default', type: 'SNMP_V2C', encryptedData: 'ENC:community=public', scope: { subnets: ['10.10.0.0/16', '10.11.0.0/16'] }, createdById: userITSupport.id },
      { tenantId: bankTenant.id, name: 'SSH Admin Key', type: 'SSH_KEY', encryptedData: 'ENC:key=ssh-rsa-admin-key-encrypted', scope: { subnets: ['10.10.0.0/16'] }, createdById: userNetworkEng.id },
    ] as any,
  });
  console.log('  ✓ 2 Scan Credentials');

  // ═══════════════════════════════════════════════════════════════════════════
  // 27. SCHEDULED SCANS (3)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('⏰ Seeding Scheduled Scans...');
  await prisma.scheduledScan.createMany({
    data: [
      { tenantId: bankTenant.id, name: 'Nightly Ping Sweep - All Sites', subnet: '10.0.0.0/8', scanType: 'PING_SWEEP', schedule: '0 2 * * *', isActive: true, nextRunAt: new Date(now.getTime() + 86400000), createdById: userITSupport.id },
      { tenantId: bankTenant.id, name: 'Weekly Full Scan - Mumbai HQ', subnet: '10.10.0.0/16', scanType: 'FULL_SCAN', schedule: '0 3 * * 0', scanWindow: { startHour: 22, endHour: 6 }, isActive: true, nextRunAt: new Date(now.getTime() + 604800000), createdById: userNetworkEng.id },
      { tenantId: bankTenant.id, name: 'Monthly Port Scan - DMZ', subnet: '10.10.100.0/24', scanType: 'PORT_SCAN', schedule: '0 1 1 * *', isActive: true, nextRunAt: new Date(now.getTime() + 2592000000), createdById: userSecAnalyst.id },
    ] as any,
  });
  console.log('  ✓ 3 Scheduled Scans');

  // ═══════════════════════════════════════════════════════════════════════════
  // 28. SCAN RESULTS (15)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📋 Seeding Scan Results...');
  const scanResultData: any[] = [];
  const scanTypes = ['NMAP', 'SNMP', 'SSH', 'ARP', 'TRACEROUTE', 'SSL', 'PATCH'];
  for (let i = 0; i < 15; i++) {
    scanResultData.push({
      tenantId: bankTenant.id,
      scanType: scanTypes[i % scanTypes.length],
      targetType: i < 5 ? 'SUBNET' : i < 10 ? 'DEVICE' : 'HOST',
      target: i < 5 ? `10.10.${i}.0/24` : `10.10.1.${100 + i}`,
      status: i < 12 ? 'COMPLETED' : 'RUNNING',
      startedAt: new Date(now.getTime() - (i + 1) * 3600000),
      completedAt: i < 12 ? new Date(now.getTime() - i * 3600000) : undefined,
      duration: i < 12 ? 30 + Math.floor(Math.random() * 120) : undefined,
      summary: { hostsUp: 10 + Math.floor(Math.random() * 50), portsFound: Math.floor(Math.random() * 100) },
      results: [{ ip: `10.10.1.${100 + i}`, status: 'up', ports: [22, 80, 443] }],
      triggeredBy: [userITSupport.id, userNetworkEng.id, userSecAnalyst.id][i % 3],
    });
  }
  await prisma.scanResult.createMany({ data: scanResultData });
  console.log('  ✓ 15 Scan Results');

  // ═══════════════════════════════════════════════════════════════════════════
  // 29. PATCHES (15)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🩹 Seeding Patches...');
  await prisma.patch.createMany({
    data: [
      { tenantId: bankTenant.id, patchId: 'KB5034441', title: 'Windows Recovery Environment Update', severity: 'Critical', status: 'Deployed', category: 'Security', affectedAssets: 200, deployedDate: new Date('2026-06-15') },
      { tenantId: bankTenant.id, patchId: 'KB5035845', title: 'Windows 11 Cumulative Update 2026-06', severity: 'Critical', status: 'Deployed', category: 'Security', affectedAssets: 120, deployedDate: new Date('2026-06-20') },
      { tenantId: bankTenant.id, patchId: 'KB5036893', title: '.NET Framework Security Update', severity: 'High', status: 'Pending', category: 'Security', affectedAssets: 150 },
      { tenantId: bankTenant.id, patchId: 'KB5037765', title: 'Windows Server 2022 CU', severity: 'Critical', status: 'Scheduled', category: 'Security', affectedAssets: 40, scheduledAt: new Date('2026-07-13') },
      { tenantId: bankTenant.id, patchId: 'CSFALCON-7.04', title: 'CrowdStrike Falcon Agent Update', severity: 'Medium', status: 'Deployed', category: 'Agent', affectedAssets: 500, deployedDate: new Date('2026-06-10') },
      { tenantId: bankTenant.id, patchId: 'CISCO-SA-2026-001', title: 'Cisco IOS XE Security Advisory', severity: 'Critical', status: 'Pending', category: 'Network', affectedAssets: 55 },
      { tenantId: bankTenant.id, patchId: 'ORA-CPU-2026-Q2', title: 'Oracle Critical Patch Update Q2 2026', severity: 'Critical', status: 'Scheduled', category: 'Database', affectedAssets: 20, scheduledAt: new Date('2026-07-20') },
      { tenantId: bankTenant.id, patchId: 'CHROME-126.0', title: 'Google Chrome Stable Channel Update', severity: 'High', status: 'Deployed', category: 'Browser', affectedAssets: 400, deployedDate: new Date('2026-07-01') },
      { tenantId: bankTenant.id, patchId: 'ADOBE-CC-2026.1', title: 'Adobe Creative Cloud Security Fix', severity: 'Medium', status: 'Pending', category: 'Application', affectedAssets: 15 },
      { tenantId: bankTenant.id, patchId: 'PA-PAN-2026-0015', title: 'PAN-OS Command Injection Fix', severity: 'Critical', status: 'Deployed', category: 'Firewall', affectedAssets: 10, deployedDate: new Date('2026-06-25') },
      { tenantId: bankTenant.id, patchId: 'FORTI-FG-7.4.5', title: 'FortiOS 7.4.5 Security Update', severity: 'High', status: 'Pending', category: 'Firewall', affectedAssets: 5 },
      { tenantId: bankTenant.id, patchId: 'VMWARE-VCSA-8U3a', title: 'VMware vCenter Server Update', severity: 'High', status: 'Scheduled', category: 'Virtualization', affectedAssets: 5, scheduledAt: new Date('2026-07-27') },
      { tenantId: bankTenant.id, patchId: 'SAP-SECURITY-NOTE-3425', title: 'SAP Security Note 3425 - ABAP Fix', severity: 'Medium', status: 'Pending', category: 'ERP', affectedAssets: 2 },
      { tenantId: bankTenant.id, patchId: 'KB5038234', title: 'Windows Defender Definition Update', severity: 'Low', status: 'Deployed', category: 'Security', affectedAssets: 500, deployedDate: new Date('2026-07-05') },
      { tenantId: bankTenant.id, patchId: 'LINUX-KERNEL-6.8.12', title: 'Linux Kernel 6.8.12 Security Patch', severity: 'High', status: 'Pending', category: 'OS', affectedAssets: 30 },
    ] as any,
  });
  console.log('  ✓ 15 Patches');

  // ═══════════════════════════════════════════════════════════════════════════
  // 30. AUTOMATION RULES (5)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('⚡ Seeding Automation Rules...');
  const autoRules = await Promise.all([
    prisma.automationRule.create({ data: { tenantId: bankTenant.id, name: 'Auto-Assign Critical Tickets', triggerModule: 'tickets', triggerEvent: 'CREATED', condition: 'priority == CRITICAL', actionModule: 'tickets', actionType: 'ASSIGN', actionConfig: { assignTo: 'on-call-engineer' }, status: 'ACTIVE', runCount: 45, createdById: userDirector.id } }),
    prisma.automationRule.create({ data: { tenantId: bankTenant.id, name: 'Alert on Rogue Device Detection', triggerModule: 'discovery', triggerEvent: 'DEVICE_DISCOVERED', condition: 'riskScore > 70', actionModule: 'notifications', actionType: 'SEND_ALERT', actionConfig: { channel: 'SLACK', message: 'High-risk device detected: {deviceIp}' }, status: 'ACTIVE', runCount: 12, createdById: userCISO.id } }),
    prisma.automationRule.create({ data: { tenantId: bankTenant.id, name: 'License Expiry Warning', triggerModule: 'licenses', triggerEvent: 'EXPIRY_APPROACHING', condition: 'daysToExpiry <= 30', actionModule: 'notifications', actionType: 'SEND_EMAIL', actionConfig: { recipients: ['itsupport@demobank.com', 'director@demobank.com'] }, status: 'ACTIVE', runCount: 8, createdById: userITSupport.id } }),
    prisma.automationRule.create({ data: { tenantId: bankTenant.id, name: 'Auto-Retire EOL Assets', triggerModule: 'assets', triggerEvent: 'EOL_REACHED', actionModule: 'assets', actionType: 'UPDATE_STATUS', actionConfig: { newStatus: 'RETIRED' }, status: 'PAUSED', runCount: 0, createdById: userITSupport.id } }),
    prisma.automationRule.create({ data: { tenantId: bankTenant.id, name: 'Patch Compliance Reminder', triggerModule: 'patches', triggerEvent: 'DEADLINE_APPROACHING', condition: 'daysToDeadline <= 3', actionModule: 'tickets', actionType: 'CREATE_TICKET', actionConfig: { priority: 'HIGH', category: 'Patch Management' }, status: 'DRAFT', runCount: 0, createdById: userSecAnalyst.id } }),
  ]);
  console.log('  ✓ 5 Automation Rules');

  // ═══════════════════════════════════════════════════════════════════════════
  // 31. AUTOMATION EXECUTIONS (10)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔄 Seeding Automation Executions...');
  const execData: any[] = [];
  for (let i = 0; i < 10; i++) {
    const rule = autoRules[i % 3]; // only active rules
    execData.push({
      ruleId: rule.id,
      status: i < 8 ? 'SUCCESS' : i === 8 ? 'FAILED' : 'SKIPPED',
      input: { triggeredBy: 'system', eventId: `EVT-${1000 + i}` },
      output: i < 8 ? { action: 'completed', target: `resource-${i}` } : undefined,
      errorMsg: i === 8 ? 'Target resource not found' : undefined,
      duration: 100 + Math.floor(Math.random() * 2000),
      executedAt: new Date(now.getTime() - i * 3600000),
    });
  }
  await prisma.automationExecution.createMany({ data: execData });
  console.log('  ✓ 10 Automation Executions');

  // ═══════════════════════════════════════════════════════════════════════════
  // 32. KNOWLEDGE ARTICLES (8)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📚 Seeding Knowledge Articles...');
  await prisma.knowledgeArticle.createMany({
    data: [
      { tenantId: bankTenant.id, title: 'How to Reset Your Password', content: 'Step 1: Go to the login page.\nStep 2: Click "Forgot Password".\nStep 3: Enter your registered email.\nStep 4: Check your inbox for the reset link.\nStep 5: Set a new password meeting complexity requirements.', category: 'Account', tags: ['password', 'reset', 'login'], status: 'PUBLISHED', viewCount: 450, helpfulCount: 120, authorId: userITSupport.id },
      { tenantId: bankTenant.id, title: 'VPN Setup Guide for Remote Workers', content: 'Prerequisites: Active employee credentials, approved VPN access.\n\nFor Windows:\n1. Download GlobalProtect from the IT portal\n2. Install and launch\n3. Enter portal: vpn.nationaldigitalbank.com\n4. Login with your AD credentials\n5. Select "Full Tunnel" profile\n\nTroubleshooting: If connection fails, check if MFA token is synchronized.', category: 'Network', tags: ['vpn', 'remote', 'connectivity'], status: 'PUBLISHED', viewCount: 320, helpfulCount: 95, authorId: userNetworkEng.id },
      { tenantId: bankTenant.id, title: 'Requesting a New Laptop', content: 'Process:\n1. Raise a Service Request ticket (category: Procurement)\n2. Get manager approval\n3. IT Admin reviews and assigns from inventory or raises PO\n4. Standard delivery: 5-7 business days\n5. Express (for critical roles): 2-3 business days\n\nNote: All laptops come pre-configured with approved software stack.', category: 'Procurement', tags: ['laptop', 'request', 'onboarding'], status: 'PUBLISHED', viewCount: 180, helpfulCount: 55, authorId: userITSupport.id },
      { tenantId: bankTenant.id, title: 'Incident Severity Classification Guide', content: 'Critical: Service completely down, affecting 100+ users or revenue impact.\nHigh: Major feature degraded, affecting 50+ users.\nMedium: Feature partially working, workaround available.\nLow: Minor issue, cosmetic defect, or feature request.\n\nSLA Response Times:\n- Critical: 15 minutes\n- High: 1 hour\n- Medium: 4 hours\n- Low: 8 hours', category: 'ITSM', tags: ['incident', 'severity', 'sla'], status: 'PUBLISHED', viewCount: 600, helpfulCount: 200, authorId: userDirector.id },
      { tenantId: bankTenant.id, title: 'PCI DSS Compliance Checklist', content: 'Key requirements:\n1. Install and maintain network security controls\n2. Apply secure configurations to all system components\n3. Protect stored account data with encryption\n4. Encrypt transmission of cardholder data\n5. Protect systems and networks from malicious software\n6. Develop and maintain secure systems and software\n7. Restrict access by business need to know\n8. Identify users and authenticate access\n9. Restrict physical access to cardholder data\n10. Log and monitor all access\n11. Test security of systems and networks regularly\n12. Support information security with organizational policies', category: 'Compliance', tags: ['pci', 'dss', 'compliance', 'audit'], status: 'PUBLISHED', viewCount: 250, helpfulCount: 80, authorId: userCISO.id },
      { tenantId: bankTenant.id, title: 'Printer Troubleshooting Guide', content: 'Common issues and resolutions:\n\n1. Print job stuck:\n   - Clear print queue\n   - Restart Print Spooler service\n\n2. Paper jam:\n   - Open all trays and remove jammed paper\n   - Check for torn pieces\n\n3. Poor quality:\n   - Replace toner cartridge\n   - Run alignment from printer menu\n\n4. Network printer not found:\n   - Verify IP address\n   - Check firewall rules for port 9100', category: 'Hardware', tags: ['printer', 'troubleshoot', 'hardware'], status: 'PUBLISHED', viewCount: 140, helpfulCount: 45, authorId: userITSupport.id },
      { tenantId: bankTenant.id, title: 'ATM Cash Management Procedures', content: 'Daily operations:\n1. Check ATM cash levels via monitoring dashboard\n2. Schedule cash replenishment when below 20% threshold\n3. Verify cassette counts match system records\n4. Report any discrepancies immediately to Treasury\n\nSecurity protocols:\n- Always use dual custody for cash handling\n- Log all access to ATM safe via biometric\n- CCTV must be operational during all ATM servicing', category: 'Operations', tags: ['atm', 'cash', 'operations'], status: 'PUBLISHED', viewCount: 90, helpfulCount: 30, authorId: userTreasuryMgr.id },
      { tenantId: bankTenant.id, title: 'Asset Disposal and Data Wiping Policy', content: 'Before disposing of any IT asset:\n1. Verify no active data or licenses\n2. Perform NIST 800-88 compliant data wiping\n3. Generate certificate of destruction\n4. Update asset status to DISPOSED in CMDB\n5. Remove from all monitoring systems\n6. File disposal certificate with compliance team\n\nFor drives containing PII/PCI data: Use physical destruction (shredding).', category: 'Policy', tags: ['disposal', 'data-wiping', 'lifecycle', 'compliance'], status: 'PUBLISHED', viewCount: 110, helpfulCount: 40, authorId: userAuditor.id },
    ] as any,
  });
  console.log('  ✓ 8 Knowledge Articles');

  // ═══════════════════════════════════════════════════════════════════════════
  // 33. SERVICE CATALOG ITEMS (10)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📋 Seeding Service Catalog...');
  await prisma.serviceCatalogItem.createMany({
    data: [
      { tenantId: bankTenant.id, name: 'New Laptop Request', category: 'Hardware', description: 'Request a new laptop for a new hire or replacement.', sla: '5 business days', approvalRequired: true, icon: 'laptop', sortOrder: 1 },
      { tenantId: bankTenant.id, name: 'Software Installation', category: 'Software', description: 'Request installation of authorized software on your device.', sla: '2 business days', approvalRequired: false, icon: 'download', sortOrder: 2 },
      { tenantId: bankTenant.id, name: 'VPN Access Request', category: 'Access', description: 'Request VPN access for remote working.', sla: '1 business day', approvalRequired: true, icon: 'shield', sortOrder: 3 },
      { tenantId: bankTenant.id, name: 'Password Reset', category: 'Account', description: 'Reset your Active Directory or application password.', sla: '1 hour', approvalRequired: false, icon: 'key', sortOrder: 4 },
      { tenantId: bankTenant.id, name: 'Email Distribution List', category: 'Communication', description: 'Create or modify an email distribution list.', sla: '2 business days', approvalRequired: true, icon: 'mail', sortOrder: 5 },
      { tenantId: bankTenant.id, name: 'Meeting Room AV Setup', category: 'Facilities', description: 'Setup audio-visual equipment in meeting rooms.', sla: '3 business days', approvalRequired: false, icon: 'video', sortOrder: 6 },
      { tenantId: bankTenant.id, name: 'Database Access Request', category: 'Access', description: 'Request read/write access to specific databases.', sla: '3 business days', approvalRequired: true, icon: 'database', sortOrder: 7 },
      { tenantId: bankTenant.id, name: 'Mobile Device Enrollment', category: 'Hardware', description: 'Enroll your mobile device in MDM for corporate email access.', sla: '1 business day', approvalRequired: false, icon: 'smartphone', sortOrder: 8 },
      { tenantId: bankTenant.id, name: 'Firewall Rule Change', category: 'Network', description: 'Request a new firewall rule or modification to existing rules.', sla: '2 business days', approvalRequired: true, icon: 'shield-check', sortOrder: 9 },
      { tenantId: bankTenant.id, name: 'Employee Offboarding', category: 'HR', description: 'IT offboarding: revoke access, collect devices, disable accounts.', sla: 'Same day', approvalRequired: true, icon: 'user-minus', sortOrder: 10 },
    ] as any,
  });
  console.log('  ✓ 10 Service Catalog Items');

  // ═══════════════════════════════════════════════════════════════════════════
  // 34. SLA POLICIES (4)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('⏱️ Seeding SLA Policies...');
  await prisma.slaPolicy.createMany({
    data: [
      { tenantId: bankTenant.id, name: 'Critical SLA', priority: 'CRITICAL', responseHours: 1, resolutionHours: 4, escalationHours: 2, businessHoursOnly: false, isDefault: true },
      { tenantId: bankTenant.id, name: 'High SLA', priority: 'HIGH', responseHours: 2, resolutionHours: 8, escalationHours: 4, businessHoursOnly: true, isDefault: true },
      { tenantId: bankTenant.id, name: 'Medium SLA', priority: 'MEDIUM', responseHours: 4, resolutionHours: 24, escalationHours: 8, businessHoursOnly: true, isDefault: true },
      { tenantId: bankTenant.id, name: 'Low SLA', priority: 'LOW', responseHours: 8, resolutionHours: 48, escalationHours: 24, businessHoursOnly: true, isDefault: true },
    ] as any,
  });
  console.log('  ✓ 4 SLA Policies');

  // ═══════════════════════════════════════════════════════════════════════════
  // 35. ENDPOINT POLICIES (6)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🛡️ Seeding Endpoint Policies...');
  await prisma.endpointPolicy.createMany({
    data: [
      { tenantId: bankTenant.id, name: 'Block Unauthorized Software', category: 'SOFTWARE_INSTALL', severity: 'CRITICAL', action: 'AUTO_BLOCK', matchPattern: { blockedSoftware: ['BitTorrent', 'uTorrent', 'TeamViewer'] }, isActive: true, isSystem: true, createdById: userCISO.id },
      { tenantId: bankTenant.id, name: 'USB Device Alert', category: 'USB_DEVICE', severity: 'WARNING', action: 'ALERT_ONLY', matchPattern: { allowedTypes: ['keyboard', 'mouse'] }, isActive: true, isSystem: true, createdById: userCISO.id },
      { tenantId: bankTenant.id, name: 'RAM Change Detection', category: 'RAM_CHANGE', severity: 'INFO', action: 'ALERT_ONLY', matchPattern: { thresholdGb: 4 }, isActive: true, isSystem: false, createdById: userSecAnalyst.id },
      { tenantId: bankTenant.id, name: 'Network Interface Change', category: 'NETWORK_CHANGE', severity: 'WARNING', action: 'REQUIRE_APPROVAL', matchPattern: { monitorDhcp: true, monitorDns: true }, isActive: true, isSystem: false, createdById: userNetworkEng.id },
      { tenantId: bankTenant.id, name: 'Disk Replacement Alert', category: 'DISK_CHANGE', severity: 'INFO', action: 'ALERT_ONLY', matchPattern: {}, isActive: true, isSystem: false, createdById: userITSupport.id },
      { tenantId: bankTenant.id, name: 'Blocked Process Monitor', category: 'PROCESS_BLOCKED', severity: 'CRITICAL', action: 'AUTO_BLOCK', matchPattern: { blockedProcesses: ['cryptominer.exe', 'mimikatz.exe'] }, isActive: true, isSystem: true, createdById: userCISO.id },
    ] as any,
  });
  console.log('  ✓ 6 Endpoint Policies');

  // ═══════════════════════════════════════════════════════════════════════════
  // 36. NETWORK CONFIGS (3)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🌐 Seeding Network Configs...');
  await prisma.networkConfig.createMany({
    data: [
      { tenantId: bankTenant.id, deviceId: coreSwitch?.id || 'unknown', deviceName: 'Cisco Catalyst 9300 - Core', configText: '! Core Switch Config\nhostname NDBK-MUM-NSW-001\n!\ninterface Vlan100\n  ip address 10.10.100.1 255.255.255.0\n  description Server VLAN\n!\ninterface Vlan200\n  ip address 10.10.200.1 255.255.255.0\n  description User VLAN\n!\nspanning-tree mode rapid-pvst\n!', version: 3, configHash: 'sha256:abc123def456', isBaseline: true },
      { tenantId: bankTenant.id, deviceId: coreRouter?.id || 'unknown', deviceName: 'Cisco ISR 4431 - Core Router', configText: '! Core Router Config\nhostname NDBK-MUM-RTR-001\n!\ninterface GigabitEthernet0/0\n  ip address 10.10.0.1 255.255.0.0\n  description Uplink to ISP\n!\nrouter ospf 1\n  network 10.10.0.0 0.0.255.255 area 0\n!', version: 2, configHash: 'sha256:def789ghi012', isBaseline: true },
      { tenantId: bankTenant.id, deviceId: fw1?.id || 'unknown', deviceName: 'Palo Alto PA-5260 - Primary', configText: '# Firewall Config\nset deviceconfig system hostname NDBK-MUM-FWL-001\nset network interface ethernet1/1 layer3 ip 10.10.0.2/16\nset rulebase security rules "Allow-CBS" from trust to untrust application cbs-app action allow\nset rulebase security rules "Block-P2P" from any to any application bittorrent action deny', version: 5, configHash: 'sha256:ghi345jkl678', isBaseline: false },
    ] as any,
  });
  console.log('  ✓ 3 Network Configs');

  // ═══════════════════════════════════════════════════════════════════════════
  // 37. FLEET — TRIPS & GPS TELEMETRY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🚗 Seeding Fleet (Trips & GPS)...');
  const vehicleAssets = await prisma.asset.findMany({ where: { assetTypeId: typeVehicle.id }, take: 5 });

  for (let v = 0; v < vehicleAssets.length; v++) {
    const vehicle = vehicleAssets[v];
    // Create 2 trips per vehicle
    for (let t = 0; t < 2; t++) {
      const startTime = new Date(now.getTime() - (v * 2 + t) * 86400000);
      const endTime = new Date(startTime.getTime() + 3600000 + Math.random() * 7200000);
      await prisma.trip.create({
        data: {
          tenantId: bankTenant.id,
          assetId: vehicle.id,
          startTime,
          endTime,
          distanceKm: 10 + Math.floor(Math.random() * 80),
          maxSpeed: 40 + Math.floor(Math.random() * 60),
          avgSpeed: 20 + Math.floor(Math.random() * 30),
          startLocation: ['Mumbai HQ', 'Treasury Mumbai', 'Delhi Office', 'Bangalore Hub'][v % 4],
          endLocation: ['Nariman Point Branch', 'Andheri Branch', 'Connaught Place', 'Whitefield'][v % 4],
        },
      });
    }

    // GPS telemetry (10 pings per vehicle)
    const gpsData: any[] = [];
    for (let g = 0; g < 10; g++) {
      gpsData.push({
        tenantId: bankTenant.id,
        assetId: vehicle.id,
        latitude: 19.05 + (Math.random() - 0.5) * 0.1,
        longitude: 72.85 + (Math.random() - 0.5) * 0.1,
        speed: Math.floor(Math.random() * 60),
        fuelLevel: 30 + Math.floor(Math.random() * 60),
        collectedAt: new Date(now.getTime() - g * 600000),
      });
    }
    await prisma.gpsTelemetry.createMany({ data: gpsData });
  }
  console.log(`  ✓ ${vehicleAssets.length * 2} Trips, ${vehicleAssets.length * 10} GPS Telemetry`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 38. NOTIFICATIONS (5+)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('🔔 Seeding Notifications...');
  await prisma.notification.createMany({
    data: [
      { tenantId: bankTenant.id, userId: userDirector.id, title: 'Compliance Alert', message: 'Unauthorized device detected in Mumbai HQ network scan.', type: 'SECURITY', module: 'discovery' },
      { tenantId: bankTenant.id, userId: userDirector.id, title: 'System Info', message: 'Weekly asset report generated successfully.', type: 'INFO', module: 'reports' },
      { tenantId: bankTenant.id, userId: userCISO.id, title: 'Critical Patch Available', message: 'Cisco IOS XE security advisory requires immediate attention on 55 devices.', type: 'WARNING', module: 'patches' },
      { tenantId: bankTenant.id, userId: userITSupport.id, title: 'License Expiring', message: 'Adobe Creative Cloud license expires in 30 days. Renewal required.', type: 'WARNING', module: 'licenses' },
      { tenantId: bankTenant.id, userId: userNetworkEng.id, title: 'Network Switch Offline', message: 'Switch NSW-003 at Bangalore DC is unreachable. Last seen 15 minutes ago.', type: 'ALERT', module: 'monitoring' },
      { tenantId: bankTenant.id, userId: userFleetMgr.id, title: 'Vehicle Service Due', message: 'Vehicle VEH-003 (Toyota Innova) has reached 15,000 km. Service overdue.', type: 'WARNING', module: 'fleet' },
      { tenantId: bankTenant.id, userId: userDBA.id, title: 'Database Alert', message: 'Oracle DB connection pool utilization at 90%. Consider increasing pool size.', type: 'WARNING', module: 'monitoring' },
    ] as any,
  });
  console.log('  ✓ 7 Notifications');

  // ═══════════════════════════════════════════════════════════════════════════
  // 39. NOTIFICATION CHANNELS (4)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📢 Seeding Notification Channels...');
  await prisma.notificationChannel.createMany({
    data: [
      { tenantId: bankTenant.id, name: 'IT Team Email', type: 'EMAIL', config: { smtpHost: 'smtp.nationaldigitalbank.com', recipients: ['it-team@demobank.com'] }, isActive: true, events: ['CRITICAL_INCIDENT', 'DEVICE_OFFLINE', 'PATCH_CRITICAL'] },
      { tenantId: bankTenant.id, name: 'Security Slack Channel', type: 'SLACK', config: { webhookUrl: 'https://hooks.slack.com/services/T000/B000/xxxx', channel: '#security-alerts' }, isActive: true, events: ['ROGUE_DEVICE', 'COMPLIANCE_VIOLATION', 'MALWARE_DETECTED'] },
      { tenantId: bankTenant.id, name: 'Management Teams', type: 'TEAMS', config: { webhookUrl: 'https://outlook.office.com/webhook/xxx', channel: 'IT Management' }, isActive: true, events: ['WEEKLY_REPORT', 'LICENSE_EXPIRY', 'BUDGET_ALERT'] },
      { tenantId: bankTenant.id, name: 'PagerDuty Integration', type: 'WEBHOOK', config: { webhookUrl: 'https://events.pagerduty.com/integration/xxx/enqueue', headers: { 'Content-Type': 'application/json' } }, isActive: true, events: ['CRITICAL_INCIDENT', 'DEVICE_OFFLINE'] },
    ] as any,
  });
  console.log('  ✓ 4 Notification Channels');

  // ═══════════════════════════════════════════════════════════════════════════
  // 40. SCHEDULED REPORTS (3)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📊 Seeding Scheduled Reports...');
  await prisma.scheduledReport.createMany({
    data: [
      { tenantId: bankTenant.id, name: 'Weekly Executive Asset Report', reportType: 'executive', schedule: '0 8 * * 1', format: 'PDF', recipients: ['director@demobank.com', 'ciso@demobank.com'], isActive: true, createdById: userDirector.id },
      { tenantId: bankTenant.id, name: 'Daily Compliance Summary', reportType: 'compliance', schedule: '0 9 * * *', format: 'CSV', recipients: ['auditor@demobank.com', 'risk.officer@demobank.com'], isActive: true, createdById: userAuditor.id },
      { tenantId: bankTenant.id, name: 'Monthly License Usage Report', reportType: 'licenses', schedule: '0 10 1 * *', format: 'CSV', recipients: ['itsupport@demobank.com', 'director@demobank.com'], isActive: true, createdById: userITSupport.id },
    ] as any,
  });
  console.log('  ✓ 3 Scheduled Reports');

  // ═══════════════════════════════════════════════════════════════════════════
  // 41. SCRIPT LIBRARY (5)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📜 Seeding Script Library...');
  await prisma.scriptLibrary.createMany({
    data: [
      { tenantId: bankTenant.id, name: 'Clear Print Spooler', description: 'Stops the print spooler service, clears the print queue, and restarts the service.', scriptContent: 'Stop-Service -Name Spooler -Force\nRemove-Item -Path "$env:SystemRoot\\System32\\spool\\PRINTERS\\*" -Force\nStart-Service -Name Spooler', platform: 'POWERSHELL', category: 'REMEDIATION', approvalStatus: 'APPROVED', timeoutSeconds: 60, runCount: 25 },
      { tenantId: bankTenant.id, name: 'Collect System Diagnostics', description: 'Gathers CPU, memory, disk, and network info for troubleshooting.', scriptContent: '#!/bin/bash\necho "=== CPU ===" && lscpu\necho "=== Memory ===" && free -h\necho "=== Disk ===" && df -h\necho "=== Network ===" && ip addr', platform: 'BASH', category: 'DIAGNOSTICS', approvalStatus: 'APPROVED', timeoutSeconds: 120, runCount: 40 },
      { tenantId: bankTenant.id, name: 'Windows Update Check', description: 'Lists pending Windows updates and their severity.', scriptContent: '$Session = New-Object -ComObject Microsoft.Update.Session\n$Searcher = $Session.CreateUpdateSearcher()\n$Results = $Searcher.Search("IsInstalled=0")\n$Results.Updates | Select-Object Title, MsrcSeverity | Format-Table', platform: 'POWERSHELL', category: 'MAINTENANCE', approvalStatus: 'APPROVED', timeoutSeconds: 300, runCount: 15 },
      { tenantId: bankTenant.id, name: 'Deploy CrowdStrike Agent', description: 'Installs CrowdStrike Falcon sensor with customer ID.', scriptContent: '#!/bin/bash\nCID="CUSTOMER_ID_HERE"\ncurl -o /tmp/falcon-sensor.deb https://falcon.crowdstrike.com/sensor/linux/latest\nsudo dpkg -i /tmp/falcon-sensor.deb\nsudo /opt/CrowdStrike/falconctl -s --cid=$CID\nsudo systemctl start falcon-sensor', platform: 'BASH', category: 'DEPLOYMENT', approvalStatus: 'APPROVED', timeoutSeconds: 600, runCount: 50 },
      { tenantId: bankTenant.id, name: 'Network Connectivity Test', description: 'Tests connectivity to critical services and reports latency.', scriptContent: 'import subprocess\nimport json\n\ntargets = ["10.10.100.1", "10.10.200.1", "8.8.8.8"]\nresults = []\nfor t in targets:\n    r = subprocess.run(["ping", "-c", "4", t], capture_output=True, text=True)\n    results.append({"target": t, "output": r.stdout})\nprint(json.dumps(results, indent=2))', platform: 'PYTHON', category: 'DIAGNOSTICS', approvalStatus: 'APPROVED', timeoutSeconds: 120, runCount: 30 },
    ] as any,
  });
  console.log('  ✓ 5 Script Library entries');

  // ═══════════════════════════════════════════════════════════════════════════
  // 42. ASSET CHECKOUTS (5)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📦 Seeding Asset Checkouts...');
  const checkoutLaptops = await prisma.asset.findMany({ where: { assetTypeId: typeLaptop.id }, take: 5 });
  await prisma.assetCheckout.createMany({
    data: [
      { tenantId: bankTenant.id, assetId: checkoutLaptops[0]?.id || '', userId: userEmployee.id, checkedOutById: userITSupport.id, expectedReturn: new Date('2026-12-31'), condition: 'GOOD', status: 'CHECKED_OUT', notes: 'Issued for project work' },
      { tenantId: bankTenant.id, assetId: checkoutLaptops[1]?.id || '', userId: userDigitalLead.id, checkedOutById: userITSupport.id, expectedReturn: new Date('2026-09-30'), condition: 'GOOD', status: 'CHECKED_OUT', notes: 'Digital banking development' },
      { tenantId: bankTenant.id, assetId: checkoutLaptops[2]?.id || '', userId: userTreasuryMgr.id, checkedOutById: userITSupport.id, expectedReturn: new Date('2026-08-15'), condition: 'GOOD', status: 'CHECKED_OUT', notes: 'Treasury operations' },
      { tenantId: bankTenant.id, assetId: checkoutLaptops[3]?.id || '', userId: userAuditor.id, checkedOutById: userITSupport.id, checkedOutAt: new Date('2026-01-15'), expectedReturn: new Date('2026-06-30'), actualReturn: new Date('2026-06-28'), condition: 'GOOD', status: 'RETURNED', notes: 'Audit engagement completed' },
      { tenantId: bankTenant.id, assetId: checkoutLaptops[4]?.id || '', userId: userHRManager.id, checkedOutById: userITSupport.id, checkedOutAt: new Date('2026-03-01'), expectedReturn: new Date('2026-06-30'), condition: 'FAIR', status: 'OVERDUE', notes: 'HR system migration' },
    ] as any,
  });
  console.log('  ✓ 5 Asset Checkouts');

  // ═══════════════════════════════════════════════════════════════════════════
  // 43. ASSET HISTORY (10+ lifecycle events)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📜 Seeding Asset History...');
  const historyAssets = await prisma.asset.findMany({ where: { tenantId: bankTenant.id }, take: 10 });
  const assetHistoryData: any[] = [];
  const eventTypes = ['CREATED', 'DEPLOYED', 'ASSIGNED', 'MAINTENANCE_START', 'MAINTENANCE_END', 'LOCATION_CHANGE', 'STATUS_CHANGE', 'WARRANTY_RENEWED', 'DECOMMISSIONED', 'CHECKED_OUT', 'CHECKED_IN', 'PATCHED'];

  for (let i = 0; i < historyAssets.length; i++) {
    const asset = historyAssets[i];
    const numEvents = 2 + Math.floor(Math.random() * 3);
    for (let e = 0; e < numEvents; e++) {
      const eventType = eventTypes[(i + e) % eventTypes.length];
      assetHistoryData.push({
        tenantId: bankTenant.id,
        assetId: asset.id,
        eventType,
        description: `${eventType.replace(/_/g, ' ').toLowerCase()} - ${asset.name}`,
        performedBy: [userITSupport.id, userNetworkEng.id, userDirector.id][i % 3],
        details: { previousStatus: 'ACTIVE', newStatus: eventType === 'DECOMMISSIONED' ? 'RETIRED' : 'ACTIVE' },
        timestamp: new Date(now.getTime() - (i * numEvents + e) * 86400000),
      });
    }
  }
  await prisma.assetHistory.createMany({ data: assetHistoryData as any });
  console.log(`  ✓ ${assetHistoryData.length} Asset History entries`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 44. ASSET ATTESTATIONS (5)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('✅ Seeding Asset Attestations...');
  const attestAssets = await prisma.asset.findMany({ where: { assetTypeId: typeLaptop.id }, skip: 5, take: 5 });
  await prisma.assetAttestation.createMany({
    data: [
      { tenantId: bankTenant.id, assetId: attestAssets[0]?.id || '', userId: userEmployee.id, campaignName: 'Q2 2026 Asset Verification', response: 'CONFIRMED', respondedAt: new Date() },
      { tenantId: bankTenant.id, assetId: attestAssets[1]?.id || '', userId: userDigitalLead.id, campaignName: 'Q2 2026 Asset Verification', response: 'CONFIRMED', respondedAt: new Date() },
      { tenantId: bankTenant.id, assetId: attestAssets[2]?.id || '', userId: userBranchMgr.id, campaignName: 'Q2 2026 Asset Verification', response: 'TRANSFERRED', respondedAt: new Date(), notes: 'Transferred to new team member' },
      { tenantId: bankTenant.id, assetId: attestAssets[3]?.id || '', userId: userTreasuryMgr.id, campaignName: 'Q2 2026 Asset Verification', response: null },
      { tenantId: bankTenant.id, assetId: attestAssets[4]?.id || '', userId: userHRManager.id, campaignName: 'Q2 2026 Asset Verification', response: 'LOST', respondedAt: new Date(), notes: 'Laptop reported lost during travel' },
    ] as any,
  });
  console.log('  ✓ 5 Asset Attestations');

  // ═══════════════════════════════════════════════════════════════════════════
  // 45. AUDIT LOGS (20+)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('📝 Seeding Audit Logs...');
  const auditData: any[] = [
    { tenantId: bankTenant.id, actorId: userDirector.id, actorIp: '10.10.1.100', action: 'USER_LOGIN', resourceType: 'auth', outcome: 'SUCCESS', severity: 'INFO', module: 'auth', metadata: { method: 'password+mfa' } },
    { tenantId: bankTenant.id, actorId: userCISO.id, actorIp: '10.10.1.101', action: 'USER_LOGIN', resourceType: 'auth', outcome: 'SUCCESS', severity: 'INFO', module: 'auth' },
    { tenantId: bankTenant.id, actorId: userITSupport.id, actorIp: '10.10.1.102', action: 'ASSET_CREATED', resourceType: 'asset', resourceName: 'Dell Latitude 5540', outcome: 'SUCCESS', severity: 'INFO', module: 'assets' },
    { tenantId: bankTenant.id, actorId: userITSupport.id, actorIp: '10.10.1.102', action: 'ASSET_UPDATED', resourceType: 'asset', resourceName: 'Dell Latitude 5540', outcome: 'SUCCESS', severity: 'INFO', module: 'assets', before: { status: 'DISCOVERED' }, after: { status: 'ACTIVE' } },
    { tenantId: bankTenant.id, actorId: userCISO.id, actorIp: '10.10.1.101', action: 'SCAN_INITIATED', resourceType: 'scan', resourceName: 'Mumbai HQ Full Scan', outcome: 'SUCCESS', severity: 'INFO', module: 'discovery' },
    { tenantId: bankTenant.id, actorId: userNetworkEng.id, actorIp: '10.10.1.103', action: 'CONFIG_BACKUP', resourceType: 'network_config', resourceName: 'Core Switch Config', outcome: 'SUCCESS', severity: 'INFO', module: 'network' },
    { tenantId: bankTenant.id, actorId: null, actorIp: '10.10.5.201', action: 'UNAUTHORIZED_DEVICE', resourceType: 'discovery', resourceName: 'unknown-device-1', outcome: 'FAILURE', severity: 'CRITICAL', module: 'security', metadata: { riskScore: 75, ip: '10.10.5.201' } },
    { tenantId: bankTenant.id, actorId: userITSupport.id, actorIp: '10.10.1.102', action: 'PATCH_DEPLOYED', resourceType: 'patch', resourceName: 'KB5034441', outcome: 'SUCCESS', severity: 'INFO', module: 'patches' },
    { tenantId: bankTenant.id, actorId: userDBA.id, actorIp: '10.10.2.50', action: 'DATABASE_ACCESS', resourceType: 'database', resourceName: 'Oracle CBS Production', outcome: 'SUCCESS', severity: 'WARNING', module: 'compliance' },
    { tenantId: bankTenant.id, actorId: userSecAnalyst.id, actorIp: '10.10.1.104', action: 'POLICY_CREATED', resourceType: 'endpoint_policy', resourceName: 'Block Unauthorized Software', outcome: 'SUCCESS', severity: 'INFO', module: 'compliance' },
    { tenantId: bankTenant.id, actorId: userDirector.id, actorIp: '10.10.1.100', action: 'ROLE_ASSIGNED', resourceType: 'user', resourceName: 'Amit Patel', outcome: 'SUCCESS', severity: 'INFO', module: 'auth', after: { role: 'IT Admin' } },
    { tenantId: bankTenant.id, actorId: null, actorIp: '192.168.1.50', action: 'FAILED_LOGIN', resourceType: 'auth', resourceName: 'unknown@demobank.com', outcome: 'FAILURE', severity: 'WARNING', module: 'auth', metadata: { reason: 'Invalid credentials', attempts: 3 } },
    { tenantId: bankTenant.id, actorId: null, actorIp: '103.45.67.89', action: 'FAILED_LOGIN', resourceType: 'auth', resourceName: 'admin@demobank.com', outcome: 'FAILURE', severity: 'CRITICAL', module: 'auth', metadata: { reason: 'Brute force detected', attempts: 15, blocked: true } },
    { tenantId: bankTenant.id, actorId: userITSupport.id, actorIp: '10.10.1.102', action: 'ASSET_CHECKOUT', resourceType: 'asset', resourceName: 'Dell Latitude 5540 LPT-001', outcome: 'SUCCESS', severity: 'INFO', module: 'assets', metadata: { checkedOutTo: 'Vikram Singh' } },
    { tenantId: bankTenant.id, actorId: userAuditor.id, actorIp: '10.10.1.110', action: 'REPORT_GENERATED', resourceType: 'report', resourceName: 'Compliance Audit Report Q2', outcome: 'SUCCESS', severity: 'INFO', module: 'reports' },
    { tenantId: bankTenant.id, actorId: userDirector.id, actorIp: '10.10.1.100', action: 'CHANGE_APPROVED', resourceType: 'change_request', resourceName: 'CR-0001 Windows Migration', outcome: 'SUCCESS', severity: 'INFO', module: 'itsm' },
    { tenantId: bankTenant.id, actorId: userCISO.id, actorIp: '10.10.1.101', action: 'AUTOMATION_RULE_CREATED', resourceType: 'automation_rule', resourceName: 'Alert on Rogue Device', outcome: 'SUCCESS', severity: 'INFO', module: 'automation' },
    { tenantId: bankTenant.id, actorId: userFleetMgr.id, actorIp: '10.10.1.120', action: 'TRIP_CREATED', resourceType: 'fleet', resourceName: 'VEH-001 Mumbai HQ to Nariman Point', outcome: 'SUCCESS', severity: 'INFO', module: 'fleet' },
    { tenantId: bankTenant.id, actorId: userHRManager.id, actorIp: '10.10.1.130', action: 'LICENSE_ASSIGNED', resourceType: 'license', resourceName: 'Microsoft 365 E5', outcome: 'SUCCESS', severity: 'INFO', module: 'licenses', metadata: { assignedTo: 'new.joiner@demobank.com' } },
    { tenantId: bankTenant.id, actorId: userITSupport.id, actorIp: '10.10.1.102', action: 'VENDOR_CREATED', resourceType: 'vendor', resourceName: 'Dell Technologies', outcome: 'SUCCESS', severity: 'INFO', module: 'procurement' },
    { tenantId: bankTenant.id, actorId: userDirector.id, actorIp: '10.10.1.100', action: 'PO_APPROVED', resourceType: 'purchase_order', resourceName: 'PO-2026-001', outcome: 'SUCCESS', severity: 'INFO', module: 'procurement', metadata: { amount: 1750000, vendor: 'Dell Technologies' } },
    { tenantId: bankTenant.id, actorId: userRiskOfficer.id, actorIp: '10.10.1.140', action: 'ATTESTATION_REVIEW', resourceType: 'attestation', resourceName: 'Q2 2026 Asset Verification', outcome: 'SUCCESS', severity: 'INFO', module: 'compliance' },
  ];
  await prisma.auditLog.createMany({ data: auditData as any });
  console.log(`  ✓ ${auditData.length} Audit Logs`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 46. SUBSCRIPTION & PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('💳 Seeding Subscription & Payments...');
  const subscription = await prisma.subscription.create({
    data: {
      tenantId: bankTenant.id,
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2028-03-31'),
      mrr: 250000,
      billingCycle: 'ANNUAL',
      notes: 'National Digital Bank - 3 year enterprise agreement',
    },
  });

  await prisma.payment.createMany({
    data: [
      { subscriptionId: subscription.id, amount: 3000000, currency: 'INR', status: 'COMPLETED', method: 'BANK_TRANSFER', referenceId: 'NEFT-2025-04-001', invoiceNumber: 'INV-2025-001', paidAt: new Date('2025-04-15') },
      { subscriptionId: subscription.id, amount: 3000000, currency: 'INR', status: 'COMPLETED', method: 'BANK_TRANSFER', referenceId: 'NEFT-2026-04-001', invoiceNumber: 'INV-2026-001', paidAt: new Date('2026-04-10') },
      { subscriptionId: subscription.id, amount: 3000000, currency: 'INR', status: 'PENDING', method: 'BANK_TRANSFER', invoiceNumber: 'INV-2027-001', notes: 'Year 3 payment - due April 2027' },
    ] as any,
  });
  console.log('  ✓ 1 Subscription, 3 Payments');

  // ═══════════════════════════════════════════════════════════════════════════
  // 47. SYSTEM CONFIG (3)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('⚙️ Seeding System Config...');
  await prisma.systemConfig.createMany({
    data: [
      { key: 'platform.version', value: JSON.stringify('2.5.0') },
      { key: 'platform.maintenance_mode', value: JSON.stringify(false) },
      { key: 'platform.features', value: JSON.stringify({ fleet: true, scanning: true, patches: true, automation: true, compliance: true, procurement: true }) },
    ] as any,
  });
  console.log('  ✓ 3 System Configs');

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL COUNTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════');
  console.log('🏦 BANK DEMO SEED COMPLETE!');
  console.log('═══════════════════════════════════════════');

  const counts = {
    tenants: await prisma.tenant.count(),
    sites: await prisma.site.count(),
    departments: await prisma.department.count(),
    roles: await prisma.role.count(),
    users: await prisma.user.count(),
    assetTypes: await prisma.assetType.count(),
    assets: await prisma.asset.count(),
    monitoredDevices: await prisma.monitoredDevice.count(),
    metricsHistory: await prisma.deviceMetricsHistory.count(),
    relationships: await prisma.assetRelationship.count(),
    agents: await prisma.agent.count(),
    agentBaselines: await prisma.agentBaseline.count(),
    tickets: await prisma.ticket.count(),
    ticketComments: await prisma.ticketComment.count(),
    workOrders: await prisma.workOrder.count(),
    changeRequests: await prisma.changeRequest.count(),
    problems: await prisma.problem.count(),
    vendors: await prisma.vendor.count(),
    contracts: await prisma.contract.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    purchaseOrderItems: await prisma.purchaseOrderItem.count(),
    softwareCatalog: await prisma.softwareCatalog.count(),
    licenses: await prisma.license.count(),
    licenseAssignments: await prisma.licenseAssignment.count(),
    scanJobs: await prisma.scanJob.count(),
    discoveredDevices: await prisma.discoveredDevice.count(),
    scanCredentials: await prisma.scanCredential.count(),
    scheduledScans: await prisma.scheduledScan.count(),
    scanResults: await prisma.scanResult.count(),
    patches: await prisma.patch.count(),
    automationRules: await prisma.automationRule.count(),
    automationExecutions: await prisma.automationExecution.count(),
    knowledgeArticles: await prisma.knowledgeArticle.count(),
    serviceCatalogItems: await prisma.serviceCatalogItem.count(),
    slaPolicies: await prisma.slaPolicy.count(),
    endpointPolicies: await prisma.endpointPolicy.count(),
    networkConfigs: await prisma.networkConfig.count(),
    trips: await prisma.trip.count(),
    gpsTelemetry: await prisma.gpsTelemetry.count(),
    notifications: await prisma.notification.count(),
    notificationChannels: await prisma.notificationChannel.count(),
    scheduledReports: await prisma.scheduledReport.count(),
    scriptLibrary: await prisma.scriptLibrary.count(),
    assetCheckouts: await prisma.assetCheckout.count(),
    assetHistory: await prisma.assetHistory.count(),
    assetAttestations: await prisma.assetAttestation.count(),
    auditLogs: await prisma.auditLog.count(),
    subscriptions: await prisma.subscription.count(),
    payments: await prisma.payment.count(),
    systemConfigs: await prisma.systemConfig.count(),
  };

  for (const [model, count] of Object.entries(counts)) {
    console.log(`  ${model}: ${count}`);
  }
  console.log('═══════════════════════════════════════════\n');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
