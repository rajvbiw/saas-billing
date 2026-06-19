const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { ProvisioningJob, Tenant } = require('../models/shared');
const { getTenantDbConnection } = require('../tenant/connection-factory');
const { sendWelcomeEmail } = require('./ses');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const queueUrl = process.env.AWS_SQS_PROVISIONING_QUEUE_URL;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || 'us-east-1';

const isMock = !accessKeyId || accessKeyId === 'mock-key-id' || !queueUrl;

let sqsClient = null;
if (!isMock) {
  sqsClient = new SQSClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

/**
 * Triggers a new tenant onboarding/provisioning run.
 * 
 * @param {Object} tenant - Sequelize Tenant record
 * @param {string} passwordHash - The owner's initial hashed password
 */
async function triggerProvisioningJob(tenant, passwordHash) {
  // 1. Create a DB job record
  const job = await ProvisioningJob.create({
    tenant_id: tenant.id,
    status: 'pending',
    steps_completed: [],
    started_at: new Date()
  });

  const payload = {
    jobId: job.id,
    tenantId: tenant.id,
    slug: tenant.slug,
    companyName: tenant.company_name,
    ownerName: tenant.owner_name,
    ownerEmail: tenant.owner_email,
    passwordHash: passwordHash,
    subdomain: tenant.subdomain
  };

  if (isMock) {
    // Fire-and-forget simulated run locally
    simulateLocalProvisioning(payload, job);
  } else {
    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(payload)
      });
      await sqsClient.send(command);
    } catch (error) {
      console.error('Failed to submit provisioning task to SQS:', error);
      await job.update({
        status: 'failed',
        error: error.message,
        completed_at: new Date()
      });
      throw error;
    }
  }

  return job;
}

/**
 * Local simulation of the 10-step Lambda provisioner.
 * Keeps local dev and verification fully functional without AWS dependencies.
 */
async function simulateLocalProvisioning(payload, job) {
  const steps = [
    'Creating database tenant_' + payload.slug + '_db',
    'Setting up schema tables',
    'Creating root account ' + payload.ownerEmail,
    'Configuring isolated Kubernetes namespace tenant-' + payload.slug,
    'Injecting Helm values maps',
    'Configuring local virtual Route53 DNS records',
    'Finalizing tenant billing credentials',
    'Initiating status handshake',
    'Dispatching tenant notification dispatch',
    'Provisioning steps finalized'
  ];

  try {
    await job.update({ status: 'in_progress' });

    for (let i = 0; i < steps.length; i++) {
      // Small delay per step to show animations in progress UI
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const currentSteps = job.steps_completed || [];
      currentSteps.push(steps[i]);
      
      await job.update({
        steps_completed: currentSteps
      });
    }

    // Step 2 & 3: Provision local mysql database for tenant
    const dbName = `tenant_${payload.slug}_db`;
    const host = process.env.DB_HOST || '127.0.0.1';
    
    // Create the schema dynamically in local DB
    const { sharedSequelize } = require('../database/shared-db');
    await sharedSequelize.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);

    // Fetch dynamic connection and sync tables
    const { getTenantDbConnection } = require('../tenant/connection-factory');
    const { sequelize, models } = getTenantDbConnection(dbName, host);
    
    await sequelize.sync({ force: true });

    // Seed the owner user in the new database
    await models.User.create({
      name: payload.ownerName,
      email: payload.ownerEmail,
      password_hash: payload.passwordHash,
      role: 'owner',
      is_active: true
    });

    // Update tenant registration in shared DB
    await Tenant.update({
      db_name: dbName,
      db_host: host,
      namespace: `tenant-${payload.slug}`,
      status: 'active'
    }, {
      where: { id: payload.tenantId }
    });

    // Send Welcome Email
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
    await sendWelcomeEmail(payload.ownerEmail, payload.ownerName, payload.companyName, loginUrl);

    await job.update({
      status: 'completed',
      completed_at: new Date()
    });
  } catch (error) {
    console.error('Local provisioning simulation error:', error);
    await job.update({
      status: 'failed',
      error: error.message,
      completed_at: new Date()
    });
  }
}

module.exports = {
  triggerProvisioningJob
};
