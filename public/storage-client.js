/* ==========================================================================
   API STORAGE CLIENT — Hoichoi CreativeOps
   Drop-in replacement for localStorage-based client.
   Uses fetch('/api/...') for all persistence.
   Same public API: loadAll(), insertRequest(), updateRequestField(), etc.
   ========================================================================== */

const SupabaseClient = (() => {

  function initials(fullName) {
    if (!fullName) return '??';
    return fullName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  }

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (res.status === 401) {
      window.location.reload();
      throw new Error('Session expired');
    }
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(data.error || "You don't have permission to do this", 'error');
      }
      throw new Error(data.error || 'Forbidden');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  function userFromRow(u) {
    const roleMap = {
      'admin': 'creative_lead',
      'creative_lead': 'creative_lead',
      'designer': 'designer',
      'motion_designer': 'motion_designer',
      'video_editor': 'video_editor',
      'requester': 'requester',
      'approver': 'approver',
    };
    const role = roleMap[u.role] || u.role;
    const isCreative = ['designer','motion_designer','video_editor','creative_lead'].includes(role);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: role,
      avatar: initials(u.name),
      skills: Array.isArray(u.skills) ? u.skills : [],
      capacity: isCreative ? (u.capacity || 6) : 0,
      department: u.department || null,
      designation: u.designation || null,
      reportsToName: u.reports_to_name || u.reportsToName || null,
      reportsToEmail: u.reports_to_email || u.reportsToEmail || null,
      location: u.location || null,
      phone: u.phone || null,
      joinedAt: u.joined_at || u.joinedAt || null,
      isActive: u.is_active !== undefined ? u.is_active : true,
    };
  }

  function campaignFromRow(c) {
    return {
      id: c.id,
      name: c.name,
      show: c.show || c.show_name || '',
      status: c.status,
      createdDate: c.created_date ? c.created_date.split('T')[0] : '',
      createdBy: c.created_by || '',
      description: c.description || '',
    };
  }

  function requestFromRow(r) {
    const deliverables = (r.deliverables || []).map(d => ({
      id: d.id,
      assetTypeId: d.asset_type_id || d.assetTypeId,
      platforms: d.platforms || [],
      assignedTo: d.assigned_to || d.assignedTo || null,
      status: d.status || 'intake',
    }));

    return {
      id: r.id,
      title: r.title,
      campaignId: r.campaign_id || r.campaignId,
      assetTypeId: r.asset_type_id || r.assetTypeId,
      platforms: r.platforms || [],
      assignedTo: r.assigned_to || r.assignedTo || null,
      status: r.status,
      priority: r.priority,
      goLiveDate: r.go_live_date || r.goLiveDate || '',
      internalDeadline: r.internal_deadline || r.internalDeadline || '',
      createdDate: r.created_date ? r.created_date.split('T')[0] : '',
      createdBy: r.created_by || r.createdBy || '',
      brief: r.brief || {},
      isExpedited: r.is_expedited || false,
      deliverables: deliverables,
      department: r.department || '',
    };
  }

  function activityFromRow(a) {
    const details = a.details || {};
    return {
      id: a.id,
      requestId: a.request_id || a.requestId,
      userId: a.user_id || a.userId,
      action: a.action,
      detail: details.detail || details.text || a.action,
      timestamp: a.created_at || a.timestamp,
    };
  }

  function commentFromRow(c) {
    return {
      id: c.id,
      requestId: c.request_id || c.requestId,
      userId: c.user_id || c.userId,
      text: c.text || c.body || '',
      timestamp: c.created_at || c.timestamp,
    };
  }

  function platformFromSeed(p) {
    const gradients = {
      instagram: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
    };
    const colorFix = { x: '#000000' };
    return {
      id: p.id,
      name: p.name,
      color: gradients[p.id] || colorFix[p.id] || p.color,
      dotClass: `platform-${p.id}`,
      icon: p.icon,
    };
  }

  function assetTypeFromSeed(a) {
    return {
      id: a.id,
      name: a.name,
      slaDays: a.slaDays || a.sla_days,
      icon: a.icon,
      stages: a.stages || a.default_stages || [],
      category: a.category || '',
    };
  }

  async function checkAuth() {
    try {
      const res = await fetch('/api/me');
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    return data;
  }

  async function register(name, email, password) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    return data;
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  }

  async function loadAll() {
    const seed = typeof SEED_DATA !== 'undefined' ? SEED_DATA : {};

    try {
      const data = await apiFetch('/api/load-all');

      window.USERS = (data.users || []).map(userFromRow);
      window.CAMPAIGNS = (data.campaigns || []).map(campaignFromRow);
      window.REQUESTS = (data.requests || []).map(requestFromRow);
      window.ACTIVITY_LOG = (data.activityLog || []).map(activityFromRow);
      window.COMMENTS = (data.comments || []).map(commentFromRow);
      window.VERSIONS = [];

      window.KNOWLEDGE_BASE = (data.knowledgeBase || []).map(kb => ({
        id: kb.id, campaignId: kb.campaign_id || kb.campaignId, title: kb.title,
        category: kb.type || kb.category || '', content: kb.content || '',
        tags: kb.tags || [], reference: kb.reference || '',
        addedBy: kb.created_by || kb.addedBy || '', addedDate: kb.created_at ? kb.created_at.split('T')[0] : '',
      }));

      window.CONTENT_SCHEDULE = (data.contentSchedule || []).map(cs => ({
        id: cs.id, campaignId: cs.campaign_id || cs.campaignId, title: cs.title,
        releaseDate: cs.scheduled_date || cs.releaseDate || '',
        platforms: cs.platform ? [cs.platform] : (cs.platforms || []),
        linkedRequestId: cs.linked_request_id || cs.linkedRequestId || null,
        status: cs.status || 'planned', notes: cs.notes || '',
        createdBy: cs.created_by || cs.createdBy || '',
      }));
    } catch (err) {
      console.warn('[CreativeOps] API load failed, using empty data:', err.message);
      window.USERS = [];
      window.CAMPAIGNS = [];
      window.REQUESTS = [];
      window.ACTIVITY_LOG = [];
      window.COMMENTS = [];
      window.VERSIONS = [];
      window.KNOWLEDGE_BASE = [];
      window.CONTENT_SCHEDULE = [];
    }

    window.PLATFORMS = (seed.platforms || []).map(platformFromSeed);
    window.ASSET_TYPES = (seed.assetTypes || []).map(assetTypeFromSeed);

    window.STATUSES = {
      intake:              { label: 'Intake',              color: 'gray',    cssClass: 'status-intake' },
      brief_approved:      { label: 'Brief Approved',      color: 'blue',    cssClass: 'status-brief-approved' },
      in_progress:         { label: 'In Progress',         color: 'blue',    cssClass: 'status-in-progress' },
      first_cut:           { label: 'First Cut',           color: 'blue',    cssClass: 'status-first-cut' },
      under_review:        { label: 'Under Review',        color: 'orange',  cssClass: 'status-under-review' },
      changes_in_progress: { label: 'Changes in Progress', color: 'orange',  cssClass: 'status-changes' },
      final_approved:      { label: 'Final Approved',      color: 'green',   cssClass: 'status-approved' },
      scheduled:           { label: 'Scheduled',           color: 'green',   cssClass: 'status-scheduled' },
      live:                { label: 'Live',                 color: 'green',   cssClass: 'status-live' },
    };
    window.PRIORITIES = {
      low:    { label: 'Low',    color: 'var(--color-text-muted)',  dot: '#888' },
      medium: { label: 'Medium', color: 'var(--color-primary)',     dot: '#2dd4bf' },
      high:   { label: 'High',   color: 'var(--color-warning)',     dot: '#fbbf24' },
      urgent: { label: 'Urgent', color: 'var(--color-error)',       dot: '#f87171' },
    };

    console.log(`[CreativeOps] Loaded: ${USERS.length} users, ${CAMPAIGNS.length} campaigns, ${REQUESTS.length} requests, ${PLATFORMS.length} platforms`);
  }

  async function insertRequest(data) {
    const row = await apiFetch('/api/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { id: row.id, ...row };
  }

  async function updateRequestField(requestId, field, value) {
    const body = {};
    body[field] = value;
    await apiFetch(`/api/requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async function deleteRequest(requestId) {
    await apiFetch(`/api/requests/${requestId}`, { method: 'DELETE' });
  }

  async function insertActivity(data) {
    // no-op: activity is logged server-side
  }

  async function insertComment(data) {
    await apiFetch(`/api/requests/${data.requestId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text: data.text }),
    });
  }

  async function insertVersion(data) {
    return { id: 'v_' + Date.now(), ...data };
  }

  async function insertCampaign(data) {
    const row = await apiFetch('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { id: row.id, ...row };
  }

  async function persist() {
    for (const r of window.REQUESTS) {
      if (r.deliverables && r.deliverables.length) {
        for (const d of r.deliverables) {
          if (d.id && !d.id.startsWith('del_auto_')) {
            try {
              await apiFetch(`/api/deliverables/${d.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  status: d.status,
                  assignedTo: d.assignedTo,
                  platforms: d.platforms,
                }),
              });
            } catch (e) {
              // ignore
            }
          }
        }
      }
    }
  }

  async function insertKnowledgeEntry(entry) {
    const row = await apiFetch(`/api/campaigns/${entry.campaignId}/knowledge`, {
      method: 'POST',
      body: JSON.stringify({
        title: entry.title,
        type: entry.category,
        content: entry.content,
        tags: entry.tags || [],
        reference: entry.reference || '',
      }),
    });
    return { id: row.id, ...row };
  }

  async function deleteKnowledgeEntry(entryId) {
    await apiFetch(`/api/knowledge/${entryId}`, { method: 'DELETE' });
  }

  async function insertContentScheduleItem(item) {
    const row = await apiFetch(`/api/campaigns/${item.campaignId}/content-schedule`, {
      method: 'POST',
      body: JSON.stringify({
        title: item.title,
        platform: (item.platforms || [])[0] || '',
        platforms: item.platforms || [],
        scheduledDate: item.releaseDate,
        status: item.status || 'planned',
        notes: item.notes || '',
        linkedRequestId: item.linkedRequestId || null,
      }),
    });
    return { id: row.id, ...row };
  }

  async function updateContentScheduleItem(itemId, field, value) {
    const body = {};
    body[field] = value;
    await apiFetch(`/api/content-schedule/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async function deleteContentScheduleItem(itemId) {
    await apiFetch(`/api/content-schedule/${itemId}`, { method: 'DELETE' });
  }

  function exportData() {
    const data = {
      users: window.USERS || [],
      campaigns: window.CAMPAIGNS || [],
      requests: window.REQUESTS || [],
      activityLog: window.ACTIVITY_LOG || [],
      comments: window.COMMENTS || [],
      versions: window.VERSIONS || [],
      knowledgeBase: window.KNOWLEDGE_BASE || [],
      contentSchedule: window.CONTENT_SCHEDULE || [],
    };
    return JSON.stringify(data, null, 2);
  }

  function importData(jsonString) {
    console.warn('[CreativeOps] Import not supported in API mode. Use the database directly.');
  }

  function resetData() {
    console.warn('[CreativeOps] Reset not supported in API mode. Clear the database directly.');
  }

  return {
    loadAll,
    persist,
    checkAuth,
    login,
    register,
    logout,
    insertRequest,
    updateRequestField,
    deleteRequest,
    insertCampaign,
    insertActivity,
    insertComment,
    insertVersion,
    insertKnowledgeEntry,
    deleteKnowledgeEntry,
    insertContentScheduleItem,
    updateContentScheduleItem,
    deleteContentScheduleItem,
    exportData,
    importData,
    resetData,
    query: async () => [],
    insert: async () => [{}],
    update: async () => [{}],
  };
})();
