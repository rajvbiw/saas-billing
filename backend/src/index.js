const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');
const Redis = require('ioredis');
const rateLimit = require('express-rate-limit');
const { sharedSequelize } = require('./database/shared-db');
const { Plan } = require('./models/shared');
const { initSocketServer } = require('./services/socket');
const apiRouter = require('./routes/api');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const SOCKET_PORT = process.env.SOCKET_PORT || 5001;

// ==========================================
// 1. Redis Session / Cache Setup
// ==========================================
const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redisClient.on('connect', () => console.log('✔ Redis connection established.'));
redisClient.on('error', (err) => console.warn('Redis connection warning (running with mock session cache):', err.message));

// ==========================================
// 2. Global Middlewares
// ==========================================
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for local web dashboard development compatibility
}));
app.use(cors({
  origin: '*', // Customize allowed origins in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug']
}));
app.use(morgan('dev'));

// Capture raw body for Stripe signature checks
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhooks/stripe')) {
      req.rawBody = buf.toString();
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

// Rate limiter for security
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Please try again after 15 minutes.' }
});

app.use('/api/', apiRateLimiter);

// ==========================================
// 3. Routing & API Registration
// ==========================================
app.use('/api', apiRouter);

// ==========================================
// 4. Liveness & Readiness Probes
// ==========================================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

app.get('/ready', async (req, res) => {
  try {
    // Check shared SQL database health
    await sharedSequelize.authenticate();
    
    // Check Redis connection health
    if (redisClient.status !== 'ready') {
      throw new Error('Redis database connection is offline.');
    }

    res.status(200).json({ status: 'READY', mysql: 'healthy', redis: 'healthy' });
  } catch (error) {
    console.error('Readiness probe failure:', error.message);
    res.status(500).json({ status: 'NOT_READY', error: error.message });
  }
});

// ==========================================
// 5. Cron Job: Monthly Usage Summary & Invoices
// ==========================================
// Runs on the first day of every month at midnight
cron.schedule('0 0 1 * *', async () => {
  console.log('[CRON] Initiating monthly usage summaries and invoice triggers...');
  try {
    const { Tenant, Subscription, UsageRecord } = require('./models/shared');
    const { syncUsageToStripe } = require('./services/usage');
    
    const tenants = await Tenant.findAll({ where: { status: 'active' } });
    for (const tenant of tenants) {
      // Sync metered API usage values to Stripe
      await syncUsageToStripe(tenant.id, 'api_calls');
      console.log(`[CRON] Synced API metrics to Stripe for tenant: ${tenant.slug}`);
    }
  } catch (err) {
    console.error('[CRON] Error during monthly usage aggregation:', err);
  }
});

// ==========================================
// 6. DB Sync & App Startup
// ==========================================
async function startServer() {
  try {
    // Authenticate and sync databases
    await sharedSequelize.authenticate();
    await sharedSequelize.sync({ alter: true });
    console.log('✔ Shared MySQL Database authenticated & synchronized.');

    // Auto-seed plans if table is empty
    const planCount = await Plan.count();
    if (planCount === 0) {
      console.log('Plan table is empty. Pre-seeding default tiers...');
      await Plan.create({
        name: 'Starter',
        stripe_price_id: 'price_starter_id',
        billing_interval: 'monthly',
        price_monthly: 29.00,
        price_yearly: 290.00,
        max_users: 5,
        max_api_calls_per_month: 10000,
        max_storage_gb: 10,
        features: ['5 Users Included', '10,000 API Calls/mo', '10GB Storage space'],
        is_active: true
      });
      await Plan.create({
        name: 'Pro',
        stripe_price_id: 'price_pro_id',
        billing_interval: 'monthly',
        price_monthly: 99.00,
        price_yearly: 990.00,
        max_users: 25,
        max_api_calls_per_month: 100000,
        max_storage_gb: 100,
        features: ['25 Users Included', '100,000 API Calls/mo', '100GB Storage space'],
        is_active: true
      });
      await Plan.create({
        name: 'Enterprise',
        stripe_price_id: 'price_enterprise_id',
        billing_interval: 'monthly',
        price_monthly: 299.00,
        price_yearly: 2990.00,
        max_users: 9999,
        max_api_calls_per_month: 1000000,
        max_storage_gb: 1000,
        features: ['Unlimited Users', '1,000,000 API Calls/mo', '1TB Storage space'],
        is_active: true
      });
      console.log('✔ Default billing tiers provisioned.');
    }

    // Attach Sockets
    initSocketServer(server);
    console.log('✔ Socket.io server mapped.');

    server.listen(PORT, () => {
      console.log(`🚀 Platform server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  }
}

startServer();
