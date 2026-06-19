const { DataTypes } = require('sequelize');
const { sharedSequelize } = require('../database/shared-db');

// 1. Plan Model
const Plan = sharedSequelize.define('Plan', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  stripe_price_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  billing_interval: {
    type: DataTypes.ENUM('monthly', 'yearly'),
    allowNull: false,
  },
  price_monthly: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  price_yearly: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  max_users: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  max_api_calls_per_month: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  max_storage_gb: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  features: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  tableName: 'plans'
});

// 2. Tenant Model
const Tenant = sharedSequelize.define('Tenant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  company_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  owner_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  owner_email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  domain: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  subdomain: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  plan_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Plan,
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('trialing', 'active', 'suspended', 'cancelled'),
    defaultValue: 'trialing',
  },
  stripe_customer_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  stripe_subscription_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  db_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  db_host: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  namespace: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  trial_ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: 'tenants'
});

// 3. Subscription Model
const Subscription = sharedSequelize.define('Subscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id'
    }
  },
  plan_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Plan,
      key: 'id'
    }
  },
  stripe_subscription_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.ENUM('trialing', 'active', 'past_due', 'cancelled', 'paused'),
    defaultValue: 'trialing',
  },
  current_period_start: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  current_period_end: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  cancel_at_period_end: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  trial_start: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  trial_end: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: 'subscriptions'
});

// 4. Invoice Model
const Invoice = sharedSequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id'
    }
  },
  stripe_invoice_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  amount_due: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  amount_paid: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('draft', 'open', 'paid', 'void', 'uncollectible'),
    allowNull: false,
  },
  invoice_pdf_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  period_start: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  period_end: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  due_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: 'invoices'
});

// 5. Usage Record Model
const UsageRecord = sharedSequelize.define('UsageRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id'
    }
  },
  metric: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  recorded_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  billing_period: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  stripe_usage_record_id: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'usage_records'
});

// 6. Webhook Event Model
const WebhookEvent = sharedSequelize.define('WebhookEvent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  stripe_event_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  processed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  tableName: 'webhook_events'
});

// 7. Provisioning Job Model
const ProvisioningJob = sharedSequelize.define('ProvisioningJob', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Tenant,
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed'),
    defaultValue: 'pending',
  },
  steps_completed: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: 'provisioning_jobs'
});

// 8. Audit Log Model
const AuditLog = sharedSequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Tenant,
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  resource: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  resource_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'audit_logs'
});

// Associations
Tenant.belongsTo(Plan, { foreignKey: 'plan_id', as: 'plan' });
Plan.hasMany(Tenant, { foreignKey: 'plan_id', as: 'tenants' });

Subscription.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(Subscription, { foreignKey: 'tenant_id', as: 'subscriptions' });

Subscription.belongsTo(Plan, { foreignKey: 'plan_id', as: 'plan' });
Plan.hasMany(Subscription, { foreignKey: 'plan_id', as: 'subscriptions' });

Invoice.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(Invoice, { foreignKey: 'tenant_id', as: 'invoices' });

UsageRecord.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(UsageRecord, { foreignKey: 'tenant_id', as: 'usageRecords' });

ProvisioningJob.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(ProvisioningJob, { foreignKey: 'tenant_id', as: 'provisioningJobs' });

AuditLog.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(AuditLog, { foreignKey: 'tenant_id', as: 'auditLogs' });

module.exports = {
  Plan,
  Tenant,
  Subscription,
  Invoice,
  UsageRecord,
  WebhookEvent,
  ProvisioningJob,
  AuditLog
};
