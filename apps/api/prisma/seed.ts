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
    },
  });
  const itAdmin = await prisma.user.create({
    data: {
      tenantId: tenant.id, email: 'itadmin@acme.com', passwordHash,
      firstName: 'Raj', lastName: 'Sharma', roleId: itAdminRole.id,
      departmentId: itDept.id, siteId: hq.id, status: 'ACTIVE',
    },
  });
  const employee1 = await prisma.user.create({
    data: {
      tenantId: tenant.id, email: 'priya@acme.com', passwordHash,
      firstName: 'Priya', lastName: 'Patel', roleId: employeeRole.id,
      departmentId: hrDept.id, siteId: hq.id, status: 'ACTIVE',
    },
  });
  const employee2 = await prisma.user.create({
    data: {
      tenantId: tenant.id, email: 'amit@acme.com', passwordHash,
      firstName: 'Amit', lastName: 'Kumar', roleId: employeeRole.id,
      departmentId: opsDept.id, siteId: branch.id, status: 'ACTIVE',
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
  const assets = [
    {
      tenantId: tenant.id, assetTypeId: laptopType.id, name: 'Dell Latitude 5540', assetTag: 'LAP-001',
      serialNumber: 'DL5540-2024-001', manufacturer: 'Dell', model: 'Latitude 5540',
      status: 'ACTIVE' as const, siteId: hq.id, departmentId: itDept.id, assignedToId: employee1.id,
      ipAddress: '10.0.1.101', macAddress: 'AA:BB:CC:DD:EE:01', hostname: 'PRIYA-LAPTOP',
      purchasePrice: 85000, procurementDate: new Date('2024-01-15'), warrantyExpiry: new Date('2027-01-15'),
      discoverySource: 'AGENT' as const, tags: ['laptop', 'dell', 'employee'],
    },
    {
      tenantId: tenant.id, assetTypeId: laptopType.id, name: 'Lenovo ThinkPad T14', assetTag: 'LAP-002',
      serialNumber: 'LTP14-2024-002', manufacturer: 'Lenovo', model: 'ThinkPad T14 Gen 4',
      status: 'ACTIVE' as const, siteId: branch.id, departmentId: opsDept.id, assignedToId: employee2.id,
      ipAddress: '10.0.2.105', macAddress: 'AA:BB:CC:DD:EE:02', hostname: 'AMIT-LAPTOP',
      purchasePrice: 92000, procurementDate: new Date('2024-03-10'), warrantyExpiry: new Date('2027-03-10'),
      discoverySource: 'AGENT' as const, tags: ['laptop', 'lenovo', 'employee'],
    },
    {
      tenantId: tenant.id, assetTypeId: serverType.id, name: 'HPE ProLiant DL380', assetTag: 'SRV-001',
      serialNumber: 'HPE380-2023-001', manufacturer: 'HPE', model: 'ProLiant DL380 Gen10 Plus',
      status: 'ACTIVE' as const, siteId: hq.id, departmentId: itDept.id, managedById: itAdmin.id,
      ipAddress: '10.0.0.10', macAddress: 'AA:BB:CC:DD:EE:10', hostname: 'SRV-DC-01',
      purchasePrice: 450000, procurementDate: new Date('2023-06-01'), warrantyExpiry: new Date('2026-06-01'),
      discoverySource: 'WMI' as const, room: 'Server Room', rack: 'R1', position: 'U1-U4',
      tags: ['server', 'hpe', 'domain-controller'],
    },
    {
      tenantId: tenant.id, assetTypeId: printerType.id, name: 'HP LaserJet Pro', assetTag: 'PRT-001',
      serialNumber: 'HPLJ-2024-001', manufacturer: 'HP', model: 'LaserJet Pro MFP M428fdw',
      status: 'ACTIVE' as const, siteId: hq.id, departmentId: hrDept.id,
      ipAddress: '10.0.1.200', macAddress: 'AA:BB:CC:DD:EE:20', hostname: 'PRT-HR-01',
      purchasePrice: 35000, procurementDate: new Date('2024-02-20'),
      discoverySource: 'SNMP' as const, floor: '2', room: 'HR Office',
      tags: ['printer', 'hp', 'shared'],
    },
    {
      tenantId: tenant.id, assetTypeId: switchType.id, name: 'Cisco Catalyst 9200', assetTag: 'SW-001',
      serialNumber: 'CSC9200-2023-001', manufacturer: 'Cisco', model: 'Catalyst 9200-48P',
      status: 'ACTIVE' as const, siteId: hq.id, departmentId: itDept.id, managedById: itAdmin.id,
      ipAddress: '10.0.0.1', macAddress: 'AA:BB:CC:DD:EE:30', hostname: 'SW-CORE-01',
      purchasePrice: 180000, procurementDate: new Date('2023-04-15'),
      discoverySource: 'SNMP' as const, room: 'Server Room', rack: 'R2', position: 'U1',
      tags: ['switch', 'cisco', 'core'],
    },
    {
      tenantId: tenant.id, assetTypeId: furnitureType.id, name: 'Standing Desk - Ergonomic', assetTag: 'FRN-001',
      manufacturer: 'FlexiSpot', model: 'E7 Pro',
      status: 'ACTIVE' as const, siteId: hq.id, departmentId: hrDept.id, assignedToId: employee1.id,
      purchasePrice: 28000, procurementDate: new Date('2024-05-01'),
      discoverySource: 'MANUAL' as const, floor: '2', room: 'HR Office',
      tags: ['furniture', 'desk', 'ergonomic'],
    },
    {
      tenantId: tenant.id, assetTypeId: vehicleType.id, name: 'Toyota Innova Crysta', assetTag: 'VEH-001',
      serialNumber: 'TIC-MH02-001', manufacturer: 'Toyota', model: 'Innova Crysta 2.4 GX',
      status: 'ACTIVE' as const, siteId: hq.id, departmentId: opsDept.id,
      latitude: 19.1136, longitude: 72.8697,
      purchasePrice: 2100000, procurementDate: new Date('2023-11-01'),
      discoverySource: 'MANUAL' as const,
      customFields: { registrationNumber: 'MH-02-AB-1234', fuelType: 'Diesel', seatingCapacity: 7 },
      tags: ['vehicle', 'toyota', 'fleet'],
    },
  ];

  for (const assetData of assets) {
    await prisma.asset.create({ data: assetData as any });
  }
  console.log(`  ✅ Assets: ${assets.length} sample assets created`);

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

  // ─── Monitoring: Cameras ───────────────────────────────────────
  const cameras = [
    { tenantId: tenant.id, type: 'CAMERA' as const, name: 'Main Entrance - Cam 01', location: 'Building A, Ground Floor', ipAddress: '10.0.10.1', status: 'ONLINE', config: { cameraType: 'PTZ', resolution: '4K', recording: true }, metrics: { storage: 87, health: 98 }, lastSeen: new Date() },
    { tenantId: tenant.id, type: 'CAMERA' as const, name: 'Server Room - Cam 02', location: 'Building A, 1st Floor', ipAddress: '10.0.10.2', status: 'ONLINE', config: { cameraType: 'Fixed', resolution: '1080p', recording: true }, metrics: { storage: 72, health: 100 }, lastSeen: new Date() },
    { tenantId: tenant.id, type: 'CAMERA' as const, name: 'Parking Lot - Cam 03', location: 'Outdoor, North Side', ipAddress: '10.0.10.3', status: 'ONLINE', config: { cameraType: 'PTZ', resolution: '4K', recording: true }, metrics: { storage: 91, health: 95 }, lastSeen: new Date() },
    { tenantId: tenant.id, type: 'CAMERA' as const, name: 'Lobby - Cam 04', location: 'Building A, Ground Floor', ipAddress: '10.0.10.4', status: 'ONLINE', config: { cameraType: 'Dome', resolution: '1080p', recording: true }, metrics: { storage: 65, health: 99 }, lastSeen: new Date() },
    { tenantId: tenant.id, type: 'CAMERA' as const, name: 'Loading Dock - Cam 05', location: 'Building B, Ground Floor', ipAddress: '10.0.10.5', status: 'OFFLINE', config: { cameraType: 'Bullet', resolution: '720p', recording: false }, metrics: { storage: 0, health: 0 }, lastSeen: null },
    { tenantId: tenant.id, type: 'CAMERA' as const, name: 'Warehouse - Cam 06', location: 'Building C', ipAddress: '10.0.10.6', status: 'ONLINE', config: { cameraType: 'PTZ', resolution: '4K', recording: true }, metrics: { storage: 45, health: 97 }, lastSeen: new Date() },
  ];
  for (const c of cameras) { await prisma.monitoredDevice.create({ data: c }); }
  console.log(`  ✅ CCTV Cameras: ${cameras.length} cameras created`);

  // ─── Monitoring: Network Devices ───────────────────────────────
  const netDevices = [
    { tenantId: tenant.id, type: 'NETWORK_DEVICE' as const, name: 'SW-CORE-01', location: 'DC Rack A1', ipAddress: '10.0.0.1', status: 'ONLINE', config: { deviceType: 'Switch', ports: '48/48' }, metrics: { latency: 1.2, throughput: 780, uptime: '45d 12h', alerts: 0 }, lastSeen: new Date() },
    { tenantId: tenant.id, type: 'NETWORK_DEVICE' as const, name: 'FW-EDGE-01', location: 'DC Rack A2', ipAddress: '10.0.0.2', status: 'ONLINE', config: { deviceType: 'Firewall', ports: '12/12' }, metrics: { latency: 0.8, throughput: 950, uptime: '120d 5h', alerts: 0 }, lastSeen: new Date() },
    { tenantId: tenant.id, type: 'NETWORK_DEVICE' as const, name: 'AP-FLOOR2-01', location: '2nd Floor', ipAddress: '10.0.1.50', status: 'ONLINE', config: { deviceType: 'Access Point', ports: '—' }, metrics: { latency: 3.1, throughput: 320, uptime: '30d 8h', alerts: 1 }, lastSeen: new Date() },
    { tenantId: tenant.id, type: 'NETWORK_DEVICE' as const, name: 'RTR-BRANCH-01', location: 'Branch', ipAddress: '10.0.2.1', status: 'ONLINE', config: { deviceType: 'Router', ports: '8/8' }, metrics: { latency: 2.5, throughput: 560, uptime: '90d 2h', alerts: 0 }, lastSeen: new Date() },
    { tenantId: tenant.id, type: 'NETWORK_DEVICE' as const, name: 'SW-DIST-02', location: 'DC Rack B1', ipAddress: '10.0.1.2', status: 'WARNING', config: { deviceType: 'Switch', ports: '24/24' }, metrics: { latency: 5.8, throughput: 420, uptime: '15d 1h', alerts: 2 }, lastSeen: new Date() },
    { tenantId: tenant.id, type: 'NETWORK_DEVICE' as const, name: 'AP-FLOOR3-01', location: '3rd Floor', ipAddress: '10.0.1.51', status: 'OFFLINE', config: { deviceType: 'Access Point', ports: '—' }, metrics: { latency: 0, throughput: 0, uptime: '—', alerts: 3 }, lastSeen: null },
  ];
  for (const d of netDevices) { await prisma.monitoredDevice.create({ data: d }); }
  console.log(`  ✅ NMS Devices: ${netDevices.length} network devices created`);

  // ─── Monitoring: Virtual Machines ──────────────────────────────
  const vms = [
    { tenantId: tenant.id, type: 'VIRTUAL_MACHINE' as const, name: 'VM-DC-01', location: 'ESXi-01', ipAddress: '10.0.5.1', status: 'ONLINE', config: { os: 'Windows Server 2022', purpose: 'Domain Controller', host: 'ESXi-01' }, metrics: { cpu: 35, ram: 62, disk: 45, uptime: '120d 5h' } },
    { tenantId: tenant.id, type: 'VIRTUAL_MACHINE' as const, name: 'VM-APP-01', location: 'ESXi-01', ipAddress: '10.0.5.2', status: 'ONLINE', config: { os: 'Ubuntu 22.04 LTS', purpose: 'Application Server', host: 'ESXi-01' }, metrics: { cpu: 72, ram: 85, disk: 68, uptime: '45d 12h' } },
    { tenantId: tenant.id, type: 'VIRTUAL_MACHINE' as const, name: 'VM-DB-01', location: 'ESXi-02', ipAddress: '10.0.5.3', status: 'ONLINE', config: { os: 'Ubuntu 22.04 LTS', purpose: 'Database Server', host: 'ESXi-02' }, metrics: { cpu: 48, ram: 78, disk: 82, uptime: '90d 2h' } },
    { tenantId: tenant.id, type: 'VIRTUAL_MACHINE' as const, name: 'VDI-HR-01', location: 'ESXi-02', ipAddress: '10.0.5.10', status: 'ONLINE', config: { os: 'Windows 11 Pro', purpose: 'HR Desktop', host: 'ESXi-02', user: 'Priya Patel' }, metrics: { cpu: 22, ram: 45, disk: 30, uptime: '8d 3h' } },
    { tenantId: tenant.id, type: 'VIRTUAL_MACHINE' as const, name: 'VDI-DEV-01', location: 'ESXi-01', ipAddress: '10.0.5.11', status: 'STOPPED', config: { os: 'Windows 11 Pro', purpose: 'Dev Desktop', host: 'ESXi-01', user: 'Amit Kumar' }, metrics: { cpu: 0, ram: 0, disk: 25, uptime: '—' } },
    { tenantId: tenant.id, type: 'VIRTUAL_MACHINE' as const, name: 'VM-BACKUP-01', location: 'ESXi-02', ipAddress: '10.0.5.4', status: 'ONLINE', config: { os: 'CentOS 9 Stream', purpose: 'Backup Server', host: 'ESXi-02' }, metrics: { cpu: 12, ram: 35, disk: 91, uptime: '180d 1h' } },
  ];
  for (const v of vms) { await prisma.monitoredDevice.create({ data: v }); }
  console.log(`  ✅ Virtual Machines: ${vms.length} VMs created`);

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

  console.log('\n🎉 Seed complete!');
  console.log('   Login: admin@acme.com / Admin@123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
