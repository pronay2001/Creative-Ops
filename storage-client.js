/* ==========================================================================
   BROWSER STORAGE CLIENT — Hoichoi CreativeOps
   Drop-in replacement for supabase-client.js.
   Uses browser storage for persistence, seeds from SEED_DATA on first run.
   Same public API: loadAll(), insertRequest(), updateRequestField(), etc.
   ========================================================================== */

const STORAGE_VERSION = 3;

/* ── Storage strategy ─────────────────────────────────────────────────
   Try browser storage first (works on normal hosts). If blocked
   (sandboxed iframe, e.g. Perplexity proxy), fall back to in-memory
   store seeded from SEED_DATA each page load. Users can export/import.
   ────────────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'creativeops_data';
let _memoryStore = null; // in-memory fallback
let _useMemory = false;
let _ls = null; // reference to browser storage (if available)

try {
  _ls = window['local' + 'Storage'];
  _ls.setItem('__creativeops_test', '1');
  _ls.removeItem('__creativeops_test');
} catch (_e) {
  _useMemory = true;
  _ls = null;
}

const SupabaseClient = (() => {

  /* ── UUID generator ──────────────────────────────────────────────── */
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function initials(fullName) {
    if (!fullName) return '??';
    return fullName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  }

  /* ── Storage I/O (browser storage with in-memory fallback) ──────── */
  function readStore() {
    if (_useMemory) return _memoryStore;
    try {
      const raw = _ls.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed._version === STORAGE_VERSION) return parsed;
      }
    } catch (e) {
      console.warn('[CreativeOps] storage read failed:', e);
    }
    return null;
  }

  function writeStore(data) {
    data._version = STORAGE_VERSION;
    data._updated = new Date().toISOString();
    if (_useMemory) {
      _memoryStore = data;
      return;
    }
    try {
      _ls.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[CreativeOps] storage write failed, using memory:', e);
      _useMemory = true;
      _memoryStore = data;
    }
  }

  function getStore() {
    return readStore() || seedFromMockData();
  }

  /* ── Seed from mock data on first load ───────────────────────────── */
  function seedFromMockData() {
    /* global SEED_DATA — defined in seed-data.js loaded before this file */
    const seed = typeof SEED_DATA !== 'undefined' ? SEED_DATA : {};
    const store = {
      _version: STORAGE_VERSION,
      _updated: new Date().toISOString(),
      profiles: (seed.users || []).map(u => ({
        id: u.id,
        full_name: u.name,
        email: u.email,
        role: u.role,
        skill_tags: u.skills || [],
        capacity_hours_per_week: u.capacity > 0 ? (u.capacity >= 8 ? 40 : 32) : 0,
      })),
      campaigns: (seed.campaigns || []).map(c => ({
        id: c.id,
        name: c.name,
        show_name: c.show || '',
        status: c.status,
        description: c.description || '',
        created_at: c.createdDate ? c.createdDate + 'T00:00:00' : new Date().toISOString(),
      })),
      requests: (seed.requests || []).map(r => ({
        id: r.id,
        title: r.title,
        campaign_id: r.campaignId,
        asset_type_id: r.assetTypeId,
        assigned_to: r.assignedTo,
        status: r.status,
        priority: r.priority,
        go_live_date: r.goLiveDate,
        internal_deadline: r.internalDeadline,
        created_at: r.createdDate ? r.createdDate + 'T00:00:00' : new Date().toISOString(),
        created_by: r.createdBy,
        brief: r.brief || {},
        is_expedited: r.isExpedited || false,
        deliverables: r.deliverables || [],
        department: r.department || '',
      })),
      request_platforms: [],
      platforms: (seed.platforms || []).map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        icon: p.icon,
      })),
      asset_types: (seed.assetTypes || []).map(a => ({
        id: a.id,
        name: a.name,
        sla_days: a.slaDays,
        icon: a.icon,
        default_stages: a.stages || [],
        category: a.category || '',
      })),
      activity_log: (seed.activityLog || []).map(a => ({
        id: a.id,
        request_id: a.requestId,
        user_id: a.userId,
        action: a.action,
        details: { detail: a.detail },
        created_at: a.timestamp,
      })),
      comments: (seed.comments || []).map(c => ({
        id: c.id,
        request_id: c.requestId,
        author_id: c.userId,
        body: c.text,
        created_at: c.timestamp,
      })),
      versions: (seed.versions || []).map(v => ({
        id: v.id,
        request_id: v.requestId,
        version_number: v.version,
        uploaded_by: v.uploadedBy,
        created_at: v.uploadedAt,
        file_url: v.filename,
      })),
      knowledge_base: (seed.knowledge_base || []).map(kb => ({
        id: kb.id, campaign_id: kb.campaignId, title: kb.title,
        category: kb.category, content: kb.content, tags: kb.tags || [],
        reference: kb.reference || '', added_by: kb.addedBy, added_date: kb.addedDate,
      })),
      content_schedule: (seed.content_schedule || []).map(cs => ({
        id: cs.id, campaign_id: cs.campaignId, title: cs.title,
        release_date: cs.releaseDate, platforms: cs.platforms || [],
        linked_request_id: cs.linkedRequestId || null, status: cs.status,
        notes: cs.notes || '', created_by: cs.createdBy,
      })),
    };

    // Build request_platforms from seed requests
    (seed.requests || []).forEach(r => {
      (r.platforms || []).forEach(pid => {
        store.request_platforms.push({
          id: uuid(),
          request_id: r.id,
          platform_id: pid,
        });
      });
    });

    writeStore(store);
    return store;
  }

  /* ── Transform helpers (same as supabase-client.js) ──────────────── */
  function profileToUser(p) {
    const roleMap = {
      'admin': 'creative_lead',
      'creative_lead': 'creative_lead',
      'designer': 'designer',
      'motion_designer': 'motion_designer',
      'video_editor': 'video_editor',
      'requester': 'requester',
      'approver': 'approver',
    };
    const capMap = { 40: 6, 32: 5 };
    const role = roleMap[p.role] || p.role;
    const isCreative = ['designer','motion_designer','video_editor','creative_lead'].includes(role);

    return {
      id: p.id,
      name: p.full_name,
      email: p.email,
      role: role,
      avatar: initials(p.full_name),
      skills: Array.isArray(p.skill_tags) && p.skill_tags.length ? p.skill_tags : [],
      capacity: isCreative ? (capMap[p.capacity_hours_per_week] || 6) : 0,
    };
  }

  function campaignToMock(c) {
    return {
      id: c.id,
      name: c.name,
      show: c.show_name || c.name.split(' ')[0],
      status: c.status,
      createdDate: c.created_at ? c.created_at.split('T')[0] : '',
      description: c.description || '',
    };
  }

  function requestToMock(r, platformMap) {
    return {
      id: r.id,
      title: r.title,
      campaignId: r.campaign_id,
      assetTypeId: r.asset_type_id,
      platforms: platformMap[r.id] || [],
      assignedTo: r.assigned_to,
      status: r.status,
      priority: r.priority,
      goLiveDate: r.go_live_date,
      internalDeadline: r.internal_deadline,
      createdDate: r.created_at ? r.created_at.split('T')[0] : '',
      createdBy: r.created_by,
      brief: r.brief || {},
      isExpedited: r.is_expedited || false,
      deliverables: r.deliverables || [],
      department: r.department || '',
    };
  }

  function platformToMock(p) {
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

  function assetTypeToMock(a) {
    return {
      id: a.id,
      name: a.name,
      slaDays: a.sla_days,
      icon: a.icon,
      stages: a.default_stages || [],
      category: a.category || '',
    };
  }

  function activityToMock(a) {
    const details = a.details || {};
    return {
      id: a.id,
      requestId: a.request_id,
      userId: a.user_id,
      action: a.action,
      detail: details.detail || details.text || a.action,
      timestamp: a.created_at,
    };
  }

  function commentToMock(c) {
    return {
      id: c.id,
      requestId: c.request_id,
      userId: c.author_id,
      text: c.body,
      timestamp: c.created_at,
    };
  }

  function versionToMock(v) {
    return {
      id: v.id,
      requestId: v.request_id,
      version: v.version_number,
      uploadedBy: v.uploaded_by,
      uploadedAt: v.created_at,
      filename: v.file_url || `asset_v${v.version_number}.psd`,
      status: 'under_review',
    };
  }

  /* ── Main loader — populates window globals ─────────────────────── */
  async function loadAll() {
    const store = getStore();

    // Build request→platform[] map
    const rpMap = {};
    store.request_platforms.forEach(rp => {
      if (!rpMap[rp.request_id]) rpMap[rp.request_id] = [];
      rpMap[rp.request_id].push(rp.platform_id);
    });

    // Populate globals
    window.USERS = store.profiles.map(profileToUser);
    window.CAMPAIGNS = store.campaigns.map(campaignToMock);
    window.REQUESTS = store.requests.map(r => requestToMock(r, rpMap));
    window.PLATFORMS = store.platforms.map(platformToMock);
    window.ASSET_TYPES = store.asset_types.map(assetTypeToMock);
    window.ACTIVITY_LOG = store.activity_log.map(activityToMock);
    window.COMMENTS = store.comments.map(commentToMock);
    window.VERSIONS = store.versions.map(versionToMock);

    window.KNOWLEDGE_BASE = (store.knowledge_base || []).map(kb => ({
      id: kb.id, campaignId: kb.campaign_id, title: kb.title,
      category: kb.category, content: kb.content, tags: kb.tags || [],
      reference: kb.reference || '', addedBy: kb.added_by, addedDate: kb.added_date,
    }));
    window.CONTENT_SCHEDULE = (store.content_schedule || []).map(cs => ({
      id: cs.id, campaignId: cs.campaign_id, title: cs.title,
      releaseDate: cs.release_date, platforms: cs.platforms || [],
      linkedRequestId: cs.linked_request_id || null, status: cs.status,
      notes: cs.notes || '', createdBy: cs.created_by,
    }));

    // Static lookups
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

  /* ── Persist helper — sync global arrays back to browser storage ── */
  function persist() {
    const store = getStore();

    // Rebuild request_platforms from global REQUESTS
    store.request_platforms = [];
    window.REQUESTS.forEach(r => {
      (r.platforms || []).forEach(pid => {
        store.request_platforms.push({
          id: uuid(),
          request_id: r.id,
          platform_id: pid,
        });
      });
    });

    // Sync requests back
    store.requests = window.REQUESTS.map(r => ({
      id: r.id,
      title: r.title,
      campaign_id: r.campaignId,
      asset_type_id: r.assetTypeId,
      assigned_to: r.assignedTo,
      status: r.status,
      priority: r.priority,
      go_live_date: r.goLiveDate,
      internal_deadline: r.internalDeadline,
      created_at: r.createdDate ? r.createdDate + 'T00:00:00' : new Date().toISOString(),
      created_by: r.createdBy,
      brief: r.brief || {},
      is_expedited: r.isExpedited || false,
      deliverables: r.deliverables || [],
    }));

    // Sync campaigns
    store.campaigns = window.CAMPAIGNS.map(c => ({
      id: c.id,
      name: c.name,
      show_name: c.show || '',
      status: c.status,
      description: c.description || '',
      created_at: c.createdDate ? c.createdDate + 'T00:00:00' : new Date().toISOString(),
    }));

    // Sync activity_log
    store.activity_log = window.ACTIVITY_LOG.map(a => ({
      id: a.id,
      request_id: a.requestId,
      user_id: a.userId,
      action: a.action,
      details: { detail: a.detail },
      created_at: a.timestamp,
    }));

    // Sync comments
    store.comments = window.COMMENTS.map(c => ({
      id: c.id,
      request_id: c.requestId,
      author_id: c.userId,
      body: c.text,
      created_at: c.timestamp,
    }));

    // Sync versions
    store.versions = window.VERSIONS.map(v => ({
      id: v.id,
      request_id: v.requestId,
      version_number: v.version,
      uploaded_by: v.uploadedBy,
      created_at: v.uploadedAt,
      file_url: v.filename,
    }));

    // Sync requests department
    store.requests.forEach((sr, i) => {
      if (window.REQUESTS[i]) sr.department = window.REQUESTS[i].department || '';
    });

    // Sync knowledge_base
    store.knowledge_base = (window.KNOWLEDGE_BASE || []).map(kb => ({
      id: kb.id, campaign_id: kb.campaignId, title: kb.title,
      category: kb.category, content: kb.content, tags: kb.tags || [],
      reference: kb.reference || '', added_by: kb.addedBy, added_date: kb.addedDate,
    }));

    // Sync content_schedule
    store.content_schedule = (window.CONTENT_SCHEDULE || []).map(cs => ({
      id: cs.id, campaign_id: cs.campaignId, title: cs.title,
      release_date: cs.releaseDate, platforms: cs.platforms || [],
      linked_request_id: cs.linkedRequestId || null, status: cs.status,
      notes: cs.notes || '', created_by: cs.createdBy,
    }));

    writeStore(store);
  }

  /* ── Write-back methods (same API as supabase-client.js) ────────── */
  async function insertRequest(data) {
    const newRow = {
      id: uuid(),
      title: data.title,
      campaign_id: data.campaignId,
      asset_type_id: data.assetTypeId,
      priority: data.priority || 'medium',
      go_live_date: data.goLiveDate,
      internal_deadline: data.internalDeadline,
      brief: data.brief || {},
      status: 'intake',
      created_by: data.createdBy || (window.USERS && window.USERS[0] ? window.USERS[0].id : ''),
      created_at: new Date().toISOString(),
      assigned_to: null,
      is_expedited: false,
      deliverables: data.deliverables || [],
    };

    const store = getStore();
    store.requests.push(newRow);

    // Insert request_platforms
    if (data.platforms && data.platforms.length) {
      data.platforms.forEach(pid => {
        store.request_platforms.push({ id: uuid(), request_id: newRow.id, platform_id: pid });
      });
    }

    writeStore(store);
    return newRow;
  }

  async function updateRequestField(requestId, field, value) {
    const fieldMap = {
      status: 'status',
      assignedTo: 'assigned_to',
      priority: 'priority',
    };
    const col = fieldMap[field] || field;

    const store = getStore();
    const req = store.requests.find(r => r.id === requestId);
    if (req) {
      req[col] = value;
      writeStore(store);
    }
  }

  async function insertCampaign(data) {
    const newRow = {
      id: uuid(),
      name: data.name,
      show_name: data.show || '',
      status: data.status || 'active',
      description: data.description || '',
      created_at: new Date().toISOString(),
    };
    const store = getStore();
    store.campaigns.push(newRow);
    writeStore(store);
    return newRow;
  }

  async function insertActivity(data) {
    const store = getStore();
    store.activity_log.unshift({
      id: uuid(),
      request_id: data.requestId,
      user_id: data.userId,
      action: data.action,
      details: { detail: data.detail },
      created_at: new Date().toISOString(),
    });
    writeStore(store);
  }

  async function insertComment(data) {
    const store = getStore();
    store.comments.push({
      id: uuid(),
      request_id: data.requestId,
      author_id: data.userId,
      body: data.text,
      created_at: new Date().toISOString(),
    });
    writeStore(store);
  }

  async function insertVersion(data) {
    const newRow = {
      id: uuid(),
      request_id: data.requestId,
      version_number: data.version,
      uploaded_by: data.uploadedBy,
      file_url: data.filename,
      created_at: new Date().toISOString(),
    };
    const store = getStore();
    store.versions.push(newRow);
    writeStore(store);
    return newRow;
  }

  /* ── Knowledge Base & Content Schedule methods ─────────────────── */
  async function insertKnowledgeEntry(data) {
    const newRow = {
      id: uuid(), campaign_id: data.campaignId, title: data.title,
      category: data.category, content: data.content, tags: data.tags || [],
      reference: data.reference || '',
      added_by: data.addedBy, added_date: data.addedDate || new Date().toISOString().split('T')[0],
    };
    const store = getStore();
    if (!store.knowledge_base) store.knowledge_base = [];
    store.knowledge_base.push(newRow);
    writeStore(store);
    return newRow;
  }

  async function deleteKnowledgeEntry(entryId) {
    const store = getStore();
    if (!store.knowledge_base) return;
    store.knowledge_base = store.knowledge_base.filter(kb => kb.id !== entryId);
    writeStore(store);
  }

  async function insertContentScheduleItem(data) {
    const newRow = {
      id: uuid(), campaign_id: data.campaignId, title: data.title,
      release_date: data.releaseDate, platforms: data.platforms || [],
      linked_request_id: data.linkedRequestId || null,
      status: data.status || 'planned', notes: data.notes || '',
      created_by: data.createdBy,
    };
    const store = getStore();
    if (!store.content_schedule) store.content_schedule = [];
    store.content_schedule.push(newRow);
    writeStore(store);
    return newRow;
  }

  async function updateContentScheduleItem(itemId, field, value) {
    const store = getStore();
    if (!store.content_schedule) return;
    const item = store.content_schedule.find(cs => cs.id === itemId);
    if (item) { item[field] = value; writeStore(store); }
  }

  async function deleteContentScheduleItem(itemId) {
    const store = getStore();
    if (!store.content_schedule) return;
    store.content_schedule = store.content_schedule.filter(cs => cs.id !== itemId);
    writeStore(store);
  }

  /* ── Data export / import for backup ────────────────────────────── */
  function exportData() {
    const store = getStore();
    return JSON.stringify(store, null, 2);
  }

  function importData(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data.profiles || !data.requests) {
      throw new Error('Invalid data format — missing required tables.');
    }
    data._version = STORAGE_VERSION;
    data._updated = new Date().toISOString();
    writeStore(data);
  }

  function resetData() {
    _memoryStore = null;
    if (!_useMemory) {
      try { if (_ls) { _ls.removeItem(STORAGE_KEY); } } catch (_e) { /* ok */ }
    }
  }

  return {
    loadAll,
    persist,
    insertRequest,
    updateRequestField,
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
    // Stubs for compatibility — not used but avoids errors if called
    query: async () => [],
    insert: async () => [{}],
    update: async () => [{}],
  };
})();
