/* ==========================================================================
   DATA SERVICE — Hoichoi CreativeOps
   Clean function interfaces that operate on global arrays.
   Arrays are populated by supabase-client.js on init.
   Mutations write through to Supabase in the background.
   ========================================================================== */

const DataService = (() => {

  // ── Status ordering for computing overall request status ───────────────
  const STATUS_ORDER = ['intake','brief_approved','in_progress','first_cut','under_review','changes_in_progress','final_approved','scheduled','live'];

  function statusIndex(s) {
    const idx = STATUS_ORDER.indexOf(s);
    return idx >= 0 ? idx : 0;
  }

  // ── Helper: compute derived fields ──────────────────────────────────────
  function enrichRequest(r) {
    // Synthesize deliverables if missing (backward compat)
    let deliverables = r.deliverables && r.deliverables.length > 0 ? r.deliverables : [
      { id: 'del_auto_' + r.id, assetTypeId: r.assetTypeId, platforms: r.platforms || [], assignedTo: r.assignedTo, status: r.status }
    ];

    // Enrich each deliverable
    deliverables = deliverables.map(d => {
      const dAssetType = ASSET_TYPES.find(a => a.id === d.assetTypeId);
      const dAssignee = USERS.find(u => u.id === d.assignedTo);
      const dPlatformObjects = (d.platforms || []).map(pid => PLATFORMS.find(p => p.id === pid)).filter(Boolean);
      return { ...d, assetType: dAssetType, assignee: dAssignee, platformObjects: dPlatformObjects, statusInfo: STATUSES[d.status] };
    });

    // Compute overall status = least progressed deliverable
    const overallStatus = deliverables.reduce((least, d) => {
      return statusIndex(d.status) < statusIndex(least) ? d.status : least;
    }, deliverables[0] ? deliverables[0].status : r.status);

    // Collect all platforms across deliverables (deduplicated)
    const allPlatformIds = [...new Set(deliverables.flatMap(d => d.platforms || []))];

    // Collect all assignees across deliverables (deduplicated)
    const allAssigneeIds = [...new Set(deliverables.map(d => d.assignedTo).filter(Boolean))];
    const allAssignees = allAssigneeIds.map(uid => USERS.find(u => u.id === uid)).filter(Boolean);

    const campaign = CAMPAIGNS.find(c => c.id === r.campaignId);
    const assetType = ASSET_TYPES.find(a => a.id === r.assetTypeId);
    const deptList = typeof SEED_DATA !== 'undefined' && SEED_DATA.departments ? SEED_DATA.departments : [];
    const departmentObj = deptList.find(d => d.id === r.department) || null;
    const verticalList = typeof SEED_DATA !== 'undefined' && SEED_DATA.verticals ? SEED_DATA.verticals : [];
    const verticalObj = verticalList.find(v => v.id === r.vertical) || null;
    const assignee = USERS.find(u => u.id === r.assignedTo);
    const creator = USERS.find(u => u.id === r.createdBy);
    const today = new Date();
    const goLive = new Date(r.goLiveDate);
    const deadline = new Date(r.internalDeadline);
    const daysUntilDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    const daysUntilGoLive = Math.ceil((goLive - today) / (1000 * 60 * 60 * 24));
    const isOverdue = daysUntilDeadline < 0 && !['final_approved','scheduled','live'].includes(overallStatus);
    const isAtRisk = !isOverdue && daysUntilDeadline <= 2 && !['final_approved','scheduled','live'].includes(overallStatus);
    const isOnTrack = !isOverdue && !isAtRisk;
    const isExpedited = daysUntilGoLive < (assetType ? assetType.slaDays : 3);

    return {
      ...r,
      campaign,
      assetType,
      assignee,
      creator,
      daysUntilDeadline,
      daysUntilGoLive,
      isOverdue,
      isAtRisk,
      isOnTrack,
      isExpedited,
      statusInfo: STATUSES[overallStatus],
      priorityInfo: PRIORITIES[r.priority],
      platformObjects: allPlatformIds.map(pid => PLATFORMS.find(p => p.id === pid)).filter(Boolean),
      deliverables,
      allAssignees,
      deliverableCount: deliverables.length,
      computedStatus: overallStatus,
      department: r.department,
      departmentObj,
      vertical: r.vertical,
      verticalObj,
    };
  }

  // ── Requests ────────────────────────────────────────────────────────────
  function getRequests(filters = {}) {
    let results = REQUESTS.map(enrichRequest);

    if (filters.status) results = results.filter(r => r.status === filters.status);
    if (filters.campaignId) results = results.filter(r => r.campaignId === filters.campaignId);
    if (filters.assetTypeId) results = results.filter(r => r.assetTypeId === filters.assetTypeId);
    if (filters.assignedTo) results = results.filter(r => r.assignedTo === filters.assignedTo);
    if (filters.platform) results = results.filter(r => r.platforms.includes(filters.platform));
    if (filters.priority) results = results.filter(r => r.priority === filters.priority);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(r => r.title.toLowerCase().includes(q) || (r.campaign && r.campaign.name.toLowerCase().includes(q)));
    }

    return results;
  }

  function getRequestById(id) {
    const r = REQUESTS.find(req => req.id === id);
    return r ? enrichRequest(r) : null;
  }

  function createRequest(data) {
    // For deliverable-based requests, compute assetTypeId and platforms from first deliverable
    const deliverables = data.deliverables || [];
    const firstDel = deliverables.length > 0 ? deliverables[0] : null;
    const effectiveAssetTypeId = firstDel ? firstDel.assetTypeId : data.assetTypeId;
    const effectivePlatforms = firstDel ? firstDel.platforms : (data.platforms || []);

    const assetType = ASSET_TYPES.find(a => a.id === effectiveAssetTypeId);
    const slaDays = assetType ? assetType.slaDays : 3;
    const goLive = new Date(data.goLiveDate);
    const deadline = new Date(goLive);
    deadline.setDate(deadline.getDate() - slaDays);

    const tempId = 'temp_' + Date.now();
    const newReq = {
      id: tempId,
      title: data.title,
      campaignId: data.campaignId,
      assetTypeId: effectiveAssetTypeId,
      platforms: effectivePlatforms,
      assignedTo: null,
      status: 'intake',
      priority: data.priority || 'medium',
      goLiveDate: data.goLiveDate,
      internalDeadline: deadline.toISOString().split('T')[0],
      createdDate: new Date().toISOString().split('T')[0],
      createdBy: (window.__currentUser && window.__currentUser.id) || '',
      brief: data.brief || {},
      deliverables: deliverables,
      department: data.department || '',
      vertical: data.vertical || '',
    };

    REQUESTS.push(newReq);
    addActivity(newReq.id, newReq.createdBy, 'created', `Created request: ${newReq.title}`);

    // Async write to storage
    SupabaseClient.insertRequest({
      ...data,
      assetTypeId: effectiveAssetTypeId,
      platforms: effectivePlatforms,
      internalDeadline: newReq.internalDeadline,
      createdBy: newReq.createdBy,
      deliverables: deliverables,
    }).then(row => {
      // Replace temp ID with real UUID
      const idx = REQUESTS.findIndex(r => r.id === tempId);
      if (idx !== -1) REQUESTS[idx].id = row.id;
    }).catch(e => console.error('Create request failed:', e));

    return enrichRequest(newReq);
  }

  function updateRequestStatus(requestId, newStatus) {
    const req = REQUESTS.find(r => r.id === requestId);
    if (req) {
      req.status = newStatus;
      SupabaseClient.updateRequestField(requestId, 'status', newStatus).catch(e => console.error('Status update failed:', e));
      return enrichRequest(req);
    }
    return null;
  }

  function assignRequest(requestId, userId) {
    const req = REQUESTS.find(r => r.id === requestId);
    if (req) {
      req.assignedTo = userId;
      const user = USERS.find(u => u.id === userId);
      addActivity(requestId, (window.__currentUser && window.__currentUser.id) || '', 'assigned', `Assigned to ${user ? user.name : userId}`);
      SupabaseClient.updateRequestField(requestId, 'assignedTo', userId).catch(e => console.error('Assign failed:', e));
      return enrichRequest(req);
    }
    return null;
  }

  // ── Campaigns ───────────────────────────────────────────────────────────
  function getCampaigns() {
    return CAMPAIGNS.map(c => {
      const reqs = REQUESTS.filter(r => r.campaignId === c.id);
      const completed = reqs.filter(r => ['final_approved','scheduled','live'].includes(r.status)).length;
      const progress = reqs.length > 0 ? Math.round((completed / reqs.length) * 100) : 0;
      return { ...c, requestCount: reqs.length, completedCount: completed, progress };
    });
  }

  function getCampaignById(id) {
    const campaigns = getCampaigns();
    return campaigns.find(c => c.id === id) || null;
  }

  // ── Users ───────────────────────────────────────────────────────────────
  function getUsers() { return [...USERS]; }

  function getUserById(id) { return USERS.find(u => u.id === id) || null; }

  function getDesigners() {
    return USERS.filter(u => ['designer','motion_designer','video_editor','creative_lead'].includes(u.role));
  }

  function getWorkload() {
    const designers = getDesigners();
    return designers.map(d => {
      // Count deliverables assigned to this designer (not just top-level requests)
      let deliverableCount = 0;
      const activeReqs = REQUESTS.filter(r => {
        const enriched = enrichRequest(r);
        // Check if any deliverable is assigned to this designer and is active
        const hasActiveDeliverable = enriched.deliverables.some(del =>
          del.assignedTo === d.id && !['final_approved','scheduled','live'].includes(del.status)
        );
        if (hasActiveDeliverable) {
          deliverableCount += enriched.deliverables.filter(del =>
            del.assignedTo === d.id && !['final_approved','scheduled','live'].includes(del.status)
          ).length;
        }
        return hasActiveDeliverable;
      }).map(enrichRequest);
      const load = deliverableCount;
      const capacityStatus = load >= d.capacity ? 'over' : load >= d.capacity - 1 ? 'at' : 'under';
      return { ...d, activeRequests: activeReqs, activeCount: load, deliverableCount, capacityStatus };
    });
  }

  // ── KPIs ────────────────────────────────────────────────────────────────
  function getDashboardKPIs() {
    const all = REQUESTS.map(enrichRequest);
    const active = all.filter(r => !['live'].includes(r.status));
    const overdue = all.filter(r => r.isOverdue);
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const dueThisWeek = all.filter(r => {
      const d = new Date(r.internalDeadline);
      return d >= today && d <= weekEnd && !['final_approved','scheduled','live'].includes(r.status);
    });
    const inReview = all.filter(r => ['under_review','changes_in_progress'].includes(r.status));
    const activeCampaigns = CAMPAIGNS.filter(c => c.status === 'active');

    return {
      totalActive: active.length,
      overdue: overdue.length,
      dueThisWeek: dueThisWeek.length,
      inReview: inReview.length,
      campaignsActive: activeCampaigns.length,
    };
  }

  function getStatusDistribution() {
    const counts = {};
    Object.keys(STATUSES).forEach(s => { counts[s] = 0; });
    REQUESTS.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }

  // ── Calendar ────────────────────────────────────────────────────────────
  function getRequestsByDate(year, month) {
    const all = REQUESTS.map(enrichRequest);
    const byDate = {};
    all.forEach(r => {
      const d = r.goLiveDate;
      const rd = new Date(d);
      if (rd.getFullYear() === year && rd.getMonth() === month) {
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(r);
      }
    });
    return byDate;
  }

  // ── Activity ────────────────────────────────────────────────────────────
  function getRecentActivity(limit = 10) {
    return ACTIVITY_LOG
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
      .map(a => ({
        ...a,
        user: USERS.find(u => u.id === a.userId),
        request: REQUESTS.find(r => r.id === a.requestId),
      }));
  }

  function getActivityForRequest(requestId) {
    return ACTIVITY_LOG
      .filter(a => a.requestId === requestId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(a => ({
        ...a,
        user: USERS.find(u => u.id === a.userId),
      }));
  }

  function addActivity(requestId, userId, action, detail) {
    const newActivity = {
      id: 'a' + Date.now(),
      requestId,
      userId,
      action,
      detail,
      timestamp: new Date().toISOString(),
    };
    ACTIVITY_LOG.unshift(newActivity);
    SupabaseClient.insertActivity(newActivity).catch(() => {});
  }

  // ── Comments ────────────────────────────────────────────────────────────
  function getCommentsForRequest(requestId) {
    return COMMENTS
      .filter(c => c.requestId === requestId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(c => ({
        ...c,
        user: USERS.find(u => u.id === c.userId),
      }));
  }

  function addComment(requestId, userId, text) {
    const newComment = {
      id: 'cm' + Date.now(),
      requestId,
      userId,
      text,
      timestamp: new Date().toISOString(),
    };
    COMMENTS.push(newComment);
    SupabaseClient.insertComment(newComment).catch(() => {});
  }

  // ── Versions ────────────────────────────────────────────────────────────
  function getVersionsForRequest(requestId) {
    return VERSIONS
      .filter(v => v.requestId === requestId)
      .sort((a, b) => b.version - a.version)
      .map(v => ({
        ...v,
        uploader: USERS.find(u => u.id === v.uploadedBy),
      }));
  }

  function addVersion(requestId, uploadedBy) {
    const existing = VERSIONS.filter(v => v.requestId === requestId);
    const nextVer = existing.length > 0 ? Math.max(...existing.map(v => v.version)) + 1 : 1;
    const req = REQUESTS.find(r => r.id === requestId);
    const slug = req ? req.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30) : 'asset';
    const newV = {
      id: 'v' + Date.now(),
      requestId,
      version: nextVer,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      filename: `${slug}_v${nextVer}.psd`,
      status: 'under_review',
    };
    VERSIONS.push(newV);
    addActivity(requestId, uploadedBy, 'uploaded', `Uploaded v${nextVer}`);
    SupabaseClient.insertVersion(newV).catch(() => {});
    return newV;
  }

  // ── Assets (DAM) ────────────────────────────────────────────────────────
  function getAssetsWithVersions(filters) {
    const requestIdsWithVersions = [...new Set(VERSIONS.map(v => v.requestId))];
    let results = requestIdsWithVersions.map(rid => {
      const reqRaw = REQUESTS.find(req => req.id === rid);
      if (!reqRaw) return null;
      const r = enrichRequest(reqRaw);
      const versions = VERSIONS.filter(v => v.requestId === rid);
      return { ...r, versionCount: versions.length, latestVersion: Math.max(...versions.map(v => v.version)) };
    }).filter(Boolean);

    if (filters) {
      if (filters.campaignId) results = results.filter(r => r.campaignId === filters.campaignId);
      if (filters.assetTypeId) results = results.filter(r => r.assetTypeId === filters.assetTypeId);
      if (filters.status) results = results.filter(r => r.status === filters.status);
    }
    return results;
  }

  // ── Campaigns CRUD ──────────────────────────────────────────────────────
  function createCampaign(data) {
    const newCampaign = {
      id: 'temp_c_' + Date.now(),
      name: data.name,
      show: data.show || '',
      status: data.status || 'active',
      createdDate: new Date().toISOString().split('T')[0],
      description: data.description || '',
    };
    CAMPAIGNS.push(newCampaign);

    SupabaseClient.insertCampaign(data).then(row => {
      const idx = CAMPAIGNS.findIndex(c => c.id === newCampaign.id);
      if (idx !== -1) CAMPAIGNS[idx].id = row.id;
    }).catch(e => console.error('Create campaign failed:', e));

    return newCampaign;
  }

  // ── Lookups ─────────────────────────────────────────────────────────────
  function getPlatforms() { return [...PLATFORMS]; }
  function getAssetTypes() { return [...ASSET_TYPES]; }
  function getStatuses() { return { ...STATUSES }; }
  function getPriorities() { return { ...PRIORITIES }; }

  // ── Deliverable helpers ─────────────────────────────────────────────────
  function updateDeliverableStatus(requestId, deliverableId, newStatus) {
    const req = REQUESTS.find(r => r.id === requestId);
    if (!req || !req.deliverables) return null;
    const del = req.deliverables.find(d => d.id === deliverableId);
    if (!del) return null;
    del.status = newStatus;
    addActivity(requestId, (window.__currentUser && window.__currentUser.id) || '', 'status_changed', `Deliverable moved to ${STATUSES[newStatus] ? STATUSES[newStatus].label : newStatus}`);
    SupabaseClient.persist();
    return enrichRequest(req);
  }

  function assignDeliverable(requestId, deliverableId, userId) {
    const req = REQUESTS.find(r => r.id === requestId);
    if (!req || !req.deliverables) return null;
    const del = req.deliverables.find(d => d.id === deliverableId);
    if (!del) return null;
    del.assignedTo = userId;
    const user = USERS.find(u => u.id === userId);
    addActivity(requestId, (window.__currentUser && window.__currentUser.id) || '', 'assigned', `Deliverable assigned to ${user ? user.name : userId}`);
    SupabaseClient.persist();
    return enrichRequest(req);
  }

  // -- Auto-Priority Calculator --
  function calculatePriority(goLiveDate, slaDays) {
    if (!goLiveDate) return 'medium';
    const today = new Date(); today.setHours(0,0,0,0);
    const goLive = new Date(goLiveDate); goLive.setHours(0,0,0,0);
    const daysUntil = Math.ceil((goLive - today) / (1000*60*60*24));
    const sla = slaDays || 3;
    if (daysUntil <= 0) return 'blocked';
    if (daysUntil < sla) return 'urgent';
    if (daysUntil < sla + 2) return 'high';
    if (daysUntil < sla + 5) return 'medium';
    return 'low';
  }

  // -- Knowledge Base --
  function getKnowledgeBase(campaignId) {
    if (!window.KNOWLEDGE_BASE) return [];
    return window.KNOWLEDGE_BASE
      .filter(kb => kb.campaignId === campaignId)
      .sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate))
      .map(kb => ({ ...kb, addedByUser: USERS.find(u => u.id === kb.addedBy) || null }));
  }

  function addKnowledgeEntry(data) {
    if (!window.KNOWLEDGE_BASE) window.KNOWLEDGE_BASE = [];
    const entry = {
      id: 'kb_' + Date.now(), campaignId: data.campaignId, title: data.title,
      category: data.category, content: data.content, tags: data.tags || [],
      reference: data.reference || '',
      addedBy: data.addedBy || (USERS[0] ? USERS[0].id : ''),
      addedDate: new Date().toISOString().split('T')[0],
    };
    window.KNOWLEDGE_BASE.push(entry);
    SupabaseClient.insertKnowledgeEntry(entry).then(row => {
      const idx = window.KNOWLEDGE_BASE.findIndex(kb => kb.id === entry.id);
      if (idx !== -1) window.KNOWLEDGE_BASE[idx].id = row.id;
    }).catch(e => console.error('Insert KB entry failed:', e));
    return entry;
  }

  function deleteKnowledgeEntry(entryId) {
    if (!window.KNOWLEDGE_BASE) return;
    window.KNOWLEDGE_BASE = window.KNOWLEDGE_BASE.filter(kb => kb.id !== entryId);
    SupabaseClient.deleteKnowledgeEntry(entryId).catch(e => console.error('Delete KB entry failed:', e));
  }

  // -- Content Schedule --
  function getContentSchedule(campaignId) {
    if (!window.CONTENT_SCHEDULE) return [];
    return window.CONTENT_SCHEDULE
      .filter(cs => cs.campaignId === campaignId)
      .sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate))
      .map(cs => {
        const linkedReq = cs.linkedRequestId ? REQUESTS.find(r => r.id === cs.linkedRequestId) : null;
        return {
          ...cs,
          linkedRequest: linkedReq ? enrichRequest(linkedReq) : null,
          platformObjects: (cs.platforms || []).map(pid => PLATFORMS.find(p => p.id === pid)).filter(Boolean),
        };
      });
  }

  function addContentScheduleItem(data) {
    if (!window.CONTENT_SCHEDULE) window.CONTENT_SCHEDULE = [];
    const item = {
      id: 'cs_' + Date.now(), campaignId: data.campaignId, title: data.title,
      releaseDate: data.releaseDate, platforms: data.platforms || [],
      linkedRequestId: data.linkedRequestId || null,
      status: data.status || 'planned', notes: data.notes || '',
      createdBy: data.createdBy || (USERS[0] ? USERS[0].id : ''),
    };
    window.CONTENT_SCHEDULE.push(item);
    SupabaseClient.insertContentScheduleItem(item).then(row => {
      const idx = window.CONTENT_SCHEDULE.findIndex(cs => cs.id === item.id);
      if (idx !== -1) window.CONTENT_SCHEDULE[idx].id = row.id;
    }).catch(e => console.error('Insert CS item failed:', e));
    return item;
  }

  function updateContentScheduleStatus(itemId, newStatus) {
    if (!window.CONTENT_SCHEDULE) return null;
    const item = window.CONTENT_SCHEDULE.find(cs => cs.id === itemId);
    if (item) {
      item.status = newStatus;
      SupabaseClient.updateContentScheduleItem(itemId, 'status', newStatus).catch(() => {});
      return item;
    }
    return null;
  }

  function deleteContentScheduleItem(itemId) {
    if (!window.CONTENT_SCHEDULE) return;
    window.CONTENT_SCHEDULE = window.CONTENT_SCHEDULE.filter(cs => cs.id !== itemId);
    SupabaseClient.deleteContentScheduleItem(itemId).catch(() => {});
  }

  function getContentScheduleByDate(year, month) {
    if (!window.CONTENT_SCHEDULE) return {};
    const byDate = {};
    window.CONTENT_SCHEDULE.forEach(cs => {
      const rd = new Date(cs.releaseDate);
      if (rd.getFullYear() === year && rd.getMonth() === month) {
        if (!byDate[cs.releaseDate]) byDate[cs.releaseDate] = [];
        byDate[cs.releaseDate].push(cs);
      }
    });
    return byDate;
  }


  // ── Public API ──────────────────────────────────────────────────────────
  return {
    getRequests,
    getRequestById,
    createRequest,
    updateRequestStatus,
    assignRequest,
    getCampaigns,
    getCampaignById,
    createCampaign,
    getUsers,
    getUserById,
    getDesigners,
    getWorkload,
    getDashboardKPIs,
    getStatusDistribution,
    getRequestsByDate,
    getRecentActivity,
    getActivityForRequest,
    addActivity,
    getCommentsForRequest,
    addComment,
    getVersionsForRequest,
    addVersion,
    getAssetsWithVersions,
    getPlatforms,
    getAssetTypes,
    getStatuses,
    getPriorities,
    updateDeliverableStatus,
    assignDeliverable,
    calculatePriority,
    getKnowledgeBase,
    addKnowledgeEntry,
    deleteKnowledgeEntry,
    getContentSchedule,
    addContentScheduleItem,
    updateContentScheduleStatus,
    deleteContentScheduleItem,
    getContentScheduleByDate,
  };
})();
