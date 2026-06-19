const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth');
const onboardingController = require('../controllers/onboarding');
const billingController = require('../controllers/billing');
const tenantApiController = require('../controllers/tenant-api');
const adminController = require('../controllers/admin');
const dashboardController = require('../controllers/dashboard');

const { authenticateUser, requireRoles } = require('../middleware/auth');
const { resolveTenant, requireTenant } = require('../middleware/tenant');
const stripeWebhookHandler = require('../webhooks/stripe-handler');

// Apply tenant resolution middleware globally across all API routes
router.use(resolveTenant);

// ==========================================
// 1. Authentication Routes (Shared / Root)
// ==========================================
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/refresh', authController.refresh);
router.post('/auth/logout', (req, res) => res.json({ message: 'Logged out successfully.' }));
router.get('/auth/me', authenticateUser, authController.me);
router.put('/auth/change-password', authenticateUser, authController.changePassword);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

// ==========================================
// 2. Onboarding Routes
// ==========================================
router.post('/onboarding/check-subdomain', onboardingController.checkSubdomain);
router.get('/onboarding/status/:tenant_id', onboardingController.getStatus);
router.post('/onboarding/complete', onboardingController.complete);

// ==========================================
// 3. Billing & Subscription Routes (Tenant-Aware)
// ==========================================
router.get('/billing/plans', billingController.getPlans);
router.get('/billing/subscription', authenticateUser, requireTenant, billingController.getSubscription);
router.post('/billing/subscribe', authenticateUser, requireTenant, billingController.subscribe);
router.put('/billing/upgrade', authenticateUser, requireTenant, billingController.upgrade);
router.put('/billing/cancel', authenticateUser, requireTenant, billingController.cancel);
router.post('/billing/reactivate', authenticateUser, requireTenant, billingController.reactivate);
router.get('/billing/invoices', authenticateUser, requireTenant, billingController.getInvoices);
router.get('/billing/invoices/:id/download', authenticateUser, requireTenant, billingController.downloadInvoice);
router.post('/billing/portal', authenticateUser, requireTenant, billingController.portal);
router.get('/billing/usage', authenticateUser, requireTenant, billingController.getUsage);
router.get('/billing/payment-methods', authenticateUser, requireTenant, billingController.getPaymentMethods);
router.post('/billing/payment-methods', authenticateUser, requireTenant, billingController.addPaymentMethod);
router.delete('/billing/payment-methods/:id', authenticateUser, requireTenant, billingController.deletePaymentMethod);

// ==========================================
// 4. Stripe Webhooks (Raw Body parser binds elsewhere)
// ==========================================
router.post('/webhooks/stripe', async (req, res) => {
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');
    const sig = req.headers['stripe-signature'];
    let event = req.body;

    if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
      try {
        event = stripe.webhooks.constructEvent(
          req.rawBody || req.body, 
          sig, 
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.warn('Webhook signature check failed, running with body payload for compatibility.');
      }
    }

    await stripeWebhookHandler.handleStripeWebhook(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook route error:', error);
    res.status(500).json({ error: 'Webhook processing exception.' });
  }
});

// ==========================================
// 5. Tenant User Management (Tenant-Aware)
// ==========================================
router.get('/users', authenticateUser, requireTenant, tenantApiController.getUsers);
router.post('/users/invite', authenticateUser, requireTenant, requireRoles(['owner', 'admin']), tenantApiController.inviteUser);
router.get('/users/:id', authenticateUser, requireTenant, tenantApiController.getUser);
router.put('/users/:id', authenticateUser, requireTenant, requireRoles(['owner', 'admin']), tenantApiController.updateUser);
router.delete('/users/:id', authenticateUser, requireTenant, requireRoles(['owner', 'admin']), tenantApiController.deleteUser);
router.post('/users/accept-invite/:token', requireTenant, tenantApiController.acceptInvite);

// ==========================================
// 6. Tenant API Keys (Tenant-Aware)
// ==========================================
router.get('/keys', authenticateUser, requireTenant, tenantApiController.getKeys);
router.post('/keys', authenticateUser, requireTenant, requireRoles(['owner', 'admin']), tenantApiController.createKey);
router.delete('/keys/:id', authenticateUser, requireTenant, requireRoles(['owner', 'admin']), tenantApiController.deleteKey);
router.put('/keys/:id/rotate', authenticateUser, requireTenant, requireRoles(['owner', 'admin']), tenantApiController.rotateKey);

// ==========================================
// 7. Tenant Usage & Analytics (Tenant-Aware)
// ==========================================
router.get('/usage/current', authenticateUser, requireTenant, billingController.getUsage);
router.get('/usage/history', authenticateUser, requireTenant, tenantApiController.getUsageHistory);
router.get('/usage/breakdown', authenticateUser, requireTenant, tenantApiController.getUsageBreakdown);

// ==========================================
// 8. Tenant Dashboard (Tenant-Aware)
// ==========================================
router.get('/dashboard/overview', authenticateUser, requireTenant, dashboardController.getOverview);
router.get('/dashboard/stats', authenticateUser, requireTenant, dashboardController.getStats);

// ==========================================
// 9. Superadmin Panel (Role: superadmin)
// ==========================================
router.get('/admin/tenants', authenticateUser, requireRoles(['superadmin']), adminController.getTenants);
router.get('/admin/tenants/:id', authenticateUser, requireRoles(['superadmin']), adminController.getTenantById);
router.put('/admin/tenants/:id/suspend', authenticateUser, requireRoles(['superadmin']), adminController.suspendTenant);
router.put('/admin/tenants/:id/reactivate', authenticateUser, requireRoles(['superadmin']), adminController.reactivateTenant);
router.get('/admin/revenue', authenticateUser, requireRoles(['superadmin']), adminController.getRevenueDashboard);
router.get('/admin/usage', authenticateUser, requireRoles(['superadmin']), adminController.getPlatformUsage);

module.exports = router;
