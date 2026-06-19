const { Plan, Subscription, Invoice, Tenant, UsageRecord } = require('../models/shared');
const stripeService = require('../services/stripe');
const { Op } = require('sequelize');

async function getPlans(req, res) {
  try {
    const plans = await Plan.findAll({ where: { is_active: true } });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to retrieve plans list.' });
  }
}

async function getSubscription(req, res) {
  try {
    const subscription = await Subscription.findOne({
      where: { tenant_id: req.tenant.id },
      include: [{ model: Plan, as: 'plan' }],
      order: [['created_at', 'DESC']]
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found for this tenant.' });
    }

    res.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription details.' });
  }
}

async function subscribe(req, res) {
  try {
    const { plan_id, payment_method_id } = req.body;
    if (!plan_id) {
      return res.status(400).json({ error: 'plan_id is required.' });
    }

    const plan = await Plan.findByPk(plan_id);
    if (!plan) {
      return res.status(404).json({ error: 'Billing plan not found.' });
    }

    const customerId = req.tenant.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ error: 'Tenant customer ID missing.' });
    }

    // Attach payment method if provided
    if (payment_method_id) {
      await stripeService.attachPaymentMethod(customerId, payment_method_id);
    }

    // Create subscription
    const stripeSubscription = await stripeService.createSubscription(customerId, plan.stripe_price_id);

    // Save Subscription locally
    const localSub = await Subscription.create({
      tenant_id: req.tenant.id,
      plan_id: plan.id,
      stripe_subscription_id: stripeSubscription.id,
      status: stripeSubscription.status,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000),
      trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
      trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null
    });

    // Update Tenant
    await req.tenant.update({
      stripe_subscription_id: stripeSubscription.id,
      plan_id: plan.id,
      status: stripeSubscription.status === 'trialing' ? 'trialing' : 'active'
    });

    res.status(201).json({
      subscription: localSub,
      clientSecret: stripeSubscription.latest_invoice?.payment_intent?.client_secret || null
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription.' });
  }
}

async function upgrade(req, res) {
  try {
    const { plan_id } = req.body;
    if (!plan_id) {
      return res.status(400).json({ error: 'plan_id is required.' });
    }

    const plan = await Plan.findByPk(plan_id);
    if (!plan) {
      return res.status(404).json({ error: 'Billing plan not found.' });
    }

    const subscriptionId = req.tenant.stripe_subscription_id;
    if (!subscriptionId) {
      return res.status(400).json({ error: 'No active Stripe subscription found to upgrade.' });
    }

    const updatedStripeSub = await stripeService.updateSubscriptionPlan(subscriptionId, plan.stripe_price_id);

    // Update local subscription record
    await Subscription.update({
      plan_id: plan.id,
      status: updatedStripeSub.status
    }, {
      where: { stripe_subscription_id: subscriptionId }
    });

    // Update Tenant
    await req.tenant.update({ plan_id: plan.id });

    res.json({ message: 'Subscription upgraded successfully.', plan });
  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ error: 'Failed to upgrade subscription.' });
  }
}

async function cancel(req, res) {
  try {
    const subscriptionId = req.tenant.stripe_subscription_id;
    if (!subscriptionId) {
      return res.status(400).json({ error: 'No active subscription found to cancel.' });
    }

    await stripeService.cancelSubscription(subscriptionId, true);

    await Subscription.update({
      cancel_at_period_end: true
    }, {
      where: { stripe_subscription_id: subscriptionId }
    });

    res.json({ message: 'Subscription will cancel at the end of the current billing cycle.' });
  } catch (error) {
    console.error('Cancellation error:', error);
    res.status(500).json({ error: 'Failed to schedule subscription cancellation.' });
  }
}

async function reactivate(req, res) {
  try {
    const subscriptionId = req.tenant.stripe_subscription_id;
    if (!subscriptionId) {
      return res.status(400).json({ error: 'No active subscription found.' });
    }

    await stripeService.reactivateSubscription(subscriptionId);

    await Subscription.update({
      cancel_at_period_end: false
    }, {
      where: { stripe_subscription_id: subscriptionId }
    });

    res.json({ message: 'Subscription has been reactivated successfully.' });
  } catch (error) {
    console.error('Reactivation error:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription.' });
  }
}

async function getInvoices(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const { rows, count } = await Invoice.findAndCountAll({
      where: { tenant_id: req.tenant.id },
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    res.json({
      invoices: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalCount: count
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices list.' });
  }
}

async function downloadInvoice(req, res) {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findOne({
      where: { id, tenant_id: req.tenant.id }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    res.json({ pdfUrl: invoice.invoice_pdf_url });
  } catch (error) {
    console.error('Error fetching invoice pdf link:', error);
    res.status(500).json({ error: 'Failed to retrieve invoice PDF.' });
  }
}

async function portal(req, res) {
  try {
    const customerId = req.tenant.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ error: 'Tenant customer ID missing.' });
    }

    const { return_url } = req.body;
    const fallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing`;
    
    const session = await stripeService.getCustomerPortalSession(customerId, return_url || fallbackUrl);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error generating portal session:', error);
    res.status(500).json({ error: 'Failed to create customer portal session.' });
  }
}

async function getUsage(req, res) {
  try {
    const now = new Date();
    const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get usage grouped by metric
    const usage = await UsageRecord.findAll({
      attributes: [
        'metric',
        [UsageRecord.sequelize.fn('SUM', UsageRecord.sequelize.col('quantity')), 'total']
      ],
      where: {
        tenant_id: req.tenant.id,
        billing_period: billingPeriod
      },
      group: ['metric']
    });

    res.json(usage);
  } catch (error) {
    console.error('Usage retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve usage stats.' });
  }
}

async function getPaymentMethods(req, res) {
  try {
    const customerId = req.tenant.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ error: 'Tenant customer ID missing.' });
    }

    const methods = await stripeService.listPaymentMethods(customerId);
    res.json(methods.data);
  } catch (error) {
    console.error('Error retrieving payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods.' });
  }
}

async function addPaymentMethod(req, res) {
  try {
    const { payment_method_id } = req.body;
    if (!payment_method_id) {
      return res.status(400).json({ error: 'payment_method_id is required.' });
    }

    const customerId = req.tenant.stripe_customer_id;
    await stripeService.attachPaymentMethod(customerId, payment_method_id);
    
    res.json({ message: 'Payment method attached successfully.' });
  } catch (error) {
    console.error('Error attaching payment method:', error);
    res.status(500).json({ error: 'Failed to add card.' });
  }
}

async function deletePaymentMethod(req, res) {
  try {
    const { id } = req.params;
    await stripeService.detachPaymentMethod(id);
    res.json({ message: 'Payment method removed successfully.' });
  } catch (error) {
    console.error('Error removing payment method:', error);
    res.status(500).json({ error: 'Failed to delete payment method.' });
  }
}

module.exports = {
  getPlans,
  getSubscription,
  subscribe,
  upgrade,
  cancel,
  reactivate,
  getInvoices,
  downloadInvoice,
  portal,
  getUsage,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod
};
