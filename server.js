require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { migrate } = require('./db/migrate');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));

function uuid() {
  return crypto.randomUUID();
}

let emailService = null;
try {
  emailService = require('./services/email');
} catch (e) { /* ok */ }

let emailTemplates = null;
try {
  emailTemplates = require('./services/email-templates');
} catch (e) { /* ok */ }

function fireEmail(to, subject, html) {
  if (!emailService || !emailService.sendMail) return;
  emailService.sendMail(to, subject, html).catch(err => {
    console.error('[email] Notification failed:', err.message);
  });
}

// ── Auth helpers ──────────────────────────────────────

const ALLOWED_DOMAINS = ['hoichoi.tv', 'svf.in'];
const CREATOR_ROLES = ['requester', 'creative_lead', 'approver'];
const LEAD_ROLES = ['creative_lead'];
const APPROVER_ROLES = ['creative_lead', 'approver'];

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

async function getSessionUser(req) {
  if (!req.session.userId) return null;
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
  return result.rows[0] || null;
}

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  requireAuth(req, res, next);
});

// ── Auth / Session ─────────────────────────────────────

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    if (!result.rows[0]) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'User not found' });
    }
    const u = result.rows[0];
    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      skills: u.skills || [],
      capacity: u.capacity || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split('@')[1];
  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    return res.status(403).json({ error: 'Only @hoichoi.tv and @svf.in email addresses are allowed' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1 AND is_active = true', [normalizedEmail]);
    if (!result.rows[0]) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const u = result.rows[0];
    if (!u.password_hash) {
      return res.status(401).json({ error: 'Account not set up. Contact your admin.' });
    }
    const valid = await bcrypt.compare(password, u.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    req.session.userId = u.id;
    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      skills: u.skills || [],
      capacity: u.capacity || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ── Load All (bulk) ────────────────────────────────────

app.get('/api/load-all', async (req, res) => {
  try {
    const [users, campaigns, requests, deliverables, activity, comments, versions, knowledge, schedule] = await Promise.all([
      pool.query('SELECT * FROM users WHERE is_active = true ORDER BY name'),
      pool.query('SELECT * FROM campaigns ORDER BY created_date DESC'),
      pool.query('SELECT * FROM requests ORDER BY created_date DESC'),
      pool.query('SELECT * FROM deliverables ORDER BY created_at'),
      pool.query('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50'),
      pool.query('SELECT * FROM comments ORDER BY created_at'),
      pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'versions' LIMIT 1`),
      pool.query('SELECT * FROM knowledge_entries ORDER BY created_at DESC'),
      pool.query('SELECT * FROM content_schedule ORDER BY scheduled_date'),
    ]);

    const delMap = {};
    deliverables.rows.forEach(d => {
      if (!delMap[d.request_id]) delMap[d.request_id] = [];
      delMap[d.request_id].push(d);
    });

    const requestsWithDel = requests.rows.map(r => ({
      ...r,
      deliverables: delMap[r.id] || []
    }));

    res.json({
      users: users.rows,
      campaigns: campaigns.rows,
      requests: requestsWithDel,
      activityLog: activity.rows,
      comments: comments.rows,
      versions: [],
      knowledgeBase: knowledge.rows,
      contentSchedule: schedule.rows,
    });
  } catch (err) {
    console.error('[load-all]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Users ──────────────────────────────────────────────

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE is_active = true ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user || !LEAD_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Only creative leads can manage users' });
    }
    const { id, name, email, role, skills, capacity } = req.body;
    const uid = id || uuid();
    const result = await pool.query(
      `INSERT INTO users (id, name, email, role, skills, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET name=$2, role=$4, skills=$5, capacity=$6, updated_at=NOW()
       RETURNING *`,
      [uid, name, email, role || 'requester', skills || [], capacity || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Campaigns ──────────────────────────────────────────

app.get('/api/campaigns', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM campaigns ORDER BY created_date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/campaigns', async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user || !CREATOR_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'You don\'t have permission to create campaigns' });
    }
    const { name, show, status, description } = req.body;
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO campaigns (id, name, show, status, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, name, show || '', status || 'active', description || '', req.session.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getSessionUser(req);
    const campaign = await pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
    if (!campaign.rows[0]) return res.status(404).json({ error: 'Campaign not found' });

    const isCreator = campaign.rows[0].created_by === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    if (!isCreator && !isLead) {
      return res.status(403).json({ error: 'You can only edit campaigns you created' });
    }

    const fields = req.body;
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [key, val] of Object.entries(fields)) {
      const col = key === 'show' ? 'show' : key === 'createdDate' ? 'created_date' : key;
      sets.push(`${col} = $${i}`);
      vals.push(val);
      i++;
    }
    sets.push(`updated_at = NOW()`);
    vals.push(id);
    const result = await pool.query(
      `UPDATE campaigns SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Requests ───────────────────────────────────────────

app.get('/api/requests', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requests ORDER BY created_date DESC');
    const dels = await pool.query('SELECT * FROM deliverables ORDER BY created_at');
    const delMap = {};
    dels.rows.forEach(d => {
      if (!delMap[d.request_id]) delMap[d.request_id] = [];
      delMap[d.request_id].push(d);
    });
    const rows = result.rows.map(r => ({ ...r, deliverables: delMap[r.id] || [] }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests', async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user || !CREATOR_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'You don\'t have permission to create requests' });
    }

    const { title, campaignId, assetTypeId, department, platforms, assignedTo, priority, goLiveDate, internalDeadline, brief, deliverables, vertical, isExpedited } = req.body;
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO requests (id, title, campaign_id, asset_type_id, department, platforms, assigned_to, status, priority, go_live_date, internal_deadline, brief, created_by, vertical, is_expedited)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'intake', $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [id, title, campaignId || null, assetTypeId, department || '', platforms || [], assignedTo || null, priority || 'medium', goLiveDate || null, internalDeadline || null, JSON.stringify(brief || {}), req.session.userId, vertical || '', isExpedited || false]
    );

    if (deliverables && deliverables.length) {
      for (const d of deliverables) {
        const did = d.id || uuid();
        await pool.query(
          `INSERT INTO deliverables (id, request_id, asset_type_id, platforms, assigned_to, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [did, id, d.assetTypeId, d.platforms || [], d.assignedTo || null, d.status || 'intake']
        );
      }
    }

    await pool.query(
      `INSERT INTO activity_log (request_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [id, req.session.userId, 'created', JSON.stringify({ detail: `Created request: ${title}` })]
    );

    const row = result.rows[0];
    const dels = await pool.query('SELECT * FROM deliverables WHERE request_id = $1', [id]);
    row.deliverables = dels.rows;
    res.json(row);
  } catch (err) {
    console.error('[POST /api/requests]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const user = await getSessionUser(req);
    const oldRow = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (!oldRow.rows[0]) return res.status(404).json({ error: 'Request not found' });
    const oldData = oldRow.rows[0];

    const isCreator = oldData.created_by === req.session.userId;
    const isAssignee = oldData.assigned_to === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    const isApprover = user && APPROVER_ROLES.includes(user.role);

    const isStatusChange = fields.status && fields.status !== oldData.status;
    const isAssignmentChange = fields.assignedTo !== undefined && fields.assignedTo !== oldData.assigned_to;
    const isBriefEdit = fields.title || fields.brief || fields.priority || fields.goLiveDate || fields.internalDeadline;

    if (isStatusChange) {
      if (!isAssignee && !isLead && !isApprover) {
        return res.status(403).json({ error: 'Only the assigned designer, creative lead, or approver can change status' });
      }
    }
    if (isAssignmentChange) {
      if (!isCreator && !isLead) {
        return res.status(403).json({ error: 'Only the request creator or creative lead can assign requests' });
      }
    }
    if (!isStatusChange && !isAssignmentChange) {
      if (!isCreator && !isLead) {
        return res.status(403).json({ error: 'You can only edit requests you created' });
      }
    }

    const sets = [];
    const vals = [];
    let i = 1;

    const colMap = {
      campaignId: 'campaign_id',
      assetTypeId: 'asset_type_id',
      assignedTo: 'assigned_to',
      goLiveDate: 'go_live_date',
      internalDeadline: 'internal_deadline',
      createdBy: 'created_by',
      createdDate: 'created_date',
      isExpedited: 'is_expedited',
    };

    for (const [key, val] of Object.entries(fields)) {
      if (key === 'deliverables') continue;
      const col = colMap[key] || key;
      if (col === 'brief') {
        sets.push(`${col} = $${i}`);
        vals.push(JSON.stringify(val));
      } else {
        sets.push(`${col} = $${i}`);
        vals.push(val);
      }
      i++;
    }

    if (sets.length === 0) {
      return res.json(oldData);
    }

    sets.push(`updated_at = NOW()`);
    vals.push(id);
    const result = await pool.query(
      `UPDATE requests SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    const updated = result.rows[0];

    if (isStatusChange) {
      await pool.query(
        `INSERT INTO activity_log (request_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
        [id, req.session.userId, 'status_changed', JSON.stringify({ detail: `Status changed from ${oldData.status} to ${fields.status}`, oldStatus: oldData.status, newStatus: fields.status })]
      );
      if (emailService && emailTemplates) {
        const recipients = [];
        if (updated.assigned_to) {
          const a = await pool.query('SELECT * FROM users WHERE id = $1', [updated.assigned_to]);
          if (a.rows[0]) recipients.push({ address: a.rows[0].email, name: a.rows[0].name });
        }
        if (updated.created_by && updated.created_by !== updated.assigned_to) {
          const c = await pool.query('SELECT * FROM users WHERE id = $1', [updated.created_by]);
          if (c.rows[0]) recipients.push({ address: c.rows[0].email, name: c.rows[0].name });
        }
        if (recipients.length) {
          const html = emailTemplates.statusChange(updated, oldData.status, fields.status);
          fireEmail(recipients, `[CreativeOps] Status update: ${updated.title} → ${fields.status}`, html);
        }
      }
    }

    if (isAssignmentChange) {
      await pool.query(
        `INSERT INTO activity_log (request_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
        [id, req.session.userId, 'assigned', JSON.stringify({ detail: `Assigned to user ${fields.assignedTo}` })]
      );
      if (emailService && emailTemplates) {
        const assignee = await pool.query('SELECT * FROM users WHERE id = $1', [fields.assignedTo]);
        if (assignee.rows[0]) {
          const html = emailTemplates.taskAssignment(updated, assignee.rows[0]);
          fireEmail(
            [{ address: assignee.rows[0].email, name: assignee.rows[0].name }],
            `[CreativeOps] New task assigned: ${updated.title}`,
            html
          );
        }
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getSessionUser(req);
    const request = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (!request.rows[0]) return res.status(404).json({ error: 'Request not found' });

    const isCreator = request.rows[0].created_by === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    if (!isCreator && !isLead) {
      return res.status(403).json({ error: 'Only the creator or creative lead can delete requests' });
    }

    await pool.query('DELETE FROM deliverables WHERE request_id = $1', [id]);
    await pool.query('DELETE FROM comments WHERE request_id = $1', [id]);
    await pool.query('DELETE FROM activity_log WHERE request_id = $1', [id]);
    await pool.query('DELETE FROM requests WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const user = await getSessionUser(req);
    const request = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (!request.rows[0]) return res.status(404).json({ error: 'Request not found' });

    const isCreator = request.rows[0].created_by === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    if (!isCreator && !isLead) {
      return res.status(403).json({ error: 'Only the request creator or creative lead can assign requests' });
    }

    const result = await pool.query(
      'UPDATE requests SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [userId, id]
    );
    const updated = result.rows[0];

    await pool.query(
      `INSERT INTO activity_log (request_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [id, req.session.userId, 'assigned', JSON.stringify({ detail: `Assigned to user ${userId}` })]
    );

    res.json({ success: true, data: updated });

    if (emailService && emailTemplates && userId) {
      const assignee = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (assignee.rows[0]) {
        const html = emailTemplates.taskAssignment(updated, assignee.rows[0]);
        fireEmail(
          [{ address: assignee.rows[0].email, name: assignee.rows[0].name }],
          `[CreativeOps] New task assigned: ${updated.title}`,
          html
        );
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = await getSessionUser(req);
    const old = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Request not found' });

    const isAssignee = old.rows[0].assigned_to === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    const isApprover = user && APPROVER_ROLES.includes(user.role);
    if (!isAssignee && !isLead && !isApprover) {
      return res.status(403).json({ error: 'Only the assigned designer, creative lead, or approver can change status' });
    }

    const oldStatus = old.rows[0].status;
    const result = await pool.query(
      'UPDATE requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    const request = result.rows[0];

    await pool.query(
      `INSERT INTO activity_log (request_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [id, req.session.userId, 'status_changed', JSON.stringify({ detail: `Status changed from ${oldStatus} to ${status}`, oldStatus, newStatus: status })]
    );

    res.json({ success: true, data: request });

    if (emailService && emailTemplates) {
      const recipients = [];
      if (request.assigned_to) {
        const a = await pool.query('SELECT * FROM users WHERE id = $1', [request.assigned_to]);
        if (a.rows[0]) recipients.push({ address: a.rows[0].email, name: a.rows[0].name });
      }
      if (request.created_by && request.created_by !== request.assigned_to) {
        const c = await pool.query('SELECT * FROM users WHERE id = $1', [request.created_by]);
        if (c.rows[0]) recipients.push({ address: c.rows[0].email, name: c.rows[0].name });
      }
      if (recipients.length) {
        const html = emailTemplates.statusChange(request, oldStatus, status);
        fireEmail(recipients, `[CreativeOps] Status update: ${request.title} → ${status}`, html);
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Comments ───────────────────────────────────────────

app.get('/api/requests/:id/comments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM comments WHERE request_id = $1 ORDER BY created_at', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.session.userId;
    const result = await pool.query(
      'INSERT INTO comments (request_id, user_id, text) VALUES ($1, $2, $3) RETURNING *',
      [id, userId, text]
    );

    await pool.query(
      `INSERT INTO activity_log (request_id, user_id, action, details) VALUES ($1, $2, $3, $4)`,
      [id, userId, 'commented', JSON.stringify({ detail: text.substring(0, 100) })]
    );

    res.json(result.rows[0]);

    if (emailService && emailTemplates) {
      const request = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
      const allCommenters = await pool.query('SELECT DISTINCT user_id FROM comments WHERE request_id = $1', [id]);
      const recipientIds = new Set();
      if (request.rows[0]) {
        if (request.rows[0].assigned_to) recipientIds.add(request.rows[0].assigned_to);
        if (request.rows[0].created_by) recipientIds.add(request.rows[0].created_by);
      }
      allCommenters.rows.forEach(c => recipientIds.add(c.user_id));
      recipientIds.delete(userId);

      if (recipientIds.size > 0) {
        const users = await pool.query('SELECT * FROM users WHERE id = ANY($1)', [Array.from(recipientIds)]);
        const commenter = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const recipients = users.rows.map(u => ({ address: u.email, name: u.name }));
        const html = emailTemplates.newComment(request.rows[0], commenter.rows[0], text);
        fireEmail(recipients, `[CreativeOps] New comment on: ${request.rows[0].title}`, html);
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Activity Log ───────────────────────────────────────

app.get('/api/requests/:id/activity', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM activity_log WHERE request_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Deliverables ───────────────────────────────────────

app.post('/api/requests/:id/deliverables', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getSessionUser(req);
    const reqRow = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
    if (!reqRow.rows[0]) return res.status(404).json({ error: 'Request not found' });
    const isCreator = reqRow.rows[0].created_by === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    if (!isCreator && !isLead) {
      return res.status(403).json({ error: 'Only the request creator or creative lead can add deliverables' });
    }
    const { assetTypeId, platforms, assignedTo, status } = req.body;
    const did = uuid();
    const result = await pool.query(
      `INSERT INTO deliverables (id, request_id, asset_type_id, platforms, assigned_to, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [did, id, assetTypeId, platforms || [], assignedTo || null, status || 'intake']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/deliverables/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    const user = await getSessionUser(req);
    const del = await pool.query('SELECT d.*, r.created_by FROM deliverables d JOIN requests r ON r.id = d.request_id WHERE d.id = $1', [id]);
    if (!del.rows[0]) return res.status(404).json({ error: 'Deliverable not found' });
    const isCreator = del.rows[0].created_by === req.session.userId;
    const isAssignee = del.rows[0].assigned_to === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    const isApprover = user && APPROVER_ROLES.includes(user.role);

    if (fields.assignedTo !== undefined && !isLead) {
      return res.status(403).json({ error: 'Only the creative lead can reassign deliverables' });
    }
    if (fields.status !== undefined && !isAssignee && !isLead && !isApprover) {
      return res.status(403).json({ error: 'Only the assigned designer, lead, or approver can change deliverable status' });
    }

    const sets = [];
    const vals = [];
    let i = 1;
    const colMap = { assetTypeId: 'asset_type_id', assignedTo: 'assigned_to' };
    for (const [key, val] of Object.entries(fields)) {
      const col = colMap[key] || key;
      sets.push(`${col} = $${i}`);
      vals.push(val);
      i++;
    }
    vals.push(id);
    const result = await pool.query(
      `UPDATE deliverables SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/deliverables/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await getSessionUser(req);
    if (!user || !LEAD_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Only creative leads can assign deliverables' });
    }

    const result = await pool.query(
      'UPDATE deliverables SET assigned_to = $1 WHERE id = $2 RETURNING *',
      [userId, id]
    );
    const del = result.rows[0];
    res.json({ success: true, data: del });

    if (emailService && emailTemplates && userId && del) {
      const request = await pool.query('SELECT * FROM requests WHERE id = $1', [del.request_id]);
      const assignee = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (assignee.rows[0] && request.rows[0]) {
        const html = emailTemplates.taskAssignment(request.rows[0], assignee.rows[0]);
        fireEmail(
          [{ address: assignee.rows[0].email, name: assignee.rows[0].name }],
          `[CreativeOps] New task assigned: ${request.rows[0].title}`,
          html
        );
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Timesheet ──────────────────────────────────────────

app.get('/api/timesheet', async (req, res) => {
  try {
    const user = await getSessionUser(req);
    const { userId, startDate, endDate } = req.query;
    const isLead = user && LEAD_ROLES.includes(user.role);
    const targetUserId = isLead ? (userId || req.session.userId) : req.session.userId;
    let q = 'SELECT * FROM timesheet_entries WHERE user_id = $1';
    const vals = [targetUserId];
    let i = 2;
    if (startDate) { q += ` AND date >= $${i}`; vals.push(startDate); i++; }
    if (endDate) { q += ` AND date <= $${i}`; vals.push(endDate); i++; }
    q += ' ORDER BY date DESC';
    const result = await pool.query(q, vals);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/timesheet', async (req, res) => {
  try {
    const { userId, requestId, date, hours, notes } = req.body;
    if (userId !== req.session.userId) {
      return res.status(403).json({ error: 'You can only edit your own timesheet' });
    }
    const result = await pool.query(
      `INSERT INTO timesheet_entries (user_id, request_id, date, hours, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, requestId || null, date, hours || 0, notes || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Knowledge Base ─────────────────────────────────────

app.get('/api/campaigns/:id/knowledge', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM knowledge_entries WHERE campaign_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/campaigns/:id/knowledge', async (req, res) => {
  try {
    const user = await getSessionUser(req);
    const campaign = await pool.query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign.rows[0]) return res.status(404).json({ error: 'Campaign not found' });

    const isCreator = campaign.rows[0].created_by === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    if (!isCreator && !isLead) {
      return res.status(403).json({ error: 'Only the campaign creator or creative lead can add knowledge entries' });
    }

    const { title, type, content, tags, reference } = req.body;
    const result = await pool.query(
      `INSERT INTO knowledge_entries (campaign_id, title, type, content, created_by, tags, reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.id, title, type || '', content || '', req.session.userId, tags || [], reference || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/knowledge/:id', async (req, res) => {
  try {
    const user = await getSessionUser(req);
    const entry = await pool.query('SELECT * FROM knowledge_entries WHERE id = $1', [req.params.id]);
    if (!entry.rows[0]) return res.status(404).json({ error: 'Entry not found' });

    const isCreator = entry.rows[0].created_by === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    if (!isCreator && !isLead) {
      return res.status(403).json({ error: 'Only the creator or creative lead can delete knowledge entries' });
    }

    await pool.query('DELETE FROM knowledge_entries WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Content Schedule ───────────────────────────────────

app.get('/api/campaigns/:id/content-schedule', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM content_schedule WHERE campaign_id = $1 ORDER BY scheduled_date', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/campaigns/:id/content-schedule', async (req, res) => {
  try {
    const user = await getSessionUser(req);
    const campaign = await pool.query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign.rows[0]) return res.status(404).json({ error: 'Campaign not found' });

    const isCreator = campaign.rows[0].created_by === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    if (!isCreator && !isLead) {
      return res.status(403).json({ error: 'Only the campaign creator or creative lead can add schedule items' });
    }

    const { title, platform, scheduledDate, status, assignedTo, notes, linkedRequestId, platforms } = req.body;
    const result = await pool.query(
      `INSERT INTO content_schedule (campaign_id, title, platform, scheduled_date, status, assigned_to, notes, linked_request_id, platforms, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.params.id, title, platform || '', scheduledDate || null, status || 'planned', assignedTo || null, notes || '', linkedRequestId || null, platforms || [], req.session.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/content-schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getSessionUser(req);
    const item = await pool.query('SELECT * FROM content_schedule WHERE id = $1', [id]);
    if (!item.rows[0]) return res.status(404).json({ error: 'Schedule item not found' });
    const isCreator = item.rows[0].created_by === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    if (!isCreator && !isLead) {
      return res.status(403).json({ error: 'Only the item creator or creative lead can edit schedule items' });
    }
    const fields = req.body;
    const sets = [];
    const vals = [];
    let i = 1;
    const colMap = { scheduledDate: 'scheduled_date', assignedTo: 'assigned_to', linkedRequestId: 'linked_request_id', releaseDate: 'scheduled_date', createdBy: 'created_by' };
    for (const [key, val] of Object.entries(fields)) {
      const col = colMap[key] || key;
      sets.push(`${col} = $${i}`);
      vals.push(val);
      i++;
    }
    vals.push(id);
    const result = await pool.query(
      `UPDATE content_schedule SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/content-schedule/:id', async (req, res) => {
  try {
    const user = await getSessionUser(req);
    const item = await pool.query('SELECT * FROM content_schedule WHERE id = $1', [req.params.id]);
    if (!item.rows[0]) return res.status(404).json({ error: 'Schedule item not found' });
    const isCreator = item.rows[0].created_by === req.session.userId;
    const isLead = user && LEAD_ROLES.includes(user.role);
    if (!isCreator && !isLead) {
      return res.status(403).json({ error: 'Only the item creator or creative lead can delete schedule items' });
    }
    await pool.query('DELETE FROM content_schedule WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Keka HR Sync ───────────────────────────────────────

app.post('/api/keka/sync', async (req, res) => {
  try {
    const user = await getSessionUser(req);
    if (!user || !LEAD_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Only creative leads can sync from Keka' });
    }
    const keka = require('./services/keka');
    const result = await keka.syncEmployees(pool);
    res.json(result);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      return res.status(501).json({ error: 'Keka integration not configured' });
    }
    console.error('[keka sync]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── SPA Fallback ───────────────────────────────────────

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

// ── Start ──────────────────────────────────────────────

async function start() {
  try {
    await migrate();
    console.log('[server] Database migration complete');
  } catch (err) {
    console.error('[server] Migration failed:', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] CreativeOps running at http://localhost:${PORT}`);
  });
}

start();
