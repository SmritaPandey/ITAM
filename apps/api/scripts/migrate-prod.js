const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Add email columns
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false');
    await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_expiry TIMESTAMPTZ');
    await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false');
    console.log('✅ User columns added');
  } catch(e) { console.log('User columns:', e.message); }

  // 2. Mark ALL existing users as verified
  await prisma.$executeRawUnsafe('UPDATE users SET email_verified = true');
  console.log('✅ All users marked as email_verified');

  // 3. Create subscriptions table
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plan TEXT NOT NULL DEFAULT 'STARTER',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
        end_date TIMESTAMPTZ,
        trial_ends_at TIMESTAMPTZ,
        mrr DECIMAL(10,2),
        billing_cycle TEXT DEFAULT 'MONTHLY',
        discount_percent DECIMAL(5,2) DEFAULT 0,
        discount_note TEXT,
        custom_price DECIMAL(10,2),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✅ subscriptions table created');
  } catch(e) { console.log('subscriptions:', e.message); }

  // 4. Create payments table
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        method TEXT,
        reference_id TEXT,
        invoice_number TEXT,
        notes TEXT,
        paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_payments_sub ON payments(subscription_id)');
    console.log('✅ payments table created');
  } catch(e) { console.log('payments:', e.message); }

  // 5. Create platform tenant
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
  console.log('✅ Platform tenant:', platformTenant.id);

  // 6. Create owner role
  let ownerRole = await prisma.role.findFirst({ where: { tenantId: platformTenant.id, name: 'Platform Owner' } });
  if (!ownerRole) {
    ownerRole = await prisma.role.create({
      data: { tenantId: platformTenant.id, name: 'Platform Owner', permissions: ['*'] },
    });
  }
  console.log('✅ Owner role:', ownerRole.id);

  // 7. Create owner account
  const hash = await bcrypt.hash('Admin@123', 12);
  const existing = await prisma.user.findFirst({ where: { email: 'smrita@neurqai.com' } });
  if (!existing) {
    await prisma.user.create({
      data: {
        tenantId: platformTenant.id, email: 'smrita@neurqai.com', passwordHash: hash,
        firstName: 'Smrita', lastName: 'Pandey', roleId: ownerRole.id,
        status: 'ACTIVE', isSuperAdmin: true, emailVerified: true,
      },
    });
    console.log('✅ Owner created: smrita@neurqai.com');
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: { isSuperAdmin: true, emailVerified: true },
    });
    console.log('✅ Owner updated:', existing.id);
  }

  // 8. Remove superadmin from demo admin
  const demoAdmin = await prisma.user.findFirst({ where: { email: 'admin@acme.com' } });
  if (demoAdmin) {
    await prisma.user.update({ where: { id: demoAdmin.id }, data: { isSuperAdmin: false } });
    console.log('✅ Removed superAdmin from admin@acme.com');
  }

  console.log('All done!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
