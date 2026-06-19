const { Sequelize } = require('sequelize');
const { initTenantModels } = require('./models');

const connectionCache = {};

/**
 * Retrieves an active Sequelize connection and model set for the tenant.
 * Creates one if not cached.
 * 
 * @param {string} dbName - Target database name e.g., tenant_acme_db
 * @param {string} dbHost - Database host (defaults to DB_HOST env var)
 * @returns {{sequelize: Sequelize, models: Object}}
 */
function getTenantDbConnection(dbName, dbHost) {
  if (!dbName) {
    throw new Error('Database name is required for tenant connection');
  }

  if (connectionCache[dbName]) {
    return connectionCache[dbName];
  }

  const host = dbHost || process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'rootpassword';

  const sequelize = new Sequelize(dbName, user, password, {
    host,
    port,
    dialect: 'mysql',
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });

  // Dynamically initialize and bind tenant models
  const models = initTenantModels(sequelize);

  connectionCache[dbName] = {
    sequelize,
    models
  };

  return connectionCache[dbName];
}

module.exports = {
  getTenantDbConnection
};
