const { Tenant, Plan, Subscription, Invoice, UsageRecord } = require('../models/shared');
const { Op, fn, col } = require('sequelize');

async function getTenants(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    const { rows, count } = await Tenant.findAndCountAll({
      where: {
        [Op.or]: [
          { company_name: { [Op.like]: `%${search}%` } },
          { slug: { [Op.like]: `%${search}%` } },
          { owner_email: { [Op.like]: `%${search}%` } }
        ]
      },
      include: [{ model: Plan, as: 'plan' }],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    res.json({
      tenants: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalCount: count
    });
  } catch (error) {
    console.error('Error fetching admin tenants list:', error);
    res.status(500).json({ error: 'Failed to retrieve tenants.' });
  }
}

async function getTenantById(req, res) {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findByPk(id, {
      include: [
        { model: Plan, as: 'plan' },
        { model: Subscription, as: 'subscriptions' },
        { model: Invoice, as: 'invoices' }
      ]
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant record not found.' });
    }

    res.json(tenant);
  } catch (error) {
    console.error('Admin getTenantById error:', error);
    res.status(500).json({ error: 'Failed to retrieve tenant profiles.' });
  }
}

async function suspendTenant(req, res) {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findByPk(id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    await tenant.update({ status: 'suspended' });
    
    // Scale down pods locally or set flag in DB
    const { emitTenantEvent } = require('../services/socket');
    emitTenantEvent(id, 'tenant_suspended', { reason: 'Suspended by system superadmin.' });

    res.json({ message: 'Tenant status successfully updated to suspended.', tenant });
  } catch (error) {
    console.error('Tenant suspension failed:', error);
    res.status(500).json({ error: 'Failed to suspend tenant.' });
  }
}

async function reactivateTenant(req, res) {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findByPk(id);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    await tenant.update({ status: 'active' });

    const { emitTenantEvent } = require('../services/socket');
    emitTenantEvent(id, 'tenant_reactivated', { status: 'active' });

    res.json({ message: 'Tenant subscription status set to active.', tenant });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reactivate tenant.' });
  }
}

async function getRevenueDashboard(req, res) {
  try {
    // Calculate Monthly Recurring Revenue (MRR)
    // MRR = Sum of active subscription monthly equivalents
    const subscriptions = await Subscription.findAll({
      where: { status: 'active' },
      include: [{ model: Plan, as: 'plan' }]
    });

    let mrr = 0;
    subscriptions.forEach(sub => {
      if (sub.plan) {
        mrr += parseFloat(sub.plan.price_monthly);
      }
    });

    const arr = mrr * 12;

    // Calculate churn rates (e.g. cancelled subscription proportion)
    const activeCount = await Subscription.count({ where: { status: 'active' } });
    const cancelledCount = await Subscription.count({ where: { status: 'cancelled' } });
    const totalCount = activeCount + cancelledCount || 1;
    const churnRate = ((cancelledCount / totalCount) * 100).toFixed(2);

    // Revenue growth over past 6 months (mocked trend)
    const revenueTrend = [
      { month: 'Jan', mrr: mrr * 0.8, arr: arr * 0.8, signups: 12 },
      { month: 'Feb', mrr: mrr * 0.85, arr: arr * 0.85, signups: 15 },
      { month: 'Mar', mrr: mrr * 0.9, arr: arr * 0.9, signups: 22 },
      { month: 'Apr', mrr: mrr * 0.92, arr: arr * 0.92, signups: 18 },
      { month: 'May', mrr: mrr * 0.95, arr: arr * 0.95, signups: 25 },
      { month: 'Jun', mrr: mrr, arr: arr, signups: 30 }
    ];

    res.json({
      mrr,
      arr,
      churnRate,
      activeSubscriptions: activeCount,
      revenueTrend
    });
  } catch (error) {
    console.error('Error fetching admin revenue overview:', error);
    res.status(500).json({ error: 'Failed to compile revenue overview metrics.' });
  }
}

async function getPlatformUsage(req, res) {
  try {
    // Sum api calls platform-wide
    const apiCalls = await UsageRecord.sum('quantity', {
      where: { metric: 'api_calls' }
    }) || 0;

    const storageUsage = await UsageRecord.sum('quantity', {
      where: { metric: 'storage_gb' }
    }) || 0;

    // Get platform metrics sorted by day (mocked trend)
    const usageTrend = [
      { date: '2026-06-12', apiCalls: apiCalls * 0.12, storageGb: storageUsage * 0.8 },
      { date: '2026-06-13', apiCalls: apiCalls * 0.13, storageGb: storageUsage * 0.82 },
      { date: '2026-06-14', apiCalls: apiCalls * 0.11, storageGb: storageUsage * 0.85 },
      { date: '2026-06-15', apiCalls: apiCalls * 0.15, storageGb: storageUsage * 0.9 },
      { date: '2026-06-16', apiCalls: apiCalls * 0.17, storageGb: storageUsage * 0.95 },
      { date: '2026-06-17', apiCalls: apiCalls * 0.16, storageGb: storageUsage * 0.98 },
      { date: '2026-06-18', apiCalls: apiCalls * 0.16, storageGb: storageUsage }
    ];

    res.json({
      apiCalls,
      storageUsage,
      usageTrend
    });
  } catch (error) {
    console.error('Usage compilation failed:', error);
    res.status(500).json({ error: 'Failed to retrieve usage stats.' });
  }
}

module.exports = {
  getTenants,
  getTenantById,
  suspendTenant,
  reactivateTenant,
  getRevenueDashboard,
  getPlatformUsage
};
