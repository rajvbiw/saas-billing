const { Tenant, ProvisioningJob } = require('../models/shared');

/**
 * Checks if a requested subdomain slug is available.
 */
async function checkSubdomain(req, res) {
  try {
    const { subdomain } = req.body;
    if (!subdomain) {
      return res.status(400).json({ error: 'Subdomain parameter is required.' });
    }

    const slug = subdomain.toLowerCase().trim();
    
    // Validate character matches
    const isValidSlug = /^[a-z0-9-]+$/.test(slug);
    if (!isValidSlug) {
      return res.status(400).json({ error: 'Subdomain can only contain lowercase letters, numbers, and dashes.' });
    }

    // Protect certain subdomains
    const reserved = ['www', 'api', 'admin', 'saas', 'app', 'status', 'portal', 'billing'];
    if (reserved.includes(slug)) {
      return res.json({ available: false, reason: 'Subdomain is a reserved platform keyword.' });
    }

    const tenant = await Tenant.findOne({ where: { slug } });
    if (tenant) {
      return res.json({ available: false, reason: 'Subdomain is already in use.' });
    }

    res.json({ available: true });
  } catch (error) {
    console.error('Error checking subdomain availability:', error);
    res.status(500).json({ error: 'Subdomain validation error.' });
  }
}

/**
 * Retrieves the live progress steps for a tenant's onboarding provisioning job.
 */
async function getStatus(req, res) {
  try {
    const { tenant_id } = req.params;
    
    const job = await ProvisioningJob.findOne({
      where: { tenant_id },
      order: [['created_at', 'DESC']]
    });

    if (!job) {
      return res.status(404).json({ error: 'No provisioning details found for this organization.' });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      steps: job.steps_completed || [],
      error: job.error,
      startedAt: job.started_at,
      completedAt: job.completed_at
    });
  } catch (error) {
    console.error('Error fetching onboarding job status:', error);
    res.status(500).json({ error: 'Failed to retrieve progress status.' });
  }
}

/**
 * Endpoint called by frontend or client once provisioning completes, to signpost onboarding wraps.
 */
async function complete(req, res) {
  res.json({ message: 'Tenant onboarding workflow complete.' });
}

module.exports = {
  checkSubdomain,
  getStatus,
  complete
};
