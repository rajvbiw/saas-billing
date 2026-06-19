const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendInvitationEmail } = require('../services/ses');
const { getApiUsageBreakdown } = require('../services/usage');
const { Op } = require('sequelize');

// ==========================================
// 1. Users & Invites Management
// ==========================================

async function getUsers(req, res) {
  try {
    const { models } = req.tenantDb;
    const users = await models.User.findAll({
      attributes: { exclude: ['password_hash'] }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to retrieve tenant users.' });
  }
}

async function inviteUser(req, res) {
  try {
    const { email, role } = req.body;
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required.' });
    }

    const { models } = req.tenantDb;
    
    // Check if user already exists
    const existingUser = await models.User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User is already a member of this tenant.' });
    }

    // Check if pending invitation already exists
    const existingInvite = await models.TeamInvitation.findOne({
      where: { email, accepted_at: null, expires_at: { [Op.gt]: new Date() } }
    });
    if (existingInvite) {
      return res.status(400).json({ error: 'An active invitation for this email already exists.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const invitation = await models.TeamInvitation.create({
      email,
      role,
      invited_by: req.user.id,
      token,
      expires_at: expiresAt
    });

    // Send email invitation link
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invite/${token}?subdomain=${req.tenant.slug}`;
    await sendInvitationEmail(email, inviteLink, req.user.name || req.user.email, req.tenant.company_name);

    // Activity log
    await models.ActivityLog.create({
      user_id: req.user.id,
      action: 'invite_user',
      resource: 'User',
      metadata: { invitee_email: email, role }
    });

    res.status(201).json({ message: 'Invitation email dispatched successfully.', invitation });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'Failed to dispatch invitation.' });
  }
}

async function getUser(req, res) {
  try {
    const { id } = req.params;
    const { models } = req.tenantDb;
    const user = await models.User.findByPk(id, {
      attributes: { exclude: ['password_hash'] }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve user details.' });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { role, is_active } = req.body;
    const { models } = req.tenantDb;

    const user = await models.User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Owner role changes requires extra safety
    if (user.role === 'owner' && role && role !== 'owner') {
      // Ensure there's another owner
      const owners = await models.User.count({ where: { role: 'owner' } });
      if (owners <= 1) {
        return res.status(400).json({ error: 'Cannot demote the only owner in this organization.' });
      }
    }

    await user.update({
      role: role !== undefined ? role : user.role,
      is_active: is_active !== undefined ? is_active : user.is_active
    });

    // Activity log
    await models.ActivityLog.create({
      user_id: req.user.id,
      action: 'update_user',
      resource: 'User',
      resource_id: String(user.id),
      metadata: { role, is_active }
    });

    res.json({ message: 'User updated successfully.', user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const { models } = req.tenantDb;

    const user = await models.User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.role === 'owner') {
      const owners = await models.User.count({ where: { role: 'owner' } });
      if (owners <= 1) {
        return res.status(400).json({ error: 'Cannot remove the sole owner of the tenant.' });
      }
    }

    await user.destroy();

    // Activity log
    await models.ActivityLog.create({
      user_id: req.user.id,
      action: 'remove_user',
      resource: 'User',
      resource_id: String(id),
      metadata: { removed_email: user.email }
    });

    res.json({ message: 'Member removed from tenant.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
}

async function acceptInvite(req, res) {
  try {
    const { token } = req.params;
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required.' });
    }

    const { models } = req.tenantDb;
    const invitation = await models.TeamInvitation.findOne({
      where: { token, accepted_at: null, expires_at: { [Op.gt]: new Date() } }
    });

    if (!invitation) {
      return res.status(400).json({ error: 'Invitation link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await models.User.create({
      name,
      email: invitation.email,
      password_hash: passwordHash,
      role: invitation.role,
      is_active: true
    });

    // Mark invitation accepted
    await invitation.update({ accepted_at: new Date() });

    // Activity log
    await models.ActivityLog.create({
      user_id: user.id,
      action: 'accept_invite',
      resource: 'User',
      resource_id: String(user.id),
      metadata: { invite_token: token }
    });

    res.json({ message: 'Invitation accepted and account registered successfully.', user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invitation.' });
  }
}

// ==========================================
// 2. API Keys Management
// ==========================================

async function getKeys(req, res) {
  try {
    const { models } = req.tenantDb;
    const keys = await models.ApiKey.findAll({
      where: { user_id: req.user.id }
    });
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API keys.' });
  }
}

async function createKey(req, res) {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Key label name is required.' });
    }

    const { models } = req.tenantDb;
    
    // Generate secure random string
    const rawKey = 'sb_live_' + crypto.randomBytes(24).toString('hex');
    const prefix = rawKey.substring(0, 12); // "sb_live_xxxx"
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await models.ApiKey.create({
      user_id: req.user.id,
      name,
      key_hash: keyHash,
      prefix,
      is_active: true,
      permissions: { scopes: ['read', 'write'] }
    });

    // Log action
    await models.ActivityLog.create({
      user_id: req.user.id,
      action: 'create_api_key',
      resource: 'ApiKey',
      resource_id: String(apiKey.id)
    });

    // Return the raw key strictly ONCE to user
    res.status(201).json({
      apiKey,
      rawKey
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({ error: 'Failed to generate API key.' });
  }
}

async function deleteKey(req, res) {
  try {
    const { id } = req.params;
    const { models } = req.tenantDb;

    const apiKey = await models.ApiKey.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found.' });
    }

    await apiKey.destroy();

    // Log action
    await models.ActivityLog.create({
      user_id: req.user.id,
      action: 'revoke_api_key',
      resource: 'ApiKey',
      resource_id: String(id)
    });

    res.json({ message: 'API key revoked and deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key.' });
  }
}

async function rotateKey(req, res) {
  try {
    const { id } = req.params;
    const { models } = req.tenantDb;

    const apiKey = await models.ApiKey.findOne({
      where: { id, user_id: req.user.id }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found.' });
    }

    // Disable old key
    await apiKey.update({ is_active: false });

    // Generate new key
    const rawKey = 'sb_live_' + crypto.randomBytes(24).toString('hex');
    const prefix = rawKey.substring(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const newApiKey = await models.ApiKey.create({
      user_id: req.user.id,
      name: `${apiKey.name} (Rotated)`,
      key_hash: keyHash,
      prefix,
      is_active: true,
      permissions: apiKey.permissions
    });

    // Log action
    await models.ActivityLog.create({
      user_id: req.user.id,
      action: 'rotate_api_key',
      resource: 'ApiKey',
      resource_id: String(id),
      metadata: { original_key_id: id, new_key_id: newApiKey.id }
    });

    res.json({
      apiKey: newApiKey,
      rawKey
    });
  } catch (error) {
    console.error('Rotate key error:', error);
    res.status(500).json({ error: 'Failed to rotate key.' });
  }
}

// ==========================================
// 3. Analytics & Usage Breakdown
// ==========================================

async function getUsageBreakdown(req, res) {
  try {
    const breakdown = await getApiUsageBreakdown(req.tenant);
    res.json(breakdown);
  } catch (error) {
    console.error('Analytics breakdown retrieval failed:', error);
    res.status(500).json({ error: 'Failed to compile usage breakdown reports.' });
  }
}

async function getUsageHistory(req, res) {
  // Return simulated metrics for usage history
  res.json({
    metrics: [
      { date: '2026-06-12', count: 120, storage: 2.1 },
      { date: '2026-06-13', count: 245, storage: 2.2 },
      { date: '2026-06-14', count: 180, storage: 2.2 },
      { date: '2026-06-15', count: 320, storage: 2.5 },
      { date: '2026-06-16', count: 410, storage: 2.8 },
      { date: '2026-06-17', count: 390, storage: 3.1 },
      { date: '2026-06-18', count: 450, storage: 3.2 }
    ]
  });
}

module.exports = {
  getUsers,
  inviteUser,
  getUser,
  updateUser,
  deleteUser,
  acceptInvite,
  getKeys,
  createKey,
  deleteKey,
  rotateKey,
  getUsageBreakdown,
  getUsageHistory
};
