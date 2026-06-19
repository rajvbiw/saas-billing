const jwt = require('jsonwebtoken');
require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkeychangeinproduction';

/**
 * Validates JWT in authorization header and attaches req.user
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. Authorization token missing or malformed.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);
    
    // Check if superadmin is bypass
    if (decoded.role === 'superadmin') {
      req.user = decoded;
      return next();
    }

    // Otherwise, ensure we have a tenant context
    if (!req.tenantDb) {
      return res.status(400).json({ error: 'Tenant context required for this user session.' });
    }

    const { models } = req.tenantDb;
    const user = await models.User.findByPk(decoded.id);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account is inactive or does not exist.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT authentication error:', error);
    res.status(401).json({ error: 'Authentication failed. Invalid or expired session token.' });
  }
}

/**
 * Ensures user has at least one of the specified roles
 */
function requireRoles(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (req.user.role === 'superadmin') {
      return next(); // Superadmin overrides all
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden. You do not have permission to access this resource.' });
    }

    next();
  };
}

module.exports = {
  authenticateUser,
  requireRoles
};
