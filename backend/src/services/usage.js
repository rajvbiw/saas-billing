const { UsageRecord, Tenant, Plan, Subscription } = require('../models/shared');
const { getTenantDbConnection } = require('../tenant/connection-factory');
const { reportUsageRecord: stripeReportUsage } = require('./stripe');
const { emitTenantEvent } = require('./socket');
const { Op, fn, col } = require('sequelize');

/**
 * Records a consumption metric (e.g. api_calls) for a tenant.
 */
async function recordUsage(tenantId, metric, quantity = 1) {
  const now = new Date();
  const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const record = await UsageRecord.create({
    tenant_id: tenantId,
    metric,
    quantity,
    recorded_at: now,
    billing_period: billingPeriod
  });

  // Fetch the total usage for this period
  const totalQuantity = await UsageRecord.sum('quantity', {
    where: {
      tenant_id: tenantId,
      metric,
      billing_period: billingPeriod
    }
  }) || 0;

  // Emit event to update frontend dials instantly via Socket.io
  emitTenantEvent(tenantId, 'usage_update', {
    metric,
    current: totalQuantity,
    billingPeriod
  });

  return record;
}

/**
 * Syncs the accumulated billing period usage for a tenant's metered plan items with Stripe.
 */
async function syncUsageToStripe(tenantId, metric) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant || !tenant.stripe_subscription_id) return;

  const now = new Date();
  const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const totalQuantity = await UsageRecord.sum('quantity', {
    where: {
      tenant_id: tenantId,
      metric,
      billing_period: billingPeriod
    }
  }) || 0;

  try {
    // In a production setup, we would fetch the Stripe Subscription details to find the sub item id.
    // Here we report usage directly to a mocked or real subscription item ID if available in metadata.
    // For simplicity, we query Stripe subscription items or use a stub item ID.
    const mockSubscriptionItemId = `si_${tenant.stripe_subscription_id.split('_')[1] || 'mock'}`;
    await stripeReportUsage(mockSubscriptionItemId, totalQuantity);
    
    // Update the record's Stripe reference
    await UsageRecord.update(
      { stripe_usage_record_id: `rec_${Math.random().toString(36).substring(7)}` },
      {
        where: {
          tenant_id: tenantId,
          metric,
          billing_period: billingPeriod,
          stripe_usage_record_id: null
        }
      }
    );
  } catch (error) {
    console.error(`Failed to sync usage to Stripe for tenant ${tenantId}:`, error);
  }
}

/**
 * Fetches api calls count by endpoint/day from the tenant's isolated database.
 */
async function getApiUsageBreakdown(tenant) {
  const { models } = getTenantDbConnection(tenant.db_name, tenant.db_host);
  
  // Aggregate calls by endpoint
  const byEndpoint = await models.ApiUsageLog.findAll({
    attributes: [
      'endpoint',
      [fn('COUNT', col('id')), 'count'],
      [fn('AVG', col('response_time_ms')), 'avgResponseTime']
    ],
    group: ['endpoint'],
    raw: true
  });

  // Aggregate calls by day for charts (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const byDay = await models.ApiUsageLog.findAll({
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      [fn('COUNT', col('id')), 'count']
    ],
    where: {
      created_at: {
        [Op.gte]: thirtyDaysAgo
      }
    },
    group: [fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true
  });

  return {
    byEndpoint,
    byDay
  };
}

module.exports = {
  recordUsage,
  syncUsageToStripe,
  getApiUsageBreakdown
};
