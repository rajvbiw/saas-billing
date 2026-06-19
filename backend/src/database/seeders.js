const { sharedSequelize } = require('./shared-db');
const { Plan, Tenant, Subscription, UsageRecord } = require('../models/shared');
const { getTenantDbConnection } = require('../tenant/connection-factory');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

async function runSeeder() {
  console.log('--- Starting Platform Database Seeding ---');

  try {
    // 1. Sync Shared Database
    await sharedSequelize.sync({ force: true });
    console.log('✔ Shared database schema synchronized.');

    // 2. Create Plans
    const starterPlan = await Plan.create({
      name: 'Starter',
      stripe_price_id: 'price_starter_id',
      billing_interval: 'monthly',
      price_monthly: 29.00,
      price_yearly: 290.00,
      max_users: 5,
      max_api_calls_per_month: 10000,
      max_storage_gb: 10,
      features: ['5 Users Included', '10,000 API Calls/mo', '10GB Storage space', 'Standard Support'],
      is_active: true
    });

    const proPlan = await Plan.create({
      name: 'Pro',
      stripe_price_id: 'price_pro_id',
      billing_interval: 'monthly',
      price_monthly: 99.00,
      price_yearly: 990.00,
      max_users: 25,
      max_api_calls_per_month: 100000,
      max_storage_gb: 100,
      features: ['25 Users Included', '100,000 API Calls/mo', '100GB Storage space', 'Priority Email Support', 'Custom Fields'],
      is_active: true
    });

    const enterprisePlan = await Plan.create({
      name: 'Enterprise',
      stripe_price_id: 'price_enterprise_id',
      billing_interval: 'monthly',
      price_monthly: 299.00,
      price_yearly: 2990.00,
      max_users: 9999,
      max_api_calls_per_month: 1000000,
      max_storage_gb: 1000,
      features: ['Unlimited Users', '1,000,000 API Calls/mo', '1TB Storage space', '24/7 Dedicated Support', 'SLA Guarantee', 'Dedicated DB Node'],
      is_active: true
    });

    console.log('✔ Default plans (Starter, Pro, Enterprise) seeded.');

    // 3. Demo Tenants Details
    const demoTenants = [
      {
        slug: 'acme',
        company_name: 'Acme Corporation',
        owner_name: 'John Doe',
        owner_email: 'john@acme.com',
        subdomain: 'acme.saas.example.com',
        plan: proPlan,
        status: 'active',
        stripe_customer_id: 'cus_acme123',
        stripe_subscription_id: 'sub_acme123'
      },
      {
        slug: 'globex',
        company_name: 'Globex Holdings',
        owner_name: 'Hank Scorpio',
        owner_email: 'hank@globex.com',
        subdomain: 'globex.saas.example.com',
        plan: starterPlan,
        status: 'trialing',
        stripe_customer_id: 'cus_globex123',
        stripe_subscription_id: 'sub_globex123'
      },
      {
        slug: 'initech',
        company_name: 'Initech Systems',
        owner_name: 'Peter Gibbons',
        owner_email: 'peter@initech.com',
        subdomain: 'initech.saas.example.com',
        plan: enterprisePlan,
        status: 'active',
        stripe_customer_id: 'cus_initech123',
        stripe_subscription_id: 'sub_initech123'
      }
    ];

    const passwordHash = await bcrypt.hash('password123', 10);

    for (const t of demoTenants) {
      const dbName = `tenant_${t.slug}_db`;
      const dbHost = process.env.DB_HOST || '127.0.0.1';

      // Register tenant in shared database
      const tenant = await Tenant.create({
        slug: t.slug,
        company_name: t.company_name,
        owner_name: t.owner_name,
        owner_email: t.owner_email,
        subdomain: t.subdomain,
        plan_id: t.plan.id,
        status: t.status,
        stripe_customer_id: t.stripe_customer_id,
        stripe_subscription_id: t.stripe_subscription_id,
        db_name: dbName,
        db_host: dbHost,
        namespace: `tenant-${t.slug}`,
        trial_ends_at: t.status === 'trialing' ? new Date(Date.now() + 10 * 24 * 3600 * 1000) : null
      });

      // Create subscription details
      await Subscription.create({
        tenant_id: tenant.id,
        plan_id: t.plan.id,
        stripe_subscription_id: t.stripe_subscription_id,
        status: t.status,
        current_period_start: new Date(Date.now() - 20 * 24 * 3600 * 1000),
        current_period_end: new Date(Date.now() + 10 * 24 * 3600 * 1000)
      });

      // Seed usage aggregates in the shared database
      const now = new Date();
      const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      await UsageRecord.create({
        tenant_id: tenant.id,
        metric: 'api_calls',
        quantity: t.slug === 'acme' ? 8400 : t.slug === 'globex' ? 340 : 89200,
        billing_period: billingPeriod
      });

      await UsageRecord.create({
        tenant_id: tenant.id,
        metric: 'storage_gb',
        quantity: t.slug === 'acme' ? 8 : t.slug === 'globex' ? 2 : 24,
        billing_period: billingPeriod
      });

      // Create dynamic schema for individual tenant database
      await sharedSequelize.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
      const { sequelize: tenantSequelize, models } = getTenantDbConnection(dbName, dbHost);
      await tenantSequelize.sync({ force: true });

      // Seed 3 users: Owner, Admin, Member
      const usersData = [
        { name: t.owner_name, email: t.owner_email, role: 'owner' },
        { name: `Admin User`, email: `admin@${t.slug}.com`, role: 'admin' },
        { name: `Staff Member`, email: `staff@${t.slug}.com`, role: 'member' }
      ];

      const createdUsers = [];
      for (const u of usersData) {
        const userObj = await models.User.create({
          name: u.name,
          email: u.email,
          password_hash: passwordHash,
          role: u.role,
          is_active: true
        });
        createdUsers.push(userObj);
      }

      // Seed 2 API keys
      const keysData = [
        { name: 'Production API Key', user: createdUsers[0] },
        { name: 'Testing Access Token', user: createdUsers[1] }
      ];

      const createdKeys = [];
      for (const k of keysData) {
        const plainKey = 'sb_live_' + crypto.randomBytes(24).toString('hex');
        const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
        const keyObj = await models.ApiKey.create({
          user_id: k.user.id,
          name: k.name,
          key_hash: keyHash,
          prefix: plainKey.substring(0, 12),
          is_active: true
        });
        createdKeys.push(keyObj);
      }

      // Seed 30 days of api usage logs
      const endpoints = ['/api/v1/customers', '/api/v1/invoices', '/api/v1/payments', '/api/v1/auth/token'];
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];
      const statuses = [200, 201, 400, 401, 500];

      for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
        const date = new Date();
        date.setDate(date.getDate() - dayOffset);

        // Generate between 5 and 20 entries per day
        const entriesCount = Math.floor(Math.random() * 15) + 5;
        for (let entryIdx = 0; entryIdx < entriesCount; entryIdx++) {
          const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
          const method = methods[Math.floor(Math.random() * methods.length)];
          const status_code = statuses[Math.random() < 0.85 ? 0 : Math.floor(Math.random() * statuses.length)];
          const response_time_ms = Math.floor(Math.random() * 450) + 50;

          await models.ApiUsageLog.create({
            api_key_id: createdKeys[Math.floor(Math.random() * createdKeys.length)].id,
            endpoint,
            method,
            status_code,
            response_time_ms,
            ip_address: '192.168.1.' + Math.floor(Math.random() * 254),
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            created_at: date
          });
        }
      }

      // Seed 1 activity log entry
      await models.ActivityLog.create({
        user_id: createdUsers[0].id,
        action: 'tenant_onboarded',
        resource: 'Tenant',
        metadata: { company_name: t.company_name }
      });

      console.log(`✔ Seeded tenant isolated DB: ${dbName}`);
    }

    console.log('--- Database Seeding Complete ---');
    process.exit(0);
  } catch (error) {
    console.error('Fatal database seeding failure:', error);
    process.exit(1);
  }
}

// Check if run directly
if (require.main === module) {
  runSeeder();
}

module.exports = {
  runSeeder
};
