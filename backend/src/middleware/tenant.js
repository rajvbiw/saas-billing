const { Tenant, Plan } = require('../models/shared');
const { getTenantDbConnection } = require('../tenant/connection-factory');

/**
 * Resolves the tenant context using the hostname or custom X-Tenant-Slug header.
 * Attaches req.tenant and req.tenantDb to the request context.
 */
async function resolveTenant(req, res, next) {
  try {
    let slug = req.headers['x-tenant-slug'];

    if (!slug) {
      const host = req.headers.host || '';
      // Support custom subdomain parsing, e.g. tenant-slug.localhost:5000 or tenant-slug.saas.example.com
      const parts = host.split('.');
      if (parts.length > 1) {
        // For localhost:5000, parts would be ['localhost:5000'] (length 1)
        // For acme.localhost:5000, parts would be ['acme', 'localhost:5000'] (length 2)
        // For acme.saas.example.com, parts would be ['acme', 'saas', 'example', 'com'] (length 4)
        const possibleSlug = parts[0];
        
        // Exclude common root-level subdomains or hostnames
        if (possibleSlug !== 'www' && possibleSlug !== 'saas' && !possibleSlug.includes('localhost')) {
          slug = possibleSlug;
        }
      }
    }

    if (!slug) {
      // No tenant slug found; this could be a public endpoint (e.g. landing page, public auth)
      return next();
    }

    // Lookup tenant in the shared database
    const tenant = await Tenant.findOne({
      where: { slug },
      include: [{ model: Plan, as: 'plan' }]
    });

    if (!tenant) {
      return res.status(404).json({ error: `Tenant not found for slug: ${slug}` });
    }

    if (tenant.status === 'suspended') {
      return res.status(403).json({ error: 'Tenant subscription suspended. Please update payment settings.' });
    }

    // Attach tenant to request
    req.tenant = tenant;

    // Attach dynamic connection pool
    if (tenant.db_name) {
      const { sequelize, models } = getTenantDbConnection(tenant.db_name, tenant.db_host);
      req.tenantDb = { sequelize, models };
    }

    next();
  } catch (error) {
    console.error('Error resolving tenant database context:', error);
    res.status(500).json({ error: 'Internal server error resolving tenant space.' });
  }
}

/**
 * Enforces that a tenant context MUST be resolved for the endpoint.
 */
function requireTenant(req, res, next) {
  if (!req.tenant || !req.tenantDb) {
    return res.status(400).json({ error: 'Tenant context could not be resolved. Please specify subdomain or X-Tenant-Slug header.' });
  }
  next();
}

module.exports = {
  resolveTenant,
  requireTenant
};
