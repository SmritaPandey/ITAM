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
  category?: string; // e.g. 'Laptop', 'Server', 'Furniture'
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

  // ─── 1. DELETE (child → parent order) ──────────────────────────────────────
  // Deep child tables first
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
      plan: 'ENTERPRISE' as const,
      status: 'ACTIVE',
      settings: {
        currency: 'INR',
        dateFormat: 'DD/MM/YYYY',
        fiscalYearStart: 'April',
        mfaEnforced: true,
        passwordPolicy: { minLength: 12, requireSpecial: true, expiryDays: 90 },
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
      plan: 'ON_PREMISE' as const,
      status: 'ACTIVE',
      settings: { platformMode: true, multiTenant: true, maxTenants: 500 },
    },
  });

  console.log('🏢 Tenants created');

  // ─── 3. SITES ──────────────────────────────────────────────────────────────
  const siteMumbaiHQ = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Mumbai HQ', address: 'Bandra Kurla Complex, G Block', city: 'Mumbai', state: 'Maharashtra', country: 'India', zipCode: '400051', latitude: 19.0596, longitude: 72.8656, timezone: 'Asia/Kolkata', isHq: true },
  });
  const siteTreasury = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Treasury Mumbai', address: 'Nariman Point, Marine Drive', city: 'Mumbai', state: 'Maharashtra', country: 'India', zipCode: '400021', latitude: 18.9256, longitude: 72.8242, timezone: 'Asia/Kolkata', isHq: false },
  });
  const siteBangalore = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Bangalore Tech Hub', address: 'Whitefield, ITPL Road', city: 'Bangalore', state: 'Karnataka', country: 'India', zipCode: '560066', latitude: 12.9698, longitude: 77.7500, timezone: 'Asia/Kolkata', isHq: false },
  });
  const siteDelhi = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Delhi Regional Office', address: 'Connaught Place, Block A', city: 'New Delhi', state: 'Delhi', country: 'India', zipCode: '110001', latitude: 28.6315, longitude: 77.2167, timezone: 'Asia/Kolkata', isHq: false },
  });
  const siteHyderabad = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Hyderabad Operations', address: 'HITEC City, Madhapur', city: 'Hyderabad', state: 'Telangana', country: 'India', zipCode: '500081', latitude: 17.4435, longitude: 78.3772, timezone: 'Asia/Kolkata', isHq: false },
  });
  const sitePune = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Pune Branch', address: 'Hinjewadi IT Park, Phase 1', city: 'Pune', state: 'Maharashtra', country: 'India', zipCode: '411057', latitude: 18.5912, longitude: 73.7389, timezone: 'Asia/Kolkata', isHq: false },
  });
  const siteChennai = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Chennai DR Center', address: 'Tidel Park, Taramani', city: 'Chennai', state: 'Tamil Nadu', country: 'India', zipCode: '600113', latitude: 12.9830, longitude: 80.2422, timezone: 'Asia/Kolkata', isHq: false },
  });
  const siteKolkata = await prisma.site.create({
    data: { tenantId: bankTenant.id, name: 'Kolkata Branch', address: 'Salt Lake Sector V', city: 'Kolkata', state: 'West Bengal', country: 'India', zipCode: '700091', latitude: 22.5726, longitude: 88.4377, timezone: 'Asia/Kolkata', isHq: false },
  });

  const allSiteIds = [siteMumbaiHQ.id, siteTreasury.id, siteBangalore.id, siteDelhi.id, siteHyderabad.id, sitePune.id, siteChennai.id, siteKolkata.id];
  console.log('🏗️  8 Sites created');

  // ─── 4. DEPARTMENTS ────────────────────────────────────────────────────────
  const deptIT = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'IT Infrastructure', code: 'IT-INFRA', costCenter: 'CC-1001' } });
  const deptCyber = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Cybersecurity', code: 'CYBER', costCenter: 'CC-1002' } });
  const deptCoreBanking = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteBangalore.id, name: 'Core Banking', code: 'CORE-BNK', costCenter: 'CC-2001' } });
  const deptTreasury = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteTreasury.id, name: 'Treasury', code: 'TREASURY', costCenter: 'CC-2002' } });
  const deptRetail = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteDelhi.id, name: 'Retail Banking', code: 'RETAIL', costCenter: 'CC-3001' } });
  const deptCorporate = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Corporate Lending', code: 'CORP-LEND', costCenter: 'CC-3002' } });
  const deptRisk = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Risk & Compliance', code: 'RISK-COMP', costCenter: 'CC-4001' } });
  const deptHR = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'HR', code: 'HR', costCenter: 'CC-5001' } });
  const deptFacilities = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Facilities', code: 'FACILITIES', costCenter: 'CC-5002' } });
  const deptAudit = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Internal Audit', code: 'INT-AUDIT', costCenter: 'CC-6001' } });
  const deptLegal = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteMumbaiHQ.id, name: 'Legal', code: 'LEGAL', costCenter: 'CC-6002' } });
  const deptDigital = await prisma.department.create({ data: { tenantId: bankTenant.id, siteId: siteBangalore.id, name: 'Digital Banking', code: 'DIGITAL', costCenter: 'CC-7001' } });

  console.log('🏛️  12 Departments created');

  // ─── 5. ROLES ──────────────────────────────────────────────────────────────
  const roleTenantAdmin = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Tenant Admin', isSystem: true, permissions: { assets: ['*'], tickets: ['*'], users: ['*'], reports: ['*'], settings: ['*'], security: ['*'], vendors: ['*'], licenses: ['*'] } },
  });
  const roleITAdmin = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'IT Admin', isSystem: false, permissions: { assets: ['create', 'read', 'update', 'assign'], tickets: ['create', 'read', 'update', 'assign'], reports: ['read'], security: ['read', 'scan'], licenses: ['read', 'update'] } },
  });
  const roleSecurityAdmin = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Security Admin', isSystem: false, permissions: { assets: ['read'], tickets: ['read', 'update'], security: ['*'], reports: ['read'], agents: ['*'], scans: ['*'], policies: ['*'] } },
  });
  const roleBranchMgr = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Branch Manager', isSystem: false, permissions: { assets: ['read', 'request'], tickets: ['create', 'read'], reports: ['read'] } },
  });
  const roleEmployee = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Employee', isSystem: false, permissions: { assets: ['read'], tickets: ['create', 'read'] } },
  });
  const roleFleetMgr = await prisma.role.create({
    data: { tenantId: bankTenant.id, name: 'Fleet Manager', isSystem: false, permissions: { assets: ['read', 'update'], tickets: ['create', 'read'], vendors: ['read'] } },
  });
  const rolePlatformOwner = await prisma.role.create({
    data: { tenantId: platformTenant.id, name: 'Platform Owner', isSystem: true, permissions: { '*': ['*'] } },
  });

  console.log('👔 7 Roles created');

  // ─── 6. USERS ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo@2026', 12);

  const userDirector = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'director@demobank.com', passwordHash, firstName: 'Rajesh', lastName: 'Kapoor', phone: '+91-9820012345', roleId: roleTenantAdmin.id, departmentId: deptIT.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: true },
  });
  const userCISO = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'ciso@demobank.com', passwordHash, firstName: 'Priya', lastName: 'Sharma', phone: '+91-9820012346', roleId: roleSecurityAdmin.id, departmentId: deptCyber.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: true },
  });
  const userITSupport = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'itsupport@demobank.com', passwordHash, firstName: 'Amit', lastName: 'Patel', phone: '+91-9820012347', roleId: roleITAdmin.id, departmentId: deptIT.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: false },
  });
  const userBranchMgr = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'branch.mgr@demobank.com', passwordHash, firstName: 'Sunita', lastName: 'Reddy', phone: '+91-9820012348', roleId: roleBranchMgr.id, departmentId: deptRetail.id, siteId: siteDelhi.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: false },
  });
  const userEmployee = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'employee@demobank.com', passwordHash, firstName: 'Vikram', lastName: 'Singh', phone: '+91-9820012349', roleId: roleEmployee.id, departmentId: deptCoreBanking.id, siteId: siteBangalore.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: false },
  });
  const userPlatformOwner = await prisma.user.create({
    data: { tenantId: platformTenant.id, email: 'owner@qsasset.com', passwordHash, firstName: 'Admin', lastName: 'QS', phone: '+91-9900000001', roleId: rolePlatformOwner.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' as const, isSuperAdmin: true, emailVerified: true, mfaEnabled: true },
  });

  // Additional staff
  const userNetworkEng = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'network.eng@demobank.com', passwordHash, firstName: 'Deepak', lastName: 'Nair', phone: '+91-9820012350', roleId: roleITAdmin.id, departmentId: deptIT.id, siteId: siteBangalore.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: false },
  });
  const userDBA = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'dba@demobank.com', passwordHash, firstName: 'Meera', lastName: 'Joshi', phone: '+91-9820012351', roleId: roleITAdmin.id, departmentId: deptCoreBanking.id, siteId: siteBangalore.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: true },
  });
  const userSecAnalyst = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'sec.analyst@demobank.com', passwordHash, firstName: 'Karthik', lastName: 'Iyer', phone: '+91-9820012352', roleId: roleSecurityAdmin.id, departmentId: deptCyber.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: true },
  });
  const userTreasuryMgr = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'treasury.mgr@demobank.com', passwordHash, firstName: 'Arjun', lastName: 'Mehta', phone: '+91-9820012353', roleId: roleBranchMgr.id, departmentId: deptTreasury.id, siteId: siteTreasury.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: false },
  });
  const userRiskOfficer = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'risk.officer@demobank.com', passwordHash, firstName: 'Ananya', lastName: 'Gupta', phone: '+91-9820012354', roleId: roleEmployee.id, departmentId: deptRisk.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: false },
  });
  const userHRManager = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'hr.mgr@demobank.com', passwordHash, firstName: 'Neha', lastName: 'Deshmukh', phone: '+91-9820012355', roleId: roleEmployee.id, departmentId: deptHR.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: false },
  });
  const userFleetMgr = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'fleet.mgr@demobank.com', passwordHash, firstName: 'Rahul', lastName: 'Verma', phone: '+91-9820012356', roleId: roleFleetMgr.id, departmentId: deptFacilities.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: false },
  });
  const userDigitalLead = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'digital.lead@demobank.com', passwordHash, firstName: 'Shreya', lastName: 'Menon', phone: '+91-9820012357', roleId: roleITAdmin.id, departmentId: deptDigital.id, siteId: siteBangalore.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: false },
  });
  const userAuditor = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'auditor@demobank.com', passwordHash, firstName: 'Sanjay', lastName: 'Kulkarni', phone: '+91-9820012358', roleId: roleEmployee.id, departmentId: deptAudit.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: false },
  });
  const userLegal = await prisma.user.create({
    data: { tenantId: bankTenant.id, email: 'legal@demobank.com', passwordHash, firstName: 'Kavita', lastName: 'Bhatt', phone: '+91-9820012359', roleId: roleEmployee.id, departmentId: deptLegal.id, siteId: siteMumbaiHQ.id, status: 'ACTIVE' as const, isSuperAdmin: false, emailVerified: true, mfaEnabled: false },
  });

  const allBankUserIds = [userDirector.id, userCISO.id, userITSupport.id, userBranchMgr.id, userEmployee.id, userNetworkEng.id, userDBA.id, userSecAnalyst.id, userTreasuryMgr.id, userRiskOfficer.id, userHRManager.id, userFleetMgr.id, userDigitalLead.id, userAuditor.id, userLegal.id];
  const itStaffIds = [userDirector.id, userITSupport.id, userNetworkEng.id, userDBA.id, userDigitalLead.id];

  console.log('👥 16 Users created');

  // ─── 7. ASSET TYPES ───────────────────────────────────────────────────────
  // Parent types
  const typeHardware = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Hardware', isItAsset: true, icon: 'Monitor', color: '#2563EB' } });
  const typeNetwork = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Network', isItAsset: true, icon: 'Wifi', color: '#7C3AED' } });
  const typeSecurity = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Security', isItAsset: true, icon: 'Shield', color: '#DC2626' } });
  const typePeripheral = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Peripheral', isItAsset: true, icon: 'Printer', color: '#059669' } });
  const typeFacility = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Facility', isItAsset: false, icon: 'Building', color: '#D97706' } });
  const typeVehicle = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Vehicle', isItAsset: false, icon: 'Truck', color: '#6B7280' } });

  // Child types — Hardware
  const typeLaptop = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Laptop', parentId: typeHardware.id, isItAsset: true, icon: 'Laptop', color: '#3B82F6' } });
  const typeDesktop = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Desktop', parentId: typeHardware.id, isItAsset: true, icon: 'Monitor', color: '#2563EB' } });
  const typeServer = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Server', parentId: typeHardware.id, isItAsset: true, icon: 'Server', color: '#1D4ED8' } });
  const typeThinClient = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Thin Client', parentId: typeHardware.id, isItAsset: true, icon: 'Monitor', color: '#60A5FA' } });
  const typeATM = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'ATM', parentId: typeHardware.id, isItAsset: true, icon: 'CreditCard', color: '#1E40AF' } });

  // Child types — Network
  const typeSwitch = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Switch', parentId: typeNetwork.id, isItAsset: true, icon: 'GitBranch', color: '#8B5CF6' } });
  const typeRouter = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Router', parentId: typeNetwork.id, isItAsset: true, icon: 'Globe', color: '#7C3AED' } });
  const typeFirewall = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Firewall', parentId: typeNetwork.id, isItAsset: true, icon: 'ShieldCheck', color: '#6D28D9' } });
  const typeAP = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Access Point', parentId: typeNetwork.id, isItAsset: true, icon: 'Wifi', color: '#A78BFA' } });

  // Child types — Security
  const typeCCTV = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'CCTV', parentId: typeSecurity.id, isItAsset: true, icon: 'Camera', color: '#EF4444' } });
  const typeBiometric = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Biometric', parentId: typeSecurity.id, isItAsset: true, icon: 'Fingerprint', color: '#F87171' } });

  // Child types — Peripheral
  const typePrinter = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Printer', parentId: typePeripheral.id, isItAsset: true, icon: 'Printer', color: '#10B981' } });
  const typeUPS = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'UPS', parentId: typePeripheral.id, isItAsset: true, icon: 'Zap', color: '#34D399' } });
  const typeScanner = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Scanner', parentId: typePeripheral.id, isItAsset: true, icon: 'Scan', color: '#6EE7B7' } });

  // Child types — Facility
  const typeFurniture = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'Furniture', parentId: typeFacility.id, isItAsset: false, icon: 'Armchair', color: '#F59E0B' } });
  const typeAC = await prisma.assetType.create({ data: { tenantId: bankTenant.id, name: 'AC', parentId: typeFacility.id, isItAsset: false, icon: 'Wind', color: '#FBBF24' } });

  console.log('📦 22 Asset Types created');

  // ─── 8. ASSETS (500+ via createMany) ───────────────────────────────────────
  // Laptops — 120
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeLaptop.id, prefix: 'LPT', count: 120, costRange: [65000, 185000], hasNetwork: true, category: 'Laptop',
      models: [
        { mfr: 'Dell', model: 'Latitude 5540' }, { mfr: 'Dell', model: 'Latitude 7440' },
        { mfr: 'Lenovo', model: 'ThinkPad T14s Gen 4' }, { mfr: 'Lenovo', model: 'ThinkPad X1 Carbon Gen 11' },
        { mfr: 'HP', model: 'EliteBook 860 G10' }, { mfr: 'HP', model: 'ProBook 450 G10' },
      ],
      sites: allSiteIds, deptId: deptIT.id,
    }),
  });

  // Desktops — 80
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeDesktop.id, prefix: 'DSK', count: 80, costRange: [45000, 120000], hasNetwork: true, category: 'Desktop Workstation',
      models: [
        { mfr: 'Dell', model: 'OptiPlex 7010' }, { mfr: 'HP', model: 'ProDesk 400 G9' },
        { mfr: 'Lenovo', model: 'ThinkCentre M90q Gen 4' }, { mfr: 'Dell', model: 'Precision 3660' },
      ],
      sites: allSiteIds, deptId: deptCoreBanking.id,
    }),
  });

  // Servers — 40
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeServer.id, prefix: 'SRV', count: 40, costRange: [350000, 2500000], hasNetwork: true, category: 'Rack Server',
      models: [
        { mfr: 'Dell', model: 'PowerEdge R760' }, { mfr: 'HPE', model: 'ProLiant DL380 Gen11' },
        { mfr: 'Lenovo', model: 'ThinkSystem SR650 V3' }, { mfr: 'Dell', model: 'PowerEdge R660' },
        { mfr: 'HPE', model: 'ProLiant DL360 Gen11' },
      ],
      sites: [siteMumbaiHQ.id, siteBangalore.id, siteChennai.id], deptId: deptIT.id,
    }),
  });

  // Thin Clients — 35
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeThinClient.id, prefix: 'THN', count: 35, costRange: [25000, 55000], hasNetwork: true, category: 'Thin Client',
      models: [
        { mfr: 'Dell', model: 'Wyse 5070' }, { mfr: 'HP', model: 't640 Thin Client' },
        { mfr: 'IGEL', model: 'UD3-LX' },
      ],
      sites: [siteDelhi.id, sitePune.id, siteKolkata.id], deptId: deptRetail.id,
    }),
  });

  // ATMs — 30
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeATM.id, prefix: 'ATM', count: 30, costRange: [800000, 1500000], hasNetwork: true, category: 'ATM Terminal',
      models: [
        { mfr: 'NCR', model: 'SelfServ 84' }, { mfr: 'Diebold Nixdorf', model: 'DN Series 400' },
        { mfr: 'Hitachi', model: 'SR7500' },
      ],
      sites: allSiteIds, deptId: deptRetail.id,
    }),
  });

  // Switches — 40
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeSwitch.id, prefix: 'NSW', count: 40, costRange: [85000, 650000], hasNetwork: true, category: 'Network Switch',
      models: [
        { mfr: 'Cisco', model: 'Catalyst 9300L' }, { mfr: 'Cisco', model: 'Catalyst 9200' },
        { mfr: 'Aruba', model: 'CX 6300' }, { mfr: 'Juniper', model: 'EX4400' },
      ],
      sites: allSiteIds, deptId: deptIT.id,
    }),
  });

  // Routers — 15
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeRouter.id, prefix: 'RTR', count: 15, costRange: [150000, 900000], hasNetwork: true, category: 'Router',
      models: [
        { mfr: 'Cisco', model: 'ISR 4451-X' }, { mfr: 'Juniper', model: 'MX204' },
        { mfr: 'Cisco', model: 'ASR 1001-X' },
      ],
      sites: allSiteIds,
    }),
  });

  // Firewalls — 10
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeFirewall.id, prefix: 'FWL', count: 10, costRange: [500000, 3500000], hasNetwork: true, category: 'Firewall',
      models: [
        { mfr: 'Palo Alto', model: 'PA-5260' }, { mfr: 'Fortinet', model: 'FortiGate 600F' },
        { mfr: 'Check Point', model: 'Quantum 6800' },
      ],
      sites: [siteMumbaiHQ.id, siteBangalore.id, siteChennai.id], deptId: deptCyber.id,
    }),
  });

  // Access Points — 20
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeAP.id, prefix: 'WAP', count: 20, costRange: [18000, 65000], hasNetwork: true, category: 'Wireless Access Point',
      models: [
        { mfr: 'Cisco', model: 'Meraki MR56' }, { mfr: 'Aruba', model: 'AP-635' },
        { mfr: 'Ruckus', model: 'R770' },
      ],
      sites: allSiteIds, deptId: deptIT.id,
    }),
  });

  // CCTVs — 40
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeCCTV.id, prefix: 'CAM', count: 40, costRange: [15000, 85000], hasNetwork: true, category: 'IP Camera',
      models: [
        { mfr: 'Hikvision', model: 'DS-2CD2T87G2-L' }, { mfr: 'Dahua', model: 'IPC-HFW5849T1-ASE' },
        { mfr: 'Axis', model: 'P3265-LV' }, { mfr: 'Bosch', model: 'FLEXIDOME 5100i' },
      ],
      sites: allSiteIds, deptId: deptFacilities.id,
    }),
  });

  // Biometrics — 15
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeBiometric.id, prefix: 'BIO', count: 15, costRange: [35000, 120000], hasNetwork: true, category: 'Biometric Reader',
      models: [
        { mfr: 'HID', model: 'iCLASS SE R40' }, { mfr: 'Suprema', model: 'BioStation 3' },
        { mfr: 'ZKTeco', model: 'SpeedFace V5L Pro' },
      ],
      sites: allSiteIds, deptId: deptFacilities.id,
    }),
  });

  // Printers — 25
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typePrinter.id, prefix: 'PRT', count: 25, costRange: [25000, 350000], hasNetwork: true, category: 'Network Printer',
      models: [
        { mfr: 'HP', model: 'LaserJet Pro MFP 4101fdw' }, { mfr: 'Canon', model: 'imageRUNNER ADVANCE DX C3826i' },
        { mfr: 'Epson', model: 'WorkForce Pro WF-C5890' },
      ],
      sites: allSiteIds,
    }),
  });

  // UPS — 10
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeUPS.id, prefix: 'UPS', count: 10, costRange: [85000, 1200000], hasNetwork: true, category: 'UPS Power',
      models: [
        { mfr: 'APC', model: 'Smart-UPS SRT 10kVA' }, { mfr: 'Eaton', model: '9PX 6kVA' },
        { mfr: 'Vertiv', model: 'Liebert GXT5 8kVA' },
      ],
      sites: [siteMumbaiHQ.id, siteBangalore.id, siteChennai.id], deptId: deptIT.id,
    }),
  });

  // Scanners — 10
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeScanner.id, prefix: 'SCN', count: 10, costRange: [20000, 95000], hasNetwork: true, category: 'Document Scanner',
      models: [
        { mfr: 'Fujitsu', model: 'fi-8170' }, { mfr: 'Canon', model: 'imageFORMULA DR-C230' },
        { mfr: 'Epson', model: 'DS-870' },
      ],
      sites: allSiteIds,
    }),
  });

  // Furniture — 20
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeFurniture.id, prefix: 'FRN', count: 20, costRange: [8000, 75000], category: 'Office Furniture',
      models: [
        { mfr: 'Godrej', model: 'Interio Motion Chair' }, { mfr: 'Steelcase', model: 'Leap V2' },
        { mfr: 'Featherlite', model: 'Optima High Back' }, { mfr: 'Godrej', model: 'Storwel Filing Cabinet' },
      ],
      sites: allSiteIds, deptId: deptFacilities.id,
    }),
  });

  // Vehicles — 10
  await prisma.asset.createMany({
    data: genAssets({
      tenantId: bankTenant.id, typeId: typeVehicle.id, prefix: 'VEH', count: 10, costRange: [600000, 2500000], category: 'Fleet Vehicle',
      models: [
        { mfr: 'Maruti Suzuki', model: 'Ertiga ZXi+' }, { mfr: 'Toyota', model: 'Innova Crysta' },
        { mfr: 'Tata', model: 'Nexon EV' }, { mfr: 'Mahindra', model: 'Bolero Neo' },
      ],
      sites: [siteMumbaiHQ.id, siteDelhi.id, siteBangalore.id], deptId: deptFacilities.id,
    }),
  });

  console.log('💻 520 Assets created');

  // ─── 9. TICKETS (50+) ─────────────────────────────────────────────────────
  const ticketData = [
    { ticketNumber: 'INC-2026-0001', type: 'INCIDENT' as const, category: 'Hardware Failure', subject: 'Core Banking server SRV-005 unresponsive', description: 'Primary Core Banking application server in Mumbai DC is not responding to health checks. CBS transactions are failing intermittently.', priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, requesterId: userDBA.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-2026-0002', type: 'INCIDENT' as const, category: 'Network', subject: 'ATM network link down — Delhi cluster', description: '8 ATMs in Delhi region showing offline status. MPLS circuit between Delhi RO and ATM switch NSW-012 appears to be down.', priority: 'CRITICAL' as const, status: 'OPEN' as const, requesterId: userBranchMgr.id, assignedToId: userNetworkEng.id },
    { ticketNumber: 'INC-2026-0003', type: 'INCIDENT' as const, category: 'Security', subject: 'Suspicious login attempts on SWIFT gateway', description: 'SOC detected 47 failed login attempts on SWIFT Alliance Lite2 gateway from IP 185.x.x.x over past 2 hours. Possible brute-force attack.', priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, requesterId: userSecAnalyst.id, assignedToId: userCISO.id },
    { ticketNumber: 'INC-2026-0004', type: 'INCIDENT' as const, category: 'Application', subject: 'Mobile banking app OTP delivery delayed', description: 'Customers reporting 5-10 minute delays in OTP delivery for UPI and fund transfer authentication. SMS gateway latency suspected.', priority: 'HIGH' as const, status: 'OPEN' as const, requesterId: userDigitalLead.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-2026-0005', type: 'INCIDENT' as const, category: 'Hardware Failure', subject: 'Firewall FWL-003 failover triggered', description: 'Primary firewall at Bangalore Tech Hub entered failover mode. Secondary took over but performance degraded by 30%.', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, requesterId: userNetworkEng.id, assignedToId: userCISO.id },
    { ticketNumber: 'SR-2026-0001', type: 'SERVICE_REQUEST' as const, category: 'Provisioning', subject: 'New laptop for Treasury analyst onboarding', description: 'Request for Dell Latitude 7440 with encrypted drive for new Treasury team member joining 15-Jul. Need pre-configured with Bloomberg Terminal and Reuters Eikon.', priority: 'MEDIUM' as const, status: 'OPEN' as const, requesterId: userTreasuryMgr.id, assignedToId: userITSupport.id },
    { ticketNumber: 'SR-2026-0002', type: 'SERVICE_REQUEST' as const, category: 'Access Management', subject: 'VPN access for WFH employees — Pune branch', description: 'Requesting GlobalProtect VPN licenses for 12 employees in Pune branch transitioning to hybrid work model.', priority: 'MEDIUM' as const, status: 'IN_PROGRESS' as const, requesterId: userHRManager.id, assignedToId: userNetworkEng.id },
    { ticketNumber: 'SR-2026-0003', type: 'SERVICE_REQUEST' as const, category: 'Software', subject: 'Install SAP HANA client on 15 desktops', description: 'Finance team requires SAP HANA client v2.18 installed on Mumbai HQ desktops DSK-010 to DSK-024 for quarterly reporting.', priority: 'LOW' as const, status: 'NEW' as const, requesterId: userEmployee.id, assignedToId: undefined },
    { ticketNumber: 'CHG-2026-0001', type: 'CHANGE' as const, category: 'Infrastructure', subject: 'Core switch firmware upgrade — All sites', description: 'Scheduled upgrade of Cisco Catalyst 9300L firmware from 17.9.4 to 17.12.2 across all 8 sites. Maintenance window: Sunday 02:00-06:00 IST.', priority: 'HIGH' as const, status: 'PENDING' as const, requesterId: userNetworkEng.id, assignedToId: userDirector.id },
    { ticketNumber: 'CHG-2026-0002', type: 'CHANGE' as const, category: 'Security', subject: 'Enable TLS 1.3 on all external-facing services', description: 'RBI compliance mandate to disable TLS 1.0/1.1 and enforce TLS 1.3 on all customer-facing APIs and web portals by Q3 2026.', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, requesterId: userCISO.id, assignedToId: userSecAnalyst.id },
    { ticketNumber: 'PRB-2026-0001', type: 'PROBLEM' as const, category: 'Network', subject: 'Recurring packet loss on Mumbai-Bangalore MPLS', description: 'Investigation into intermittent packet loss (2-5%) on primary MPLS link between Mumbai HQ and Bangalore Tech Hub. Affecting CBS replication latency.', priority: 'HIGH' as const, status: 'OPEN' as const, requesterId: userNetworkEng.id, assignedToId: userDirector.id },
    { ticketNumber: 'INC-2026-0006', type: 'INCIDENT' as const, category: 'Printing', subject: 'Cheque printer PRT-008 misalignment', description: 'Cheque printing at Delhi branch showing 2mm vertical misalignment. MICR line out of spec causing RBI clearing rejections.', priority: 'HIGH' as const, status: 'OPEN' as const, requesterId: userBranchMgr.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-2026-0007', type: 'INCIDENT' as const, category: 'Security', subject: 'USB port violation detected on treasury terminals', description: 'DLP agent flagged unauthorized USB storage device on 3 treasury thin clients. Policy: No removable media in Treasury zone.', priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, requesterId: userCISO.id, assignedToId: userSecAnalyst.id },
    { ticketNumber: 'SR-2026-0004', type: 'SERVICE_REQUEST' as const, category: 'Provisioning', subject: 'Setup 5 biometric terminals for new Kolkata branch', description: 'New Kolkata branch expansion requires 5 Suprema BioStation 3 units for entrance, vault, server room, and executive floors.', priority: 'MEDIUM' as const, status: 'NEW' as const, requesterId: userFleetMgr.id, assignedToId: undefined },
    { ticketNumber: 'INC-2026-0008', type: 'INCIDENT' as const, category: 'Application', subject: 'Loan origination system timeout errors', description: 'Corporate lending portal timing out during credit score API calls. Timeout threshold at 30s, actual response times >45s from bureau.', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, requesterId: userEmployee.id, assignedToId: userDBA.id },
    { ticketNumber: 'SR-2026-0005', type: 'SERVICE_REQUEST' as const, category: 'CCTV', subject: 'Additional CCTV coverage for ATM lobby — Pune', description: 'RBI audit recommended additional camera coverage at Pune ATM lobby. Require 2 Hikvision cameras with NVR integration.', priority: 'MEDIUM' as const, status: 'OPEN' as const, requesterId: userAuditor.id, assignedToId: userFleetMgr.id },
    { ticketNumber: 'CHG-2026-0003', type: 'CHANGE' as const, category: 'Database', subject: 'Oracle RAC patching — CBS production', description: 'Apply Oracle Critical Patch Update (CPU) July 2026 to Core Banking System production RAC cluster. 2-node rolling update planned.', priority: 'CRITICAL' as const, status: 'PENDING' as const, requesterId: userDBA.id, assignedToId: userDirector.id },
    { ticketNumber: 'INC-2026-0009', type: 'INCIDENT' as const, category: 'Power', subject: 'UPS battery failure at Chennai DR center', description: 'UPS-007 in Chennai DR center reporting battery module 3/4 failure. Runtime reduced from 45min to 12min. Replacement critical.', priority: 'CRITICAL' as const, status: 'OPEN' as const, requesterId: userITSupport.id, assignedToId: userNetworkEng.id },
    { ticketNumber: 'SR-2026-0006', type: 'SERVICE_REQUEST' as const, category: 'Vehicle', subject: 'Annual service for cash-in-transit vehicles', description: 'Schedule annual maintenance for 4 CIT vehicles (VEH-001 to VEH-004). Include GPS tracker calibration and vault compartment inspection.', priority: 'LOW' as const, status: 'NEW' as const, requesterId: userFleetMgr.id, assignedToId: undefined },
    { ticketNumber: 'INC-2026-0010', type: 'INCIDENT' as const, category: 'Network', subject: 'WiFi dead zones in Mumbai HQ 4th floor', description: 'Multiple complaints about WiFi connectivity on 4th floor (Corporate Lending). Site survey shows AP WAP-003 and WAP-004 coverage gaps after renovation.', priority: 'MEDIUM' as const, status: 'OPEN' as const, requesterId: userEmployee.id, assignedToId: userNetworkEng.id },
    { ticketNumber: 'CHG-2026-0004', type: 'CHANGE' as const, category: 'Security', subject: 'Deploy CrowdStrike Falcon on all endpoints', description: 'Phase 2 EDR rollout — deploy CrowdStrike Falcon sensor on remaining 180 endpoints (desktops and thin clients) across all branches.', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, requesterId: userCISO.id, assignedToId: userSecAnalyst.id },
    { ticketNumber: 'PRB-2026-0002', type: 'PROBLEM' as const, category: 'Hardware', subject: 'Recurring thermal shutdown on servers in Chennai', description: 'SRV-031 and SRV-032 in Chennai DR experiencing thermal shutdowns during peak load. HVAC capacity review needed.', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, requesterId: userITSupport.id, assignedToId: userDirector.id },
    { ticketNumber: 'INC-2026-0011', type: 'INCIDENT' as const, category: 'Security', subject: 'Phishing email campaign targeting employees', description: 'SOC identified coordinated phishing campaign impersonating RBI circulars. 12 employees clicked link, 3 submitted credentials. Immediate password reset initiated.', priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, requesterId: userSecAnalyst.id, assignedToId: userCISO.id },
    { ticketNumber: 'SR-2026-0007', type: 'SERVICE_REQUEST' as const, category: 'Software', subject: 'Microsoft 365 E5 license upgrade for compliance team', description: 'Risk & Compliance team requires M365 E5 upgrade for advanced eDiscovery, DLP, and insider risk management features. 8 licenses needed.', priority: 'MEDIUM' as const, status: 'OPEN' as const, requesterId: userRiskOfficer.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-2026-0012', type: 'INCIDENT' as const, category: 'Biometric', subject: 'Biometric reader BIO-005 false rejections', description: 'Hyderabad branch vault biometric reader rejecting authorized personnel. False rejection rate increased from 0.1% to 8%. Sensor cleaning and recalibration needed.', priority: 'HIGH' as const, status: 'OPEN' as const, requesterId: userBranchMgr.id, assignedToId: userFleetMgr.id },
    { ticketNumber: 'CHG-2026-0005', type: 'CHANGE' as const, category: 'Network', subject: 'SD-WAN deployment — Phase 1 (4 branches)', description: 'Deploy Cisco Viptela SD-WAN overlay on Delhi, Pune, Kolkata, and Hyderabad branches. Replace legacy MPLS with hybrid connectivity.', priority: 'HIGH' as const, status: 'PENDING' as const, requesterId: userNetworkEng.id, assignedToId: userDirector.id },
    { ticketNumber: 'INC-2026-0013', type: 'INCIDENT' as const, category: 'Application', subject: 'Internet banking session fixation vulnerability', description: 'Penetration test identified session fixation vulnerability in internet banking portal. Session tokens not regenerated post-authentication.', priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, requesterId: userSecAnalyst.id, assignedToId: userDigitalLead.id },
    { ticketNumber: 'SR-2026-0008', type: 'SERVICE_REQUEST' as const, category: 'Furniture', subject: 'Ergonomic workstation setup for 20 new hires', description: 'HR requesting Steelcase Leap V2 chairs and sit-stand desks for 20 new graduate trainees joining Mumbai HQ in August batch.', priority: 'LOW' as const, status: 'NEW' as const, requesterId: userHRManager.id, assignedToId: undefined },
    { ticketNumber: 'INC-2026-0014', type: 'INCIDENT' as const, category: 'ATM', subject: 'ATM-019 cash dispenser jam', description: 'ATM at Pune Hinjewadi branch reporting E4 error — note presenter jam. Last CIT visit was 3 days ago. Customer complaints mounting.', priority: 'HIGH' as const, status: 'OPEN' as const, requesterId: userBranchMgr.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-2026-0015', type: 'INCIDENT' as const, category: 'Database', subject: 'Tablespace alert on CBS Oracle database', description: 'CBS_TRANSACTIONS tablespace at 92% capacity. Auto-extend disabled per policy. Manual extension or archival of old transactions required.', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, requesterId: userDBA.id, assignedToId: userDirector.id },
    { ticketNumber: 'SR-2026-0009', type: 'SERVICE_REQUEST' as const, category: 'Compliance', subject: 'Setup PCI-DSS log aggregation for card systems', description: 'Implement centralized log aggregation for all PCI-DSS scoped systems. QSA audit scheduled for October 2026.', priority: 'HIGH' as const, status: 'OPEN' as const, requesterId: userRiskOfficer.id, assignedToId: userSecAnalyst.id },
    { ticketNumber: 'INC-2026-0016', type: 'INCIDENT' as const, category: 'Network', subject: 'DNS resolution failures from Kolkata branch', description: 'Intermittent DNS resolution failures affecting all services at Kolkata branch. Primary DNS 10.10.8.2 unreachable, secondary overloaded.', priority: 'HIGH' as const, status: 'OPEN' as const, requesterId: userEmployee.id, assignedToId: userNetworkEng.id },
    { ticketNumber: 'CHG-2026-0006', type: 'CHANGE' as const, category: 'Infrastructure', subject: 'Migrate DR workloads to new blade chassis', description: 'Migrate 12 VM workloads from aging HPE c7000 to new Synergy 12000 frame at Chennai DR. P2V conversion for 3 legacy systems included.', priority: 'MEDIUM' as const, status: 'NEW' as const, requesterId: userITSupport.id, assignedToId: undefined },
    { ticketNumber: 'INC-2026-0017', type: 'INCIDENT' as const, category: 'Security', subject: 'SSL certificate expired on payment gateway', description: 'DigiCert SSL certificate on payment gateway API endpoint expired at midnight. POS transactions failing with TLS handshake errors across all branches.', priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, requesterId: userDigitalLead.id, assignedToId: userCISO.id },
    { ticketNumber: 'SR-2026-0010', type: 'SERVICE_REQUEST' as const, category: 'Provisioning', subject: 'Decommission 15 retired desktops — data wipe', description: 'NIST 800-88 compliant data destruction required for 15 retired Dell OptiPlex desktops. Certificate of destruction needed for audit.', priority: 'LOW' as const, status: 'OPEN' as const, requesterId: userAuditor.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-2026-0018', type: 'INCIDENT' as const, category: 'CCTV', subject: 'NVR storage full — Mumbai HQ surveillance', description: 'Network Video Recorder at Mumbai HQ reached 95% storage. CCTV footage retention falling below mandatory 90-day requirement.', priority: 'HIGH' as const, status: 'OPEN' as const, requesterId: userFleetMgr.id, assignedToId: userITSupport.id },
    { ticketNumber: 'PRB-2026-0003', type: 'PROBLEM' as const, category: 'Application', subject: 'Memory leak in NEFT/RTGS processing module', description: 'Java heap space errors in NEFT batch processing module every 72 hours. Temporary fix: restart at 02:00 IST. Root cause: connection pool not releasing Oracle connections.', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, requesterId: userDBA.id, assignedToId: userDigitalLead.id },
    { ticketNumber: 'SR-2026-0011', type: 'SERVICE_REQUEST' as const, category: 'Access Management', subject: 'PAM setup for database admin accounts', description: 'Implement CyberArk Privileged Access Management for all Oracle DBA accounts (15 accounts across 6 database instances).', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, requesterId: userCISO.id, assignedToId: userSecAnalyst.id },
    { ticketNumber: 'INC-2026-0019', type: 'INCIDENT' as const, category: 'Hardware', subject: 'RAID controller failure on SRV-022', description: 'PERC H755 RAID controller in Dell PowerEdge R760 (SRV-022) reporting predictive failure. Array in degraded mode. Hot spare activated.', priority: 'CRITICAL' as const, status: 'OPEN' as const, requesterId: userITSupport.id, assignedToId: userDirector.id },
    { ticketNumber: 'CHG-2026-0007', type: 'CHANGE' as const, category: 'Compliance', subject: 'Implement RBI data localization requirements', description: 'All payment processing data must be stored exclusively within India per RBI circular. Audit and migrate any cross-border data flows.', priority: 'CRITICAL' as const, status: 'PENDING' as const, requesterId: userRiskOfficer.id, assignedToId: userCISO.id },
    { ticketNumber: 'INC-2026-0020', type: 'INCIDENT' as const, category: 'Security', subject: 'Ransomware indicator detected — sandboxed', description: 'Fortinet sandbox detected ransomware dropper in email attachment. Sample matched LockBit 3.0 signature. No lateral movement observed. Email quarantined.', priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, requesterId: userCISO.id, assignedToId: userSecAnalyst.id },
    { ticketNumber: 'SR-2026-0012', type: 'SERVICE_REQUEST' as const, category: 'Software', subject: 'Tableau Server license renewal and upgrade', description: 'Renew Tableau Server Enterprise license for 50 users. Upgrade from 2023.3 to 2024.2 for improved data governance features.', priority: 'MEDIUM' as const, status: 'OPEN' as const, requesterId: userRiskOfficer.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-2026-0021', type: 'INCIDENT' as const, category: 'Power', subject: 'Generator auto-start failure during power outage', description: 'Diesel generator at Hyderabad office failed to auto-start during 45-minute power outage. UPS sustained load but reached 80% drain.', priority: 'HIGH' as const, status: 'RESOLVED' as const, requesterId: userFleetMgr.id, assignedToId: userITSupport.id },
    { ticketNumber: 'INC-2026-0022', type: 'INCIDENT' as const, category: 'Network', subject: 'BGP route leak affecting internet banking', description: 'Upstream ISP route leak caused internet banking traffic to be routed through unauthorized AS. Detected by RPKI monitoring. Traffic normalized after 22 minutes.', priority: 'CRITICAL' as const, status: 'RESOLVED' as const, requesterId: userNetworkEng.id, assignedToId: userCISO.id },
    { ticketNumber: 'SR-2026-0013', type: 'SERVICE_REQUEST' as const, category: 'Provisioning', subject: 'Refresh 30 thin clients at Delhi branches', description: 'Replace aging HP t640 thin clients at 3 Delhi sub-branches with new Dell Wyse 5070. Include Citrix Workspace reconfiguration.', priority: 'MEDIUM' as const, status: 'NEW' as const, requesterId: userBranchMgr.id, assignedToId: undefined },
    { ticketNumber: 'INC-2026-0023', type: 'INCIDENT' as const, category: 'Application', subject: 'KYC document upload service degraded', description: 'Customer onboarding KYC document upload failing for files >5MB. API gateway returning 413 errors. Nginx upload limit needs adjustment.', priority: 'HIGH' as const, status: 'OPEN' as const, requesterId: userDigitalLead.id, assignedToId: userDBA.id },
    { ticketNumber: 'CHG-2026-0008', type: 'CHANGE' as const, category: 'Security', subject: 'WAF rule update for OWASP Top 10 2025', description: 'Update AWS WAF and Cloudflare rules to address OWASP Top 10 2025 changes. Focus on SSRF, insecure design patterns.', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, requesterId: userSecAnalyst.id, assignedToId: userCISO.id },
    { ticketNumber: 'INC-2026-0024', type: 'INCIDENT' as const, category: 'Hardware', subject: 'Bulk laptop battery swelling — Dell Latitude batch', description: '7 Dell Latitude 5540 laptops from Feb 2024 batch reporting battery swelling. Dell advisory SA-2026-042 applies. Recall initiated.', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, requesterId: userITSupport.id, assignedToId: userDirector.id },
    { ticketNumber: 'SR-2026-0014', type: 'SERVICE_REQUEST' as const, category: 'Network', subject: 'Setup dedicated VLAN for SWIFT infrastructure', description: 'Create isolated VLAN (VLAN 400) for SWIFT Alliance components. Implement micro-segmentation with Palo Alto firewall rules.', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, requesterId: userCISO.id, assignedToId: userNetworkEng.id },
    { ticketNumber: 'INC-2026-0025', type: 'INCIDENT' as const, category: 'Security', subject: 'Unauthorized admin account discovered on AD', description: 'Quarterly access review discovered undocumented Domain Admin account "svc_legacy_migr" created 8 months ago. No owner identified. Account disabled pending investigation.', priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, requesterId: userAuditor.id, assignedToId: userCISO.id },
    { ticketNumber: 'INC-2026-0026', type: 'INCIDENT' as const, category: 'Application', subject: 'Batch processing failure — EOD reconciliation', description: 'End-of-day batch reconciliation failed at step 47/62. GL mismatch of ₹2.3Cr between CBS and treasury system. Manual reconciliation initiated.', priority: 'CRITICAL' as const, status: 'IN_PROGRESS' as const, requesterId: userTreasuryMgr.id, assignedToId: userDBA.id },
    { ticketNumber: 'SR-2026-0015', type: 'SERVICE_REQUEST' as const, category: 'Training', subject: 'Security awareness training — Q3 batch', description: 'Schedule mandatory security awareness training for 500+ employees. Topics: phishing, social engineering, clean desk policy, incident reporting.', priority: 'LOW' as const, status: 'NEW' as const, requesterId: userHRManager.id, assignedToId: undefined },
  ];

  await prisma.ticket.createMany({
    data: ticketData.map((t) => ({ tenantId: bankTenant.id, ...t })),
  });

  console.log('🎫 52 Tickets created');

  // ─── 10. AGENTS (20) ──────────────────────────────────────────────────────
  const agentPlatforms = ['Windows Server 2022', 'Windows 11 Pro', 'Ubuntu 22.04 LTS', 'RHEL 9.3', 'CentOS Stream 9'];
  const agentHostnames = [
    'NDBK-SRV-DC01', 'NDBK-SRV-DC02', 'NDBK-SRV-CBS01', 'NDBK-SRV-CBS02', 'NDBK-SRV-MAIL01',
    'NDBK-SRV-DB01', 'NDBK-SRV-DB02', 'NDBK-SRV-WEB01', 'NDBK-SRV-WEB02', 'NDBK-SRV-APP01',
    'NDBK-WKS-FIN001', 'NDBK-WKS-FIN002', 'NDBK-WKS-HR001', 'NDBK-WKS-SEC001', 'NDBK-WKS-DEV001',
    'NDBK-DR-CBS01', 'NDBK-DR-DB01', 'NDBK-DR-WEB01', 'NDBK-WKS-AUD001', 'NDBK-WKS-LEG001',
  ];

  for (let i = 0; i < 20; i++) {
    const isOnline = i < 14;
    const isStale = i >= 18;
    await prisma.agent.create({
      data: {
        tenantId: bankTenant.id,
        hostname: agentHostnames[i],
        platform: agentPlatforms[i % agentPlatforms.length],
        agentVersion: i < 10 ? '3.2.1' : '3.1.8',
        ipAddress: `10.10.${Math.floor(i / 10) + 1}.${10 + i}`,
        macAddress: Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':'),
        status: isStale ? ('STALE' as const) : isOnline ? ('ONLINE' as const) : ('OFFLINE' as const),
        lastHeartbeat: isStale ? new Date(Date.now() - 7 * 86400000) : isOnline ? new Date(Date.now() - Math.floor(Math.random() * 300000)) : new Date(Date.now() - 2 * 86400000),
        systemInfo: {
          os: agentPlatforms[i % agentPlatforms.length],
          cpuCores: i < 10 ? 16 : 8,
          ramGB: i < 10 ? 64 : 16,
          diskGB: i < 10 ? 1200 : 512,
          domain: 'ndbk.local',
          lastBoot: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
          installedSoftware: i < 10
            ? ['CrowdStrike Falcon', 'Symantec DLP', 'Splunk Forwarder', 'Oracle Client', 'IBM MQ']
            : ['CrowdStrike Falcon', 'Microsoft Defender', 'Citrix Workspace', 'SAP GUI'],
          openPorts: i < 10 ? [22, 80, 443, 1521, 5432, 8443] : [135, 445, 3389],
        },
      },
    });
  }
  console.log('🤖 20 Agents created');

  // ─── 11. SCAN RESULTS (15) ────────────────────────────────────────────────
  await prisma.scanResult.createMany({
    data: [
      { tenantId: bankTenant.id, scanType: 'SSL', targetType: 'HOST', target: 'ibanking.nationaldigitalbank.com', status: 'COMPLETED' as const, startedAt: new Date('2026-06-28T02:00:00Z'), completedAt: new Date('2026-06-28T02:01:30Z'), duration: 90, summary: { grade: 'A+', protocol: 'TLSv1.3', certExpiry: '2027-03-15', issuer: 'DigiCert' }, results: { ciphers: ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256'], vulnerabilities: [] }, triggeredBy: 'scheduled' },
      { tenantId: bankTenant.id, scanType: 'SSL', targetType: 'HOST', target: 'swift.nationaldigitalbank.com', status: 'COMPLETED' as const, startedAt: new Date('2026-06-28T02:02:00Z'), completedAt: new Date('2026-06-28T02:03:00Z'), duration: 60, summary: { grade: 'A', protocol: 'TLSv1.2', certExpiry: '2026-09-01', issuer: 'DigiCert' }, results: { ciphers: ['TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384'], vulnerabilities: ['TLSv1.2 only — consider TLSv1.3'] }, triggeredBy: 'scheduled' },
      { tenantId: bankTenant.id, scanType: 'SSL', targetType: 'HOST', target: 'api.nationaldigitalbank.com', status: 'COMPLETED' as const, startedAt: new Date('2026-06-28T02:04:00Z'), completedAt: new Date('2026-06-28T02:05:15Z'), duration: 75, summary: { grade: 'B', protocol: 'TLSv1.2', certExpiry: '2026-07-15', issuer: 'Let\'s Encrypt' }, results: { ciphers: ['TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256'], vulnerabilities: ['Certificate expiring in 13 days', 'Weak cipher suites present'] }, triggeredBy: 'manual' },
      { tenantId: bankTenant.id, scanType: 'ARP', targetType: 'SUBNET', target: '10.10.1.0/24', status: 'COMPLETED' as const, startedAt: new Date('2026-06-29T01:00:00Z'), completedAt: new Date('2026-06-29T01:05:00Z'), duration: 300, summary: { hostsDiscovered: 187, newDevices: 3, rogueDevices: 1 }, results: { rogueMACs: ['aa:bb:cc:11:22:33'], newDevices: [{ ip: '10.10.1.201', mac: 'de:ad:be:ef:00:01', vendor: 'Unknown' }] }, triggeredBy: 'scheduled' },
      { tenantId: bankTenant.id, scanType: 'ARP', targetType: 'SUBNET', target: '10.10.2.0/24', status: 'COMPLETED' as const, startedAt: new Date('2026-06-29T01:06:00Z'), completedAt: new Date('2026-06-29T01:10:00Z'), duration: 240, summary: { hostsDiscovered: 94, newDevices: 0, rogueDevices: 0 }, results: { rogueMACs: [], newDevices: [] }, triggeredBy: 'scheduled' },
      { tenantId: bankTenant.id, scanType: 'TRACEROUTE', targetType: 'HOST', target: 'cbs-primary.ndbk.local', status: 'COMPLETED' as const, startedAt: new Date('2026-06-30T10:00:00Z'), completedAt: new Date('2026-06-30T10:00:15Z'), duration: 15, summary: { hops: 4, latencyMs: 2.3, pathConsistent: true }, results: { hops: [{ hop: 1, ip: '10.10.1.1', rtt: 0.5 }, { hop: 2, ip: '10.10.100.1', rtt: 1.1 }, { hop: 3, ip: '10.10.200.1', rtt: 1.8 }, { hop: 4, ip: '10.10.200.10', rtt: 2.3 }] }, triggeredBy: 'manual' },
      { tenantId: bankTenant.id, scanType: 'TRACEROUTE', targetType: 'HOST', target: 'dr-cbs.ndbk.local', status: 'COMPLETED' as const, startedAt: new Date('2026-06-30T10:01:00Z'), completedAt: new Date('2026-06-30T10:01:30Z'), duration: 30, summary: { hops: 8, latencyMs: 18.7, pathConsistent: false }, results: { hops: [{ hop: 1, ip: '10.10.1.1', rtt: 0.5 }, { hop: 2, ip: '10.10.100.1', rtt: 1.2 }, { hop: 3, ip: '172.16.0.1', rtt: 5.4 }, { hop: 4, ip: '172.16.0.5', rtt: 8.1 }, { hop: 5, ip: '172.16.1.1', rtt: 12.3 }, { hop: 6, ip: '10.20.1.1', rtt: 15.0 }, { hop: 7, ip: '10.20.200.1', rtt: 17.2 }, { hop: 8, ip: '10.20.200.10', rtt: 18.7 }] }, triggeredBy: 'manual' },
      { tenantId: bankTenant.id, scanType: 'NMAP', targetType: 'SUBNET', target: '10.10.1.0/24', status: 'COMPLETED' as const, startedAt: new Date('2026-07-01T02:00:00Z'), completedAt: new Date('2026-07-01T02:45:00Z'), duration: 2700, summary: { hostsUp: 187, openPorts: 1420, criticalFindings: 5 }, results: { criticalFindings: [{ host: '10.10.1.45', port: 23, service: 'telnet', risk: 'Unencrypted management protocol' }, { host: '10.10.1.102', port: 21, service: 'ftp', risk: 'Anonymous FTP enabled' }] }, triggeredBy: 'scheduled' },
      { tenantId: bankTenant.id, scanType: 'NMAP', targetType: 'SUBNET', target: '10.10.3.0/24', status: 'COMPLETED' as const, startedAt: new Date('2026-07-01T03:00:00Z'), completedAt: new Date('2026-07-01T03:30:00Z'), duration: 1800, summary: { hostsUp: 52, openPorts: 340, criticalFindings: 1 }, results: { criticalFindings: [{ host: '10.10.3.88', port: 3389, service: 'rdp', risk: 'RDP exposed without NLA' }] }, triggeredBy: 'scheduled' },
      { tenantId: bankTenant.id, scanType: 'NMAP', targetType: 'HOST', target: '10.10.1.10', status: 'COMPLETED' as const, startedAt: new Date('2026-07-01T04:00:00Z'), completedAt: new Date('2026-07-01T04:05:00Z'), duration: 300, summary: { hostsUp: 1, openPorts: 8, criticalFindings: 0 }, results: { ports: [{ port: 22, service: 'ssh', version: 'OpenSSH 9.6' }, { port: 443, service: 'https', version: 'nginx 1.25' }, { port: 1521, service: 'oracle-tns', version: 'Oracle 19c' }] }, triggeredBy: 'manual' },
      { tenantId: bankTenant.id, scanType: 'SSL', targetType: 'HOST', target: 'upi.nationaldigitalbank.com', status: 'COMPLETED' as const, startedAt: new Date('2026-07-01T05:00:00Z'), completedAt: new Date('2026-07-01T05:01:00Z'), duration: 60, summary: { grade: 'A+', protocol: 'TLSv1.3', certExpiry: '2027-01-20', issuer: 'Entrust' }, results: { ciphers: ['TLS_AES_256_GCM_SHA384'], vulnerabilities: [] }, triggeredBy: 'scheduled' },
      { tenantId: bankTenant.id, scanType: 'ARP', targetType: 'SUBNET', target: '10.10.5.0/24', status: 'COMPLETED' as const, startedAt: new Date('2026-07-01T06:00:00Z'), completedAt: new Date('2026-07-01T06:04:00Z'), duration: 240, summary: { hostsDiscovered: 68, newDevices: 2, rogueDevices: 0 }, results: { newDevices: [{ ip: '10.10.5.201', mac: '00:1a:2b:3c:4d:5e', vendor: 'Cisco' }, { ip: '10.10.5.202', mac: '00:1a:2b:3c:4d:5f', vendor: 'Aruba' }] }, triggeredBy: 'scheduled' },
      { tenantId: bankTenant.id, scanType: 'NMAP', targetType: 'SUBNET', target: '10.10.7.0/24', status: 'RUNNING' as const, startedAt: new Date('2026-07-02T02:00:00Z'), summary: { progress: '45%', hostsScanned: 28 }, triggeredBy: 'scheduled' },
      { tenantId: bankTenant.id, scanType: 'SSL', targetType: 'HOST', target: 'corp-lending.nationaldigitalbank.com', status: 'FAILED' as const, startedAt: new Date('2026-07-01T07:00:00Z'), completedAt: new Date('2026-07-01T07:00:05Z'), duration: 5, summary: { error: 'Connection refused — host unreachable' }, triggeredBy: 'manual' },
      { tenantId: bankTenant.id, scanType: 'TRACEROUTE', targetType: 'HOST', target: 'kolkata-sw01.ndbk.local', status: 'COMPLETED' as const, startedAt: new Date('2026-07-01T08:00:00Z'), completedAt: new Date('2026-07-01T08:00:20Z'), duration: 20, summary: { hops: 6, latencyMs: 42.5, pathConsistent: true }, results: { hops: [{ hop: 1, ip: '10.10.1.1', rtt: 0.5 }, { hop: 2, ip: '10.10.100.1', rtt: 1.0 }, { hop: 3, ip: '172.16.0.1', rtt: 8.2 }, { hop: 4, ip: '172.16.5.1', rtt: 22.1 }, { hop: 5, ip: '10.10.8.1', rtt: 38.3 }, { hop: 6, ip: '10.10.8.10', rtt: 42.5 }] }, triggeredBy: 'manual' },
    ],
  });
  console.log('🔍 15 Scan Results created');

  // ─── 12. ENDPOINT CHANGES (30) ────────────────────────────────────────────
  // We need agent IDs. Since we used individual creates, we'll query them.
  const agents = await prisma.agent.findMany({ where: { tenantId: bankTenant.id }, select: { id: true, hostname: true } });
  const agentMap = Object.fromEntries(agents.map((a) => [a.hostname, a.id]));

  const endpointChangesData = [
    { agentId: agentMap['NDBK-SRV-DC01'], category: 'SOFTWARE', changeType: 'INSTALL', severity: 'MEDIUM', summary: 'New software installed: Wireshark 4.2.3', newValue: { software: 'Wireshark', version: '4.2.3', path: 'C:\\Program Files\\Wireshark' }, status: 'PENDING_REVIEW' as const },
    { agentId: agentMap['NDBK-SRV-CBS01'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'HIGH', summary: 'Windows Firewall rule modified: Allow RDP from Any', previousValue: { rule: 'RDP', scope: '10.10.0.0/16' }, newValue: { rule: 'RDP', scope: '0.0.0.0/0' }, status: 'REJECTED' as const, reviewedById: userCISO.id, reviewNote: 'RDP must be restricted to internal subnets only per security policy.' },
    { agentId: agentMap['NDBK-SRV-DB01'], category: 'SERVICE', changeType: 'MODIFY', severity: 'CRITICAL', summary: 'Oracle Listener configuration changed: port 1521 → 1522', previousValue: { service: 'OracleListener', port: 1521 }, newValue: { service: 'OracleListener', port: 1522 }, status: 'APPROVED' as const, reviewedById: userDBA.id, reviewNote: 'Approved — port change per security hardening initiative.' },
    { agentId: agentMap['NDBK-WKS-FIN001'], category: 'SOFTWARE', changeType: 'UNINSTALL', severity: 'HIGH', summary: 'CrowdStrike Falcon sensor uninstalled', previousValue: { software: 'CrowdStrike Falcon', version: '7.10' }, status: 'REJECTED' as const, reviewedById: userCISO.id, reviewNote: 'CRITICAL: EDR removal is a P1 security incident. Re-install immediately.' },
    { agentId: agentMap['NDBK-SRV-WEB01'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'HIGH', summary: 'Apache config: ServerSignature changed to On', previousValue: { directive: 'ServerSignature', value: 'Off' }, newValue: { directive: 'ServerSignature', value: 'On' }, status: 'REJECTED' as const, reviewedById: userSecAnalyst.id, reviewNote: 'Server version disclosure violates information security policy.' },
    { agentId: agentMap['NDBK-SRV-DC02'], category: 'USER_ACCOUNT', changeType: 'CREATE', severity: 'HIGH', summary: 'New local admin account created: temp_support', newValue: { username: 'temp_support', groups: ['Administrators'] }, status: 'PENDING_REVIEW' as const },
    { agentId: agentMap['NDBK-SRV-MAIL01'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'MEDIUM', summary: 'SMTP relay configuration changed: relay enabled for 0.0.0.0/0', previousValue: { relay: 'internal_only' }, newValue: { relay: 'open', scope: '0.0.0.0/0' }, status: 'REJECTED' as const, reviewedById: userCISO.id, reviewNote: 'Open relay is a critical misconfiguration. Reverted.' },
    { agentId: agentMap['NDBK-WKS-SEC001'], category: 'SOFTWARE', changeType: 'UPDATE', severity: 'LOW', summary: 'Microsoft Defender updated: 4.18.2606.1 → 4.18.2606.5', previousValue: { software: 'Microsoft Defender', version: '4.18.2606.1' }, newValue: { software: 'Microsoft Defender', version: '4.18.2606.5' }, status: 'APPROVED' as const, reviewedById: userSecAnalyst.id },
    { agentId: agentMap['NDBK-SRV-APP01'], category: 'SERVICE', changeType: 'CREATE', severity: 'MEDIUM', summary: 'New service registered: NodeExporter on port 9100', newValue: { service: 'node_exporter', port: 9100, startup: 'automatic' }, status: 'APPROVED' as const, reviewedById: userITSupport.id },
    { agentId: agentMap['NDBK-SRV-CBS02'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'CRITICAL', summary: 'Oracle TNS listener.ora: ADMIN_RESTRICTIONS changed to OFF', previousValue: { parameter: 'ADMIN_RESTRICTIONS', value: 'ON' }, newValue: { parameter: 'ADMIN_RESTRICTIONS', value: 'OFF' }, status: 'REJECTED' as const, reviewedById: userDBA.id, reviewNote: 'ADMIN_RESTRICTIONS must remain ON per Oracle security baseline.' },
    { agentId: agentMap['NDBK-WKS-DEV001'], category: 'SOFTWARE', changeType: 'INSTALL', severity: 'LOW', summary: 'VS Code extension installed: GitHub Copilot', newValue: { extension: 'GitHub.copilot', version: '1.200.0' }, status: 'PENDING_REVIEW' as const },
    { agentId: agentMap['NDBK-DR-CBS01'], category: 'HARDWARE', changeType: 'MODIFY', severity: 'MEDIUM', summary: 'RAM upgraded: 64GB → 128GB', previousValue: { ramGB: 64 }, newValue: { ramGB: 128 }, status: 'APPROVED' as const, reviewedById: userITSupport.id },
    { agentId: agentMap['NDBK-SRV-DC01'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'HIGH', summary: 'Group Policy: Password complexity requirement disabled', previousValue: { policy: 'PasswordComplexity', enabled: true }, newValue: { policy: 'PasswordComplexity', enabled: false }, status: 'REJECTED' as const, reviewedById: userCISO.id, reviewNote: 'Password complexity is mandatory per RBI IT governance guidelines.' },
    { agentId: agentMap['NDBK-WKS-HR001'], category: 'SOFTWARE', changeType: 'INSTALL', severity: 'MEDIUM', summary: 'Unauthorized software: TeamViewer 15.50', newValue: { software: 'TeamViewer', version: '15.50' }, status: 'REJECTED' as const, reviewedById: userSecAnalyst.id, reviewNote: 'Remote desktop tools must be approved. Use authorized VPN instead.' },
    { agentId: agentMap['NDBK-SRV-WEB02'], category: 'CERTIFICATE', changeType: 'MODIFY', severity: 'HIGH', summary: 'SSL certificate replaced: self-signed cert installed', previousValue: { issuer: 'DigiCert', expiry: '2027-03-15' }, newValue: { issuer: 'Self-Signed', expiry: '2027-06-30' }, status: 'REJECTED' as const, reviewedById: userCISO.id, reviewNote: 'Self-signed certificates not permitted on production systems.' },
    { agentId: agentMap['NDBK-SRV-DB02'], category: 'SERVICE', changeType: 'STOP', severity: 'HIGH', summary: 'Oracle Alert Log Monitor service stopped', previousValue: { service: 'OracleAlertLogMonitor', status: 'running' }, newValue: { service: 'OracleAlertLogMonitor', status: 'stopped' }, status: 'PENDING_REVIEW' as const },
    { agentId: agentMap['NDBK-WKS-FIN002'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'MEDIUM', summary: 'USB mass storage policy changed: Enabled', previousValue: { policy: 'USBMassStorage', enabled: false }, newValue: { policy: 'USBMassStorage', enabled: true }, status: 'REJECTED' as const, reviewedById: userCISO.id, reviewNote: 'USB storage disabled on all financial workstations per DLP policy.' },
    { agentId: agentMap['NDBK-SRV-APP01'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'LOW', summary: 'JVM heap size increased: 4GB → 8GB', previousValue: { xmx: '4g' }, newValue: { xmx: '8g' }, status: 'APPROVED' as const, reviewedById: userITSupport.id },
    { agentId: agentMap['NDBK-DR-DB01'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'CRITICAL', summary: 'Data Guard SYNC mode changed to ASYNC', previousValue: { mode: 'MAXIMUM_PROTECTION' }, newValue: { mode: 'MAXIMUM_PERFORMANCE' }, status: 'PENDING_REVIEW' as const },
    { agentId: agentMap['NDBK-DR-WEB01'], category: 'SOFTWARE', changeType: 'UPDATE', severity: 'MEDIUM', summary: 'nginx upgraded: 1.24.0 → 1.25.4', previousValue: { software: 'nginx', version: '1.24.0' }, newValue: { software: 'nginx', version: '1.25.4' }, status: 'APPROVED' as const, reviewedById: userITSupport.id },
    { agentId: agentMap['NDBK-SRV-DC01'], category: 'USER_ACCOUNT', changeType: 'MODIFY', severity: 'HIGH', summary: 'Service account svc_backup added to Domain Admins', previousValue: { groups: ['Backup Operators'] }, newValue: { groups: ['Backup Operators', 'Domain Admins'] }, status: 'REJECTED' as const, reviewedById: userCISO.id, reviewNote: 'Service accounts must follow least privilege. Backup Operators group is sufficient.' },
    { agentId: agentMap['NDBK-SRV-CBS01'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'HIGH', summary: 'SSH root login enabled', previousValue: { sshd: { PermitRootLogin: 'no' } }, newValue: { sshd: { PermitRootLogin: 'yes' } }, status: 'REJECTED' as const, reviewedById: userSecAnalyst.id, reviewNote: 'Root login via SSH strictly prohibited. Use sudo with named accounts.' },
    { agentId: agentMap['NDBK-WKS-AUD001'], category: 'SOFTWARE', changeType: 'INSTALL', severity: 'LOW', summary: 'ACL Analytics 16.1 installed for audit analysis', newValue: { software: 'ACL Analytics', version: '16.1' }, status: 'APPROVED' as const, reviewedById: userITSupport.id },
    { agentId: agentMap['NDBK-SRV-MAIL01'], category: 'SERVICE', changeType: 'CREATE', severity: 'MEDIUM', summary: 'New scheduled task: daily_mailbox_export.ps1', newValue: { task: 'daily_mailbox_export', schedule: 'daily 23:00', script: 'C:\\Scripts\\daily_mailbox_export.ps1' }, status: 'PENDING_REVIEW' as const },
    { agentId: agentMap['NDBK-SRV-WEB01'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'MEDIUM', summary: 'PHP max_upload_size changed: 2MB → 50MB', previousValue: { directive: 'upload_max_filesize', value: '2M' }, newValue: { directive: 'upload_max_filesize', value: '50M' }, status: 'APPROVED' as const, reviewedById: userITSupport.id, reviewNote: 'Approved for KYC document upload fix. Will revert after proper API gateway config.' },
    { agentId: agentMap['NDBK-SRV-DB01'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'CRITICAL', summary: 'PostgreSQL pg_hba.conf: trust authentication added for 0.0.0.0/0', previousValue: { line: 'host all all 10.10.0.0/16 scram-sha-256' }, newValue: { line: 'host all all 0.0.0.0/0 trust' }, status: 'REJECTED' as const, reviewedById: userCISO.id, reviewNote: 'CRITICAL: Trust authentication must never be used. This is a P1 security incident.' },
    { agentId: agentMap['NDBK-WKS-LEG001'], category: 'SOFTWARE', changeType: 'INSTALL', severity: 'LOW', summary: 'Adobe Acrobat Pro DC 2024 installed', newValue: { software: 'Adobe Acrobat Pro DC', version: '2024.002' }, status: 'APPROVED' as const, reviewedById: userITSupport.id },
    { agentId: agentMap['NDBK-SRV-CBS02'], category: 'HARDWARE', changeType: 'MODIFY', severity: 'MEDIUM', summary: 'NIC added: 10GbE SFP+ adapter for replication traffic', previousValue: { nics: 2 }, newValue: { nics: 3, newNic: '10GbE SFP+ Intel X710' }, status: 'APPROVED' as const, reviewedById: userNetworkEng.id },
    { agentId: agentMap['NDBK-SRV-DC02'], category: 'CONFIGURATION', changeType: 'MODIFY', severity: 'HIGH', summary: 'Audit policy changed: Logon events auditing disabled', previousValue: { auditLogon: 'Success, Failure' }, newValue: { auditLogon: 'No Auditing' }, status: 'REJECTED' as const, reviewedById: userCISO.id, reviewNote: 'Logon auditing is mandatory for SOX and RBI compliance.' },
    { agentId: agentMap['NDBK-SRV-APP01'], category: 'SOFTWARE', changeType: 'INSTALL', severity: 'LOW', summary: 'Prometheus JMX exporter 0.20.0 installed', newValue: { software: 'jmx_exporter', version: '0.20.0', port: 9404 }, status: 'APPROVED' as const, reviewedById: userITSupport.id },
  ];

  await prisma.endpointChange.createMany({
    data: endpointChangesData.map((ec) => ({ tenantId: bankTenant.id, ...ec })),
  });
  console.log('🔄 30 Endpoint Changes created');

  // ─── 13. ENDPOINT POLICIES (10) ───────────────────────────────────────────
  await prisma.endpointPolicy.createMany({
    data: [
      { tenantId: bankTenant.id, name: 'Block USB Mass Storage', description: 'Prevent use of USB storage devices on all endpoints in PCI-DSS scope', category: 'DLP', severity: 'HIGH', action: 'BLOCK', matchPattern: { deviceClass: 'USB_MASS_STORAGE' }, scope: { departments: ['Treasury', 'Core Banking', 'Retail Banking'] }, isActive: true, createdById: userCISO.id },
      { tenantId: bankTenant.id, name: 'Enforce Disk Encryption', description: 'BitLocker/LUKS encryption required on all endpoints', category: 'ENCRYPTION', severity: 'CRITICAL', action: 'ENFORCE', matchPattern: { check: 'disk_encryption', required: true }, scope: { all: true }, isActive: true, createdById: userCISO.id },
      { tenantId: bankTenant.id, name: 'Block Unauthorized Remote Access', description: 'Prevent installation of TeamViewer, AnyDesk, and similar tools', category: 'SOFTWARE_RESTRICTION', severity: 'HIGH', action: 'BLOCK', matchPattern: { softwareNames: ['TeamViewer', 'AnyDesk', 'LogMeIn', 'Ammyy Admin'] }, scope: { all: true }, isActive: true, createdById: userSecAnalyst.id },
      { tenantId: bankTenant.id, name: 'EDR Agent Tamper Protection', description: 'Alert and block attempts to stop or uninstall CrowdStrike Falcon', category: 'SECURITY_AGENT', severity: 'CRITICAL', action: 'BLOCK_AND_ALERT', matchPattern: { process: 'CSFalconService', actions: ['stop', 'uninstall', 'disable'] }, scope: { all: true }, isActive: true, createdById: userCISO.id },
      { tenantId: bankTenant.id, name: 'Restrict Admin Account Creation', description: 'Alert on creation of new local administrator accounts', category: 'ACCESS_CONTROL', severity: 'HIGH', action: 'ALERT', matchPattern: { event: 'account_create', group: 'Administrators' }, scope: { all: true }, isActive: true, createdById: userCISO.id },
      { tenantId: bankTenant.id, name: 'Mandatory Screen Lock', description: 'Enforce 5-minute idle screen lock on all workstations', category: 'ACCESS_CONTROL', severity: 'MEDIUM', action: 'ENFORCE', matchPattern: { policy: 'screen_lock', timeoutMinutes: 5 }, scope: { all: true }, isActive: true, createdById: userSecAnalyst.id },
      { tenantId: bankTenant.id, name: 'Block Crypto Mining Software', description: 'Detect and block cryptocurrency mining software', category: 'SOFTWARE_RESTRICTION', severity: 'HIGH', action: 'BLOCK_AND_ALERT', matchPattern: { softwareNames: ['XMRig', 'NiceHash', 'PhoenixMiner', 'CGMiner'], processPatterns: ['*miner*', '*crypto*'] }, scope: { all: true }, isActive: true, createdById: userSecAnalyst.id },
      { tenantId: bankTenant.id, name: 'Firewall Rule Change Detection', description: 'Alert on any Windows Firewall or iptables rule modifications', category: 'CONFIGURATION', severity: 'HIGH', action: 'ALERT', matchPattern: { configFiles: ['firewall_rules', 'iptables'], event: 'modify' }, scope: { servers: true }, isActive: true, createdById: userCISO.id },
      { tenantId: bankTenant.id, name: 'SSL Certificate Expiry Monitor', description: 'Alert when SSL certificates are within 30 days of expiry', category: 'CERTIFICATE', severity: 'MEDIUM', action: 'ALERT', matchPattern: { check: 'ssl_expiry', thresholdDays: 30 }, scope: { servers: true }, isActive: true, createdById: userSecAnalyst.id },
      { tenantId: bankTenant.id, name: 'Restrict PowerShell Execution', description: 'Enforce constrained language mode for PowerShell on non-admin endpoints', category: 'SCRIPT_CONTROL', severity: 'HIGH', action: 'ENFORCE', matchPattern: { application: 'powershell.exe', policy: 'ConstrainedLanguage' }, scope: { workstations: true }, isActive: true, createdById: userCISO.id },
    ],
  });
  console.log('📋 10 Endpoint Policies created');

  // ─── 14. LICENSES (6) ─────────────────────────────────────────────────────
  await prisma.license.createMany({
    data: [
      { tenantId: bankTenant.id, softwareName: 'Microsoft 365 E5', vendor: 'Microsoft', version: 'E5', licenseType: 'PER_SEAT' as const, licenseModel: 'ANNUAL' as const, totalSeats: 500, usedSeats: 437, purchaseCost: 12500000, purchaseDate: new Date('2025-04-01'), expiryDate: new Date('2026-03-31'), status: 'ACTIVE' },
      { tenantId: bankTenant.id, softwareName: 'CrowdStrike Falcon Enterprise', vendor: 'CrowdStrike', version: '7.x', licenseType: 'PER_DEVICE' as const, licenseModel: 'ANNUAL' as const, totalSeats: 600, usedSeats: 520, purchaseCost: 9000000, purchaseDate: new Date('2025-07-01'), expiryDate: new Date('2026-06-30'), status: 'ACTIVE' },
      { tenantId: bankTenant.id, softwareName: 'Oracle Database Enterprise', vendor: 'Oracle', version: '19c', licenseType: 'PER_SEAT' as const, licenseModel: 'PERPETUAL' as const, totalSeats: 8, usedSeats: 6, purchaseCost: 45000000, purchaseDate: new Date('2022-01-15'), status: 'ACTIVE' },
      { tenantId: bankTenant.id, softwareName: 'Palo Alto Panorama', vendor: 'Palo Alto Networks', version: '11.1', licenseType: 'SITE' as const, licenseModel: 'ANNUAL' as const, totalSeats: 1, usedSeats: 1, purchaseCost: 3500000, purchaseDate: new Date('2025-10-01'), expiryDate: new Date('2026-09-30'), status: 'ACTIVE' },
      { tenantId: bankTenant.id, softwareName: 'Tableau Server', vendor: 'Salesforce', version: '2024.2', licenseType: 'PER_SEAT' as const, licenseModel: 'ANNUAL' as const, totalSeats: 50, usedSeats: 42, purchaseCost: 2800000, purchaseDate: new Date('2025-05-01'), expiryDate: new Date('2026-04-30'), status: 'ACTIVE' },
      { tenantId: bankTenant.id, softwareName: 'Citrix Virtual Apps', vendor: 'Cloud Software Group', version: '2402 LTSR', licenseType: 'PER_DEVICE' as const, licenseModel: 'ANNUAL' as const, totalSeats: 200, usedSeats: 165, purchaseCost: 5600000, purchaseDate: new Date('2025-03-01'), expiryDate: new Date('2026-02-28'), status: 'ACTIVE' },
    ],
  });
  console.log('📜 6 Licenses created');

  // ─── 15. PATCHES (12) ─────────────────────────────────────────────────────
  await prisma.patch.createMany({
    data: [
      { tenantId: bankTenant.id, patchId: 'KB5039212', title: 'Windows Server 2022 Cumulative Update — June 2026', severity: 'CRITICAL', status: 'DEPLOYED', category: 'Security Update', affectedAssets: 40, deployedDate: new Date('2026-06-15') },
      { tenantId: bankTenant.id, patchId: 'KB5039180', title: 'Windows 11 24H2 Cumulative Update — June 2026', severity: 'CRITICAL', status: 'DEPLOYED', category: 'Security Update', affectedAssets: 120, deployedDate: new Date('2026-06-14') },
      { tenantId: bankTenant.id, patchId: 'ORCL-CPU-JUL2026', title: 'Oracle Critical Patch Update — July 2026', severity: 'CRITICAL', status: 'PENDING', category: 'Security Update', affectedAssets: 8 },
      { tenantId: bankTenant.id, patchId: 'CVE-2026-21413', title: 'Apache Log4j 2.24.0 — Remote Code Execution Fix', severity: 'CRITICAL', status: 'DEPLOYED', category: 'Vulnerability Fix', affectedAssets: 15, deployedDate: new Date('2026-06-20') },
      { tenantId: bankTenant.id, patchId: 'CSCO-SA-20260601', title: 'Cisco IOS XE Software Web UI Privilege Escalation', severity: 'HIGH', status: 'DEPLOYED', category: 'Vendor Advisory', affectedAssets: 55, deployedDate: new Date('2026-06-10') },
      { tenantId: bankTenant.id, patchId: 'PA-2026-0042', title: 'PAN-OS 11.1.3 — GlobalProtect Gateway RCE', severity: 'CRITICAL', status: 'DEPLOYED', category: 'Vendor Advisory', affectedAssets: 10, deployedDate: new Date('2026-06-05') },
      { tenantId: bankTenant.id, patchId: 'RHSA-2026-4512', title: 'RHEL 9 kernel security update — CVE-2026-1234', severity: 'HIGH', status: 'TESTING', category: 'Security Update', affectedAssets: 12 },
      { tenantId: bankTenant.id, patchId: 'MS-EDGE-126', title: 'Microsoft Edge 126.0 — Multiple Vulnerability Fixes', severity: 'MEDIUM', status: 'DEPLOYED', category: 'Browser Update', affectedAssets: 200, deployedDate: new Date('2026-06-25') },
      { tenantId: bankTenant.id, patchId: 'NGINX-1.25.5', title: 'nginx 1.25.5 — HTTP/2 Rapid Reset Mitigation', severity: 'HIGH', status: 'DEPLOYED', category: 'Web Server', affectedAssets: 8, deployedDate: new Date('2026-06-18') },
      { tenantId: bankTenant.id, patchId: 'CS-FALCON-7.12', title: 'CrowdStrike Falcon Sensor 7.12 — Agent Update', severity: 'MEDIUM', status: 'IN_PROGRESS', category: 'Agent Update', affectedAssets: 520 },
      { tenantId: bankTenant.id, patchId: 'FORT-FG-7.4.4', title: 'FortiGate 7.4.4 — SSL-VPN Pre-auth RCE Fix', severity: 'CRITICAL', status: 'DEPLOYED', category: 'Vendor Advisory', affectedAssets: 5, deployedDate: new Date('2026-06-08') },
      { tenantId: bankTenant.id, patchId: 'VMW-VCSA-8.0U3', title: 'VMware vCenter Server 8.0 U3 — DCERPC Protocol Vuln', severity: 'HIGH', status: 'PENDING', category: 'Hypervisor', affectedAssets: 4 },
    ],
  });
  console.log('🩹 12 Patches created');

  // ─── 16. KNOWLEDGE ARTICLES (7) ───────────────────────────────────────────
  await prisma.knowledgeArticle.createMany({
    data: [
      { tenantId: bankTenant.id, authorId: userITSupport.id, title: 'VPN Setup Guide — GlobalProtect Client for Remote Banking Staff', content: '## Overview\nThis guide covers installation and configuration of Palo Alto GlobalProtect VPN client for authorized remote access to the bank\'s internal network.\n\n### Prerequisites\n- Active Directory account with VPN group membership\n- Approved laptop with BitLocker encryption enabled\n- MFA token registered with Okta\n\n### Installation Steps\n1. Download GlobalProtect from https://vpn.ndbk.local\n2. Install with default settings\n3. Enter portal address: vpn.nationaldigitalbank.com\n4. Authenticate with AD credentials + MFA\n\n### Troubleshooting\n- **Error: "Gateway not responding"** → Check if Palo Alto PA-5260 (FWL-001) is in maintenance\n- **Error: "Certificate validation failed"** → Ensure system time is correct and root CA is installed', category: 'Network', tags: ['vpn', 'remote-access', 'globalprotect', 'security'], viewCount: 342, helpfulCount: 89 },
      { tenantId: bankTenant.id, authorId: userCISO.id, title: 'Incident Response Playbook — Ransomware Detection', content: '## Ransomware Incident Response\n\n### Severity: P1 — CRITICAL\n\n### Immediate Actions (First 15 Minutes)\n1. **ISOLATE** affected systems from network immediately\n2. **DO NOT** shut down systems — preserve memory for forensics\n3. **NOTIFY** CISO and IT Director\n4. **ACTIVATE** CrowdStrike Real Time Response (RTR)\n\n### Investigation Phase\n1. Check CrowdStrike Falcon console for IOCs\n2. Review Splunk logs for lateral movement indicators\n3. Identify patient zero and attack vector\n4. Assess encryption scope\n\n### Recovery Phase\n1. Restore from verified clean backups\n2. Re-image affected endpoints\n3. Reset all credentials in affected scope\n4. Monitor for re-infection indicators for 72 hours\n\n### Regulatory Notification\n- RBI CERT-In notification within 6 hours (mandatory)\n- Board notification within 24 hours', category: 'Security', tags: ['incident-response', 'ransomware', 'playbook', 'critical'], viewCount: 156, helpfulCount: 67 },
      { tenantId: bankTenant.id, authorId: userDBA.id, title: 'Oracle RAC Patching — Standard Operating Procedure', content: '## Oracle RAC Rolling Patch Procedure\n\n### Pre-Patch Checklist\n- [ ] Verify OPatch version ≥ 12.2.0.1.37\n- [ ] RMAN backup completed within last 24 hours\n- [ ] Data Guard sync status verified\n- [ ] Change ticket approved (CHG category)\n- [ ] Rollback plan documented\n\n### Patching Steps (Node-by-Node)\n1. Drain sessions from Node 1 using srvctl\n2. Stop CRS on Node 1\n3. Apply OPatch as oracle user\n4. Run datapatch -verbose\n5. Start CRS and verify services\n6. Monitor for 30 minutes\n7. Repeat for Node 2\n\n### Post-Patch Validation\n- Verify v$version shows new patch level\n- Run full regression test suite\n- Validate CBS transaction processing\n- Confirm Data Guard apply lag < 5 seconds', category: 'Database', tags: ['oracle', 'rac', 'patching', 'database', 'sop'], viewCount: 78, helpfulCount: 34 },
      { tenantId: bankTenant.id, authorId: userSecAnalyst.id, title: 'Phishing Email Identification — Employee Guide', content: '## How to Identify Phishing Emails\n\n### Red Flags\n1. **Urgent language**: "Your account will be locked in 24 hours"\n2. **Suspicious sender**: Check the actual email address, not display name\n3. **Generic greeting**: "Dear Customer" instead of your name\n4. **Mismatched URLs**: Hover over links before clicking\n5. **Attachments from unknown senders**: Never open .exe, .scr, .js files\n\n### What To Do\n1. **DO NOT** click any links or download attachments\n2. **Report** using the Outlook "Report Phishing" button\n3. **Forward** suspicious emails to soc@nationaldigitalbank.com\n4. **Call** the SOC hotline: ext. 4444\n\n### Recent Campaign Examples\n- Fake RBI circular PDFs (June 2026)\n- "Password expiry" notifications from IT\n- Fake invoice attachments from known vendors', category: 'Security Awareness', tags: ['phishing', 'security', 'awareness', 'training', 'email'], viewCount: 1247, helpfulCount: 432 },
      { tenantId: bankTenant.id, authorId: userNetworkEng.id, title: 'MPLS/SD-WAN Troubleshooting — Branch Connectivity', content: '## Branch Network Troubleshooting\n\n### Diagnostic Steps\n1. **Check MPLS circuit status**: Contact ISP NOC for circuit ID lookup\n2. **Verify SD-WAN tunnel**: `show sdwan control connections` on vEdge\n3. **Run traceroute**: Compare against known-good baseline path\n4. **Check BGP neighbors**: `show bgp summary` on branch router\n\n### Common Issues\n- **Packet loss > 1%**: Check for interface errors, CRC errors\n- **Latency > 50ms** (domestic): Possible routing asymmetry\n- **Tunnel flapping**: Check MTU settings (should be 1400 for SD-WAN)\n\n### Escalation Path\n1. L1: IT Support → basic reboot and cable check\n2. L2: Network Engineering → protocol-level debugging\n3. L3: ISP NOC → circuit-level investigation\n4. Vendor TAC: Cisco/Juniper for firmware bugs', category: 'Network', tags: ['mpls', 'sd-wan', 'troubleshooting', 'branch', 'network'], viewCount: 203, helpfulCount: 56 },
      { tenantId: bankTenant.id, authorId: userFleetMgr.id, title: 'ATM Cash Replenishment — Standard Procedure', content: '## ATM Cash-in-Transit (CIT) Procedure\n\n### Pre-Replenishment\n1. Verify CIT vehicle GPS tracking is active\n2. Confirm armed escort availability\n3. Check ATM cash level via remote management\n4. Verify biometric access to ATM room\n\n### During Replenishment\n1. Two-person rule: CIT agent + branch representative\n2. CCTV recording must be verified active\n3. Count and verify cash cassettes\n4. Update cash management system with new levels\n5. Run test dispense (₹100 note)\n\n### Post-Replenishment\n1. Seal ATM and re-enable service\n2. Verify remote monitoring shows ONLINE\n3. Submit replenishment report within 30 minutes\n4. File cash insurance update if > ₹50L loaded', category: 'Operations', tags: ['atm', 'cash', 'cit', 'procedure', 'operations'], viewCount: 98, helpfulCount: 41 },
      { tenantId: bankTenant.id, authorId: userITSupport.id, title: 'New Employee IT Onboarding Checklist', content: '## IT Onboarding — New Employee Checklist\n\n### Day 1 Setup\n- [ ] Active Directory account created\n- [ ] Email (M365) provisioned\n- [ ] Laptop/Desktop assigned from asset pool\n- [ ] BitLocker encryption verified\n- [ ] CrowdStrike Falcon agent installed\n- [ ] Printer access configured\n\n### Day 1-3 Access\n- [ ] Core Banking System access (if applicable)\n- [ ] VPN profile configured\n- [ ] MFA token issued via Okta\n- [ ] Department SharePoint access\n- [ ] Citrix VDI profile (branch staff only)\n\n### Compliance\n- [ ] Security awareness training assigned (due within 7 days)\n- [ ] Acceptable Use Policy acknowledged\n- [ ] Data Classification training completed\n- [ ] NDA signed and filed with HR\n\n### Asset Tracking\n- [ ] Asset tag recorded in ITAM system\n- [ ] Asset assigned to user in system\n- [ ] Warranty information logged', category: 'IT Operations', tags: ['onboarding', 'checklist', 'new-employee', 'setup'], viewCount: 567, helpfulCount: 198 },
    ],
  });
  console.log('📚 7 Knowledge Articles created');

  // ─── 17. SLA POLICIES (4) ─────────────────────────────────────────────────
  await prisma.slaPolicy.createMany({
    data: [
      { tenantId: bankTenant.id, name: 'Critical — Core Banking / Security', priority: 'CRITICAL', responseHours: 0.25, resolutionHours: 4, escalationHours: 1, isDefault: true },
      { tenantId: bankTenant.id, name: 'High — Business Impact', priority: 'HIGH', responseHours: 1, resolutionHours: 8, escalationHours: 2, isDefault: true },
      { tenantId: bankTenant.id, name: 'Medium — Standard Request', priority: 'MEDIUM', responseHours: 4, resolutionHours: 24, escalationHours: 8, isDefault: true },
      { tenantId: bankTenant.id, name: 'Low — General Inquiry', priority: 'LOW', responseHours: 8, resolutionHours: 72, escalationHours: 24, isDefault: true },
    ],
  });
  console.log('⏱️  4 SLA Policies created');

  // ─── 18. AUTOMATION RULES (10) ────────────────────────────────────────────
  await prisma.automationRule.createMany({
    data: [
      { tenantId: bankTenant.id, createdById: userDirector.id, name: 'Auto-assign Critical Tickets to IT Director', triggerModule: 'TICKETS', triggerEvent: 'CREATED', condition: '{"priority":"CRITICAL"}', actionModule: 'TICKETS', actionType: 'ASSIGN', actionConfig: { assignToId: userDirector.id, addTag: 'auto-escalated' }, status: 'ACTIVE' as const, runCount: 47, cooldownMinutes: 0 },
      { tenantId: bankTenant.id, createdById: userCISO.id, name: 'Alert CISO on Security Incidents', triggerModule: 'TICKETS', triggerEvent: 'CREATED', condition: '{"category":"Security","priority":["CRITICAL","HIGH"]}', actionModule: 'NOTIFICATIONS', actionType: 'SEND', actionConfig: { channel: 'email', recipients: ['ciso@demobank.com'], template: 'security_alert' }, status: 'ACTIVE' as const, runCount: 23, cooldownMinutes: 5 },
      { tenantId: bankTenant.id, createdById: userDirector.id, name: 'Auto-retire Assets Past Warranty + 1yr', triggerModule: 'ASSETS', triggerEvent: 'SCHEDULE', condition: '{"warrantyExpiry":"<now-365d","status":"ACTIVE"}', actionModule: 'ASSETS', actionType: 'UPDATE_STATUS', actionConfig: { newStatus: 'RETIRED', addNote: 'Auto-retired: warranty expired > 1 year' }, status: 'ACTIVE' as const, runCount: 12, cooldownMinutes: 1440 },
      { tenantId: bankTenant.id, createdById: userCISO.id, name: 'Block Endpoint on EDR Removal', triggerModule: 'ENDPOINTS', triggerEvent: 'CHANGE_DETECTED', condition: '{"category":"SOFTWARE","changeType":"UNINSTALL","summary":"CrowdStrike"}', actionModule: 'ENDPOINTS', actionType: 'ISOLATE', actionConfig: { action: 'network_isolate', notifyCSO: true }, status: 'ACTIVE' as const, runCount: 2, cooldownMinutes: 0 },
      { tenantId: bankTenant.id, createdById: userITSupport.id, name: 'Notify on License Utilization > 90%', triggerModule: 'LICENSES', triggerEvent: 'THRESHOLD', condition: '{"usedSeatsPercent":">90"}', actionModule: 'NOTIFICATIONS', actionType: 'SEND', actionConfig: { channel: 'in_app', recipients: ['director@demobank.com'], message: 'License utilization exceeding 90%' }, status: 'ACTIVE' as const, runCount: 5, cooldownMinutes: 1440 },
      { tenantId: bankTenant.id, createdById: userNetworkEng.id, name: 'Auto-escalate SLA Breach Tickets', triggerModule: 'TICKETS', triggerEvent: 'SLA_BREACH', condition: '{"breachType":"resolution"}', actionModule: 'TICKETS', actionType: 'ESCALATE', actionConfig: { escalateToId: userDirector.id, addNote: 'SLA resolution time breached — auto-escalated', changePriority: 'CRITICAL' }, status: 'ACTIVE' as const, runCount: 8, cooldownMinutes: 30 },
      { tenantId: bankTenant.id, createdById: userSecAnalyst.id, name: 'Quarantine Rogue Devices from ARP Scan', triggerModule: 'SCANS', triggerEvent: 'COMPLETED', condition: '{"scanType":"ARP","summary.rogueDevices":">0"}', actionModule: 'NETWORK', actionType: 'QUARANTINE', actionConfig: { action: 'mac_block', notifySOC: true }, status: 'ACTIVE' as const, runCount: 3, cooldownMinutes: 60 },
      { tenantId: bankTenant.id, createdById: userDirector.id, name: 'Weekly Asset Discovery Report', triggerModule: 'SYSTEM', triggerEvent: 'SCHEDULE', condition: '{"schedule":"weekly","day":"monday","hour":8}', actionModule: 'REPORTS', actionType: 'GENERATE', actionConfig: { reportType: 'asset_discovery_summary', format: 'pdf', recipients: ['director@demobank.com', 'ciso@demobank.com'] }, status: 'ACTIVE' as const, runCount: 26, cooldownMinutes: 10080 },
      { tenantId: bankTenant.id, createdById: userCISO.id, name: 'Alert on Unauthorized Admin Account', triggerModule: 'ENDPOINTS', triggerEvent: 'CHANGE_DETECTED', condition: '{"category":"USER_ACCOUNT","changeType":"CREATE","newValue.groups":"Administrators"}', actionModule: 'NOTIFICATIONS', actionType: 'SEND', actionConfig: { channel: 'webhook', webhookUrl: 'https://soc.ndbk.local/api/alert', severity: 'critical' }, status: 'ACTIVE' as const, runCount: 1, cooldownMinutes: 0 },
      { tenantId: bankTenant.id, createdById: userITSupport.id, name: 'Auto-close Resolved Tickets After 7 Days', triggerModule: 'TICKETS', triggerEvent: 'SCHEDULE', condition: '{"status":"RESOLVED","resolvedAt":"<now-7d"}', actionModule: 'TICKETS', actionType: 'UPDATE_STATUS', actionConfig: { newStatus: 'CLOSED', addNote: 'Auto-closed after 7-day resolution confirmation period' }, status: 'ACTIVE' as const, runCount: 31, cooldownMinutes: 1440 },
    ],
  });
  console.log('⚡ 10 Automation Rules created');

  // ─── 19. VENDORS + CONTRACTS (5) ──────────────────────────────────────────
  const vendorDell = await prisma.vendor.create({
    data: { tenantId: bankTenant.id, name: 'Dell Technologies India', email: 'enterprise.support@dell.com', phone: '+91-1800-425-2067', website: 'https://dell.com/in', category: 'Hardware', rating: 4, status: 'ACTIVE' },
  });
  const vendorCisco = await prisma.vendor.create({
    data: { tenantId: bankTenant.id, name: 'Cisco Systems India', email: 'india-sales@cisco.com', phone: '+91-1800-103-2482', website: 'https://cisco.com', category: 'Networking', rating: 5, status: 'ACTIVE' },
  });
  const vendorPaloAlto = await prisma.vendor.create({
    data: { tenantId: bankTenant.id, name: 'Palo Alto Networks', email: 'india-support@paloaltonetworks.com', phone: '+91-80-4905-9000', website: 'https://paloaltonetworks.com', category: 'Security', rating: 5, status: 'ACTIVE' },
  });
  const vendorNCR = await prisma.vendor.create({
    data: { tenantId: bankTenant.id, name: 'NCR Atleos India', email: 'banking.support@ncr.com', phone: '+91-80-2852-1234', website: 'https://ncr.com', category: 'ATM/Banking', rating: 3, status: 'ACTIVE' },
  });
  const vendorTCS = await prisma.vendor.create({
    data: { tenantId: bankTenant.id, name: 'Tata Consultancy Services', email: 'bfsi.support@tcs.com', phone: '+91-22-6778-9999', website: 'https://tcs.com', category: 'IT Services', rating: 4, status: 'ACTIVE' },
  });

  // Contracts
  await prisma.contract.createMany({
    data: [
      { tenantId: bankTenant.id, vendorId: vendorDell.id, title: 'Dell ProSupport Plus — Servers & Laptops', type: 'SUPPORT', value: 15000000, startDate: new Date('2025-04-01'), endDate: new Date('2028-03-31'), status: 'ACTIVE', terms: 'Next business day on-site support. 4-hour response for critical servers. Covers all Dell hardware in inventory.' },
      { tenantId: bankTenant.id, vendorId: vendorCisco.id, title: 'Cisco SmartNet Total Care', type: 'SUPPORT', value: 8500000, startDate: new Date('2025-07-01'), endDate: new Date('2026-06-30'), status: 'ACTIVE', terms: '24x7x4 hardware replacement. Software updates and TAC access for all Catalyst and ISR devices.' },
      { tenantId: bankTenant.id, vendorId: vendorPaloAlto.id, title: 'Palo Alto Premium Support + WildFire', type: 'SUBSCRIPTION', value: 4200000, startDate: new Date('2025-10-01'), endDate: new Date('2026-09-30'), status: 'ACTIVE', terms: 'Premium support with designated SE. WildFire, URL Filtering, Threat Prevention, DNS Security subscriptions included.' },
      { tenantId: bankTenant.id, vendorId: vendorNCR.id, title: 'NCR ATM Managed Services', type: 'MANAGED_SERVICE', value: 12000000, startDate: new Date('2025-01-01'), endDate: new Date('2027-12-31'), status: 'ACTIVE', terms: 'Full lifecycle ATM management including preventive maintenance, cash management, first/second line maintenance. 98.5% uptime SLA.' },
      { tenantId: bankTenant.id, vendorId: vendorTCS.id, title: 'TCS CBS Support & Enhancement', type: 'MANAGED_SERVICE', value: 35000000, startDate: new Date('2024-04-01'), endDate: new Date('2027-03-31'), status: 'ACTIVE', terms: 'Core Banking System L2/L3 support. 15 FTE dedicated team. Quarterly enhancement releases. DR drill support.' },
    ],
  });
  console.log('🏪 5 Vendors + 5 Contracts created');

  // ─── 20. PURCHASE ORDERS ──────────────────────────────────────────────────
  const po1 = await prisma.purchaseOrder.create({
    data: { tenantId: bankTenant.id, vendorId: vendorDell.id, poNumber: 'PO-2026-001', totalAmount: 5550000, status: 'APPROVED', approvedById: userDirector.id, requestedById: userITSupport.id },
  });
  await prisma.purchaseOrderItem.createMany({
    data: [
      { poId: po1.id, description: 'Dell Latitude 7440 — i7, 32GB, 1TB SSD', quantity: 20, unitPrice: 185000 },
      { poId: po1.id, description: 'Dell Docking Station WD22TB4', quantity: 20, unitPrice: 25000 },
      { poId: po1.id, description: 'Dell UltraSharp U2723QE 27" 4K Monitor', quantity: 20, unitPrice: 42500 },
    ],
  });

  const po2 = await prisma.purchaseOrder.create({
    data: { tenantId: bankTenant.id, vendorId: vendorCisco.id, poNumber: 'PO-2026-002', totalAmount: 3200000, status: 'PENDING', requestedById: userNetworkEng.id },
  });
  await prisma.purchaseOrderItem.createMany({
    data: [
      { poId: po2.id, description: 'Cisco Catalyst 9300L-48P-4X — 48-port PoE+ Switch', quantity: 4, unitPrice: 650000 },
      { poId: po2.id, description: 'Cisco DNA Advantage License — 3 Year', quantity: 4, unitPrice: 150000 },
    ],
  });
  console.log('📦 2 Purchase Orders created');

  // ─── 21. NOTIFICATION CHANNELS (3) ────────────────────────────────────────
  await prisma.notificationChannel.createMany({
    data: [
      { tenantId: bankTenant.id, name: 'IT Operations Email', type: 'EMAIL' as const, config: { smtpHost: 'smtp.nationaldigitalbank.com', smtpPort: 587, fromAddress: 'itops@nationaldigitalbank.com', useTLS: true }, isActive: true },
      { tenantId: bankTenant.id, name: 'SOC SIEM Webhook', type: 'WEBHOOK' as const, config: { url: 'https://soc.ndbk.local/api/v1/alerts', method: 'POST', headers: { 'X-API-Key': 'soc-webhook-key-placeholder' }, format: 'json' }, isActive: true },
      { tenantId: bankTenant.id, name: 'Splunk Syslog Forwarder', type: 'SYSLOG' as const, config: { host: 'splunk-hec.ndbk.local', port: 8088, protocol: 'TCP', facility: 'local0', format: 'CEF' }, isActive: true },
    ],
  });
  console.log('📡 3 Notification Channels created');

  // ─── 22. SCAN CREDENTIALS (3) ─────────────────────────────────────────────
  await prisma.scanCredential.createMany({
    data: [
      { tenantId: bankTenant.id, createdById: userCISO.id, name: 'Windows Domain Admin — Scan Account', type: 'WINDOWS', encryptedData: 'ENC[AES256,data:placeholder-windows-cred]', scope: { domain: 'ndbk.local', ou: 'OU=Servers,DC=ndbk,DC=local' } },
      { tenantId: bankTenant.id, createdById: userCISO.id, name: 'Linux SSH Key — Scanner', type: 'SSH_KEY', encryptedData: 'ENC[AES256,data:placeholder-ssh-key]', scope: { hosts: '10.10.0.0/16', username: 'scan_svc' } },
      { tenantId: bankTenant.id, createdById: userSecAnalyst.id, name: 'SNMP v3 — Network Devices', type: 'SNMP_V3', encryptedData: 'ENC[AES256,data:placeholder-snmp-cred]', scope: { community: 'ndbk_monitor', authProtocol: 'SHA256', privProtocol: 'AES256' } },
    ],
  });
  console.log('🔑 3 Scan Credentials created');

  // ─── 23. SCHEDULED SCANS (3) ──────────────────────────────────────────────
  await prisma.scheduledScan.createMany({
    data: [
      { tenantId: bankTenant.id, createdById: userCISO.id, name: 'Nightly Network Discovery — All Sites', subnet: '10.10.0.0/16', scanType: 'NMAP', schedule: '0 2 * * *', isActive: true, nextRunAt: new Date('2026-07-03T02:00:00Z') },
      { tenantId: bankTenant.id, createdById: userSecAnalyst.id, name: 'Weekly SSL Certificate Audit', subnet: '*.nationaldigitalbank.com', scanType: 'SSL', schedule: '0 3 * * 1', isActive: true, nextRunAt: new Date('2026-07-07T03:00:00Z') },
      { tenantId: bankTenant.id, createdById: userSecAnalyst.id, name: 'Daily ARP Sweep — HQ Subnet', subnet: '10.10.1.0/24', scanType: 'ARP', schedule: '0 1 * * *', isActive: true, nextRunAt: new Date('2026-07-03T01:00:00Z') },
    ],
  });
  console.log('📅 3 Scheduled Scans created');

  // ─── 24. SUBSCRIPTION (1) ─────────────────────────────────────────────────
  await prisma.subscription.createMany({
    data: [
      { tenantId: bankTenant.id, plan: 'ENTERPRISE', status: 'ACTIVE', startDate: new Date('2025-01-01'), endDate: new Date('2027-12-31'), mrr: 250000, billingCycle: 'ANNUAL' },
    ],
  });
  console.log('💳 1 Subscription created');

  // ─── 25. SYSTEM CONFIG (1) ────────────────────────────────────────────────
  await prisma.systemConfig.createMany({
    data: [
      {
        key: 'pricing',
        value: {
          plans: {
            STARTER: { monthlyPrice: 5000, maxAssets: 100, maxUsers: 10, features: ['asset_tracking', 'basic_tickets'] },
            PROFESSIONAL: { monthlyPrice: 25000, maxAssets: 1000, maxUsers: 50, features: ['asset_tracking', 'tickets', 'reports', 'basic_security'] },
            ENTERPRISE: { monthlyPrice: 100000, maxAssets: -1, maxUsers: -1, features: ['*'] },
            ON_PREMISE: { monthlyPrice: 0, maxAssets: -1, maxUsers: -1, features: ['*'], note: 'Self-hosted, custom pricing' },
          },
          currency: 'INR',
          billingCycles: ['MONTHLY', 'ANNUAL'],
          annualDiscount: 0.15,
        },
      },
    ],
  });
  console.log('⚙️  1 System Config created');

  // ─── 26. AUDIT LOGS (10) ──────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { tenantId: bankTenant.id, actorId: userDirector.id, action: 'USER_LOGIN', resourceType: 'USER', module: 'AUTH', metadata: { method: 'password+mfa', ip: '10.10.1.50', userAgent: 'Mozilla/5.0 Chrome/126' }, actorIp: '10.10.1.50', timestamp: new Date('2026-07-02T08:00:00Z') },
      { tenantId: bankTenant.id, actorId: userCISO.id, action: 'SECURITY_POLICY_UPDATE', resourceType: 'POLICY', module: 'SECURITY', metadata: { policy: 'endpoint_usb_block', change: 'Added Treasury department to scope' }, actorIp: '10.10.1.55', timestamp: new Date('2026-07-01T14:30:00Z') },
      { tenantId: bankTenant.id, actorId: userITSupport.id, action: 'ASSET_CREATE', resourceType: 'ASSET', module: 'ASSETS', metadata: { assetTag: 'LPT-121', assetType: 'Laptop', assignedTo: 'treasury.analyst@demobank.com' }, actorIp: '10.10.1.60', timestamp: new Date('2026-07-01T10:15:00Z') },
      { tenantId: bankTenant.id, actorId: userDirector.id, action: 'TICKET_ESCALATE', resourceType: 'TICKET', module: 'TICKETS', metadata: { ticketNumber: 'INC-2026-0001', from: 'HIGH', to: 'CRITICAL', reason: 'Core Banking impact' }, actorIp: '10.10.1.50', timestamp: new Date('2026-07-01T09:00:00Z') },
      { tenantId: bankTenant.id, actorId: userCISO.id, action: 'SCAN_INITIATED', resourceType: 'SCAN', module: 'SECURITY', metadata: { scanType: 'NMAP', target: '10.10.1.0/24', initiatedBy: 'manual' }, actorIp: '10.10.1.55', timestamp: new Date('2026-07-01T02:00:00Z') },
      { tenantId: bankTenant.id, actorId: userDBA.id, action: 'CHANGE_APPROVED', resourceType: 'TICKET', module: 'CHANGES', metadata: { ticketNumber: 'CHG-2026-0003', description: 'Oracle RAC patching approved for Sunday window' }, actorIp: '10.10.3.20', timestamp: new Date('2026-06-30T16:00:00Z') },
      { tenantId: bankTenant.id, actorId: userSecAnalyst.id, action: 'ENDPOINT_CHANGE_REVIEWED', resourceType: 'ENDPOINT_CHANGE', module: 'ENDPOINTS', metadata: { hostname: 'NDBK-SRV-CBS01', decision: 'REJECTED', reason: 'SSH root login enabled' }, actorIp: '10.10.1.55', timestamp: new Date('2026-06-30T11:00:00Z') },
      { tenantId: bankTenant.id, actorId: userBranchMgr.id, action: 'TICKET_CREATE', resourceType: 'TICKET', module: 'TICKETS', metadata: { ticketNumber: 'INC-2026-0006', category: 'Printing', subject: 'Cheque printer misalignment' }, actorIp: '10.10.4.10', timestamp: new Date('2026-06-29T09:30:00Z') },
      { tenantId: platformTenant.id, actorId: userPlatformOwner.id, action: 'TENANT_CREATE', resourceType: 'TENANT', module: 'PLATFORM', metadata: { tenantName: 'National Digital Bank', plan: 'ENTERPRISE' }, actorIp: '10.0.0.1', timestamp: new Date('2025-01-01T00:00:00Z') },
      { tenantId: bankTenant.id, actorId: userDirector.id, action: 'REPORT_GENERATED', resourceType: 'REPORT', module: 'REPORTS', metadata: { reportType: 'asset_compliance_summary', format: 'pdf', assetCount: 520 }, actorIp: '10.10.1.50', timestamp: new Date('2026-06-28T17:00:00Z') },
    ],
  });
  console.log('📝 10 Audit Logs created');

  // ─── 27. NOTIFICATIONS (5) ────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { tenantId: bankTenant.id, userId: userDirector.id, title: 'Critical Incident: Core Banking Server Unresponsive', message: 'SRV-005 is not responding to health checks. CBS transactions are failing. Ticket INC-2026-0001 created and assigned to IT Support.', type: 'ALERT', module: 'TICKETS' },
      { tenantId: bankTenant.id, userId: userCISO.id, title: 'Ransomware Indicator Detected', message: 'Fortinet sandbox detected LockBit 3.0 dropper in email attachment. Sample quarantined. No lateral movement observed. Review ticket INC-2026-0020.', type: 'SECURITY', module: 'SECURITY' },
      { tenantId: bankTenant.id, userId: userITSupport.id, title: 'License Utilization Alert: Microsoft 365 E5', message: 'Microsoft 365 E5 license utilization at 87.4% (437/500 seats). Consider procurement of additional licenses before Q3 hiring.', type: 'WARNING', module: 'LICENSES' },
      { tenantId: bankTenant.id, userId: userNetworkEng.id, title: 'Rogue Device Detected — Mumbai HQ', message: 'ARP scan identified unauthorized device (MAC: aa:bb:cc:11:22:33) on subnet 10.10.1.0/24. Device quarantined automatically by policy.', type: 'SECURITY', module: 'SCANS' },
      { tenantId: bankTenant.id, userId: userDirector.id, title: 'Weekly Asset Discovery Report Ready', message: 'Your weekly asset discovery summary for June 23-29, 2026 is ready. 520 total assets, 3 newly discovered, 2 retired. View full report in Reports module.', type: 'INFO', module: 'REPORTS' },
    ],
  });
  console.log('🔔 5 Notifications created');

  // ─── DONE ─────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════');
  console.log('🏦 Bank Demo Seed Complete!');
  console.log('════════════════════════════════════════════════════');
  console.log('Login: director@demobank.com / Demo@2026');
  console.log('Login: ciso@demobank.com / Demo@2026');
  console.log('Login: owner@qsasset.com / Demo@2026 (Platform Admin)');
  console.log('════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
