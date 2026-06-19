const { WebhookEvent, Tenant, Subscription, Invoice, Plan } = require('../models/shared');
const { sendTrialEndingEmail, sendPaymentFailedEmail, sendInvoicePaidEmail } = require('../services/ses');
const { emitTenantEvent } = require('../services/socket');

/**
 * Handles processed Stripe webhook events and triggers application logic.
 * 
 * @param {Object} event - Stripe Webhook Event Object
 */
async function handleStripeWebhook(event) {
  // Save event payload to verify status, preventing double-processing
  const [dbEvent, created] = await WebhookEvent.findOrCreate({
    where: { stripe_event_id: event.id },
    defaults: {
      type: event.type,
      payload: event,
      processed: false,
      created_at: new Date()
    }
  });

  if (!created && dbEvent.processed) {
    console.log(`Stripe event ${event.id} already processed. Skipping.`);
    return;
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const stripeCustomerId = sub.customer;
        const tenant = await Tenant.findOne({ where: { stripe_customer_id: stripeCustomerId } });
        
        if (tenant) {
          const priceId = sub.items.data[0].price.id;
          const plan = await Plan.findOne({ where: { stripe_price_id: priceId } });
          const planId = plan ? plan.id : tenant.plan_id;

          const statusMap = {
            trialing: 'trialing',
            active: 'active',
            past_due: 'suspended',
            canceled: 'cancelled',
            unpaid: 'suspended'
          };
          const tenantStatus = statusMap[sub.status] || 'active';

          await tenant.update({
            stripe_subscription_id: sub.id,
            plan_id: planId,
            status: tenantStatus,
            trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000) : null
          });

          await Subscription.upsert({
            tenant_id: tenant.id,
            plan_id: planId,
            stripe_subscription_id: sub.id,
            status: sub.status === 'canceled' ? 'cancelled' : sub.status,
            current_period_start: new Date(sub.current_period_start * 1000),
            current_period_end: new Date(sub.current_period_end * 1000),
            cancel_at_period_end: sub.cancel_at_period_end,
            trial_start: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000) : null
          });

          emitTenantEvent(tenant.id, 'subscription_updated', {
            status: sub.status,
            planId
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const tenant = await Tenant.findOne({ where: { stripe_subscription_id: sub.id } });
        if (tenant) {
          await tenant.update({ status: 'cancelled' });
          await Subscription.update(
            { status: 'cancelled' },
            { where: { stripe_subscription_id: sub.id } }
          );

          // Real-time socket event and frontend suspension
          emitTenantEvent(tenant.id, 'subscription_cancelled', { status: 'cancelled' });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const tenant = await Tenant.findOne({ where: { stripe_customer_id: invoice.customer } });
        if (tenant) {
          await tenant.update({ status: 'suspended' });
          if (tenant.stripe_subscription_id) {
            await Subscription.update(
              { status: 'past_due' },
              { where: { stripe_subscription_id: tenant.stripe_subscription_id } }
            );
          }

          await Invoice.upsert({
            tenant_id: tenant.id,
            stripe_invoice_id: invoice.id,
            amount_due: invoice.amount_due / 100,
            amount_paid: invoice.amount_paid / 100,
            status: 'open',
            invoice_pdf_url: invoice.invoice_pdf || null,
            period_start: new Date(invoice.period_start * 1000),
            period_end: new Date(invoice.period_end * 1000),
            due_date: invoice.due_date ? new Date(invoice.due_date * 1000) : null
          });

          emitTenantEvent(tenant.id, 'payment_failed', {
            amountDue: invoice.amount_due / 100,
            invoiceUrl: invoice.hosted_invoice_url || '#'
          });

          await sendPaymentFailedEmail(
            tenant.owner_email,
            tenant.owner_name,
            invoice.amount_due / 100,
            invoice.hosted_invoice_url || '#'
          );
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const tenant = await Tenant.findOne({ where: { stripe_customer_id: invoice.customer } });
        if (tenant) {
          await tenant.update({ status: 'active' });
          if (tenant.stripe_subscription_id) {
            await Subscription.update(
              { status: 'active' },
              { where: { stripe_subscription_id: tenant.stripe_subscription_id } }
            );
          }

          await Invoice.upsert({
            tenant_id: tenant.id,
            stripe_invoice_id: invoice.id,
            amount_due: invoice.amount_due / 100,
            amount_paid: invoice.amount_paid / 100,
            status: 'paid',
            invoice_pdf_url: invoice.invoice_pdf || null,
            period_start: new Date(invoice.period_start * 1000),
            period_end: new Date(invoice.period_end * 1000),
            due_date: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
            paid_at: new Date()
          });

          emitTenantEvent(tenant.id, 'payment_succeeded', {
            amountPaid: invoice.amount_paid / 100,
            pdfUrl: invoice.invoice_pdf || null
          });

          await sendInvoicePaidEmail(
            tenant.owner_email,
            tenant.owner_name,
            invoice.amount_paid / 100,
            invoice.invoice_pdf || '#'
          );
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object;
        const tenant = await Tenant.findOne({ where: { stripe_subscription_id: sub.id } });
        if (tenant) {
          await sendTrialEndingEmail(tenant.owner_email, tenant.owner_name, sub.trial_end * 1000);
        }
        break;
      }
    }

    await dbEvent.update({
      processed: true,
      processed_at: new Date()
    });
  } catch (error) {
    console.error('Error handling webhook processing:', error);
    await dbEvent.update({
      error: error.message,
      processed: false
    });
    throw error;
  }
}

module.exports = {
  handleStripeWebhook
};
