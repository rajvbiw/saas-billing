const { DataTypes } = require('sequelize');

function initTenantModels(sequelize) {
  // 1. User Model
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'member', 'viewer'),
      defaultValue: 'member',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
  });

  // 2. ApiKey Model
  const ApiKey = sequelize.define('ApiKey', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    key_hash: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    prefix: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    }
  }, {
    tableName: 'api_keys',
    timestamps: true,
    underscored: true,
  });

  // 3. ApiUsageLog Model
  const ApiUsageLog = sequelize.define('ApiUsageLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    api_key_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: ApiKey,
        key: 'id'
      }
    },
    endpoint: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    method: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status_code: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    response_time_ms: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  }, {
    tableName: 'api_usage_logs',
    timestamps: true,
    underscored: true,
    updatedAt: false, // Usage logs are append-only
  });

  // 4. TeamInvitation Model
  const TeamInvitation = sequelize.define('TeamInvitation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'member', 'viewer'),
      defaultValue: 'member',
    },
    invited_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id'
      }
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    }
  }, {
    tableName: 'team_invitations',
    timestamps: true,
    underscored: true,
  });

  // 5. ActivityLog Model
  const ActivityLog = sequelize.define('ActivityLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: 'id'
      }
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
    }
  }, {
    tableName: 'activity_logs',
    timestamps: true,
    underscored: true,
    updatedAt: false,
  });

  // Associations
  User.hasMany(ApiKey, { foreignKey: 'user_id', as: 'apiKeys' });
  ApiKey.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  ApiKey.hasMany(ApiUsageLog, { foreignKey: 'api_key_id', as: 'usageLogs' });
  ApiUsageLog.belongsTo(ApiKey, { foreignKey: 'api_key_id', as: 'apiKey' });

  User.hasMany(TeamInvitation, { foreignKey: 'invited_by', as: 'sentInvitations' });
  TeamInvitation.belongsTo(User, { foreignKey: 'invited_by', as: 'inviter' });

  User.hasMany(ActivityLog, { foreignKey: 'user_id', as: 'activityLogs' });
  ActivityLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  return {
    User,
    ApiKey,
    ApiUsageLog,
    TeamInvitation,
    ActivityLog
  };
}

module.exports = {
  initTenantModels
};
