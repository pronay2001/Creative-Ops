const https = require('https');
const querystring = require('querystring');

let cachedToken = null;
let tokenExpiry = 0;

function isConfigured() {
  return !!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET && process.env.MAIL_FROM);
}

async function getToken() {
  if (!isConfigured()) throw new Error('Email credentials not configured');
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const tenantId = process.env.AZURE_TENANT_ID;
  const body = querystring.stringify({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'login.microsoftonline.com',
      path: `/${tenantId}/oauth2/v2.0/token`,
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
            tokenExpiry = Date.now() + ((parsed.expires_in || 3599) - 300) * 1000;
            resolve(cachedToken);
          } else {
            reject(new Error(`Graph token error: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Graph token parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendMail(recipients, subject, htmlBody) {
  if (!isConfigured()) {
    console.warn('[email] Microsoft Graph credentials not configured, skipping email');
    return;
  }

  const token = await getToken();
  const mailFrom = process.env.MAIL_FROM;

  const toRecipients = (Array.isArray(recipients) ? recipients : [recipients]).map(r => {
    if (typeof r === 'string') return { emailAddress: { address: r } };
    return { emailAddress: { address: r.address, name: r.name || '' } };
  });

  const payload = JSON.stringify({
    message: {
      subject,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients,
    },
    saveToSentItems: false,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'graph.microsoft.com',
      path: `/v1.0/users/${encodeURIComponent(mailFrom)}/sendMail`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 202 || res.statusCode === 200) {
          console.log(`[email] Sent: ${subject}`);
          resolve();
        } else {
          reject(new Error(`Graph sendMail failed (${res.statusCode}): ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { sendMail, isConfigured };
