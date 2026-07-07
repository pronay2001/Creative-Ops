const https = require('https');

let _email = null;
try { _email = require('./email'); } catch (e) { /* ok */ }

let cachedBotUserId = null;
const userIdCache = new Map();
const chatCache = new Map();

function isConfigured() {
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    (process.env.TEAMS_BOT_USER_ID || process.env.MAIL_FROM)
  );
}

async function getToken() {
  if (_email && typeof _email.getToken === 'function') return _email.getToken();
  throw new Error('Microsoft Graph token source not available (services/email.js missing getToken)');
}

function graph(method, urlPath, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Authorization': `Bearer ${token}` };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request({
      hostname: 'graph.microsoft.com',
      path: `/v1.0${urlPath}`,
      method,
      headers,
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { resolve({}); }
        } else {
          reject(new Error(`Graph ${method} ${urlPath} failed (${res.statusCode}): ${buf.slice(0, 400)}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getBotUserId(token) {
  if (cachedBotUserId) return cachedBotUserId;
  if (process.env.TEAMS_BOT_USER_ID) {
    cachedBotUserId = process.env.TEAMS_BOT_USER_ID;
    return cachedBotUserId;
  }
  const u = await graph('GET', `/users/${encodeURIComponent(process.env.MAIL_FROM)}`, token);
  if (!u.id) throw new Error(`Bot user not found for MAIL_FROM=${process.env.MAIL_FROM}`);
  cachedBotUserId = u.id;
  return cachedBotUserId;
}

async function getUserId(email, token) {
  const key = String(email).toLowerCase();
  if (userIdCache.has(key)) return userIdCache.get(key);
  const u = await graph('GET', `/users/${encodeURIComponent(email)}`, token);
  if (!u.id) throw new Error(`Recipient ${email} not found in tenant directory`);
  userIdCache.set(key, u.id);
  return u.id;
}

async function ensureChat(botId, recipientId, token) {
  const cacheKey = `${botId}:${recipientId}`;
  if (chatCache.has(cacheKey)) return chatCache.get(cacheKey);
  const chat = await graph('POST', '/chats', token, {
    chatType: 'oneOnOne',
    members: [
      {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: ['owner'],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${botId}')`,
      },
      {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: ['owner'],
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${recipientId}')`,
      },
    ],
  });
  if (!chat.id) throw new Error(`Failed to create chat: ${JSON.stringify(chat).slice(0, 300)}`);
  chatCache.set(cacheKey, chat.id);
  return chat.id;
}

// Throws on failure. Callers that want fire-and-forget behaviour should
// wrap the call in their own try/catch (notify() in server.js does this
// via Promise.allSettled so a Teams failure never blocks email).
async function sendChatMessage({ recipientEmail, htmlBody, subject }) {
  if (!isConfigured()) {
    throw new Error('Teams notifications not configured');
  }
  if (!recipientEmail) throw new Error('recipientEmail is required');

  const token = await getToken();
  const botId = await getBotUserId(token);
  const recipientId = await getUserId(recipientEmail, token);
  const chatId = await ensureChat(botId, recipientId, token);

  const content = subject
    ? `<p style="margin:0 0 8px;font-weight:600;">${escapeHtml(subject)}</p>${htmlBody || ''}`
    : (htmlBody || '');

  await graph('POST', `/chats/${chatId}/messages`, token, {
    body: { contentType: 'html', content },
  });
  console.log(`[teams] DM sent to ${recipientEmail}${subject ? `: ${subject}` : ''}`);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Channel Notifications ────────────────────────────────────────────────────
// Posts a message to a Teams channel.
// Requires TEAMS_CHANNEL_TEAM_ID + TEAMS_CHANNEL_ID env vars and the
// ChannelMessage.Send application permission granted in Azure.

function isChannelConfigured() {
  return isConfigured() &&
    !!(process.env.TEAMS_CHANNEL_TEAM_ID && process.env.TEAMS_CHANNEL_ID);
}

async function sendChannelNotification({ emoji, title, rows, url }) {
  if (!isChannelConfigured()) return;

  const teamId    = process.env.TEAMS_CHANNEL_TEAM_ID;
  const channelId = process.env.TEAMS_CHANNEL_ID;
  const token     = await getToken();

  const emojiPrefix = emoji ? `${emoji}&nbsp;` : '';
  const detailRows  = Array.isArray(rows) && rows.length
    ? `<table style="border-collapse:collapse;margin-top:8px;font-size:13px;">
        ${rows.map(([label, value]) =>
          `<tr>
            <td style="color:#888;padding:2px 12px 2px 0;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
            <td style="color:#333;padding:2px 0;vertical-align:top;">${escapeHtml(String(value || '—'))}</td>
          </tr>`
        ).join('')}
       </table>`
    : '';
  const cta = url
    ? `<p style="margin:12px 0 0;"><a href="${escapeHtml(url)}" style="color:#d20820;font-weight:600;">Open in CreativeOps →</a></p>`
    : '';

  const content = `<p style="margin:0;font-size:15px;font-weight:700;">${emojiPrefix}${escapeHtml(title)}</p>${detailRows}${cta}`;

  await graph(
    'POST',
    `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
    token,
    { body: { contentType: 'html', content } }
  );
  console.log(`[teams] Channel notification: ${title}`);
}

module.exports = { sendChatMessage, sendChannelNotification, isConfigured, isChannelConfigured };
