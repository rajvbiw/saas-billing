const { Tenant, Plan, Subscription, ProvisioningJob } = require('../models/shared');
const { createCustomer, createSubscription } = require('../services/stripe');
const { triggerProvisioningJob } = require('../services/provisioning');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkeychangeinproduction';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'supersecretjwtrefreshkeychangeinproduction';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';

const SUPERADMIN_EMAIL = 'superadmin@saas-billing-rajbi.com';
// Hashed value of 'superpassword' for initial demo login
const SUPERADMIN_PASSWORD_HASH = bcrypt.hashSync('superpassword', 10);

async function register(req, res) {
  try {
    const { company_name, owner_name, owner_email, subdomain, password, plan_id } = req.body;

    if (!company_name || !owner_name || !owner_email || !subdomain || !password || !plan_id) {
      return res.status(400).json({ error: 'All registration parameters are required.' });
    }

    // Check subdomain uniqueness
    const slug = subdomain.toLowerCase().trim();
    const existing = await Tenant.findOne({ where: { slug } });
    if (existing) {
      return res.status(400).json({ error: 'Subdomain prefix is already claimed.' });
    }

    // Fetch Plan details
    const plan = await Plan.findByPk(plan_id);
    if (!plan || !plan.is_active) {
      return res.status(400).json({ error: 'Selected billing plan is invalid.' });
    }

    // 1. Create Stripe Customer
    const stripeCustomer = await createCustomer(owner_email, owner_name, company_name);

    // 2. Create Stripe Subscription (14 day trial default)
    const stripeSubscription = await createSubscription(stripeCustomer.id, plan.stripe_price_id, 14);

    // 3. Save Tenant Registration
    const tenant = await Tenant.create({
      slug,
      company_name,
      owner_name,
      owner_email,
      subdomain: `${slug}.saas-billing-rajbi.com`,
      plan_id: plan.id,
      status: 'trialing',
      stripe_customer_id: stripeCustomer.id,
      stripe_subscription_id: stripeSubscription.id,
      trial_ends_at: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : new Date(Date.now() + 14 * 24 * 3600 * 1000)
    });

    // 4. Create Subscription Record in shared database
    await Subscription.create({
      tenant_id: tenant.id,
      plan_id: plan.id,
      stripe_subscription_id: stripeSubscription.id,
      status: stripeSubscription.status || 'trialing',
      current_period_start: new Date(stripeSubscription.current_period_start * 1000),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000),
      trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : new Date(),
      trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : new Date(Date.now() + 14 * 24 * 3600 * 1000)
    });

    // 5. Generate Hashed Password
    const passwordHash = await bcrypt.hash(password, 10);

    // 6. Trigger Provisioning Queue Pipeline (SQS/Lambda)
    const job = await triggerProvisioningJob(tenant, passwordHash);

    res.status(201).json({
      message: 'Onboarding registered successfully. Provisioning job initiated.',
      tenantId: tenant.id,
      jobId: job.id,
      subdomain: tenant.subdomain
    });
  } catch (error) {
    console.error('Error registering new tenant:', error);
    res.status(500).json({ error: 'Failed to complete tenant signup.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // 1. Superadmin check (no subdomain required)
    if (email === SUPERADMIN_EMAIL && (!req.tenant || !req.tenantDb)) {
      const match = await bcrypt.compare(password, SUPERADMIN_PASSWORD_HASH);
      if (!match) {
        return res.status(401).json({ error: 'Invalid superadmin credentials.' });
      }

      const token = jwt.sign(
        { id: 0, email: SUPERADMIN_EMAIL, role: 'superadmin' },
        jwtSecret,
        { expiresIn: jwtExpiresIn }
      );
      
      const refreshToken = jwt.sign(
        { id: 0, email: SUPERADMIN_EMAIL, role: 'superadmin' },
        jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      return res.json({
        token,
        refreshToken,
        user: { id: 0, email: SUPERADMIN_EMAIL, name: 'System Superadmin', role: 'superadmin' }
      });
    }

    // 2. Standard Tenant-Aware login
    if (!req.tenant || !req.tenantDb) {
      return res.status(400).json({ error: 'Subdomain is required to login to your tenant workspace.' });
    }

    const { models } = req.tenantDb;
    const user = await models.User.findOne({ where: { email } });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Update login timestamp
    await user.update({ last_login: new Date() });

    // Sign Access Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, tenantId: req.tenant.id },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );

    // Sign Refresh Token
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, tenantId: req.tenant.id },
      jwtRefreshSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: req.tenant.id,
        tenantName: req.tenant.company_name,
        subdomain: req.tenant.subdomain
      }
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ error: 'Login session initialization failed.' });
  }
}

async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }

    const decoded = jwt.verify(refreshToken, jwtRefreshSecret);
    const token = jwt.sign(
      { id: decoded.id, email: decoded.email, role: decoded.role, tenantId: decoded.tenantId },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );

    res.json({ token });
  } catch (error) {
    res.status(401).json({ error: 'Refresh token is expired or invalid.' });
  }
}

async function me(req, res) {
  if (req.user.role === 'superadmin') {
    return res.json({
      user: { id: 0, email: SUPERADMIN_EMAIL, name: 'System Superadmin', role: 'superadmin' }
    });
  }

  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      lastLogin: req.user.last_login
    },
    tenant: {
      id: req.tenant.id,
      companyName: req.tenant.company_name,
      slug: req.tenant.slug,
      subdomain: req.tenant.subdomain,
      status: req.tenant.status,
      plan: req.tenant.plan
    }
  });
}

async function changePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Both old and new passwords are required.' });
    }

    if (req.user.role === 'superadmin') {
      return res.status(403).json({ error: 'Superadmin credentials can only be changed via security policies.' });
    }

    const { models } = req.tenantDb;
    const user = await models.User.findByPk(req.user.id);
    const match = await bcrypt.compare(oldPassword, user.password_hash);

    if (!match) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await user.update({ password_hash: passwordHash });

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Could not change password.' });
  }
}

async function forgotPassword(req, res) {
  // Mock endpoint: returns token for password resetting
  const { email } = req.body;
  res.json({ message: 'If the email exists in our records, a reset link will be sent shortly.', resetToken: 'mock_reset_token' });
}

async function resetPassword(req, res) {
  // Mock reset endpoint
  const { token, newPassword } = req.body;
  res.json({ message: 'Password has been reset successfully.' });
}

module.exports = {
  register,
  login,
  refresh,
  me,
  changePassword,
  forgotPassword,
  resetPassword
};
