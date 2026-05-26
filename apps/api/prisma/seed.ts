import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data for idempotent seeding (dev only)
  console.log('  🗑️  Cleaning existing data...');
  await prisma.automationExecution.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.slaPolicy.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.patch.deleteMany();
  await prisma.monitoredDevice.deleteMany();
  await prisma.licenseAssignment.deleteMany();
  await prisma.license.deleteMany();
  await prisma.discoveredDevice.deleteMany();
  await prisma.scanJob.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticketAsset.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.assetHistory.deleteMany();
  await prisma.softwareInstallation.deleteMany();
  await prisma.securityPosture.deleteMany();
  await prisma.osDetail.deleteMany();
  await prisma.hardwareDetail.deleteMany();
  await prisma.assetRelationship.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.assetType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.department.deleteMany();
  await prisma.site.deleteMany();
  await prisma.auditLog.deleteMany();
  
  // Clean up all new and dependent compliance/scanning/fleet/financial tables to avoid FK constraint errors
  await prisma.scanResult.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.endpointPolicy.deleteMany();
  await prisma.endpointChange.deleteMany();
  await prisma.agentBaseline.deleteMany();
  await prisma.assetCheckout.deleteMany();
  await prisma.changeRequest.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.assetAttestation.deleteMany();
  await prisma.notificationChannel.deleteMany();
  await prisma.deviceMetricsHistory.deleteMany();
  await prisma.contactSubmission.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.gpsTelemetry.deleteMany();
  await prisma.userTelemetry.deleteMany();
  await prisma.patchDeployment.deleteMany();
  await prisma.scanCredential.deleteMany();
  await prisma.scheduledReport.deleteMany();
  await prisma.scriptLibrary.deleteMany();
  await prisma.networkConfig.deleteMany();
  await prisma.systemConfig.deleteMany();

  // Financials and contracts ordering (children first)
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.vendor.deleteMany();

  await prisma.tenant.deleteMany();

  // 1. Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'ACME Corporation',
      slug: 'acme-corp',
      domain: 'acme.com',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      settings: { timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY' },
    },
  });
  console.log(`  ✅ Tenant: ${tenant.name}`);

  // 1b. Create platform owner tenant (system-level, not visible to clients)
  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'qs-asset-platform' },
    update: {},
    create: {
      name: 'QS Asset Platform',
      slug: 'qs-asset-platform',
      domain: 'qsasset.com',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      settings: { timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY', isSystemTenant: true },
    },
  });
  console.log(`  ✅ Platform Tenant: ${platformTenant.name}`);

  // 2. Create sites
  const hq = await prisma.site.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: tenant.id,
      name: 'Headquarters - Mumbai',
      address: '123 Business Park, Andheri East',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      zipCode: '400069',
      latitude: 19.1136,
      longitude: 72.8697,
      timezone: 'Asia/Kolkata',
      isHq: true,
    },
  });

  const branch = await prisma.site.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      tenantId: tenant.id,
      name: 'Branch Office - Bangalore',
      address: '456 Tech Park, Whitefield',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      zipCode: '560066',
      latitude: 12.9716,
      longitude: 77.5946,
      timezone: 'Asia/Kolkata',
    },
  });
  console.log(`  ✅ Sites: ${hq.name}, ${branch.name}`);

  // 3. Create departments
  const itDept = await prisma.department.create({
    data: { tenantId: tenant.id, siteId: hq.id, name: 'Information Technology', code: 'IT', costCenter: 'CC-IT-001' },
  });
  const hrDept = await prisma.department.create({
    data: { tenantId: tenant.id, siteId: hq.id, name: 'Human Resources', code: 'HR', costCenter: 'CC-HR-001' },
  });
  const opsDept = await prisma.department.create({
    data: { tenantId: tenant.id, siteId: hq.id, name: 'Operations', code: 'OPS', costCenter: 'CC-OPS-001' },
  });
  const facilityDept = await prisma.department.create({
    data: { tenantId: tenant.id, siteId: hq.id, name: 'Facility Management', code: 'FM', costCenter: 'CC-FM-001' },
  });
  console.log(`  ✅ Departments: IT, HR, Operations, Facility`);

  // 4. Create roles
  const adminRole = await prisma.role.create({
    data: {
      tenantId: tenant.id, name: 'Tenant Admin', isSystem: true,
      permissions: JSON.parse(JSON.stringify(['*'])),
    },
  });
  const itAdminRole = await prisma.role.create({
    data: {
      tenantId: tenant.id, name: 'IT Admin', isSystem: true,
      permissions: JSON.parse(JSON.stringify(['assets:*', 'tickets:*', 'patches:*', 'licenses:*', 'nms:*', 'discovery:*', 'users:read'])),
    },
  });
  const employeeRole = await prisma.role.create({
    data: {
      tenantId: tenant.id, name: 'Employee', isSystem: true,
      permissions: JSON.parse(JSON.stringify(['assets:read:own', 'tickets:create', 'tickets:read:own', 'kb:read'])),
    },
  });
  const fleetMgrRole = await prisma.role.create({
    data: {
      tenantId: tenant.id, name: 'Fleet Manager', isSystem: true,
      permissions: JSON.parse(JSON.stringify(['fleet:*', 'assets:read', 'tickets:*'])),
    },
  });
  console.log(`  ✅ Roles: Admin, IT Admin, Employee, Fleet Manager`);

  // 5. Create users
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id, email: 'admin@acme.com', passwordHash,
      firstName: 'Admin', lastName: 'User', roleId: adminRole.id,
      departmentId: itDept.id, siteId: hq.id, status: 'ACTIVE',
      isSuperAdmin: false, emailVerified: true,
    },
  });

  // Create platform owner account (separate from tenant users)
  const ownerRole = await prisma.role.create({
    data: {
      tenantId: platformTenant.id, name: 'Platform Owner',
      permissions: JSON.parse(JSON.stringify(['*'])),
    },
  });
  await prisma.user.create({
    data: {
      tenantId: platformTenant.id, email: 'smrita@neurqai.com', passwordHash,
      firstName: 'Smrita', lastName: 'Pandey', roleId: ownerRole.id,
      status: 'ACTIVE', isSuperAdmin: true, emailVerified: true,
    },
  });
  console.log(`  ✅ Platform Owner: owner@qsasset.com`);
  const itAdmin = await prisma.user.create({
    data: {
      tenantId: tenant.id, email: 'itadmin@acme.com', passwordHash,
      firstName: 'Raj', lastName: 'Sharma', roleId: itAdminRole.id,
      departmentId: itDept.id, siteId: hq.id, status: 'ACTIVE',
      emailVerified: true,
    },
  });
  const employee1 = await prisma.user.create({
    data: {
      tenantId: tenant.id, email: 'priya@acme.com', passwordHash,
      firstName: 'Priya', lastName: 'Patel', roleId: employeeRole.id,
      departmentId: hrDept.id, siteId: hq.id, status: 'ACTIVE',
      emailVerified: true,
    },
  });
  const employee2 = await prisma.user.create({
    data: {
      tenantId: tenant.id, email: 'amit@acme.com', passwordHash,
      firstName: 'Amit', lastName: 'Kumar', roleId: employeeRole.id,
      departmentId: opsDept.id, siteId: branch.id, status: 'ACTIVE',
      emailVerified: true,
    },
  });
  console.log(`  ✅ Users: admin, itadmin, priya, amit (password: Admin@123)`);

  // 6. Create asset types
  const hwType = await prisma.assetType.create({
    data: { tenantId: tenant.id, name: 'Hardware', isItAsset: true, icon: 'monitor', color: '#3b82f6' },
  });
  const laptopType = await prisma.assetType.create({
    data: { tenantId: tenant.id, name: 'Laptop', parentId: hwType.id, isItAsset: true, icon: 'laptop', color: '#6366f1' },
  });
  const serverType = await prisma.assetType.create({
    data: { tenantId: tenant.id, name: 'Server', parentId: hwType.id, isItAsset: true, icon: 'server', color: '#8b5cf6' },
  });
  const printerType = await prisma.assetType.create({
    data: { tenantId: tenant.id, name: 'Printer', parentId: hwType.id, isItAsset: true, icon: 'printer', color: '#a855f7' },
  });
  const networkType = await prisma.assetType.create({
    data: { tenantId: tenant.id, name: 'Network Device', isItAsset: true, icon: 'router', color: '#0ea5e9' },
  });
  const switchType = await prisma.assetType.create({
    data: { tenantId: tenant.id, name: 'Switch', parentId: networkType.id, isItAsset: true, icon: 'switch', color: '#06b6d4' },
  });
  const facilityType = await prisma.assetType.create({
    data: { tenantId: tenant.id, name: 'Facility Asset', isItAsset: false, icon: 'building', color: '#f59e0b' },
  });
  const furnitureType = await prisma.assetType.create({
    data: { tenantId: tenant.id, name: 'Furniture', parentId: facilityType.id, isItAsset: false, icon: 'armchair', color: '#f97316' },
  });
  const vehicleType = await prisma.assetType.create({
    data: { tenantId: tenant.id, name: 'Vehicle', isItAsset: false, icon: 'car', color: '#10b981' },
  });
  console.log(`  ✅ Asset Types: Hardware, Laptop, Server, Printer, Network, Facility, Vehicle`);

  // 7. Create sample assets
  // Asset seeding has been completely removed to provide a clean slate for new users.

  // 8. Create sample tickets
  const tickets = [
    {
      tenantId: tenant.id, ticketNumber: 'TKT-000001', type: 'SERVICE_REQUEST' as const,
      category: 'Hardware', subject: 'Request for new laptop',
      description: 'My current laptop is running slow and needs replacement. It is 4 years old.',
      priority: 'MEDIUM' as const, status: 'NEW' as const, requesterId: employee1.id,
    },
    {
      tenantId: tenant.id, ticketNumber: 'TKT-000002', type: 'INCIDENT' as const,
      category: 'Printer', subject: 'HR printer not working - paper jam',
      description: 'The HP printer on 2nd floor HR section has a paper jam. Error light is blinking.',
      priority: 'HIGH' as const, status: 'OPEN' as const, requesterId: employee1.id, assignedToId: itAdmin.id,
    },
    {
      tenantId: tenant.id, ticketNumber: 'TKT-000003', type: 'SERVICE_REQUEST' as const,
      category: 'Furniture', subject: 'Need new office chair',
      description: 'My office chair armrest is broken. Requesting a new ergonomic chair.',
      priority: 'LOW' as const, status: 'IN_PROGRESS' as const, requesterId: employee2.id,
    },
    {
      tenantId: tenant.id, ticketNumber: 'TKT-000004', type: 'CHANGE' as const,
      category: 'Network', subject: 'Upgrade branch office switch firmware',
      description: 'Cisco has released a critical security patch for Catalyst 9200. Need to schedule firmware update.',
      priority: 'CRITICAL' as const, status: 'PENDING' as const, requesterId: itAdmin.id,
    },
  ];

  for (const ticketData of tickets) {
    await prisma.ticket.create({ data: ticketData });
  }
  console.log(`  ✅ Tickets: ${tickets.length} sample tickets created`);

  // 9. Create sample licenses
  await prisma.licenseAssignment.deleteMany();
  await prisma.license.deleteMany();

  const licenses = [
    {
      tenantId: tenant.id, softwareName: 'Microsoft 365 Business', vendor: 'Microsoft', version: 'E3',
      licenseType: 'SUBSCRIPTION' as const, licenseModel: 'ANNUAL' as const,
      totalSeats: 50, usedSeats: 42, purchaseCost: 480000,
      purchaseDate: new Date('2025-01-01'), expiryDate: new Date('2026-12-31'),
      status: 'ACTIVE',
    },
    {
      tenantId: tenant.id, softwareName: 'Adobe Creative Cloud', vendor: 'Adobe', version: '2025',
      licenseType: 'PER_SEAT' as const, licenseModel: 'ANNUAL' as const,
      totalSeats: 10, usedSeats: 8, purchaseCost: 156000,
      purchaseDate: new Date('2025-06-01'), expiryDate: new Date('2026-05-31'),
      status: 'ACTIVE',
    },
    {
      tenantId: tenant.id, softwareName: 'Zoom Workplace', vendor: 'Zoom', version: 'Business',
      licenseType: 'SUBSCRIPTION' as const, licenseModel: 'MONTHLY' as const,
      totalSeats: 30, usedSeats: 30, purchaseCost: 72000,
      expiryDate: new Date('2026-12-31'),
      status: 'ACTIVE',
    },
    {
      tenantId: tenant.id, softwareName: 'AutoCAD', vendor: 'Autodesk', version: '2025',
      licenseType: 'PER_DEVICE' as const, licenseModel: 'ANNUAL' as const,
      totalSeats: 5, usedSeats: 7, purchaseCost: 280000,
      expiryDate: new Date('2026-08-15'),
      status: 'ACTIVE',
    },
    {
      tenantId: tenant.id, softwareName: 'Slack Business+', vendor: 'Salesforce', version: null,
      licenseType: 'PER_SEAT' as const, licenseModel: 'ANNUAL' as const,
      totalSeats: 100, usedSeats: 65, purchaseCost: 195000,
      expiryDate: new Date('2025-12-15'),
      status: 'ACTIVE',
    },
    {
      tenantId: tenant.id, softwareName: 'Windows Server 2022', vendor: 'Microsoft', version: 'Datacenter',
      licenseType: 'PER_DEVICE' as const, licenseModel: 'PERPETUAL' as const,
      totalSeats: 3, usedSeats: 2, purchaseCost: 450000,
      status: 'ACTIVE',
    },
  ];

  for (const lic of licenses) {
    await prisma.license.create({ data: lic });
  }
  console.log(`  ✅ Licenses: ${licenses.length} sample licenses created`);

  // 10. Create sample notifications
  await prisma.notification.deleteMany();
  const notifs = [
    { tenantId: tenant.id, userId: admin.id, title: 'New device discovered', message: '4 new devices found on 192.168.1.0/24 subnet', type: 'INFO', module: 'discovery' },
    { tenantId: tenant.id, userId: admin.id, title: 'AutoCAD license overused', message: 'AutoCAD 2025 has 7/5 seats in use — 2 over limit', type: 'WARNING', module: 'licenses' },
    { tenantId: tenant.id, userId: admin.id, title: 'Ticket escalated', message: 'TKT-000004 escalated to CRITICAL priority', type: 'ALERT', module: 'tickets' },
    { tenantId: tenant.id, userId: admin.id, title: 'Patch compliance improved', message: 'Overall patch compliance reached 94% (+3%)', type: 'SUCCESS', module: 'patches' },
    { tenantId: tenant.id, userId: admin.id, title: 'Slack license expiring', message: 'Slack Business+ expires on Dec 15, 2025 — renewal required', type: 'WARNING', module: 'licenses' },
  ];
  for (const n of notifs) { await prisma.notification.create({ data: n }); }
  console.log(`  ✅ Notifications: ${notifs.length} sample notifications created`);

  // 11. Create sample automation rules (event-bus compatible)
  await prisma.automationExecution.deleteMany();
  await prisma.automationRule.deleteMany();
  const rules = [
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'Auto-ticket on new unmanaged device',
      triggerModule: 'Discovery', triggerEvent: 'new_device',
      condition: '{}',
      actionModule: 'Tickets', actionType: 'create_ticket',
      actionConfig: { priority: 'MEDIUM', category: 'Asset Review', subject: '[Auto] New unmanaged device found' },
      status: 'ACTIVE' as const, runCount: 4,
    },
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'Notify admin on scan completion',
      triggerModule: 'Discovery', triggerEvent: 'scan_completed',
      condition: '{}',
      actionModule: 'Notifications', actionType: 'send_notification',
      actionConfig: { title: 'Scan completed', severity: 'INFO' },
      status: 'ACTIVE' as const, runCount: 8,
    },
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'P1 ticket on critical missing patches',
      triggerModule: 'Patch', triggerEvent: 'critical_missing',
      condition: '{}',
      actionModule: 'Tickets', actionType: 'create_ticket',
      actionConfig: { priority: 'CRITICAL', category: 'Security', subject: '[Auto] Critical patches missing' },
      status: 'ACTIVE' as const, runCount: 2,
    },
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'Alert on CCTV camera offline',
      triggerModule: 'Monitoring', triggerEvent: 'device_down',
      condition: '{}',
      actionModule: 'Notifications', actionType: 'send_notification',
      actionConfig: { title: 'Camera/device went offline', severity: 'ALERT' },
      status: 'ACTIVE' as const, runCount: 1,
    },
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'Create incident on network device down',
      triggerModule: 'Monitoring', triggerEvent: 'device_down',
      condition: '{}',
      actionModule: 'Tickets', actionType: 'create_ticket',
      actionConfig: { priority: 'HIGH', category: 'Incident', subject: '[Auto] Network device down' },
      status: 'ACTIVE' as const, runCount: 3,
    },
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'License overuse warning',
      triggerModule: 'License', triggerEvent: 'overused',
      condition: '{}',
      actionModule: 'Notifications', actionType: 'send_notification',
      actionConfig: { title: 'License seats exceeded', severity: 'WARNING' },
      status: 'ACTIVE' as const, runCount: 0,
    },
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'Ticket SLA breach escalation',
      triggerModule: 'Ticket', triggerEvent: 'sla_breach',
      condition: '{}',
      actionModule: 'Notifications', actionType: 'send_notification',
      actionConfig: { title: 'Ticket SLA breach imminent', severity: 'ALERT' },
      status: 'ACTIVE' as const, runCount: 0,
    },
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'New employee asset assignment',
      triggerModule: 'Asset', triggerEvent: 'created',
      condition: '{}',
      actionModule: 'Notifications', actionType: 'send_notification',
      actionConfig: { title: 'New asset registered', severity: 'INFO' },
      status: 'DRAFT' as const, runCount: 0,
    },
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'Webhook on asset retirement',
      triggerModule: 'Asset', triggerEvent: 'status_changed',
      condition: '{}',
      actionModule: 'External', actionType: 'send_webhook',
      actionConfig: { url: 'https://hooks.example.com/asset-retired' },
      status: 'DRAFT' as const, runCount: 0,
    },
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'VDI threshold alert (CPU > 90%)',
      triggerModule: 'Monitoring', triggerEvent: 'threshold_breach',
      condition: '{}',
      actionModule: 'Notifications', actionType: 'send_notification',
      actionConfig: { title: 'VDI resource threshold exceeded', severity: 'WARNING' },
      status: 'ACTIVE' as const, runCount: 0,
    },
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'Fleet geofence breach alert',
      triggerModule: 'Monitoring', triggerEvent: 'geofence_breach',
      condition: '{}',
      actionModule: 'Notifications', actionType: 'send_notification',
      actionConfig: { title: 'Vehicle left geofence', severity: 'ALERT' },
      status: 'ACTIVE' as const, runCount: 0,
    },
    {
      tenantId: tenant.id, createdById: admin.id,
      name: 'Auto-ticket on scan finding > 5 new devices',
      triggerModule: 'Discovery', triggerEvent: 'scan_completed',
      condition: '{}',
      actionModule: 'Tickets', actionType: 'create_ticket',
      actionConfig: { priority: 'MEDIUM', category: 'Discovery Review', subject: '[Auto] Multiple new devices detected' },
      status: 'PAUSED' as const, runCount: 0,
    },
  ];
  for (const r of rules) { await prisma.automationRule.create({ data: r }); }
  console.log(`  ✅ Automation Rules: ${rules.length} enterprise templates created`);

  // Seeding of mock monitored devices (cameras, network switches, and virtual machines) has been completely removed to ensure all network topology nodes and discovery scans represent 100% real infrastructure.

  // ─── Patches ──────────────────────────────────────────────────
  const patches = [
    { tenantId: tenant.id, patchId: 'KB5034441', title: 'Windows Security Update - Jan 2026', severity: 'Critical', status: 'Deployed', category: 'Security', affectedAssets: 12, deployedDate: new Date('2026-01-15') },
    { tenantId: tenant.id, patchId: 'KB5034123', title: 'Exchange Server CU15 Rollup', severity: 'Critical', status: 'Pending', category: 'Security', affectedAssets: 3 },
    { tenantId: tenant.id, patchId: 'KB5033456', title: 'Chrome Browser v122.0.6261', severity: 'Critical', status: 'Failed', category: 'Browser', affectedAssets: 1 },
    { tenantId: tenant.id, patchId: 'KB5032789', title: '.NET Runtime 8.0.3 Update', severity: 'High', status: 'Deployed', category: 'Framework', affectedAssets: 8, deployedDate: new Date('2026-03-20') },
    { tenantId: tenant.id, patchId: 'KB5031234', title: 'Windows Defender Definitions', severity: 'High', status: 'Deployed', category: 'Security', affectedAssets: 15, deployedDate: new Date('2026-04-28') },
    { tenantId: tenant.id, patchId: 'KB5030567', title: 'Office 365 Monthly Update', severity: 'Medium', status: 'Scheduled', category: 'Productivity', affectedAssets: 20 },
    { tenantId: tenant.id, patchId: 'KB5029890', title: 'Adobe Reader DC 24.001', severity: 'Medium', status: 'Deployed', category: 'Application', affectedAssets: 18, deployedDate: new Date('2026-04-10') },
    { tenantId: tenant.id, patchId: 'KB5028345', title: 'Java Runtime 21.0.2', severity: 'High', status: 'Pending', category: 'Framework', affectedAssets: 6 },
    { tenantId: tenant.id, patchId: 'KB5027678', title: 'VMware Tools 12.4.0', severity: 'Low', status: 'Deployed', category: 'Virtualization', affectedAssets: 4, deployedDate: new Date('2026-04-22') },
    { tenantId: tenant.id, patchId: 'KB5026012', title: 'SSH OpenSSH 9.6 Update', severity: 'High', status: 'Deployed', category: 'Security', affectedAssets: 7, deployedDate: new Date('2026-02-15') },
    { tenantId: tenant.id, patchId: 'KB5025345', title: 'PostgreSQL 16.2 Patch', severity: 'Medium', status: 'Deployed', category: 'Database', affectedAssets: 2, deployedDate: new Date('2026-03-01') },
    { tenantId: tenant.id, patchId: 'KB5024678', title: 'Windows Print Spooler Fix', severity: 'Low', status: 'Deployed', category: 'OS', affectedAssets: 5, deployedDate: new Date('2026-01-28') },
  ];
  for (const p of patches) { await prisma.patch.create({ data: p }); }
  console.log(`  ✅ Patches: ${patches.length} patch records created`);

  // ─── Scheduled Scans ──────────────────────────────────────────
  await prisma.scheduledScan.deleteMany();
  const schedules = [
    { tenantId: tenant.id, createdById: admin.id, name: 'Nightly Office Subnet Scan', subnet: '192.168.1.0/24', scanType: 'FULL_SCAN', schedule: '0 2 * * *', isActive: true, nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    { tenantId: tenant.id, createdById: admin.id, name: 'Weekly Server Room Scan', subnet: '10.0.1.0/24', scanType: 'TCP_PORT_SCAN', schedule: '0 3 * * 0', isActive: true, nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    { tenantId: tenant.id, createdById: admin.id, name: 'Hourly DMZ Ping Check', subnet: '172.16.0.0/24', scanType: 'PING_SWEEP', schedule: '0 * * * *', isActive: false, nextRunAt: null },
  ];
  for (const s of schedules) { await prisma.scheduledScan.create({ data: s }); }
  console.log(`  ✅ Scheduled Scans: ${schedules.length} scan schedules created`);

  // ─── Scan Credentials (Vault) ─────────────────────────────────
  await prisma.scanCredential.deleteMany();
  const crypto = require('crypto');
  const vaultKey = process.env.VAULT_ENCRYPTION_KEY || 'assetcommand-default-vault-key-32!';
  const encryptVault = (text: string): string => {
    const key = crypto.scryptSync(vaultKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(text, 'utf8', 'hex');
    enc += cipher.final('hex');
    return iv.toString('hex') + ':' + enc;
  };
  const creds = [
    { tenantId: tenant.id, createdById: admin.id, name: 'Windows Domain Admin', type: 'WMI', encryptedData: encryptVault(JSON.stringify({ username: 'ACME\\admin', password: '********' })), scope: { subnets: ['192.168.1.0/24'] } },
    { tenantId: tenant.id, createdById: admin.id, name: 'Linux SSH Key', type: 'SSH_KEY', encryptedData: encryptVault(JSON.stringify({ username: 'root', privateKey: '-----BEGIN RSA PRIVATE KEY-----...' })), scope: { subnets: ['10.0.1.0/24'] } },
    { tenantId: tenant.id, createdById: admin.id, name: 'SNMP v2c - Core Switches', type: 'SNMP_V2C', encryptedData: encryptVault(JSON.stringify({ community: 'acme-private' })), scope: { subnets: ['10.0.0.0/16'] } },
  ];
  for (const c of creds) { await prisma.scanCredential.create({ data: c }); }
  console.log(`  ✅ Scan Credentials: ${creds.length} vault entries created`);

  // ─── Knowledge Base ───────────────────────────────────────────
  await prisma.knowledgeArticle.deleteMany();
  const articles = [
    { tenantId: tenant.id, authorId: admin.id, title: 'How to Request a New Laptop', content: '## Laptop Request Process\n\n1. Navigate to **Service Catalog** in the employee portal\n2. Select "New Hardware Request"\n3. Choose your laptop model from the approved list\n4. Fill in the justification and manager approval\n5. Submit the request — IT will process within 3-5 business days\n\n### Approved Models\n- Dell Latitude 5540\n- HP EliteBook 840 G10\n- MacBook Pro 14" M3\n\n> Note: All laptops come pre-configured with company security policies.', category: 'IT Support', tags: ['laptop', 'hardware', 'onboarding'], viewCount: 142, helpfulCount: 38 },
    { tenantId: tenant.id, authorId: admin.id, title: 'VPN Connection Troubleshooting', content: '## VPN Not Connecting?\n\n### Quick Fixes\n1. **Restart the VPN client** — Right-click tray icon → Disconnect → Reconnect\n2. **Check your internet** — Ensure you have a stable connection\n3. **Clear DNS cache** — Run `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (macOS)\n4. **Update VPN client** — Check Software Center for updates\n\n### Still Not Working?\nOpen a ticket with category **Network > VPN** and include:\n- Error message screenshot\n- Your IP address (`ipconfig` / `ifconfig`)\n- Time of last successful connection', category: 'Network', tags: ['vpn', 'network', 'troubleshooting'], viewCount: 89, helpfulCount: 24 },
    { tenantId: tenant.id, authorId: admin.id, title: 'Password Reset Policy', content: '## Password Requirements\n\n- Minimum 12 characters\n- At least 1 uppercase, 1 lowercase, 1 number, 1 special character\n- Cannot reuse last 12 passwords\n- Must change every 90 days\n- Account locks after 5 failed attempts (15-minute lockout)\n\n## How to Reset\n1. Go to https://sso.acme.com/reset\n2. Enter your email\n3. Check your inbox for the reset link\n4. Set a new password meeting the requirements above\n\n> Contact IT if you need an admin reset.', category: 'Security', tags: ['password', 'security', 'account'], viewCount: 256, helpfulCount: 67 },
    { tenantId: tenant.id, authorId: admin.id, title: 'Printer Setup Guide', content: '## Adding a Network Printer\n\n### Windows\n1. Open **Settings > Printers & Scanners**\n2. Click **Add Printer**\n3. Select from the discovered printers or enter the IP address\n4. Install the driver when prompted\n\n### macOS\n1. Open **System Settings > Printers & Scanners**\n2. Click **+** to add printer\n3. Select the printer from the list or enter IP\n\n### Floor Printer IPs\n| Floor | Printer | IP |\n|-------|---------|----|\n| 1F | HP LaserJet Pro | 10.0.10.50 |\n| 2F | Canon imageCLASS | 10.0.10.51 |\n| 3F | HP Color LaserJet | 10.0.10.52 |', category: 'IT Support', tags: ['printer', 'setup', 'hardware'], viewCount: 67, helpfulCount: 15 },
    { tenantId: tenant.id, authorId: admin.id, title: 'Asset Check-in/Check-out Procedure', content: '## Shared Asset Management\n\nShared assets (conference room laptops, projectors, cameras) must be properly checked in/out.\n\n### Check-Out\n1. Go to **My Assets** in the employee portal\n2. Click **Request Shared Asset**\n3. Select the asset and desired timeframe\n4. Get manager approval if > 24 hours\n\n### Check-In\n1. Return the asset to the designated location\n2. Go to **My Assets** and click **Return Asset**\n3. Report any damage or issues\n\n> **Note:** Unreturned assets after 48 hours will trigger an automated reminder.', category: 'General', tags: ['asset', 'checkin', 'checkout', 'shared'], viewCount: 34, helpfulCount: 8 },
    {
      tenantId: tenant.id,
      authorId: admin.id,
      title: 'Guide to Network Discovery Scans',
      content: '## Network Discovery Scanning Overview\n\nNetwork discovery scanning identifies active physical, virtual, and network devices within your environment. By scanning IP subnets, you can audit your IT perimeter and dynamically update the Asset Management CMDB.\n\n### Discovery Scanning Methods\n\n1. **ICMP Ping Sweep**\n   - Standard protocol to sweep subnets quickly.\n   - **How it works:** Pings consecutive hosts inside the subnet.\n   - **Limitation:** Cloud-isolated networks or firewalls blocking ICMP (Ping) requests may report 0 hosts.\n\n2. **TCP Socket Probing Fallback**\n   - Automatically triggered if ICMP sweeps return 0 devices.\n   - **How it works:** Probes common infrastructure ports (e.g. 22 SSH, 80 HTTP, 135 RPC, 443 HTTPS, 445 SMB) in parallel.\n   - **Advantage:** Discovers hosts that are active but configured to ignore standard ICMP pings.\n\n3. **SNMP Deep Discovery**\n   - Queries routers, switches, and network printers.\n   - Retrieves structural hardware details (e.g. sysDescr, ports list, MAC addresses, and vendor descriptions) to automatically classify network device types and operating systems.\n\n### Configuration & Workflow\n\n- **Target Subnet:** Define the sweep scope (e.g., `192.168.1.0/24` or `10.0.0.0/24`).\n- **Credentials Vault:** Set SSH keys, WMI domain credentials, or SNMP community strings in the Vault to authorize deep operating system and inventory fingerprinting.\n- **Review and Approval Flow:** Discovered devices do not auto-pollute your active inventory. They are held in **Pending Review** status.\n  - **Merge:** If the IP or hostname matches an existing device, it merges updates.\n  - **Approve:** Converts a discovered device into a managed asset tag.\n  - **Ignore/Archive:** Dismisses rogue or non-essential assets.',
      category: 'Network & Discovery',
      tags: ['network', 'scanning', 'discovery', 'admin'],
      viewCount: 120,
      helpfulCount: 45
    },
    {
      tenantId: tenant.id,
      authorId: admin.id,
      title: 'Deploying and Pairing LAN Discovery Agents',
      content: '## Deploying On-Premise LAN Discovery Agents\n\nIf your main application server is hosted in an isolated cloud environment (such as Railway or Vercel), it cannot directly communicate with or sweep your local office subnet. Introducing the **LAN Discovery Agent** solves this isolation gap by serving as an on-premise proxy.\n\n### How Agent-Delegated Scanning Works\n\n1. **Agent Heartbeat:** When you run the agent on an office machine, it checks in with the primary server every 60 seconds (or custom interval).\n2. **Discovery Delegation:** If a network scan is scheduled or manually triggered, the server flags it as `PENDING`. Upon the next agent heartbeat check-in, the server delegates the `RUN_SCAN` instruction containing the subnet scope and scan preferences to the agent.\n3. **LAN Scan Sweep:** The agent executes the active ping/TCP sweep and port classification locally within the office network.\n4. **Secure Result Upload:** Once complete, the agent uploads the discovered hosts list via HTTP/HTTPS back to the server\'s scan result portal, where details are evaluated for asset deduplication and security risk scoring.\n\n### Step-by-Step Installation\n\n#### 1. Download the Paired Package\n- Navigate to the **Discovery** module inside the dashboard.\n- Click **Download Agent CLI** to fetch a pre-packaged ZIP tailored for your active tenant workspace.\n\n#### 2. Running on Linux / macOS\nExtract the zip package and execute the startup script:\n```bash\ntar -xvf agent-package.tar.gz\ncd agent\n# Run the pairing and execution command\nnode reconapm-agent.js --server https://your-server.com --user your-email@corp.com --pass YourPassword@123\n```\n\n#### 3. Running on Windows\nExtract the folder and run the command in PowerShell or Command Prompt:\n```powershell\nnode reconapm-agent.js --server https://your-server.com --user your-email@corp.com --pass YourPassword@123\n```\n\n### Troubleshooting\n\n- **Node Runtime Sandboxing:** The agent has zero physical dependencies (no `npm install` required). Ensure Node.js (v16+) is installed on the host machine.\n- **Heartbeat Errors (401/403):** Verify that the user credentials specified have the `Tenant Admin` or `IT Admin` role assigned.\n- **0 Devices Found:** Ensure the network interfaces configured on the host machine have access to the targeted subnet. If local OS firewalls block outbound pings, the agent automatically falls back to parallel TCP probes.',
      category: 'Network & Discovery',
      tags: ['agent', 'deployment', 'setup', 'troubleshooting'],
      viewCount: 145,
      helpfulCount: 52
    }
  ];
  for (const a of articles) { await prisma.knowledgeArticle.create({ data: a }); }
  console.log(`  ✅ Knowledge Base: ${articles.length} articles created`);

  // ─── SLA Policies ───────────────────────────────────────────────
  const slaPolicies = [
    { tenantId: tenant.id, name: 'Critical SLA', priority: 'CRITICAL', responseHours: 1, resolutionHours: 4, escalationHours: 2, isDefault: true },
    { tenantId: tenant.id, name: 'High SLA', priority: 'HIGH', responseHours: 4, resolutionHours: 8, escalationHours: 6, isDefault: true },
    { tenantId: tenant.id, name: 'Medium SLA', priority: 'MEDIUM', responseHours: 8, resolutionHours: 24, escalationHours: 16, isDefault: true },
    { tenantId: tenant.id, name: 'Low SLA', priority: 'LOW', responseHours: 24, resolutionHours: 72, escalationHours: 48, isDefault: true },
  ];
  for (const p of slaPolicies) { await prisma.slaPolicy.create({ data: p }); }
  console.log(`  ✅ SLA Policies: ${slaPolicies.length} policies created`);

  // ─── Update existing automation rules with cooldown values ─────
  await prisma.automationRule.updateMany({
    where: { tenantId: tenant.id, cooldownMinutes: 0 },
    data: { cooldownMinutes: 15 },
  });
  console.log('  ✅ Automation Rules: cooldown values applied (15 min default)');
 
  // ─── Fleet Telematics Seeding ────────────────────────────────────
  console.log('  🛞 Seeding Fleet Telematics (Trips & Live Coordinates)...');
  await prisma.trip.deleteMany();
  await prisma.gpsTelemetry.deleteMany();

  const vehicle = await prisma.asset.findFirst({
    where: { assetTag: 'VEH-001', tenantId: tenant.id },
  });

  if (vehicle) {
    // Seed 3 historical trips in Mumbai
    const route1 = [
      { lat: 19.0974, lng: 72.8752, speed: 40, timestamp: new Date(Date.now() - 3 * 3600 * 1000 - 30 * 60 * 1000) },
      { lat: 19.0886, lng: 72.8680, speed: 55, timestamp: new Date(Date.now() - 3 * 3600 * 1000 - 25 * 60 * 1000) },
      { lat: 19.0768, lng: 72.8601, speed: 60, timestamp: new Date(Date.now() - 3 * 3600 * 1000 - 20 * 60 * 1000) },
      { lat: 19.0682, lng: 72.8550, speed: 45, timestamp: new Date(Date.now() - 3 * 3600 * 1000 - 15 * 60 * 1000) },
      { lat: 19.0596, lng: 72.8641, speed: 30, timestamp: new Date(Date.now() - 3 * 3600 * 1000 - 10 * 60 * 1000) },
      { lat: 19.0620, lng: 72.8727, speed: 20, timestamp: new Date(Date.now() - 3 * 3600 * 1000) },
    ];
    await prisma.trip.create({
      data: {
        tenantId: tenant.id,
        assetId: vehicle.id,
        startTime: route1[0].timestamp,
        endTime: route1[route1.length - 1].timestamp,
        distanceKm: 8.5,
        maxSpeed: 60,
        avgSpeed: 41.6,
        startLocation: 'Chhatrapati Shivaji Maharaj International Airport (BOM)',
        endLocation: 'Bandra Kurla Complex (BKC)',
        routeCoords: route1,
      }
    });

    const route2 = [
      { lat: 19.0620, lng: 72.8727, speed: 30, timestamp: new Date(Date.now() - 2 * 3600 * 1000 - 45 * 60 * 1000) },
      { lat: 19.0330, lng: 72.8580, speed: 65, timestamp: new Date(Date.now() - 2 * 3600 * 1000 - 35 * 60 * 1000) },
      { lat: 18.9920, lng: 72.8150, speed: 80, timestamp: new Date(Date.now() - 2 * 3600 * 1000 - 25 * 60 * 1000) },
      { lat: 18.9580, lng: 72.8060, speed: 50, timestamp: new Date(Date.now() - 2 * 3600 * 1000 - 15 * 60 * 1000) },
      { lat: 18.9220, lng: 72.8340, speed: 25, timestamp: new Date(Date.now() - 2 * 3600 * 1000) },
    ];
    await prisma.trip.create({
      data: {
        tenantId: tenant.id,
        assetId: vehicle.id,
        startTime: route2[0].timestamp,
        endTime: route2[route2.length - 1].timestamp,
        distanceKm: 18.2,
        maxSpeed: 80,
        avgSpeed: 50,
        startLocation: 'Bandra Kurla Complex (BKC)',
        endLocation: 'Gateway of India, Colaba',
        routeCoords: route2,
      }
    });

    const activeRoute = [
      { lat: 19.1136, lng: 72.8697, speed: 0, fuel: 82.5 },
      { lat: 19.1150, lng: 72.8720, speed: 35, fuel: 82.1 },
      { lat: 19.1180, lng: 72.8750, speed: 45, fuel: 81.8 },
      { lat: 19.1220, lng: 72.8790, speed: 50, fuel: 81.5 },
      { lat: 19.1250, lng: 72.8830, speed: 20, fuel: 81.2 },
    ];

    for (let j = 0; j < activeRoute.length; j++) {
      await prisma.gpsTelemetry.create({
        data: {
          tenantId: tenant.id,
          assetId: vehicle.id,
          latitude: activeRoute[j].lat,
          longitude: activeRoute[j].lng,
          speed: activeRoute[j].speed,
          fuelLevel: activeRoute[j].fuel,
          collectedAt: new Date(Date.now() - (activeRoute.length - 1 - j) * 60 * 1000),
        }
      });
    }
    console.log('  ✅ Fleet Telematics: Trips and telemetry points successfully seeded');
  }

  // ─── Dynamic Pricing & System Config ───────────────────────────────
  console.log('  🌱 Seeding system-wide pricing settings...');
  await prisma.systemConfig.create({
    data: {
      key: 'pricing_settings',
      value: {
        starter: {
          priceUSD: 0,
          priceINR: 0,
          discountPercent: 0,
          features: ["IT Asset Tracking", "4 Users", "Basic Reports", "Email Support", "Community Access"]
        },
        professional: {
          priceUSD: 199,
          priceINR: 16999,
          discountPercent: 50,
          features: ["All 12 Modules", "Unlimited Users", "Vulnerability Scanning", "ITSM + SLA Engine", "Priority Support", "API Access"]
        },
        enterprise: {
          priceUSD: 499,
          priceINR: 39999,
          discountPercent: 50,
          features: ["Everything in Pro", "On-Premise Deploy", "SSO / SAML / LDAP", "Dedicated CSM", "Custom SLA", "White-Label Option"]
        },
        custom: {
          priceUSD: -1,
          priceINR: -1,
          discountPercent: 0,
          features: ["Everything in Enterprise", "Custom asset limits", "Negotiated pricing", "Dedicated account manager", "Custom SLA", "White-label option", "Priority onboarding"]
        }
      }
    }
  });
  console.log('  ✅ System Config: Pricing configurations successfully seeded');

  console.log('\n🎉 Seed complete!');
  console.log('   Login: admin@acme.com / Admin@123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
