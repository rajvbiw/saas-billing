const { UsageRecord, Subscription, Plan } = require('../models/shared');

async function getOverview(req, res) {
  try {
    const { models } = req.tenantDb;
    
    // 1. Fetch user count
    const usersCount = await models.User.count({ where: { is_active: true } });

    // 2. Fetch current month's usage from shared database
    const now = new Date();
    const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const apiCallsThisMonth = await UsageRecord.sum('quantity', {
      where: {
        tenant_id: req.tenant.id,
        metric: 'api_calls',
        billing_period: billingPeriod
      }
    }) || 0;

    const storageUsedGb = await UsageRecord.sum('quantity', {
      where: {
        tenant_id: req.tenant.id,
        metric: 'storage_gb',
        billing_period: billingPeriod
      }
    }) || 0;

    // 3. Fetch active subscription & limits
    const subscription = await Subscription.findOne({
      where: { tenant_id: req.tenant.id, status: ['active', 'trialing'] },
      include: [{ model: Plan, as: 'plan' }],
      order: [['created_at', 'DESC']]
    });

    const planLimits = {
      max_users: subscription?.plan?.max_users || 5,
      max_api_calls: subscription?.plan?.max_api_calls_per_month || 10000,
      max_storage: subscription?.plan?.max_storage_gb || 10
    };

    let daysUntilRenewal = 0;
    if (subscription) {
      const diffTime = Math.abs(new Date(subscription.current_period_end) - now);
      daysUntilRenewal = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // 4. Fetch recent activity (mocked user logs)
    const recentActivity = await models.ActivityLog.findAll({
      limit: 10,
      order: [['created_at', 'DESC']],
      include: [{ model: models.User, as: 'user', attributes: ['name', 'email'] }]
    });

    res.json({
      users_count: usersCount,
      api_calls_this_month: apiCallsThisMonth,
      storage_used_gb: storageUsedGb,
      plan_limits: planLimits,
      days_until_renewal: daysUntilRenewal,
      recent_activity: recentActivity
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to compile dashboard metrics.' });
  }
}

async function getStats(req, res) {
  const { period } = req.query; // 7d, 30d, 90d
  // Return simulated metrics depending on timeframe selection
  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  const stats = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    stats.push({
      date: dateStr,
      apiCalls: Math.floor(Math.random() * 500) + 100,
      storageGb: 2.5 + (i * 0.05)
    });
  }
  res.json(stats);
}

module.exports = {
  getOverview,
  getStats
};
