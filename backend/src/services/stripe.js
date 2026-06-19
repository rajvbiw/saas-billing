const Stripe = require('stripe');
require('dotenv').config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16', // or standard LTS version
});

// Helper for local mock responses if Stripe key is mock
const isMock = stripeSecretKey.startsWith('sk_test_mock');

async function createCustomer(email, name, companyName) {
  if (isMock) {
    return { id: `cus_mock_${Math.random().toString(36).substring(7)}` };
  }
  return await stripe.customers.create({
    email,
    name,
    metadata: {
      companyName
    }
  });
}

async function createSubscription(customerId, priceId, trialDays = 14) {
  if (isMock) {
    return {
      id: `sub_mock_${Math.random().toString(36).substring(7)}`,
      status: 'trialing',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 3600),
      trial_start: Math.floor(Date.now() / 1000),
      trial_end: Math.floor(Date.now() / 1000) + (trialDays * 24 * 3600),
    };
  }
  
  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: trialDays,
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });
}

async function updateSubscriptionPlan(subscriptionId, newPriceId) {
  if (isMock) {
    return { id: subscriptionId, status: 'active' };
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
    proration_behavior: 'always_invoice',
    items: [{
      id: subscription.items.data[0].id,
      price: newPriceId,
    }],
  });
}

async function cancelSubscription(subscriptionId, atPeriodEnd = true) {
  if (isMock) {
    return { id: subscriptionId, status: 'active', cancel_at_period_end: atPeriodEnd };
  }
  if (atPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return await stripe.subscriptions.cancel(subscriptionId);
  }
}

async function reactivateSubscription(subscriptionId) {
  if (isMock) {
    return { id: subscriptionId, status: 'active', cancel_at_period_end: false };
  }
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

async function getCustomerPortalSession(customerId, returnUrl) {
  if (isMock) {
    return { url: 'https://billing.stripe.com/p/session/mock' };
  }
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

async function listInvoices(customerId, limit = 10, startingAfter = null) {
  if (isMock) {
    return {
      data: [
        {
          id: 'in_mock_1',
          amount_due: 2900,
          amount_paid: 2900,
          status: 'paid',
          invoice_pdf: 'https://stripe.com/mock-invoice.pdf',
          period_start: Math.floor(Date.now() / 1000) - 30 * 24 * 3600,
          period_end: Math.floor(Date.now() / 1000),
          due_date: Math.floor(Date.now() / 1000),
          created: Math.floor(Date.now() / 1000),
        }
      ],
      has_more: false
    };
  }
  const params = { customer: customerId, limit };
  if (startingAfter) {
    params.starting_after = startingAfter;
  }
  return await stripe.invoices.list(params);
}

async function listPaymentMethods(customerId) {
  if (isMock) {
    return {
      data: [
        {
          id: 'pm_mock_1',
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2028
          }
        }
      ]
    };
  }
  return await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });
}

async function attachPaymentMethod(customerId, paymentMethodId) {
  if (isMock) {
    return { id: paymentMethodId, customer: customerId };
  }
  // Attach PM to customer
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });
  // Set as default payment method
  return await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

async function detachPaymentMethod(paymentMethodId) {
  if (isMock) {
    return { id: paymentMethodId };
  }
  return await stripe.paymentMethods.detach(paymentMethodId);
}

async function reportUsageRecord(subscriptionItemId, quantity) {
  if (isMock) {
    return { id: `ur_mock_${Math.random().toString(36).substring(7)}`, quantity };
  }
  return await stripe.subscriptionItems.createUsageRecord(
    subscriptionItemId,
    {
      quantity,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'set',
    }
  );
}

module.exports = {
  stripe,
  createCustomer,
  createSubscription,
  updateSubscriptionPlan,
  cancelSubscription,
  reactivateSubscription,
  getCustomerPortalSession,
  listInvoices,
  listPaymentMethods,
  attachPaymentMethod,
  detachPaymentMethod,
  reportUsageRecord
};
