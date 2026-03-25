const https = require('https');
const querystring = require('querystring');

let cachedToken = null;
let tokenExpiry = 0;

function isConfigured() {
  return !!(process.env.KEKA_COMPANY && process.env.KEKA_CLIENT_ID && process.env.KEKA_CLIENT_SECRET && process.env.KEKA_API_KEY);
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const company = process.env.KEKA_COMPANY;
  const body = querystring.stringify({
    grant_type: 'kekaapi',
    scope: 'kekaapi',
    client_id: process.env.KEKA_CLIENT_ID,
    client_secret: process.env.KEKA_CLIENT_SECRET,
    api_key: process.env.KEKA_API_KEY,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${company}.keka.com`,
      path: '/connect/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) {
            cachedToken = parsed.access_token;
            tokenExpiry = Date.now() + ((parsed.expires_in || 3600) - 300) * 1000;
            resolve(cachedToken);
          } else {
            reject(new Error(`Keka token error: ${data}`));
          }
        } catch (e) {
          reject(new Error(`Keka token parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function apiGet(path, token) {
  const company = process.env.KEKA_COMPANY;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${company}.keka.com`,
      path,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Keka API parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncEmployees(pool) {
  if (!isConfigured()) {
    return { success: false, message: 'Keka HR credentials not configured', added: 0, updated: 0, skipped: 0 };
  }

  const token = await getToken();
  let page = 1;
  const pageSize = 100;
  let added = 0, updated = 0, skipped = 0;

  while (true) {
    const result = await apiGet(`/api/v1/hris/employees?pageNumber=${page}&pageSize=${pageSize}`, token);
    const employees = result.data || result || [];

    if (!Array.isArray(employees) || employees.length === 0) break;

    for (const emp of employees) {
      const email = (emp.email || '').toLowerCase();
      if (!email.endsWith('@hoichoi.tv') && !email.endsWith('@svf.in')) {
        skipped++;
        continue;
      }

      const name = emp.displayName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
      const kekaId = emp.employeeNumber || emp.id;
      const department = (emp.department && emp.department.name) || '';
      const jobTitle = (emp.jobTitle && emp.jobTitle.name) || '';
      const isActive = emp.isActive !== false;

      let role = 'requester';
      const titleLower = jobTitle.toLowerCase();
      const deptLower = department.toLowerCase();
      if (titleLower.includes('designer') || titleLower.includes('graphic')) role = 'designer';
      else if (titleLower.includes('motion')) role = 'motion_designer';
      else if (titleLower.includes('video') || titleLower.includes('editor')) role = 'video_editor';
      else if (titleLower.includes('creative lead') || titleLower.includes('creative head') || titleLower.includes('art director')) role = 'creative_lead';
      else if (titleLower.includes('approver') || titleLower.includes('manager')) role = 'approver';

      let capacity = 0;
      if (['designer', 'motion_designer', 'video_editor', 'creative_lead'].includes(role)) {
        capacity = role === 'creative_lead' ? 8 : 6;
      }

      try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
          await pool.query(
            `UPDATE users SET name=$1, keka_id=$2, role=$3, capacity=$4, is_active=$5, updated_at=NOW() WHERE email=$6`,
            [name, kekaId, role, capacity, isActive, email]
          );
          updated++;
        } else {
          const uid = 'keka_' + (kekaId || email.split('@')[0]);
          await pool.query(
            `INSERT INTO users (id, keka_id, name, email, role, capacity, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [uid, kekaId, name, email, role, capacity, isActive]
          );
          added++;
        }
      } catch (err) {
        console.warn(`[keka] Failed to upsert ${email}:`, err.message);
        skipped++;
      }
    }

    if (employees.length < pageSize) break;
    page++;
    await delay(1500);
  }

  return { success: true, message: `Keka sync complete`, added, updated, skipped };
}

module.exports = { syncEmployees, isConfigured };
