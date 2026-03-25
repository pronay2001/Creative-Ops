/* ==========================================================================
   APP.JS — Hoichoi CreativeOps
   Main application: routing, views, interactions
   ========================================================================== */

const App = (() => {
  let currentView = 'dashboard';
  let chartInstance = null;
  let workloadChartInstance = null;
  let kanbanSortables = [];
  let workloadSortables = [];
  let calendarSortables = [];
  let calendarYear = 2026;
  let calendarMonth = 2; // March (0-indexed)
  let currentFilters = {};
  let assetFilters = {};
  let assetViewMode = 'grid';
  let sortState = { key: null, dir: 'asc' };
  let isDragging = false;
  let dayPopup = null;
  let activeDropdown = null;
  let supabaseConfig = { url: '', key: '', status: 'none' };
  let assetUploads = {}; // { requestId: { type: 'image'|'video', dataUrl: '...' } }
  let campaignDetailTab = 'requests';
  let creativeTeamFilters = {};
  // supabaseConfig is no longer used — data is in browser storage

  /* ── AVATAR COLORS ─────────────────────────────────────────────────── */
  const avatarColors = [
    '#0d9488','#8b5cf6','#2563eb','#dc2626','#d97706','#16a34a','#ec4899','#6366f1',
    '#0891b2','#84cc16','#f43f5e','#a855f7','#14b8a6','#f59e0b','#3b82f6'
  ];

  function getAvatarColor(userId) {
    if (!userId) return avatarColors[0];
    // Hash the UUID to get a stable index
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0;
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  }

  function renderAvatar(user, size) {
    if (!user) return '';
    const cls = size === 'sm' ? 'avatar avatar-sm' : size === 'lg' ? 'avatar avatar-lg' : 'avatar';
    return `<span class="${cls}" style="background:${getAvatarColor(user.id)}" title="${user.name}">${user.avatar}</span>`;
  }

  /* ── STATUS/PRIORITY HELPERS ───────────────────────────────────────── */
  const statusBadgeMap = {
    intake: 'badge-gray', brief_approved: 'badge-blue', in_progress: 'badge-blue',
    first_cut: 'badge-blue', under_review: 'badge-orange', changes_in_progress: 'badge-orange',
    final_approved: 'badge-green', scheduled: 'badge-green', live: 'badge-green',
  };

  function statusBadge(status) {
    const info = STATUSES[status];
    return info ? `<span class="badge ${statusBadgeMap[status] || 'badge-gray'}">${info.label}</span>` : '';
  }

  function priorityDot(priority) {
    return `<span class="priority-dot priority-${priority}" title="${priority}"></span>`;
  }

  function platformDots(platformObjs) {
    return platformObjs.map(p => {
      const c = p.id === 'x' ? 'currentColor' : (p.color && !p.color.includes('gradient') ? p.color : '');
      const style = c ? `width:14px;height:14px;color:${c}` : `width:14px;height:14px`;
      return `<span class="platform-icon-chip" title="${p.name}"><i data-lucide="${p.icon}" style="${style}"></i></span>`;
    }).join('');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  }

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 0) return 'just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(ts);
  }

  /* ── ROUTING ───────────────────────────────────────────────────────── */
  function navigate(route) {
    const [view, ...rest] = route.split('/');
    currentView = view;
    window.location.hash = route;
    updateActiveNav(view);
    updateTopbarTitle(view);
    renderView(view, rest.join('/'));
    closeMobileSidebar();
  }

  function updateActiveNav(view) {
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === view);
    });
  }

  const viewTitles = {
    dashboard: 'Dashboard', requests: 'Requests', campaigns: 'Campaigns',
    calendar: 'Calendar', kanban: 'Kanban Board', workload: 'Workload',
    assets: 'Assets', timesheet: 'Timesheet', settings: 'Settings', creative_team: 'Creative Team',
  };

  function updateTopbarTitle(view) {
    document.getElementById('topbarTitle').textContent = viewTitles[view] || 'Dashboard';
    document.title = (viewTitles[view] || 'Dashboard') + ' — CreativeOps';
  }

  /* ── RENDER VIEW ───────────────────────────────────────────────────── */
  function renderView(view, param) {
    const container = document.getElementById('viewContainer');
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    if (workloadChartInstance) { workloadChartInstance.destroy(); workloadChartInstance = null; }
    kanbanSortables.forEach(s => s.destroy());
    kanbanSortables = [];
    workloadSortables.forEach(s => s.destroy());
    workloadSortables = [];
    calendarSortables.forEach(s => s.destroy());
    calendarSortables = [];
    closeDayPopup();
    closeDropdowns();

    switch (view) {
      case 'dashboard':  container.innerHTML = renderDashboard(); initDashboardChart(); animateCountUp(); break;
      case 'requests':   container.innerHTML = renderRequests(); break;
      case 'campaigns':  container.innerHTML = renderCampaigns(param); break;
      case 'calendar':   container.innerHTML = renderCalendar(); initCalendarDnD(); break;
      case 'kanban':     container.innerHTML = renderKanban(); initKanbanDnD(); break;
      case 'workload':   container.innerHTML = renderWorkload(); initWorkloadChart(); initWorkloadDnD(); animateCountUp(); break;
      case 'creative_team': container.innerHTML = renderCreativeTeam(); break;
      case 'assets':     container.innerHTML = renderAssets(); break;
      case 'timesheet':  container.innerHTML = renderTimesheet(); break;
      case 'settings':   container.innerHTML = renderSettings(); break;
      default:           container.innerHTML = renderDashboard(); initDashboardChart(); break;
    }

    lucide.createIcons();
  }

  /* ── 1. DASHBOARD ──────────────────────────────────────────────────── */
  function renderDashboard() {
    const kpi = DataService.getDashboardKPIs();
    const activity = DataService.getRecentActivity(10);

    const currentUserId = window.__currentUser ? window.__currentUser.id : null;
    const myWork = currentUserId ? DataService.getRequests({ assignedTo: currentUserId }).filter(r => !['live'].includes(r.status)) : [];

    // Due This Week
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const dueItems = DataService.getRequests().filter(r => {
      const d = new Date(r.internalDeadline);
      return d >= today && d <= weekEnd && !['final_approved','scheduled','live'].includes(r.status);
    });

    // Bottlenecks — count per status
    const dist = DataService.getStatusDistribution();
    const maxCount = Math.max(...Object.values(dist), 1);
    const bottlenecks = Object.entries(dist)
      .filter(([k, v]) => v > 0 && STATUSES[k])
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: STATUSES[k].label, count: v, pct: Math.round((v / maxCount) * 100) }));

    return `<div class="view-container">
      <div class="view-header">
        <h1>Dashboard</h1>
        ${window.Permissions && window.Permissions.canCreateRequest() ? '<button class="btn btn-primary" onclick="App.openNewRequestModal()"><i data-lucide="plus"></i> Quick Create</button>' : ''}
      </div>

      <div class="kpi-grid">
        ${kpiCard('file-text','Active Requests', kpi.totalActive, 'var(--color-primary-highlight)','var(--color-primary)')}
        ${kpiCard('alert-circle','Overdue', kpi.overdue, 'var(--color-error-highlight)','var(--color-error)')}
        ${kpiCard('clock','Due This Week', kpi.dueThisWeek, 'var(--color-warning-highlight)','var(--color-warning)')}
        ${kpiCard('eye','In Review', kpi.inReview, 'var(--color-blue-highlight)','var(--color-blue)')}
        ${kpiCard('megaphone','Campaigns Active', kpi.campaignsActive, 'var(--color-success-highlight)','var(--color-success)')}
      </div>

      <div class="dashboard-3col">
        <div class="dashboard-widget">
          <div class="dashboard-widget-header">
            <span class="dashboard-widget-title">My Work</span>
            <span class="text-xs text-faint">${myWork.length} items</span>
          </div>
          <div class="dashboard-widget-body">
            ${myWork.length === 0 ? '<div class="notifications-empty" style="padding:var(--space-6)"><span class="text-xs text-faint">No items assigned to you</span></div>' :
              myWork.slice(0,5).map(r => `<div class="widget-list-item" onclick="App.openRequestDetail('${r.id}')">
                ${priorityDot(r.priority)}
                <span class="widget-list-item-title">${r.title}</span>
                ${statusBadge(r.status)}
              </div>`).join('')}
          </div>
        </div>

        <div class="dashboard-widget">
          <div class="dashboard-widget-header">
            <span class="dashboard-widget-title">Due This Week</span>
            <span class="text-xs text-faint">${dueItems.length} items</span>
          </div>
          <div class="dashboard-widget-body">
            ${dueItems.length === 0 ? '<div class="notifications-empty" style="padding:var(--space-6)"><span class="text-xs text-faint">Nothing due this week</span></div>' :
              dueItems.slice(0,5).map(r => `<div class="widget-list-item" onclick="App.openRequestDetail('${r.id}')">
                <span class="widget-list-item-title">${r.title}</span>
                <span class="widget-list-item-meta" ${r.isOverdue ? 'style="color:var(--color-error)"' : ''}>${formatDate(r.internalDeadline)}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="dashboard-widget">
          <div class="dashboard-widget-header">
            <span class="dashboard-widget-title">Bottlenecks</span>
          </div>
          <div class="dashboard-widget-body">
            ${bottlenecks.slice(0,5).map(b => `<div style="padding:var(--space-2) var(--space-4);border-bottom:1px solid var(--color-divider)">
              <div style="display:flex;justify-content:space-between;font-size:var(--text-xs)">
                <span>${b.label}</span>
                <span class="text-muted">${b.count}</span>
              </div>
              <div class="bottleneck-bar"><div class="bottleneck-bar-fill" style="width:${b.pct}%;background:${b.count > 3 ? 'var(--color-warning)' : 'var(--color-primary)'}"></div></div>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="chart-container">
          <div class="chart-title">Requests by Status</div>
          <div style="position:relative;height:200px;">
            <canvas id="statusChart"></canvas>
          </div>
        </div>

        <div class="chart-container">
          <div class="chart-title">Recent Activity</div>
          <div class="activity-feed">
            ${activity.map(a => `
              <div class="activity-item">
                ${renderAvatar(a.user, 'sm')}
                <div class="activity-content">
                  <div class="activity-text"><strong>${a.user ? a.user.name : 'Unknown'}</strong> ${a.detail}</div>
                  <div class="activity-time">${timeAgo(a.timestamp)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="attribution-footer" style="margin-top:var(--space-8)">
        <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer">Created with Perplexity Computer</a>
      </div>
    </div>`;
  }

  function kpiCard(icon, label, value, bgColor, fgColor) {
    return `<div class="kpi-card">
      <div class="kpi-icon" style="background:${bgColor};color:${fgColor}"><i data-lucide="${icon}"></i></div>
      <div class="kpi-label">${label}</div>
      <div class="kpi-value" data-target="${value}" ${typeof value === 'number' && value > 0 && label === 'Overdue' ? 'style="color:var(--color-error)"' : ''}>0</div>
    </div>`;
  }

  function initDashboardChart() {
    const canvas = document.getElementById('statusChart');
    if (!canvas) return;
    const dist = DataService.getStatusDistribution();
    const root = getComputedStyle(document.documentElement);
    const textMuted = root.getPropertyValue('--color-text-muted').trim() || '#888';
    const border = root.getPropertyValue('--color-border').trim() || '#333';

    const labels = Object.keys(dist).map(k => STATUSES[k].label);
    const data = Object.values(dist);
    const colors = ['#6b7280','#60a5fa','#60a5fa','#60a5fa','#fbbf24','#fbbf24','#4ade80','#4ade80','#4ade80'];

    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderColor: 'transparent', borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'right', labels: { color: textMuted, font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 8 } },
        },
      },
    });
  }

  /* ── 2. REQUESTS ───────────────────────────────────────────────────── */
  function renderRequests(filterOverrides) {
    const filters = filterOverrides || currentFilters;
    const reqs = DataService.getRequests(filters);
    // Apply sorting
    if (sortState.key) {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const statusOrder = Object.keys(STATUSES);
      reqs.sort((a, b) => {
        let va, vb;
        if (sortState.key === 'priority') { va = priorityOrder[a.priority] ?? 99; vb = priorityOrder[b.priority] ?? 99; }
        else if (sortState.key === 'status') { va = statusOrder.indexOf(a.status); vb = statusOrder.indexOf(b.status); }
        else if (sortState.key === 'goLiveDate' || sortState.key === 'internalDeadline') { va = new Date(a[sortState.key] || '9999'); vb = new Date(b[sortState.key] || '9999'); }
        else { va = (a[sortState.key] || '').toString().toLowerCase(); vb = (b[sortState.key] || '').toString().toLowerCase(); }
        if (va < vb) return sortState.dir === 'asc' ? -1 : 1;
        if (va > vb) return sortState.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    const campaigns = DataService.getCampaigns();
    const assetTypes = DataService.getAssetTypes();
    const platforms = DataService.getPlatforms();
    const designers = DataService.getDesigners();

    return `<div class="view-container">
      <div class="view-header">
        <h1>Requests <span class="text-muted text-xs" style="font-weight:400">(${reqs.length})</span></h1>
        ${window.Permissions && window.Permissions.canCreateRequest() ? '<button class="btn btn-primary" onclick="App.openNewRequestModal()"><i data-lucide="plus"></i> New Request</button>' : ''}
      </div>

      <div class="filter-bar">
        <select class="filter-select" onchange="App.filterRequests('status', this.value)">
          <option value="">All Statuses</option>
          ${Object.entries(STATUSES).map(([k,v]) => `<option value="${k}" ${filters.status===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
        <select class="filter-select" onchange="App.filterRequests('assetTypeId', this.value)">
          <option value="">All Asset Types</option>
          ${assetTypes.map(a => `<option value="${a.id}" ${filters.assetTypeId===a.id?'selected':''}>${a.name}</option>`).join('')}
        </select>
        <select class="filter-select" onchange="App.filterRequests('platform', this.value)">
          <option value="">All Platforms</option>
          ${platforms.map(p => `<option value="${p.id}" ${filters.platform===p.id?'selected':''}>${p.name}</option>`).join('')}
        </select>
        <select class="filter-select" onchange="App.filterRequests('assignedTo', this.value)">
          <option value="">All Assignees</option>
          ${designers.map(d => `<option value="${d.id}" ${filters.assignedTo===d.id?'selected':''}>${d.name}</option>`).join('')}
        </select>
        <select class="filter-select" onchange="App.filterRequests('campaignId', this.value)">
          <option value="">All Campaigns</option>
          ${campaigns.map(c => `<option value="${c.id}" ${filters.campaignId===c.id?'selected':''}>${c.name}</option>`).join('')}
        </select>
        ${Object.keys(filters).length > 0 ? '<button class="btn btn-ghost btn-sm" onclick="App.clearFilters()"><i data-lucide="x"></i> Clear</button>' : ''}
      </div>

      ${Object.keys(filters).length > 0 ? `<div class="filter-pills">
        ${Object.entries(filters).map(([k, v]) => {
          let label = v;
          if (k === 'status' && STATUSES[v]) label = STATUSES[v].label;
          if (k === 'assignedTo') { const u = DataService.getUserById(v); label = u ? u.name : v; }
          if (k === 'campaignId') { const c = DataService.getCampaignById(v); label = c ? c.name : v; }
          if (k === 'assetTypeId') { const a = ASSET_TYPES.find(at => at.id === v); label = a ? a.name : v; }
          if (k === 'platform') { const p = PLATFORMS.find(pl => pl.id === v); label = p ? p.name : v; }
          const keyLabel = { status:'Status', assetTypeId:'Type', platform:'Platform', assignedTo:'Assignee', campaignId:'Campaign' }[k] || k;
          return `<span class="filter-pill">${keyLabel}: ${label}<span class="filter-pill-remove" onclick="event.stopPropagation();App.filterRequests('${k}','')"><i data-lucide="x" style="width:10px;height:10px"></i></span></span>`;
        }).join('')}
      </div>` : ''}

      ${reqs.length === 0 ? emptyState('inbox', 'No requests found', 'Try adjusting your filters or create a new request.', { label: 'New Request', onclick: 'App.openNewRequestModal()' }) : `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="sortable ${sortState.key==='title'?'sort-active':''}${sortState.key==='title'&&sortState.dir==='desc'?' sort-desc':''}" onclick="App.sortTable('title')">Title<i data-lucide="arrow-up" class="sort-icon"></i></th>
              <th>Campaign</th>
              <th>Deliverables</th>
              <th>Platform(s)</th>
              <th>Assigned To</th>
              <th class="sortable ${sortState.key==='status'?'sort-active':''}${sortState.key==='status'&&sortState.dir==='desc'?' sort-desc':''}" onclick="App.sortTable('status')">Status<i data-lucide="arrow-up" class="sort-icon"></i></th>
              <th class="sortable ${sortState.key==='priority'?'sort-active':''}${sortState.key==='priority'&&sortState.dir==='desc'?' sort-desc':''}" onclick="App.sortTable('priority')">Priority<i data-lucide="arrow-up" class="sort-icon"></i></th>
              <th class="sortable ${sortState.key==='goLiveDate'?'sort-active':''}${sortState.key==='goLiveDate'&&sortState.dir==='desc'?' sort-desc':''}" onclick="App.sortTable('goLiveDate')">Go-Live<i data-lucide="arrow-up" class="sort-icon"></i></th>
              <th class="sortable ${sortState.key==='internalDeadline'?'sort-active':''}${sortState.key==='internalDeadline'&&sortState.dir==='desc'?' sort-desc':''}" onclick="App.sortTable('internalDeadline')">Deadline<i data-lucide="arrow-up" class="sort-icon"></i></th>
            </tr>
          </thead>
          <tbody>
            ${reqs.map(r => `
              <tr onclick="App.openRequestDetail('${r.id}')" class="${r.isOverdue ? 'row-overdue' : r.isAtRisk ? 'row-at-risk' : ''}" data-id="${r.id}">
                <td class="table-title-cell">${r.title}</td>
                <td class="text-xs text-muted" style="max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.campaign ? r.campaign.name : '—'}</td>
                <td><div class="deliverable-chips">${r.deliverables.map(d => `<span class="deliverable-chip" title="${d.assetType ? d.assetType.name : d.assetTypeId}"><i data-lucide="${d.assetType ? d.assetType.icon : 'file'}" style="width:12px;height:12px"></i></span>`).join('')}<span class="text-xs text-muted" style="margin-left:2px">${r.deliverableCount > 1 ? r.deliverableCount : ''}</span></div></td>
                <td><div class="flex gap-2 items-center">${platformDots(r.platformObjects)}</div></td>
                <td>${r.allAssignees.length > 1 ? `<div class="flex gap-1 items-center">${r.allAssignees.slice(0,3).map(u => renderAvatar(u,'sm')).join('')}${r.allAssignees.length > 3 ? '<span class="text-xs text-faint">+' + (r.allAssignees.length-3) + '</span>' : ''}</div>` : r.assignee ? `<div class="flex gap-2 items-center">${renderAvatar(r.assignee,'sm')}<span class="text-xs">${r.assignee.name.split(' ')[0]}</span></div>` : '<span class="text-faint text-xs">Unassigned</span>'}</td>
                <td>${statusBadge(r.status)}</td>
                <td><div class="flex gap-2 items-center">${priorityDot(r.priority)}<span class="text-xs">${PRIORITIES[r.priority].label}</span></div></td>
                <td class="text-xs font-mono ${r.isOverdue ? 'style="color:var(--color-error)"' : ''}">${formatDate(r.goLiveDate)}</td>
                <td class="text-xs font-mono ${r.isOverdue ? 'style="color:var(--color-error)"' : r.isAtRisk ? 'style="color:var(--color-warning)"' : ''}">${formatDate(r.internalDeadline)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`}
    </div>`;
  }

  function filterRequests(key, value) {
    if (value) { currentFilters[key] = value; }
    else { delete currentFilters[key]; }
    document.getElementById('viewContainer').innerHTML = renderRequests();
    lucide.createIcons();
  }

  function clearFilters() {
    currentFilters = {};
    document.getElementById('viewContainer').innerHTML = renderRequests();
    lucide.createIcons();
  }

  /* ── 3. REQUEST DETAIL PANEL ───────────────────────────────────────── */
  /* -- CREATIVE TEAM PAGE -- */
  function renderCreativeTeam() {
    const workload = DataService.getWorkload();
    const allReqs = DataService.getRequests();
    const campaigns = DataService.getCampaigns();
    let allDeliverables = [];
    allReqs.forEach(r => {
      (r.deliverables || []).forEach(d => {
        if (['final_approved','scheduled','live'].includes(d.status)) return;
        allDeliverables.push({ ...d, requestId: r.id, requestTitle: r.title, campaignId: r.campaignId, campaign: r.campaign, priority: r.priority, goLiveDate: r.goLiveDate, internalDeadline: r.internalDeadline, isOverdue: r.isOverdue, isAtRisk: r.isAtRisk });
      });
    });
    if (creativeTeamFilters.campaignId) allDeliverables = allDeliverables.filter(d => d.campaignId === creativeTeamFilters.campaignId);
    if (creativeTeamFilters.priority) allDeliverables = allDeliverables.filter(d => d.priority === creativeTeamFilters.priority);
    if (creativeTeamFilters.assetCategory) {
      allDeliverables = allDeliverables.filter(d => {
        const at = ASSET_TYPES.find(a => a.id === d.assetTypeId);
        return at && at.category === creativeTeamFilters.assetCategory;
      });
    }
    const unassigned = allDeliverables.filter(d => !d.assignedTo);
    const assigned = allDeliverables.filter(d => d.assignedTo);
    const assignedByDesigner = {};
    assigned.forEach(d => { if (!assignedByDesigner[d.assignedTo]) assignedByDesigner[d.assignedTo] = []; assignedByDesigner[d.assignedTo].push(d); });
    const designers = DataService.getDesigners();

    return `<div class="view-container">
      <div class="view-header"><h1>Creative Team</h1></div>
      <div class="ct-filters">
        <select class="form-input form-input-sm" onchange="App.filterCreativeTeam('campaignId', this.value)">
          <option value="">All Campaigns</option>
          ${campaigns.filter(c => c.status === 'active').map(c => `<option value="${c.id}" ${creativeTeamFilters.campaignId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
        <select class="form-input form-input-sm" onchange="App.filterCreativeTeam('assetCategory', this.value)">
          <option value="">All Types</option>
          <option value="static" ${creativeTeamFilters.assetCategory === 'static' ? 'selected' : ''}>Static</option>
          <option value="video" ${creativeTeamFilters.assetCategory === 'video' ? 'selected' : ''}>Video</option>
          <option value="motion" ${creativeTeamFilters.assetCategory === 'motion' ? 'selected' : ''}>Motion Graphics</option>
        </select>
        <select class="form-input form-input-sm" onchange="App.filterCreativeTeam('priority', this.value)">
          <option value="">All Priorities</option>
          <option value="urgent" ${creativeTeamFilters.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
          <option value="high" ${creativeTeamFilters.priority === 'high' ? 'selected' : ''}>High</option>
          <option value="medium" ${creativeTeamFilters.priority === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="low" ${creativeTeamFilters.priority === 'low' ? 'selected' : ''}>Low</option>
        </select>
      </div>
      <div class="ct-section">
        <div class="ct-section-title"><i data-lucide="users" style="width:16px;height:16px"></i> Team Overview</div>
        <div class="ct-team-grid">
          ${workload.map(w => {
            const capPct = w.capacity > 0 ? Math.min(100, Math.round((w.activeCount / w.capacity) * 100)) : 0;
            const capColor = capPct > 90 ? 'var(--color-error)' : capPct >= 70 ? 'var(--color-warning)' : 'var(--color-success)';
            return `<div class="ct-member-card"><div class="ct-member-info">${renderAvatar(w, 'sm')}<div><div class="ct-member-name">${w.name}</div><div class="ct-member-role">${w.role.replace(/_/g, ' ')}</div></div></div><div class="ct-member-stats"><span class="ct-member-count">${w.deliverableCount} deliverables</span><div class="ct-capacity-bar"><div class="ct-capacity-fill" style="width:${capPct}%;background:${capColor}"></div></div><span class="ct-capacity-label">${w.activeCount}/${w.capacity}</span></div></div>`;
          }).join('')}
        </div>
      </div>
      <div class="ct-section">
        <div class="ct-section-title"><i data-lucide="inbox" style="width:16px;height:16px"></i> Unassigned Work <span class="badge badge-orange">${unassigned.length}</span></div>
        ${unassigned.length === 0 ? '<div class="text-xs text-faint" style="padding:var(--space-4)">All deliverables are assigned.</div>' : `
        <div class="ct-unassigned-list">
          ${unassigned.map(d => {
            const assetType = ASSET_TYPES.find(a => a.id === d.assetTypeId);
            const dPlatforms = (d.platforms || []).map(pid => PLATFORMS.find(p => p.id === pid)).filter(Boolean);
            return `<div class="ct-unassigned-item ${d.isOverdue ? 'ct-overdue' : d.isAtRisk ? 'ct-at-risk' : ''}">
              <div class="ct-unassigned-main">
                <div class="ct-unassigned-title">${priorityDot(d.priority)} <span onclick="App.openRequestDetail('${d.requestId}')" style="cursor:pointer">${d.requestTitle}</span></div>
                <div class="ct-unassigned-meta">
                  <span class="text-xs"><i data-lucide="${assetType ? assetType.icon : 'file'}" style="width:12px;height:12px"></i> ${assetType ? assetType.name : d.assetTypeId}</span>
                  <span class="ct-unassigned-platforms">${dPlatforms.map(p => '<span class="platform-icon-chip" title="' + p.name + '"><i data-lucide="' + p.icon + '" style="width:11px;height:11px"></i></span>').join('')}</span>
                  <span class="text-xs font-mono">${formatDate(d.goLiveDate)}</span>
                  ${d.isOverdue ? '<span class="badge badge-red">Overdue</span>' : d.isAtRisk ? '<span class="badge badge-orange">At Risk</span>' : ''}
                </div>
              </div>
              ${window.Permissions && window.Permissions.isLead() ? `<div class="ct-unassigned-assign"><select class="form-input form-input-sm ct-assign-select" onchange="App.assignCreativeTeamDeliverable('${d.requestId}', '${d.id}', this.value)"><option value="">Assign to...</option>${designers.map(des => '<option value="' + des.id + '">' + des.name + '</option>').join('')}</select></div>` : ''}
            </div>`;
          }).join('')}
        </div>`}
      </div>
      <div class="ct-section">
        <div class="ct-section-title"><i data-lucide="clipboard-list" style="width:16px;height:16px"></i> Assigned Work</div>
        ${Object.keys(assignedByDesigner).length === 0 ? '<div class="text-xs text-faint" style="padding:var(--space-4)">No active assigned deliverables.</div>' : `
        <div class="ct-assigned-groups">
          ${workload.filter(w => assignedByDesigner[w.id] && assignedByDesigner[w.id].length > 0).map(w => `
            <div class="ct-assigned-group">
              <div class="ct-assigned-group-header">${renderAvatar(w, 'sm')} <span class="ct-assigned-group-name">${w.name}</span> <span class="badge badge-gray">${assignedByDesigner[w.id].length}</span></div>
              <div class="ct-assigned-items">
                ${assignedByDesigner[w.id].map(d => {
                  const assetType = ASSET_TYPES.find(a => a.id === d.assetTypeId);
                  return `<div class="ct-assigned-item">
                    <div class="ct-assigned-item-main" onclick="App.openRequestDetail('${d.requestId}')">
                      <div class="ct-assigned-item-title">${priorityDot(d.priority)} <span>${d.requestTitle}</span></div>
                      <div class="ct-assigned-item-meta"><span class="text-xs"><i data-lucide="${assetType ? assetType.icon : 'file'}" style="width:11px;height:11px"></i> ${assetType ? assetType.name : ''}</span> <span class="text-xs font-mono">${formatDate(d.goLiveDate)}</span></div>
                    </div>
                    <div class="ct-assigned-item-actions">${statusBadge(d.status)} ${window.Permissions && (window.Permissions.isLead() || d.assignedTo === (window.__currentUser && window.__currentUser.id)) ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();App.advanceCreativeTeamDeliverable('${d.requestId}','${d.id}')" title="Advance status"><i data-lucide="arrow-right" style="width:12px;height:12px"></i></button>` : ''}</div>
                  </div>`;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>`}
      </div>
    </div>`;
  }

  function filterCreativeTeam(key, value) {
    if (value) creativeTeamFilters[key] = value; else delete creativeTeamFilters[key];
    const container = document.getElementById('viewContainer');
    container.innerHTML = renderCreativeTeam();
    lucide.createIcons();
  }

  function assignCreativeTeamDeliverable(requestId, deliverableId, userId) {
    if (!userId) return;
    DataService.assignDeliverable(requestId, deliverableId, userId);
    showToast('Deliverable assigned.', 'success');
    const container = document.getElementById('viewContainer');
    container.innerHTML = renderCreativeTeam();
    lucide.createIcons();
  }

  function advanceCreativeTeamDeliverable(requestId, deliverableId) {
    const req = DataService.getRequestById(requestId);
    if (!req) return;
    const del = req.deliverables.find(d => d.id === deliverableId);
    if (!del) return;
    const stages = del.assetType ? del.assetType.stages : ['intake','brief_approved','in_progress','first_cut','under_review','changes_in_progress','final_approved','scheduled','live'];
    const idx = stages.indexOf(del.status);
    if (idx >= 0 && idx < stages.length - 1) {
      DataService.updateDeliverableStatus(requestId, deliverableId, stages[idx + 1]);
      showToast('Status advanced.', 'success');
      const container = document.getElementById('viewContainer');
      container.innerHTML = renderCreativeTeam();
      lucide.createIcons();
    }
  }

  function openRequestDetail(id) {
    const r = DataService.getRequestById(id);
    if (!r) return;

    const comments = DataService.getCommentsForRequest(id);
    const versions = DataService.getVersionsForRequest(id);
    const activity = DataService.getActivityForRequest(id);
    const stages = r.assetType ? r.assetType.stages : [];
    const currentIdx = stages.indexOf(r.status);

    document.getElementById('panelTitle').textContent = r.title;
    document.getElementById('panelBody').innerHTML = `
      <!-- Status Timeline -->
      <div class="panel-section">
        <div class="panel-section-title">Status</div>
        <div class="status-timeline">
          ${stages.map((s, i) => `
            <div class="status-step ${i < currentIdx ? 'completed' : i === currentIdx ? 'current' : ''}">
              <div class="status-step-dot">${i < currentIdx ? '<i data-lucide="check"></i>' : ''}</div>
              <div class="status-step-label">${STATUSES[s] ? STATUSES[s].label : s}</div>
              ${i < stages.length - 1 ? '<div class="status-step-line"></div>' : ''}
            </div>
          `).join('')}
        </div>
        ${r.isExpedited ? '<div class="expedited-warning"><i data-lucide="alert-triangle"></i> Expedited — Go-live date is within SLA window</div>' : ''}
      </div>

      <!-- Actions -->
      <div class="panel-section">
        <div class="flex gap-2" style="flex-wrap:wrap;">
          ${window.Permissions && window.Permissions.canAdvanceStatus(r) ? `<button class="btn btn-primary btn-sm" onclick="App.advanceStatus('${r.id}')"><i data-lucide="arrow-right"></i> Advance Status</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="App.uploadVersion('${r.id}')"><i data-lucide="upload"></i> Upload Version</button>
          ${window.Permissions && window.Permissions.canCreateRequest() ? `<button class="btn btn-ghost btn-sm" onclick="App.duplicateRequest('${r.id}')"><i data-lucide="copy"></i> Duplicate</button>` : ''}
          ${window.Permissions && window.Permissions.canApprove() ? `<div class="action-dropdown-container">
            <button class="btn btn-ghost btn-sm" onclick="App.toggleApprovalDropdown(event, '${r.id}')"><i data-lucide="check-circle"></i> Approve</button>
          </div>` : ''}
        </div>
      </div>

      <!-- Details -->
      <div class="panel-section">
        <div class="panel-section-title">Details</div>
        <div class="detail-fields">
          <div class="detail-field"><label>Campaign</label><p>${r.campaign ? r.campaign.name : '—'}</p></div>
          <div class="detail-field"><label>Asset Type</label><p>${r.assetType ? r.assetType.name : '—'}</p></div>
          <div class="detail-field"><label>Priority</label><p><span class="flex gap-2 items-center">${priorityDot(r.priority)} ${PRIORITIES[r.priority].label}</span></p></div>
          <div class="detail-field"><label>Status</label><p>${statusBadge(r.status)}</p></div>
          <div class="detail-field"><label>Go-Live Date</label><p class="font-mono">${formatDate(r.goLiveDate)}</p></div>
          <div class="detail-field"><label>Internal Deadline</label><p class="font-mono ${r.isOverdue ? 'style="color:var(--color-error)"' : ''}">${formatDate(r.internalDeadline)}</p></div>
          <div class="detail-field"><label>Assigned To</label><p>
            ${window.Permissions && window.Permissions.canAssignRequest(r) ? `<span class="assignee-dropdown-trigger" onclick="App.toggleAssigneeDropdown(event, '${r.id}')">
              ${r.assignee ? `${renderAvatar(r.assignee,'sm')} ${r.assignee.name}` : '<span class="text-faint">Unassigned</span>'}
              <i data-lucide="chevron-down" style="width:12px;height:12px;color:var(--color-text-faint)"></i>
            </span>` : `${r.assignee ? `${renderAvatar(r.assignee,'sm')} ${r.assignee.name}` : '<span class="text-faint">Unassigned</span>'}`}
          </p></div>
          <div class="detail-field"><label>Created By</label><p>${r.creator ? r.creator.name : '—'}</p></div>
          <div class="detail-field"><label>Vertical</label><p>${r.verticalObj ? r.verticalObj.name : '—'}</p></div>
          <div class="detail-field"><label>Department</label><p>${r.departmentObj ? r.departmentObj.fullName : '—'}</p></div>
          <div class="detail-field"><label>Platforms</label><p><span class="flex gap-2 items-center">${r.platformObjects.map(p => `<span class="flex gap-2 items-center"><span class="platform-dot platform-${p.id}"></span><span class="text-xs">${p.name}</span></span>`).join(' ')}</span></p></div>
          <div class="detail-field"><label>Days to Deadline</label><p class="font-mono ${r.isOverdue ? 'style="color:var(--color-error)"' : r.isAtRisk ? 'style="color:var(--color-warning)"' : ''}">${r.isOverdue ? r.daysUntilDeadline + ' (overdue)' : r.daysUntilDeadline}</p></div>
        </div>
      </div>

      <!-- Deliverables -->
      <div class="panel-section">
        <div class="panel-section-title">Deliverables (${r.deliverables.length})</div>
        <div class="deliverable-list">
          ${r.deliverables.map(d => `
            <div class="deliverable-detail-row">
              <div class="deliverable-detail-left">
                <div class="deliverable-detail-type">
                  <i data-lucide="${d.assetType ? d.assetType.icon : 'file'}" style="width:14px;height:14px;color:var(--color-primary)"></i>
                  <span>${d.assetType ? d.assetType.name : d.assetTypeId}</span>
                </div>
                <div class="deliverable-detail-platforms">${(d.platformObjects || []).map(p => `<span class="platform-icon-chip" title="${p.name}"><i data-lucide="${p.icon}" style="width:12px;height:12px"></i></span>`).join('')}</div>
              </div>
              <div class="deliverable-detail-right">
                <span class="deliverable-status">${statusBadge(d.status)}</span>
                ${window.Permissions && window.Permissions.isLead() ? `<span class="deliverable-assignee-trigger" onclick="event.stopPropagation();App.toggleDelAssigneeDropdown(event,'${r.id}','${d.id}')">
                  ${d.assignee ? renderAvatar(d.assignee,'sm') : '<span class="deliverable-unassigned"><i data-lucide="user-plus" style="width:12px;height:12px"></i></span>'}
                </span>` : `${d.assignee ? renderAvatar(d.assignee,'sm') : ''}`}
                ${window.Permissions && (window.Permissions.isLead() || (d.assignedTo === (window.__currentUser && window.__currentUser.id))) ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();App.advanceDeliverableStatus('${r.id}','${d.id}')" title="Advance status"><i data-lucide="arrow-right" style="width:12px;height:12px"></i></button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Brief -->
      ${r.brief && r.brief.objective ? `
      <div class="panel-section">
        <div class="panel-section-title">Brief</div>
        <div class="detail-fields">
          ${r.brief.objective ? `<div class="detail-field" style="grid-column:1/-1"><label>Objective</label><p>${r.brief.objective}</p></div>` : ''}
          ${r.brief.keyMessage ? `<div class="detail-field" style="grid-column:1/-1"><label>Key Message</label><p>${r.brief.keyMessage}</p></div>` : ''}
          ${r.brief.targetGroup ? `<div class="detail-field"><label>Target Group</label><p>${r.brief.targetGroup}</p></div>` : ''}
          ${r.brief.mandatories ? `<div class="detail-field"><label>Mandatories</label><p>${r.brief.mandatories}</p></div>` : ''}
          ${r.brief.languages && r.brief.languages.length ? `<div class="detail-field"><label>Languages</label><p>${r.brief.languages.join(', ')}</p></div>` : ''}
          ${r.brief.copyDraft ? `<div class="detail-field" style="grid-column:1/-1"><label>Copy Draft</label><p style="font-style:italic">${r.brief.copyDraft}</p></div>` : ''}
        </div>
      </div>` : ''}

      <!-- Versions -->
      <div class="panel-section">
        <div class="panel-section-title">Versions (${versions.length})</div>
        ${versions.length > 0 ? versions.map(v => `
          <div class="version-item">
            <div class="version-info">
              <span class="version-number">v${v.version}</span>
              <span class="text-xs">${v.filename}</span>
            </div>
            <div class="flex gap-2 items-center">
              ${renderAvatar(v.uploader, 'sm')}
              <span class="text-xs text-muted">${timeAgo(v.uploadedAt)}</span>
              <span class="badge ${v.status === 'approved' ? 'badge-green' : v.status === 'under_review' ? 'badge-orange' : 'badge-gray'}">${v.status === 'approved' ? 'Approved' : v.status === 'under_review' ? 'In Review' : 'Changes'}</span>
            </div>
          </div>
        `).join('') : '<p class="text-xs text-muted">No versions uploaded yet</p>'}
      </div>

      <!-- Comments -->
      <div class="panel-section">
        <div class="panel-section-title">Comments (${comments.length})</div>
        ${comments.map(c => `
          <div class="comment-item">
            ${renderAvatar(c.user, 'sm')}
            <div class="comment-body">
              <div class="comment-author">${c.user ? c.user.name : 'Unknown'}</div>
              <div class="comment-text">${c.text}</div>
              <div class="comment-time">${timeAgo(c.timestamp)}</div>
            </div>
          </div>
        `).join('')}
        <div class="comment-input-group">
          <input class="comment-input" placeholder="Add a comment..." id="commentInput" onkeypress="if(event.key==='Enter')App.addComment('${id}')">
          <button class="btn btn-primary btn-sm" onclick="App.addComment('${id}')">Post</button>
        </div>
      </div>

      <!-- Activity -->
      ${activity.length > 0 ? `
      <div class="panel-section">
        <div class="panel-section-title">Activity</div>
        <div class="activity-feed">
          ${activity.map(a => `
            <div class="activity-item">
              ${renderAvatar(a.user, 'sm')}
              <div class="activity-content">
                <div class="activity-text"><strong>${a.user ? a.user.name : 'Unknown'}</strong> ${a.detail}</div>
                <div class="activity-time">${timeAgo(a.timestamp)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
    `;

    document.getElementById('panelOverlay').classList.add('open');
    document.getElementById('detailPanel').classList.add('open');
    lucide.createIcons();
  }

  function closeDetailPanel() {
    document.getElementById('panelOverlay').classList.remove('open');
    document.getElementById('detailPanel').classList.remove('open');
  }

  function advanceStatus(reqId) {
    const r = DataService.getRequestById(reqId);
    if (!r || !r.assetType) return;
    const stages = r.assetType.stages;
    const idx = stages.indexOf(r.status);
    if (idx < stages.length - 1) {
      DataService.updateRequestStatus(reqId, stages[idx + 1]);
      DataService.addActivity(reqId, 'u1', 'status_changed', `Moved to ${STATUSES[stages[idx+1]].label}`);
      openRequestDetail(reqId);
      if (currentView === 'kanban') { renderView('kanban'); }
    }
  }

  function addComment(reqId) {
    const input = document.getElementById('commentInput');
    if (!input || !input.value.trim()) return;
    DataService.addComment(reqId, 'u1', input.value.trim());
    openRequestDetail(reqId);
  }

  /* ── 3b. UPLOAD VERSION ─────────────────────────────────────────── */
  function uploadVersion(reqId) {
    DataService.addVersion(reqId, 'u1');
    showToast('Version uploaded successfully', 'success');
    openRequestDetail(reqId);
  }

  /* ── 3c. APPROVAL WORKFLOW ───────────────────────────────────────── */
  function toggleApprovalDropdown(event, reqId) {
    event.stopPropagation();
    closeDropdowns();
    const container = event.currentTarget.closest('.action-dropdown-container');
    const dropdown = document.createElement('div');
    dropdown.className = 'action-dropdown';
    dropdown.innerHTML = `
      <button class="action-dropdown-item approve-action" onclick="App.handleApproval('${reqId}','approve')">
        <i data-lucide="check-circle"></i> Approve
      </button>
      <button class="action-dropdown-item changes-action" onclick="App.handleApproval('${reqId}','changes')">
        <i data-lucide="rotate-ccw"></i> Request Changes
      </button>
      <button class="action-dropdown-item reject-action" onclick="App.handleApproval('${reqId}','reject')">
        <i data-lucide="x-circle"></i> Reject
      </button>
    `;
    container.appendChild(dropdown);
    activeDropdown = dropdown;
    lucide.createIcons();
    setTimeout(() => document.addEventListener('click', closeDropdownOnClick), 10);
  }

  function handleApproval(reqId, action) {
    closeDropdowns();
    if (action === 'approve') {
      DataService.updateRequestStatus(reqId, 'final_approved');
      DataService.addActivity(reqId, 'u1', 'approved', 'Final approved');
      DataService.addComment(reqId, 'u1', 'Approved — looks great, ready to go!');
      showToast('Request approved', 'success');
    } else if (action === 'changes') {
      DataService.updateRequestStatus(reqId, 'changes_in_progress');
      DataService.addActivity(reqId, 'u1', 'changes_requested', 'Requested changes');
      DataService.addComment(reqId, 'u1', 'Some changes needed before final approval.');
      showToast('Changes requested', 'info');
    } else if (action === 'reject') {
      DataService.addActivity(reqId, 'u1', 'rejected', 'Rejected this version');
      DataService.addComment(reqId, 'u1', 'This version does not meet requirements. Please revisit the brief.');
      showToast('Version rejected', 'error');
    }
    openRequestDetail(reqId);
    renderView(currentView);
  }

  /* ── 3d. ASSIGN/REASSIGN ────────────────────────────────────────── */
  function toggleAssigneeDropdown(event, reqId) {
    event.stopPropagation();
    closeDropdowns();
    const trigger = event.currentTarget;
    const designers = DataService.getDesigners();
    const dropdown = document.createElement('div');
    dropdown.className = 'action-dropdown';
    dropdown.style.cssText = 'max-height:200px;overflow-y:auto;';
    dropdown.innerHTML = designers.map(d =>
      `<button class="action-dropdown-item" onclick="App.assignToDesigner('${reqId}','${d.id}')">
        ${renderAvatar(d, 'sm')} ${d.name}
      </button>`
    ).join('');
    trigger.style.position = 'relative';
    trigger.appendChild(dropdown);
    activeDropdown = dropdown;
    lucide.createIcons();
    setTimeout(() => document.addEventListener('click', closeDropdownOnClick), 10);
  }

  function assignToDesigner(reqId, userId) {
    closeDropdowns();
    DataService.assignRequest(reqId, userId);
    const user = DataService.getUserById(userId);
    showToast(`Assigned to ${user ? user.name : userId}`, 'success');
    openRequestDetail(reqId);
    renderView(currentView);
  }

  /* ── DROPDOWN HELPERS ─────────────────────────────────────────── */
  function closeDropdowns() {
    if (activeDropdown) {
      activeDropdown.remove();
      activeDropdown = null;
    }
    document.removeEventListener('click', closeDropdownOnClick);
  }

  function closeDropdownOnClick() {
    closeDropdowns();
  }

  /* ── TOAST SYSTEM ─────────────────────────────────────────────── */
  function showToast(message, type) {
    type = type || 'info';
    const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="toast-icon"></i><span>${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => {
      toast.classList.add('toast-removing');
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  /* ── 4. NEW REQUEST MODAL ──────────────────────────────────────────── */
  let modalDeliverables = [];
  let _deliverableCounter = 0;

  function newDeliverableEntry() {
    _deliverableCounter++;
    return { id: 'new_del_' + _deliverableCounter, assetTypeId: '', platforms: [] };
  }

  function renderDeliverablesBuilder() {
    const assetTypes = DataService.getAssetTypes();
    const platforms = DataService.getPlatforms();
    const container = document.getElementById('deliverablesContainer');
    if (!container) return;
    container.innerHTML = modalDeliverables.map((del, idx) => `
      <div class="deliverable-row" data-del-idx="${idx}">
        <div class="deliverable-row-header">
          <span class="deliverable-row-num">${idx + 1}</span>
          <select class="form-select form-select-sm deliverable-asset-select" onchange="App.updateModalDeliverable(${idx},'assetTypeId',this.value)">
            <option value="">Asset Type *</option>
            <optgroup label="Video">
              ${assetTypes.filter(a => a.category === 'video').map(a => `<option value="${a.id}" ${del.assetTypeId===a.id?'selected':''}>${a.name}</option>`).join('')}
            </optgroup>
            <optgroup label="Static">
              ${assetTypes.filter(a => a.category === 'static').map(a => `<option value="${a.id}" ${del.assetTypeId===a.id?'selected':''}>${a.name}</option>`).join('')}
            </optgroup>
            <optgroup label="Motion Graphics">
              ${assetTypes.filter(a => a.category === 'motion').map(a => `<option value="${a.id}" ${del.assetTypeId===a.id?'selected':''}>${a.name}</option>`).join('')}
            </optgroup>
          </select>
          ${modalDeliverables.length > 1 ? `<button class="btn btn-ghost btn-sm deliverable-remove-btn" onclick="App.removeModalDeliverable(${idx})" title="Remove"><i data-lucide="x" style="width:14px;height:14px"></i></button>` : ''}
        </div>
        <div class="deliverable-platforms">
          ${platforms.map(p => {
            const checked = del.platforms.includes(p.id);
            return `<label class="deliverable-platform-chip ${checked ? 'selected' : ''}" title="${p.name}">
              <input type="checkbox" class="sr-only" ${checked?'checked':''} onchange="App.toggleModalDelPlatform(${idx},'${p.id}',this.checked)">
              <i data-lucide="${p.icon}" style="width:14px;height:14px"></i>
            </label>`;
          }).join('')}
        </div>
      </div>
    `).join('');
    const countEl = document.getElementById('delCount');
    if (countEl) countEl.textContent = modalDeliverables.length + ' item' + (modalDeliverables.length !== 1 ? 's' : '');
    lucide.createIcons();
  }

  function updateModalDeliverable(idx, field, value) {
    if (modalDeliverables[idx]) modalDeliverables[idx][field] = value;
  }

  function toggleModalDelPlatform(idx, platformId, checked) {
    if (!modalDeliverables[idx]) return;
    const del = modalDeliverables[idx];
    if (checked && !del.platforms.includes(platformId)) del.platforms.push(platformId);
    if (!checked) del.platforms = del.platforms.filter(p => p !== platformId);
    renderDeliverablesBuilder();
  }

  function addModalDeliverable() {
    modalDeliverables.push(newDeliverableEntry());
    renderDeliverablesBuilder();
  }

  function removeModalDeliverable(idx) {
    modalDeliverables.splice(idx, 1);
    renderDeliverablesBuilder();
  }

  function openNewRequestModal(preselectedCampaignId) {
    const campaigns = DataService.getCampaigns();
    modalDeliverables = [newDeliverableEntry()];

    document.getElementById('modalTitle').textContent = 'New Request';
    document.getElementById('modalSubmit').textContent = 'Create Request';
    document.getElementById('modalBody').innerHTML = `
      <div class="form-group">
        <label class="form-label" style="margin-bottom:var(--space-2)">Quick Template</label>
        <div class="template-grid">
          <div class="template-card" onclick="App.applyTemplate('yt_thumb')"><div class="template-card-icon"><i data-lucide="youtube"></i></div><div class="template-card-name">YT Thumbnail</div></div>
          <div class="template-card" onclick="App.applyTemplate('ig_post')"><div class="template-card-icon"><i data-lucide="image"></i></div><div class="template-card-name">IG Post</div></div>
          <div class="template-card" onclick="App.applyTemplate('key_art')"><div class="template-card-icon"><i data-lucide="frame"></i></div><div class="template-card-name">Key Art</div></div>
          <div class="template-card" onclick="App.applyTemplate('motion')"><div class="template-card-icon"><i data-lucide="film"></i></div><div class="template-card-name">Motion Teaser</div></div>
          <div class="template-card" onclick="App.applyTemplate('email')"><div class="template-card-icon"><i data-lucide="mail"></i></div><div class="template-card-name">Email Banner</div></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-input" id="reqTitle" placeholder="e.g., Durga Puja Launch Campaign">
      </div>
      <div class="form-row form-row-3col">
        <div class="form-group">
          <label class="form-label">Campaign</label>
          <select class="form-select" id="reqCampaign">
            <option value="">Select campaign</option>
            ${campaigns.map(c => `<option value="${c.id}" ${preselectedCampaignId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Vertical *</label>
          <select class="form-select" id="reqVertical">
            <option value="">Select vertical</option>
            ${(typeof SEED_DATA !== 'undefined' && SEED_DATA.verticals ? SEED_DATA.verticals : []).map(v => '<option value="' + v.id + '">' + v.name + '</option>').join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Department *</label>
          <select class="form-select" id="reqDepartment">
            <option value="">Select department</option>
            ${(typeof SEED_DATA !== 'undefined' && SEED_DATA.departments ? SEED_DATA.departments : []).map(d => '<option value="' + d.id + '">' + d.fullName + '</option>').join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Go-Live Date *</label>
          <input class="form-input" type="date" id="reqGoLive" style="max-width:220px" onchange="App.updateAutoPriority()">
        </div>
        <div class="form-group">
          <label class="form-label">Auto Priority</label>
          <div id="autoPriorityDisplay" class="auto-priority-indicator"><span class="badge badge-gray">Set go-live date</span></div>
          <label class="text-xs text-faint" style="margin-top:var(--space-1);display:flex;align-items:center;gap:var(--space-1)"><input type="checkbox" id="reqPriorityOverride" onchange="document.getElementById('reqPriorityManual').style.display=this.checked?'block':'none'"> Override priority</label>
          <select class="form-select" id="reqPriorityManual" style="display:none;margin-top:var(--space-1)">
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
      <div id="slaWarning"></div>

      <div class="deliverables-section">
        <div class="deliverables-section-header">
          <span class="form-label" style="margin:0">Deliverables *</span>
          <span class="text-xs text-faint" id="delCount">1 item</span>
        </div>
        <div id="deliverablesContainer"></div>
        <button class="deliverable-add-btn" onclick="App.addModalDeliverable()"><i data-lucide="plus" style="width:14px;height:14px"></i> Add Deliverable</button>
      </div>

      <div style="border-top:1px solid var(--color-divider);margin:var(--space-4) 0;padding-top:var(--space-4)">
        <div class="panel-section-title" style="margin-bottom:var(--space-3)">Brief</div>
        <div class="form-group">
          <label class="form-label">Objective</label>
          <input class="form-input" id="reqObjective" placeholder="What should this asset achieve?">
        </div>
        <div class="form-group">
          <label class="form-label">Key Message</label>
          <input class="form-input" id="reqKeyMessage" placeholder="Primary message or tagline">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Target Group</label>
            <input class="form-input" id="reqTargetGroup" placeholder="Who is this for?">
          </div>
          <div class="form-group">
            <label class="form-label">Languages</label>
            <select class="form-select" id="reqLanguages" multiple style="height:60px">
              <option value="Bengali" selected>Bengali</option>
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Mandatories</label>
          <textarea class="form-textarea" id="reqMandatories" placeholder="Must-have elements, brand guidelines, etc." rows="2"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Copy Draft</label>
          <textarea class="form-textarea" id="reqCopyDraft" placeholder="Draft copy or messaging" rows="2"></textarea>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Attachments</label>
        <div style="border:2px dashed var(--color-border);border-radius:var(--radius-lg);padding:var(--space-6);text-align:center;color:var(--color-text-faint);font-size:var(--text-xs)">
          <i data-lucide="upload-cloud" style="display:inline-block;width:24px;height:24px;margin-bottom:var(--space-2)"></i><br>
          Drop files here or click to upload<br>
          <span style="font-size:10px">(Mock — upload wired in Supabase integration)</span>
        </div>
      </div>
    `;

    document.getElementById('modalOverlay').classList.add('open');
    renderDeliverablesBuilder();
    lucide.createIcons();
  }

  function onAssetTypeChange() {
    // No-op: deliverables now handle asset types individually
  }

  function updateAutoPriority() {
    const goLive = document.getElementById('reqGoLive')?.value;
    const display = document.getElementById('autoPriorityDisplay');
    if (!display) return;
    if (!goLive) { display.innerHTML = '<span class="badge badge-gray">Set go-live date</span>'; return; }
    const firstDelType = modalDeliverables.find(d => d.assetTypeId);
    const at = firstDelType ? ASSET_TYPES.find(a => a.id === firstDelType.assetTypeId) : null;
    const p = DataService.calculatePriority(goLive, at ? at.slaDays : 3);
    const colorMap = { blocked: 'badge-red', urgent: 'badge-red', high: 'badge-orange', medium: 'badge-blue', low: 'badge-gray' };
    const labelMap = { blocked: 'Blocked (Same-Day)', urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };
    display.innerHTML = '<span class="badge ' + (colorMap[p] || 'badge-gray') + '">' + (labelMap[p] || p) + '</span>';
    if (p === 'blocked') {
      const warn = document.getElementById('slaWarning');
      if (warn) { warn.innerHTML = '<div class="expedited-warning"><i data-lucide="alert-triangle"></i> Same-day request: requires Creative Team Head approval.</div>'; lucide.createIcons(); }
    }
  }

  function checkSlaWarning(assetTypeId, goLiveStr) {
    const warn = document.getElementById('slaWarning');
    if (!warn) return;
    if (!assetTypeId || !goLiveStr) { warn.innerHTML = ''; return; }
    const at = ASSET_TYPES.find(a => a.id === assetTypeId);
    if (!at) return;
    const goLive = new Date(goLiveStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    const daysUntil = Math.ceil((goLive - today) / (1000*60*60*24));
    if (daysUntil < at.slaDays) {
      warn.innerHTML = `<div class="expedited-warning"><i data-lucide="alert-triangle"></i> Expedited: Go-live is ${daysUntil} days away but SLA requires ${at.slaDays} days. Internal deadline will be today.</div>`;
      lucide.createIcons();
    } else {
      warn.innerHTML = '';
    }
  }

  function submitModal() {
    const modalTitle = document.getElementById('modalTitle').textContent;
    if (modalTitle === 'New Campaign') {
      submitNewCampaign();
      return;
    }
    const title = document.getElementById('reqTitle')?.value;
    const campaignId = document.getElementById('reqCampaign')?.value;
    const goLiveDate = document.getElementById('reqGoLive')?.value;
    const vertical = document.getElementById('reqVertical')?.value || '';
    const department = document.getElementById('reqDepartment')?.value || '';

    // Compute auto priority
    let priority = 'medium';
    const overrideChk = document.getElementById('reqPriorityOverride');
    if (overrideChk && overrideChk.checked) {
      priority = document.getElementById('reqPriorityManual')?.value || 'medium';
    } else if (goLiveDate) {
      const firstDelType = modalDeliverables.find(d => d.assetTypeId);
      const at = firstDelType ? ASSET_TYPES.find(a => a.id === firstDelType.assetTypeId) : null;
      priority = DataService.calculatePriority(goLiveDate, at ? at.slaDays : 3);
      if (priority === 'blocked') priority = 'urgent';
    }

    // Validate deliverables
    const validDels = modalDeliverables.filter(d => d.assetTypeId && d.platforms.length > 0);
    if (!title || !goLiveDate || validDels.length === 0) {
      showToast('Please fill in title, go-live date, and at least one deliverable with asset type and platform.', 'error');
      return;
    }

    // Build deliverables with IDs and default status
    const deliverables = validDels.map((d, i) => ({
      id: 'del_' + Date.now() + '_' + i,
      assetTypeId: d.assetTypeId,
      platforms: d.platforms,
      assignedTo: null,
      status: 'intake',
    }));

    const languages = [...document.getElementById('reqLanguages').selectedOptions].map(o => o.value);

    DataService.createRequest({
      title, campaignId, goLiveDate, priority, vertical, department,
      deliverables,
      brief: {
        objective: document.getElementById('reqObjective')?.value || '',
        keyMessage: document.getElementById('reqKeyMessage')?.value || '',
        targetGroup: document.getElementById('reqTargetGroup')?.value || '',
        mandatories: document.getElementById('reqMandatories')?.value || '',
        languages, copyDraft: document.getElementById('reqCopyDraft')?.value || '',
      }
    });

    closeModal();
    showToast('Request created successfully', 'success');
    renderView(currentView);
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
  }

  /* ── CAMPAIGN CREATION MODAL ─────────────────────────────────────── */
  function openNewCampaignModal() {
    document.getElementById('modalTitle').textContent = 'New Campaign';
    document.getElementById('modalSubmit').textContent = 'Create Campaign';
    document.getElementById('modalBody').innerHTML = `
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input class="form-input" id="campName" placeholder="e.g., Durga Puja 2026 Campaign">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Show Name</label>
          <input class="form-input" id="campShow" placeholder="e.g., Kacher Manush">
        </div>
        <div class="form-group">
          <label class="form-label">Season</label>
          <input class="form-input" id="campSeason" placeholder="e.g., Season 2">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="campDesc" rows="3" placeholder="Campaign description..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="campStatus">
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
        </select>
      </div>
    `;
    document.getElementById('modalOverlay').classList.add('open');
    lucide.createIcons();
  }

  function submitNewCampaign() {
    const name = document.getElementById('campName')?.value;
    if (!name) {
      showToast('Campaign name is required', 'error');
      return;
    }
    const show = document.getElementById('campShow')?.value || '';
    const season = document.getElementById('campSeason')?.value || '';
    const description = document.getElementById('campDesc')?.value || '';
    const status = document.getElementById('campStatus')?.value || 'active';
    DataService.createCampaign({
      name,
      show: season ? `${show} ${season}`.trim() : show,
      description,
      status,
    });
    closeModal();
    showToast('Campaign created successfully', 'success');
    renderView(currentView);
  }

  /* ── 5. CAMPAIGNS ──────────────────────────────────────────────────── */
  function renderCampaigns(param) {
    if (param) return renderCampaignDetail(param);

    const campaigns = DataService.getCampaigns();
    const statusLabels = { active: 'Active', on_hold: 'On Hold', completed: 'Completed', archived: 'Archived' };

    return `<div class="view-container">
      <div class="view-header">
        <h1>Campaigns</h1>
        ${window.Permissions && window.Permissions.canCreateCampaign() ? '<button class="btn btn-primary" onclick="App.openNewCampaignModal()"><i data-lucide="plus"></i> New Campaign</button>' : ''}
      </div>

      <div class="card-grid">
        ${campaigns.map(c => `
          <div class="card" onclick="App.navigate('campaigns/${c.id}')">
            <div class="flex items-center gap-2" style="justify-content:space-between;margin-bottom:var(--space-2)">
              <span class="badge campaign-status-${c.status}">${statusLabels[c.status] || c.status}</span>
              <span class="text-xs text-faint font-mono">${formatDate(c.createdDate)}</span>
            </div>
            <div class="card-title">${c.name}</div>
            <div class="card-meta">${c.show} · ${c.requestCount} requests</div>
            ${c.description ? `<p class="text-xs text-muted" style="margin-bottom:var(--space-3);line-height:1.4">${c.description.substring(0,100)}${c.description.length > 100 ? '...' : ''}</p>` : ''}
            <div class="card-progress">
              <div class="progress-bar"><div class="progress-fill" style="width:${c.progress}%"></div></div>
              <div class="progress-label">${c.progress}% complete (${c.completedCount}/${c.requestCount})</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  function renderCampaignDetail(campaignId) {
    const campaign = DataService.getCampaignById(campaignId);
    if (!campaign) return '<div class="view-container"><p>Campaign not found.</p></div>';

    const reqs = DataService.getRequests({ campaignId });

    let tabContent = '';
    if (campaignDetailTab === 'knowledge_base') {
      tabContent = renderKnowledgeBase(campaignId);
    } else if (campaignDetailTab === 'content_schedule') {
      tabContent = renderContentSchedule(campaignId);
    } else {
      tabContent = reqs.length > 0 ? `
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Title</th><th>Asset Type</th><th>Assigned To</th><th>Status</th><th>Priority</th><th>Go-Live</th></tr></thead>
          <tbody>
          ${reqs.map(r => `
            <tr onclick="App.openRequestDetail('${r.id}')">
              <td class="table-title-cell">${r.title}</td>
              <td class="text-xs">${r.assetType ? r.assetType.name : '\u2014'}</td>
              <td>${r.assignee ? `<div class="flex gap-2 items-center">${renderAvatar(r.assignee,'sm')}<span class="text-xs">${r.assignee.name.split(' ')[0]}</span></div>` : '<span class="text-faint text-xs">\u2014</span>'}</td>
              <td>${statusBadge(r.status)}</td>
              <td><div class="flex gap-2 items-center">${priorityDot(r.priority)}<span class="text-xs">${PRIORITIES[r.priority].label}</span></div></td>
              <td class="text-xs font-mono">${formatDate(r.goLiveDate)}</td>
            </tr>
          `).join('')}
          </tbody>
        </table>
      </div>` : emptyState('inbox', 'No requests yet', 'Create the first request for this campaign.', { label: 'New Request', onclick: "App.openNewRequestModal('" + campaignId + "')" });
    }

    return `<div class="view-container">
      <div class="view-header">
        <div>
          <div class="breadcrumbs">
            <span class="breadcrumb-item" onclick="App.navigate('dashboard')">Dashboard</span>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-item" onclick="App.navigate('campaigns')">Campaigns</span>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-current">${campaign.name}</span>
          </div>
          <h1>${campaign.name}</h1>
          <p class="text-xs text-muted mt-2">${campaign.description || ''}</p>
        </div>
        ${window.Permissions && window.Permissions.canCreateRequest() ? `<button class="btn btn-primary" onclick="App.openNewRequestModal('${campaignId}')"><i data-lucide="plus" style="width:16px;height:16px"></i> New Request</button>` : ''}
      </div>

      <div class="kpi-grid" style="margin-bottom:var(--space-4)">
        <div class="kpi-card"><div class="kpi-label">Total Requests</div><div class="kpi-value">${campaign.requestCount}</div></div>
        <div class="kpi-card"><div class="kpi-label">Completed</div><div class="kpi-value">${campaign.completedCount}</div></div>
        <div class="kpi-card"><div class="kpi-label">Progress</div><div class="kpi-value">${campaign.progress}%</div></div>
      </div>

      <div class="campaign-tabs">
        <button class="campaign-tab ${campaignDetailTab === 'requests' ? 'active' : ''}" onclick="App.switchCampaignTab('${campaignId}', 'requests')">
          <i data-lucide="file-text" style="width:14px;height:14px"></i> Requests
        </button>
        <button class="campaign-tab ${campaignDetailTab === 'knowledge_base' ? 'active' : ''}" onclick="App.switchCampaignTab('${campaignId}', 'knowledge_base')">
          <i data-lucide="book-open" style="width:14px;height:14px"></i> Knowledge Base
        </button>
        <button class="campaign-tab ${campaignDetailTab === 'content_schedule' ? 'active' : ''}" onclick="App.switchCampaignTab('${campaignId}', 'content_schedule')">
          <i data-lucide="calendar-clock" style="width:14px;height:14px"></i> Content Schedule
        </button>
      </div>

      ${tabContent}
    </div>`;
  }

  function switchCampaignTab(campaignId, tab) {
    campaignDetailTab = tab;
    const container = document.getElementById('viewContainer');
    container.innerHTML = renderCampaignDetail(campaignId);
    lucide.createIcons();
  }

  /* -- Knowledge Base -- */
  function renderKnowledgeBase(campaignId) {
    const entries = DataService.getKnowledgeBase(campaignId);
    const categoryLabels = { past_asset: 'Past Asset', performance_data: 'Performance Data', learning: 'Learning', brief: 'Brief', reference: 'Reference' };
    const categoryIcons = { past_asset: 'image', performance_data: 'bar-chart-2', learning: 'lightbulb', brief: 'file-text', reference: 'link' };
    const categoryColors = { past_asset: 'badge-blue', performance_data: 'badge-green', learning: 'badge-orange', brief: 'badge-gray', reference: 'badge-purple' };

    return `
      <div class="kb-section">
        <div class="kb-header">
          <span class="text-xs text-faint">${entries.length} entries</span>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('kbFormContainer').style.display = document.getElementById('kbFormContainer').style.display === 'none' ? 'block' : 'none'">
            <i data-lucide="plus" style="width:14px;height:14px"></i> Add Entry
          </button>
        </div>
        <div id="kbFormContainer" class="kb-form-container" style="display:none">
          <div class="kb-form">
            <div class="form-group"><label class="form-label">Title</label><input type="text" id="kbTitle" class="form-input" placeholder="Entry title..."></div>
            <div class="form-group"><label class="form-label">Category</label>
              <select id="kbCategory" class="form-input"><option value="past_asset">Past Asset</option><option value="performance_data">Performance Data</option><option value="learning">Learning</option><option value="brief">Brief</option><option value="reference">Reference</option></select>
            </div>
            <div class="form-group"><label class="form-label">Notes / Content</label><textarea id="kbContent" class="form-input" rows="4" placeholder="Enter notes, learnings, data..."></textarea></div>
            <div class="form-group"><label class="form-label">Tags (comma-separated)</label><input type="text" id="kbTags" class="form-input" placeholder="e.g. season_1, instagram, key_art"></div>
            <div class="form-group"><label class="form-label">Reference / Link (optional)</label><input type="text" id="kbReference" class="form-input" placeholder="File name or URL..."></div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick="App.submitKnowledgeEntry('${campaignId}')">Save Entry</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('kbFormContainer').style.display='none'">Cancel</button>
            </div>
          </div>
        </div>
        ${entries.length === 0 ? '<div class="empty-state" style="padding:var(--space-8)"><div class="empty-state-icon"><i data-lucide="book-open"></i></div><h3>No knowledge entries yet</h3><p>Add past assets, performance data, learnings, and briefs for this campaign.</p></div>' : `
        <div class="kb-entries-list">
          ${entries.map(kb => `
            <div class="kb-entry-card">
              <div class="kb-entry-header">
                <div class="kb-entry-title-row">
                  <i data-lucide="${categoryIcons[kb.category] || 'file'}" style="width:16px;height:16px;color:var(--color-primary);flex-shrink:0"></i>
                  <span class="kb-entry-title">${kb.title}</span>
                  <span class="badge ${categoryColors[kb.category] || 'badge-gray'}">${categoryLabels[kb.category] || kb.category}</span>
                </div>
                <button class="btn btn-ghost btn-sm kb-delete-btn" onclick="App.deleteKnowledgeEntry('${campaignId}', '${kb.id}')" title="Delete entry">
                  <i data-lucide="trash-2" style="width:12px;height:12px"></i>
                </button>
              </div>
              <div class="kb-entry-content">${kb.content}</div>
              ${kb.reference ? '<div class="kb-entry-reference"><i data-lucide="paperclip" style="width:12px;height:12px"></i> ' + kb.reference + '</div>' : ''}
              <div class="kb-entry-footer">
                <div class="kb-entry-tags">${(kb.tags || []).map(t => '<span class="kb-tag">' + t.replace(/_/g, ' ') + '</span>').join('')}</div>
                <div class="kb-entry-meta">
                  ${kb.addedByUser ? renderAvatar(kb.addedByUser, 'sm') + ' <span class="text-xs text-faint">' + kb.addedByUser.name.split(' ')[0] + '</span>' : ''}
                  <span class="text-xs text-faint">${formatDate(kb.addedDate)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>`}
      </div>`;
  }

  function submitKnowledgeEntry(campaignId) {
    const title = document.getElementById('kbTitle').value.trim();
    const category = document.getElementById('kbCategory').value;
    const kbContent = document.getElementById('kbContent').value.trim();
    const tagsRaw = document.getElementById('kbTags').value.trim();
    const reference = document.getElementById('kbReference').value.trim();
    if (!title || !kbContent) { showToast('Title and content are required.', 'error'); return; }
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().replace(/\s+/g, '_')).filter(Boolean) : [];
    DataService.addKnowledgeEntry({ campaignId, title, category, content: kbContent, tags, reference });
    showToast('Knowledge entry added.', 'success');
    switchCampaignTab(campaignId, 'knowledge_base');
  }

  function deleteKnowledgeEntry(campaignId, entryId) {
    DataService.deleteKnowledgeEntry(entryId);
    showToast('Entry deleted.', 'success');
    switchCampaignTab(campaignId, 'knowledge_base');
  }

  /* -- Content Schedule -- */
  function renderContentSchedule(campaignId) {
    const items = DataService.getContentSchedule(campaignId);
    const reqs2 = DataService.getRequests({ campaignId });
    const csStatusLabels = { planned: 'Planned', in_production: 'In Production', ready: 'Ready', published: 'Published' };
    const csStatusColors = { planned: 'badge-gray', in_production: 'badge-blue', ready: 'badge-green', published: 'badge-green' };
    const csStatusOrder = ['planned', 'in_production', 'ready', 'published'];

    return `
      <div class="cs-section">
        <div class="cs-header">
          <span class="text-xs text-faint">${items.length} scheduled items</span>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('csFormContainer').style.display = document.getElementById('csFormContainer').style.display === 'none' ? 'block' : 'none'">
            <i data-lucide="plus" style="width:14px;height:14px"></i> Add Content Item
          </button>
        </div>
        <div id="csFormContainer" class="cs-form-container" style="display:none">
          <div class="cs-form">
            <div class="form-row-2col">
              <div class="form-group"><label class="form-label">Title</label><input type="text" id="csTitle" class="form-input" placeholder="e.g. Teaser Drop, Character Reveal..."></div>
              <div class="form-group"><label class="form-label">Release Date</label><input type="date" id="csReleaseDate" class="form-input"></div>
            </div>
            <div class="form-row-2col">
              <div class="form-group"><label class="form-label">Platforms</label>
                <div class="cs-platform-checkboxes" id="csPlatforms">${PLATFORMS.map(p => '<label class="cs-platform-checkbox"><input type="checkbox" value="' + p.id + '"> ' + p.name + '</label>').join('')}</div>
              </div>
              <div class="form-group"><label class="form-label">Link to Request (optional)</label>
                <select id="csLinkedRequest" class="form-input"><option value="">None</option>${reqs2.map(r => '<option value="' + r.id + '">' + r.title + '</option>').join('')}</select>
              </div>
            </div>
            <div class="form-group"><label class="form-label">Notes</label><textarea id="csNotes" class="form-input" rows="2" placeholder="Scheduling notes, timing, etc."></textarea></div>
            <div class="flex gap-2">
              <button class="btn btn-primary btn-sm" onclick="App.submitContentItem('${campaignId}')">Add Item</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('csFormContainer').style.display='none'">Cancel</button>
            </div>
          </div>
        </div>
        ${items.length === 0 ? '<div class="empty-state" style="padding:var(--space-8)"><div class="empty-state-icon"><i data-lucide="calendar-clock"></i></div><h3>No content scheduled</h3><p>Plan content releases and link them to creative requests.</p></div>' : `
        <div class="cs-timeline">
          ${items.map(cs => {
            const rd = new Date(cs.releaseDate);
            const today = new Date(); today.setHours(0,0,0,0);
            const isPast = rd < today;
            const isToday = rd.toISOString().split('T')[0] === today.toISOString().split('T')[0];
            const nextIdx = csStatusOrder.indexOf(cs.status) + 1;
            const nextStatus = nextIdx < csStatusOrder.length ? csStatusOrder[nextIdx] : null;
            return `
            <div class="cs-timeline-item ${isPast && cs.status !== 'published' ? 'cs-overdue' : ''} ${isToday ? 'cs-today' : ''}">
              <div class="cs-timeline-date"><div class="cs-date-badge ${isToday ? 'cs-date-today' : isPast ? 'cs-date-past' : ''}"><span class="cs-date-day">${rd.getDate()}</span><span class="cs-date-month">${rd.toLocaleDateString('en-IN', { month: 'short' })}</span></div></div>
              <div class="cs-timeline-connector"><div class="cs-timeline-dot cs-status-${cs.status}"></div><div class="cs-timeline-line"></div></div>
              <div class="cs-timeline-content">
                <div class="cs-item-header">
                  <span class="cs-item-title">${cs.title}</span>
                  <div class="cs-item-actions">
                    ${nextStatus ? '<button class="btn btn-ghost btn-sm" onclick="App.advanceContentStatus(\'' + campaignId + '\', \'' + cs.id + '\', \'' + nextStatus + '\')" title="Move to ' + csStatusLabels[nextStatus] + '"><i data-lucide="arrow-right" style="width:12px;height:12px"></i></button>' : ''}
                    <button class="btn btn-ghost btn-sm" onclick="App.deleteContentItem('${campaignId}', '${cs.id}')" title="Delete"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>
                  </div>
                </div>
                <div class="cs-item-meta">
                  <span class="badge ${csStatusColors[cs.status] || 'badge-gray'}">${csStatusLabels[cs.status] || cs.status}</span>
                  <span class="cs-item-platforms">${(cs.platformObjects || []).map(p => '<span class="platform-icon-chip" title="' + p.name + '"><i data-lucide="' + p.icon + '" style="width:12px;height:12px"></i></span>').join('')}</span>
                </div>
                ${cs.linkedRequest ? '<div class="cs-linked-request" onclick="App.openRequestDetail(\'' + cs.linkedRequestId + '\')"><i data-lucide="link" style="width:12px;height:12px"></i> <span>' + cs.linkedRequest.title + '</span> ' + statusBadge(cs.linkedRequest.status) + '</div>' : ''}
                ${cs.notes ? '<div class="cs-item-notes">' + cs.notes + '</div>' : ''}
              </div>
            </div>`;
          }).join('')}
        </div>`}
      </div>`;
  }

  function submitContentItem(campaignId) {
    const title = document.getElementById('csTitle').value.trim();
    const releaseDate = document.getElementById('csReleaseDate').value;
    const linkedRequestId = document.getElementById('csLinkedRequest').value || null;
    const notes = document.getElementById('csNotes').value.trim();
    const platformCheckboxes = document.querySelectorAll('#csPlatforms input[type=checkbox]:checked');
    const platforms = Array.from(platformCheckboxes).map(cb => cb.value);
    if (!title || !releaseDate) { showToast('Title and release date are required.', 'error'); return; }
    DataService.addContentScheduleItem({ campaignId, title, releaseDate, platforms, linkedRequestId, notes });
    showToast('Content item scheduled.', 'success');
    switchCampaignTab(campaignId, 'content_schedule');
  }

  function advanceContentStatus(campaignId, itemId, newStatus) {
    DataService.updateContentScheduleStatus(itemId, newStatus);
    showToast('Status updated.', 'success');
    switchCampaignTab(campaignId, 'content_schedule');
  }

  function deleteContentItem(campaignId, itemId) {
    DataService.deleteContentScheduleItem(itemId);
    showToast('Content item removed.', 'success');
    switchCampaignTab(campaignId, 'content_schedule');
  }

  /* ── 6. CALENDAR ───────────────────────────────────────────────────── */
  function renderCalendar() {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const events = DataService.getRequestsByDate(calendarYear, calendarMonth);
    // Also get deadline dates
    const allReqs = DataService.getRequests();
    const deadlineMap = {};
    allReqs.forEach(r => {
      if (r.internalDeadline) {
        const rd = new Date(r.internalDeadline);
        if (rd.getFullYear() === calendarYear && rd.getMonth() === calendarMonth) {
          const dk = r.internalDeadline;
          if (!deadlineMap[dk]) deadlineMap[dk] = [];
          deadlineMap[dk].push(r);
        }
      }
    });

    const firstDay = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const prevDays = new Date(calendarYear, calendarMonth, 0).getDate();
    let days = '';
    let cellIndex = 0;

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const isWeekend = (cellIndex % 7) >= 5;
      days += `<div class="calendar-day other-month${isWeekend ? ' weekend' : ''}"><div class="calendar-day-number">${prevDays - i}</div></div>`;
      cellIndex++;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayEvents = events[dateStr] || [];
      const deadlineEvents = (deadlineMap[dateStr] || []);
      const now = new Date();
      const isToday = calendarYear === now.getFullYear() && calendarMonth === now.getMonth() && d === now.getDate();
      const isWeekend = (cellIndex % 7) >= 5;

      days += `<div class="calendar-day ${isToday ? 'today' : ''}${isWeekend ? ' weekend' : ''}" onclick="App.showDayPopup(event, '${dateStr}')">
        <div class="calendar-day-number">${d}</div>
        <div class="calendar-day-events" data-date="${dateStr}">
          ${dayEvents.slice(0, 2).map(e => `<div class="calendar-event golive-event" data-id="${e.id}">
            <span class="platform-dot platform-${e.platforms[0]}" style="width:6px;height:6px"></span>
            <span style="overflow:hidden;text-overflow:ellipsis">${e.title.substring(0, 18)}</span>
          </div>`).join('')}
          ${deadlineEvents.slice(0, 1).map(e => `<div class="calendar-event deadline-event">
            <span style="overflow:hidden;text-overflow:ellipsis;color:var(--color-warning)">${e.title.substring(0, 18)}</span>
          </div>`).join('')}
          ${dayEvents.length > 2 ? `<div class="text-xs text-faint" style="padding:0 4px">+${dayEvents.length - 2} more</div>` : ''}
        </div>
      </div>`;
      cellIndex++;
    }

    // Next month leading days
    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const isWeekend = (cellIndex % 7) >= 5;
      days += `<div class="calendar-day other-month${isWeekend ? ' weekend' : ''}"><div class="calendar-day-number">${i}</div></div>`;
      cellIndex++;
    }

    return `<div class="view-container">
      <div class="view-header">
        <h1>Calendar</h1>
      </div>

      <div class="calendar-header">
        <div class="calendar-nav">
          <button class="btn btn-ghost btn-sm" onclick="App.prevMonth()"><i data-lucide="chevron-left"></i></button>
          <span class="calendar-month-label">${monthNames[calendarMonth]} ${calendarYear}</span>
          <button class="btn btn-ghost btn-sm" onclick="App.nextMonth()"><i data-lucide="chevron-right"></i></button>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="App.calendarToday()">Today</button>
      </div>

      <div class="calendar-legend">
        <div class="calendar-legend-item"><div class="calendar-legend-dot" style="background:var(--color-primary)"></div> Go-Live</div>
        <div class="calendar-legend-item"><div class="calendar-legend-dot" style="background:var(--color-warning)"></div> Internal Deadline</div>
      </div>

      <div class="calendar-grid">
        ${dayNames.map((dn, di) => `<div class="calendar-day-header${di >= 5 ? ' weekend' : ''}">${dn}</div>`).join('')}
        ${days}
      </div>

      <!-- Calendar reschedule confirmation dialog -->
      <div class="cal-confirm-overlay" id="calConfirmOverlay" style="display:none">
        <div class="cal-confirm-dialog">
          <p id="calConfirmMsg">Reschedule?</p>
          <div class="cal-confirm-actions">
            <button class="btn btn-ghost btn-sm" onclick="App.cancelCalendarDrag()">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="App.confirmCalendarDrag()">Confirm</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  let _pendingCalDrag = null;

  function initCalendarDnD() {
    calendarSortables.forEach(s => s.destroy());
    calendarSortables = [];
    document.querySelectorAll('.calendar-day-events[data-date]').forEach(container => {
      const sortable = new Sortable(container, {
        group: 'calendar',
        animation: 150,
        ghostClass: 'cal-sortable-ghost',
        dragClass: 'cal-sortable-drag',
        draggable: '.calendar-event.golive-event',
        forceFallback: true,
        fallbackOnBody: true,
        fallbackTolerance: 3,
        delay: 120,
        delayOnTouchOnly: true,
        onStart: function() { isDragging = true; },
        onEnd: function(evt) {
          const reqId = evt.item.dataset.id;
          const fromDate = evt.from.dataset.date;
          const toDate = evt.to.dataset.date;
          if (!reqId || !toDate || fromDate === toDate) {
            setTimeout(() => { isDragging = false; }, 100);
            return;
          }
          const req = DataService.getRequestById(reqId);
          if (!req) { setTimeout(() => { isDragging = false; }, 100); return; }
          _pendingCalDrag = { reqId, toDate, title: req.title };
          const overlay = document.getElementById('calConfirmOverlay');
          const msg = document.getElementById('calConfirmMsg');
          if (overlay && msg) {
            msg.textContent = `Reschedule "${req.title}" go-live to ${formatDate(toDate)}?`;
            overlay.style.display = 'flex';
          }
          setTimeout(() => { isDragging = false; }, 100);
        }
      });
      calendarSortables.push(sortable);
    });
  }

  function confirmCalendarDrag() {
    if (!_pendingCalDrag) return;
    const { reqId, toDate } = _pendingCalDrag;
    const raw = REQUESTS.find(r => r.id === reqId);
    if (raw) {
      raw.goLiveDate = toDate;
      SupabaseClient.updateRequestField(reqId, 'go_live_date', toDate).catch(() => {});
      DataService.addActivity(reqId, 'u1', 'rescheduled', `Rescheduled go-live to ${formatDate(toDate)}`);
      showToast(`Rescheduled to ${formatDate(toDate)}`, 'success');
    }
    _pendingCalDrag = null;
    const overlay = document.getElementById('calConfirmOverlay');
    if (overlay) overlay.style.display = 'none';
    document.getElementById('viewContainer').innerHTML = renderCalendar();
    initCalendarDnD();
    lucide.createIcons();
  }

  function cancelCalendarDrag() {
    _pendingCalDrag = null;
    const overlay = document.getElementById('calConfirmOverlay');
    if (overlay) overlay.style.display = 'none';
    // Re-render to restore original positions
    document.getElementById('viewContainer').innerHTML = renderCalendar();
    initCalendarDnD();
    lucide.createIcons();
  }

  function prevMonth() {
    calendarMonth--;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    document.getElementById('viewContainer').innerHTML = renderCalendar();
    initCalendarDnD();
    lucide.createIcons();
  }

  function nextMonth() {
    calendarMonth++;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    document.getElementById('viewContainer').innerHTML = renderCalendar();
    initCalendarDnD();
    lucide.createIcons();
  }

  function calendarToday() {
    const now = new Date();
    calendarYear = now.getFullYear();
    calendarMonth = now.getMonth();
    document.getElementById('viewContainer').innerHTML = renderCalendar();
    initCalendarDnD();
    lucide.createIcons();
  }

  function showDayPopup(event, dateStr) {
    closeDayPopup();
    const events = DataService.getRequestsByDate(calendarYear, calendarMonth);
    const dayEvents = events[dateStr] || [];
    if (dayEvents.length === 0) return;

    const popup = document.createElement('div');
    popup.className = 'calendar-day-popup';
    popup.innerHTML = `
      <h4>${formatDate(dateStr)}</h4>
      ${dayEvents.map(e => `
        <div class="calendar-popup-item" onclick="App.openRequestDetail('${e.id}')" style="cursor:pointer">
          <span class="platform-dot platform-${e.platforms[0]}"></span>
          <span class="text-sm">${e.title}</span>
          ${statusBadge(e.status)}
        </div>
      `).join('')}
    `;

    const rect = event.currentTarget.getBoundingClientRect();
    popup.style.top = `${rect.bottom + 4}px`;
    popup.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
    document.body.appendChild(popup);
    dayPopup = popup;
    lucide.createIcons();

    setTimeout(() => { document.addEventListener('click', closeDayPopupOnClick); }, 10);
  }

  function closeDayPopupOnClick(e) {
    if (dayPopup && !dayPopup.contains(e.target)) { closeDayPopup(); }
  }

  function closeDayPopup() {
    if (dayPopup) { dayPopup.remove(); dayPopup = null; }
    document.removeEventListener('click', closeDayPopupOnClick);
  }

  /* ── 7. KANBAN ─────────────────────────────────────────────────────── */
  function renderKanban() {
    const allReqs = DataService.getRequests();
    const delCards = [];
    allReqs.forEach(r => {
      r.deliverables.forEach(d => {
        delCards.push({ ...d, parentRequest: r, requestId: r.id, requestTitle: r.title, priority: r.priority, goLiveDate: r.goLiveDate, internalDeadline: r.internalDeadline, isOverdue: r.isOverdue, isAtRisk: r.isAtRisk, daysUntilDeadline: r.daysUntilDeadline });
      });
    });

    const columns = [
      { key: 'intake', label: 'Intake' },
      { key: 'brief_approved', label: 'Brief Approved' },
      { key: 'in_progress', label: 'In Progress' },
      { key: 'first_cut', label: 'First Cut' },
      { key: 'under_review', label: 'Under Review' },
      { key: 'changes_in_progress', label: 'Changes' },
      { key: 'final_approved', label: 'Final Approved' },
      { key: 'scheduled', label: 'Scheduled' },
      { key: 'live', label: 'Live' },
    ];

    return `<div class="view-container" style="padding-bottom:0">
      <div class="view-header">
        <h1>Kanban Board</h1>
      </div>
      <div class="kanban-board">
        ${columns.map(col => {
          const cards = delCards.filter(d => d.status === col.key);
          return `<div class="kanban-column">
            <div class="kanban-column-header">
              <span class="kanban-column-title">${col.label}</span>
              <span class="kanban-column-count">${cards.length}</span>
            </div>
            <div class="kanban-column-body" data-status="${col.key}">
              ${cards.length === 0 ? '<div class="kanban-empty-placeholder text-xs text-faint" style="text-align:center;padding:var(--space-4)">No items</div>' : ''}
              ${cards.map(d => kanbanDeliverableCard(d)).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function kanbanCard(r) {
    const riskClass = r.isOverdue ? 'overdue' : r.isAtRisk ? 'at-risk' : 'on-track';
    const deadlineText = r.isOverdue ? `${Math.abs(r.daysUntilDeadline)}d late` : r.daysUntilDeadline === 0 ? 'Today' : `${r.daysUntilDeadline}d`;
    const at = r.assetType;

    return `<div class="kanban-card ${riskClass}" data-id="${r.id}" onmouseup="App.kanbanCardClick('${r.id}')" oncontextmenu="App.showContextMenu(event,'${r.id}')">
      <div class="kanban-card-title">${r.title}</div>
      <div class="kanban-card-meta">
        <div class="kanban-card-left">
          ${at ? `<i data-lucide="${at.icon}" style="width:12px;height:12px;color:var(--color-text-faint)"></i>` : ''}
          ${r.assignee ? renderAvatar(r.assignee, 'sm') : ''}
          ${priorityDot(r.priority)}
        </div>
        <span class="kanban-card-deadline ${r.isOverdue ? 'style="color:var(--color-error)"' : r.isAtRisk ? 'style="color:var(--color-warning)"' : ''}">${deadlineText}</span>
      </div>
    </div>`;
  }

  function kanbanDeliverableCard(d) {
    const riskClass = d.isOverdue ? 'overdue' : d.isAtRisk ? 'at-risk' : 'on-track';
    const deadlineText = d.isOverdue ? `${Math.abs(d.daysUntilDeadline)}d late` : d.daysUntilDeadline === 0 ? 'Today' : `${d.daysUntilDeadline}d`;
    const at = d.assetType;
    const reqId = d.requestId;

    return `<div class="kanban-card ${riskClass}" data-id="${reqId}" data-del-id="${d.id}" onmouseup="App.kanbanCardClick('${reqId}')" oncontextmenu="App.showContextMenu(event,'${reqId}')">
      <div class="kanban-card-title">${d.requestTitle}</div>
      <div class="kanban-card-del-type"><i data-lucide="${at ? at.icon : 'file'}" style="width:11px;height:11px"></i> ${at ? at.name : ''}</div>
      <div class="kanban-card-meta">
        <div class="kanban-card-left">
          ${d.assignee ? renderAvatar(d.assignee, 'sm') : ''}
          ${priorityDot(d.priority)}
        </div>
        <span class="kanban-card-deadline ${d.isOverdue ? 'style="color:var(--color-error)"' : d.isAtRisk ? 'style="color:var(--color-warning)"' : ''}">${deadlineText}</span>
      </div>
    </div>`;
  }

  function initKanbanDnD() {
    document.querySelectorAll('.kanban-column-body').forEach(col => {
      const sortable = new Sortable(col, {
        group: 'kanban',
        animation: 200,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        draggable: '.kanban-card',
        forceFallback: true,
        fallbackOnBody: true,
        fallbackTolerance: 2,
        swapThreshold: 0.5,
        delay: 80,
        delayOnTouchOnly: true,
        onStart: function() {
          isDragging = true;
          document.querySelectorAll('.kanban-column-body .kanban-empty-placeholder').forEach(el => el.remove());
          document.body.style.cursor = 'grabbing';
        },
        onMove: function(evt) {
          // Highlight target column
          document.querySelectorAll('.kanban-column-body.drag-over').forEach(el => el.classList.remove('drag-over'));
          if (evt.to) evt.to.classList.add('drag-over');
        },
        onEnd: function(evt) {
          document.querySelectorAll('.kanban-column-body.drag-over').forEach(el => el.classList.remove('drag-over'));
          document.body.style.cursor = '';
          const reqId = evt.item.dataset.id;
          const delId = evt.item.dataset.delId;
          const newStatus = evt.to.dataset.status;
          if (reqId && newStatus) {
            if (delId) {
              DataService.updateDeliverableStatus(reqId, delId, newStatus);
            } else {
              DataService.updateRequestStatus(reqId, newStatus);
              DataService.addActivity(reqId, 'u1', 'status_changed', `Moved to ${STATUSES[newStatus].label}`);
            }
            document.querySelectorAll('.kanban-column-header .kanban-column-count').forEach((cnt) => {
              const body = cnt.closest('.kanban-column').querySelector('.kanban-column-body');
              cnt.textContent = body.querySelectorAll('.kanban-card').length;
            });
            showToast(`Moved to ${STATUSES[newStatus].label}`, 'success');
          }
          setTimeout(() => { isDragging = false; }, 100);
        }
      });
      kanbanSortables.push(sortable);
    });
  }

  function kanbanCardClick(reqId) {
    if (isDragging) return;
    openRequestDetail(reqId);
  }

  /* ── 8. WORKLOAD ───────────────────────────────────────────────────── */
  function renderWorkload() {
    const workload = DataService.getWorkload();
    const totalActive = workload.reduce((s, w) => s + w.activeCount, 0);
    const atCapacity = workload.filter(w => w.capacityStatus === 'over' || w.capacityStatus === 'at').length;
    const available = workload.filter(w => w.capacityStatus === 'under').length;

    return `<div class="view-container">
      <div class="view-header"><h1>Workload</h1></div>

      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
        ${kpiCard('clipboard-list','Total Active', totalActive, 'var(--color-primary-highlight)','var(--color-primary)')}
        ${kpiCard('alert-triangle','At Capacity', atCapacity, 'var(--color-warning-highlight)','var(--color-warning)')}
        ${kpiCard('check-circle','Available', available, 'var(--color-success-highlight)','var(--color-success)')}
      </div>

      <div class="chart-container" style="margin-bottom:var(--space-6)">
        <div class="chart-title">Requests per Designer</div>
        <div style="position:relative;height:200px;"><canvas id="workloadChart"></canvas></div>
      </div>

      <div class="workload-designers-grid">
      ${workload.map(w => {
        const capPct = w.capacity > 0 ? Math.min(100, Math.round((w.activeCount / w.capacity) * 100)) : 0;
        const capColor = capPct > 90 ? 'var(--color-error)' : capPct >= 70 ? 'var(--color-warning)' : 'var(--color-success)';
        return `
        <div class="workload-designer-card">
          <div class="workload-designer-header">
            <div class="workload-designer-info">
              ${renderAvatar(w, 'sm')}
              <div>
                <div class="workload-designer-name">${w.name}</div>
                <div class="workload-designer-role">${w.role.replace(/_/g,' ')}</div>
              </div>
            </div>
            <span class="badge ${w.capacityStatus === 'over' ? 'badge-red' : w.capacityStatus === 'at' ? 'badge-orange' : 'badge-green'}">
              ${w.capacityStatus === 'over' ? 'Over' : w.capacityStatus === 'at' ? 'At Cap' : 'Available'}
            </span>
          </div>
          <div class="workload-capacity-bar-wrap">
            <div class="workload-capacity-label"><span>${w.activeCount} / ${w.capacity}</span><span>${capPct}%</span></div>
            <div class="workload-capacity-track"><div class="workload-capacity-fill" style="width:${capPct}%;background:${capColor}"></div></div>
          </div>
          ${w.skills && w.skills.length ? `<div class="workload-skill-tags">${w.skills.map(s => `<span class="workload-skill-pill">${s}</span>`).join('')}</div>` : ''}
          <div class="workload-designer-cards" data-designer-id="${w.id}">
            ${w.activeRequests.length === 0 ? '<div class="text-xs text-faint" style="padding:var(--space-2)">No active requests</div>' :
              w.activeRequests.map(r => `
                <div class="workload-req-card" data-id="${r.id}" onmouseup="App.workloadCardClick('${r.id}')">
                  <div class="workload-req-card-title">${r.title.substring(0, 35)}${r.title.length > 35 ? '...' : ''}</div>
                  <div class="workload-req-card-meta">
                    <span class="flex gap-1 items-center">${platformDots(r.platformObjects)}</span>
                    ${statusBadge(r.status)}
                  </div>
                </div>
              `).join('')}
          </div>
        </div>`;
      }).join('')}
      </div>
    </div>`;
  }

  function initWorkloadChart() {
    const canvas = document.getElementById('workloadChart');
    if (!canvas) return;
    const workload = DataService.getWorkload();
    const root = getComputedStyle(document.documentElement);
    const textMuted = root.getPropertyValue('--color-text-muted').trim() || '#888';
    const gridColor = root.getPropertyValue('--color-divider').trim() || '#333';

    workloadChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: workload.map(w => w.name.split(' ')[0]),
        datasets: [{
          label: 'Active',
          data: workload.map(w => w.activeCount),
          backgroundColor: workload.map(w => w.capacityStatus === 'over' ? '#f87171' : w.capacityStatus === 'at' ? '#fbbf24' : '#4ade80'),
          borderRadius: 4,
          barThickness: 20,
        }, {
          label: 'Remaining',
          data: workload.map(w => Math.max(0, w.capacity - w.activeCount)),
          backgroundColor: gridColor,
          borderRadius: 4,
          barThickness: 20,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: { color: textMuted, font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 12 }
          },
          tooltip: {
            callbacks: {
              afterBody: function(tooltipItems) {
                const idx = tooltipItems[0].dataIndex;
                return `Capacity: ${workload[idx].capacity}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            stacked: true,
            grid: { color: gridColor },
            ticks: { color: textMuted, font: { family: 'Inter', size: 11 }, stepSize: 1 },
          },
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: textMuted, font: { family: 'Inter', size: 11 } },
          },
        },
      },
    });
  }

  function initWorkloadDnD() {
    document.querySelectorAll('.workload-designer-cards').forEach(section => {
      const sortable = new Sortable(section, {
        group: 'workload',
        animation: 200,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        draggable: '.workload-req-card',
        forceFallback: true,
        fallbackOnBody: true,
        fallbackTolerance: 2,
        delay: 80,
        delayOnTouchOnly: true,
        onStart: function() {
          isDragging = true;
          document.body.style.cursor = 'grabbing';
        },
        onMove: function(evt) {
          document.querySelectorAll('.workload-designer-cards.drag-over').forEach(el => el.classList.remove('drag-over'));
          if (evt.to) evt.to.classList.add('drag-over');
        },
        onEnd: function(evt) {
          document.querySelectorAll('.workload-designer-cards.drag-over').forEach(el => el.classList.remove('drag-over'));
          document.body.style.cursor = '';
          const reqId = evt.item.dataset.id;
          const newDesignerId = evt.to.dataset.designerId;
          if (reqId && newDesignerId && evt.from !== evt.to) {
            DataService.assignRequest(reqId, newDesignerId);
            const designer = DataService.getUserById(newDesignerId);
            showToast(`Reassigned to ${designer ? designer.name : newDesignerId}`, 'success');
          }
          setTimeout(() => { isDragging = false; }, 100);
        }
      });
      workloadSortables.push(sortable);
    });
  }

  function showWorkloadDetail(userId) {
    const reqs = DataService.getRequests({ assignedTo: userId }).filter(r => !['final_approved','scheduled','live'].includes(r.status));
    const user = DataService.getUserById(userId);
    if (!user) return;

    document.getElementById('panelTitle').textContent = `${user.name}'s Active Requests`;
    document.getElementById('panelBody').innerHTML = `
      <div class="panel-section">
        <div class="flex gap-3 items-center mb-4">
          ${renderAvatar(user, 'lg')}
          <div>
            <div style="font-weight:600">${user.name}</div>
            <div class="text-xs text-muted">${user.role.replace(/_/g,' ')} · ${user.email}</div>
            <div class="text-xs text-muted mt-2">Skills: ${user.skills.join(', ')}</div>
          </div>
        </div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">Active Requests (${reqs.length})</div>
        ${reqs.length === 0 ? '<p class="text-xs text-muted">No active requests</p>' : reqs.map(r => `
          <div class="flex items-center gap-3" style="padding:var(--space-2) 0;border-bottom:1px solid var(--color-divider);cursor:pointer" onclick="App.openRequestDetail('${r.id}')">
            <div style="flex:1;min-width:0">
              <div class="text-sm" style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.title}</div>
              <div class="text-xs text-muted">${r.assetType ? r.assetType.name : ''} · Due ${formatDate(r.internalDeadline)}</div>
            </div>
            ${statusBadge(r.status)}
            ${priorityDot(r.priority)}
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('panelOverlay').classList.add('open');
    document.getElementById('detailPanel').classList.add('open');
    lucide.createIcons();
  }

  function workloadCardClick(reqId) {
    if (isDragging) return;
    openRequestDetail(reqId);
  }

  /* ── TIMESHEET VIEW ──────────────────────────────────────────────── */
  let timesheetData = {}; // { 'reqId:YYYY-MM-DD': hours }
  let timesheetWeekStart = null;
  let timesheetTab = 'my'; // 'my' | 'team'
  let timesheetUserId = null; // Current user for "my" timesheet

  // ── Timesheet CTA state ──
  let tsClockState = 'idle'; // 'idle' | 'running' | 'paused'
  let tsActiveReqId = null;  // request currently being tracked
  let tsClockStart = null;   // Date when clock started
  let tsAccumulated = 0;     // seconds accumulated before pause
  let _tsInterval = null;    // timer interval ref

  function getTimesheetWeekStart() {
    if (timesheetWeekStart) return new Date(timesheetWeekStart);
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now);
    monday.setDate(diff);
    monday.setHours(0,0,0,0);
    return monday;
  }

  function getWeekDays(start) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }

  function formatShortDate(d) {
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function formatDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function isToday(d) {
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }

  function renderTimesheet() {
    const weekStart = getTimesheetWeekStart();
    const weekDays = getWeekDays(weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekLabel = `${weekStart.toLocaleDateString('en-IN', {day:'numeric', month:'short'})} — ${weekEnd.toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}`;

    if (!timesheetUserId) {
      timesheetUserId = window.__currentUser ? window.__currentUser.id : null;
      if (!timesheetUserId) {
        const designers = DataService.getDesigners();
        timesheetUserId = designers.length > 0 ? designers[0].id : null;
      }
    }

    if (timesheetTab === 'team') {
      return renderTeamTimesheet(weekStart, weekDays, weekLabel);
    }

    // My Timesheet — show requests assigned to current user
    const allReqs = DataService.getRequests({ assignedTo: timesheetUserId }).filter(r =>
      !['live'].includes(r.status)
    );
    const currentUser = DataService.getUserById(timesheetUserId);

    // Calculate totals
    let weekTotal = 0;
    const dayTotals = weekDays.map(() => 0);
    allReqs.forEach(r => {
      weekDays.forEach((d, i) => {
        const key = `${r.id}:${formatDateKey(d)}`;
        const hrs = timesheetData[key] || 0;
        dayTotals[i] += hrs;
        weekTotal += hrs;
      });
    });

    // Target hours per week (40h = 8h * 5 weekdays)
    const targetHours = 40;
    const pctComplete = Math.min(100, Math.round((weekTotal / targetHours) * 100));

    return `<div class="view-container">
      <div class="view-header">
        <h1>Timesheet</h1>
      </div>

      <div class="timesheet-tabs">
        <button class="timesheet-tab ${timesheetTab === 'my' ? 'active' : ''}" onclick="App.switchTimesheetTab('my')">My Timesheet</button>
        <button class="timesheet-tab ${timesheetTab === 'team' ? 'active' : ''}" onclick="App.switchTimesheetTab('team')">Team Overview</button>
      </div>

      <div class="timesheet-controls">
        <div class="timesheet-week-nav">
          <button class="btn btn-ghost btn-sm" onclick="App.timesheetPrevWeek()"><i data-lucide="chevron-left"></i></button>
          <span class="timesheet-week-label">${weekLabel}</span>
          <button class="btn btn-ghost btn-sm" onclick="App.timesheetNextWeek()"><i data-lucide="chevron-right"></i></button>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="App.timesheetThisWeek()">This Week</button>
          ${window.Permissions && window.Permissions.isLead() ? `<select class="filter-select" onchange="App.switchTimesheetUser(this.value)">
            ${DataService.getDesigners().map(d => `<option value="${d.id}" ${d.id===timesheetUserId?'selected':''}>${d.name}</option>`).join('')}
          </select>` : ''}
        </div>
      </div>

      <div class="ts-cta-bar">
        <div class="ts-cta-left">
          <select class="form-input form-input-sm ts-task-select" id="tsTaskSelect">
            <option value="">Select task...</option>
            ${allReqs.map(r => `<option value="${r.id}" ${tsActiveReqId === r.id ? 'selected' : ''}>${r.title}</option>`).join('')}
          </select>
          <button class="btn btn-sm ts-cta-btn ts-cta-start ${tsClockState === 'running' ? 'ts-cta-active' : ''}" onclick="App.tsStart()" title="Start tracking">
            <i data-lucide="play" style="width:14px;height:14px"></i> Start
          </button>
          <button class="btn btn-sm ts-cta-btn ts-cta-shift" onclick="App.tsShiftJob()" title="Switch to another task">
            <i data-lucide="shuffle" style="width:14px;height:14px"></i> Shift Job
          </button>
          <button class="btn btn-sm ts-cta-btn ts-cta-resume" onclick="App.tsStartAgain()" title="Resume after break">
            <i data-lucide="rotate-cw" style="width:14px;height:14px"></i> Start Again
          </button>
          <button class="btn btn-sm ts-cta-btn ts-cta-end" onclick="App.tsEnd()" title="End tracking">
            <i data-lucide="square" style="width:14px;height:14px"></i> End
          </button>
          ${isManagerUser() ? `<button class="btn btn-sm ts-cta-btn ts-cta-manager" onclick="App.tsChangeAssignedPerson()" title="Change assigned person (Manager only)">
            <i data-lucide="user-cog" style="width:14px;height:14px"></i> Change Person
          </button>` : ''}
        </div>
        <div class="ts-cta-right">
          ${tsClockState !== 'idle' ? `<div class="ts-clock-display ${tsClockState === 'running' ? 'ts-clock-running' : 'ts-clock-paused'}">
            <span class="ts-clock-dot"></span>
            <span class="ts-clock-label">${tsClockState === 'running' ? 'Tracking' : 'Paused'}</span>
            <span class="ts-clock-time" id="tsClockTime">${formatTsClock()}</span>
            ${tsActiveReqId ? `<span class="ts-clock-task">${(allReqs.find(r => r.id === tsActiveReqId) || {}).title || ''}</span>` : ''}
          </div>` : '<div class="ts-clock-display ts-clock-idle"><span class="ts-clock-label">Not tracking</span></div>'}
        </div>
      </div>

      ${_tsReassignOpen ? `<div class="ts-reassign-bar">
        <span class="ts-reassign-label"><i data-lucide="user-cog" style="width:14px;height:14px"></i> Reassign task to:</span>
        <select class="form-select form-input-sm" id="tsReassignSelect" style="max-width:200px">
          <option value="">Select person...</option>
          ${DataService.getDesigners().map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" onclick="App.tsConfirmReassign()">Confirm</button>
        <button class="btn btn-ghost btn-sm" onclick="App.tsCancelReassign()">Cancel</button>
      </div>` : ''}

      <div class="timesheet-summary-cards">
        <div class="timesheet-summary-card">
          <div class="timesheet-summary-label">This Week</div>
          <div class="timesheet-summary-value">${weekTotal}h <span class="text-xs text-muted" style="font-weight:400">/ ${targetHours}h</span></div>
        </div>
        <div class="timesheet-summary-card">
          <div class="timesheet-summary-label">Progress</div>
          <div class="timesheet-summary-value" style="color:${pctComplete >= 100 ? 'var(--color-success)' : pctComplete >= 60 ? 'var(--color-primary)' : 'var(--color-text)'}">${pctComplete}%</div>
        </div>
        <div class="timesheet-summary-card">
          <div class="timesheet-summary-label">Active Tasks</div>
          <div class="timesheet-summary-value">${allReqs.length}</div>
        </div>
        <div class="timesheet-summary-card">
          <div class="timesheet-summary-label">Avg per Day</div>
          <div class="timesheet-summary-value">${weekTotal > 0 ? (weekTotal / 5).toFixed(1) : '0'}h</div>
        </div>
      </div>

      <div class="timesheet-table-container">
        <table class="timesheet-table">
          <thead>
            <tr>
              <th>Request</th>
              ${weekDays.map((d, i) => `<th class="${isToday(d) ? 'today-col' : ''}">${d.toLocaleDateString('en-IN', {weekday:'short'})}<br><span style="font-weight:400;opacity:0.7">${d.getDate()}</span></th>`).join('')}
              <th class="total-col">Total</th>
            </tr>
          </thead>
          <tbody>
            ${allReqs.length === 0 ? `<tr><td colspan="${weekDays.length + 2}" style="text-align:center;padding:var(--space-8);color:var(--color-text-faint)">No active requests. Hours logged here once you have assigned tasks.</td></tr>` :
            allReqs.map(r => {
              let rowTotal = 0;
              return `<tr>
                <td>
                  <div class="timesheet-request-cell" onclick="App.openRequestDetail('${r.id}')">
                    ${priorityDot(r.priority)}
                    <div>
                      <div class="timesheet-request-name">${r.title}</div>
                      <div class="timesheet-request-meta">${r.assetType ? r.assetType.name : ''} · ${statusBadge(r.status)}</div>
                    </div>
                  </div>
                </td>
                ${weekDays.map((d, i) => {
                  const key = `${r.id}:${formatDateKey(d)}`;
                  const val = timesheetData[key] || '';
                  if (val) rowTotal += val;
                  return `<td class="${isToday(d) ? 'today-col' : ''}">
                    <input type="number" class="timesheet-input ${val ? 'has-value' : ''}" 
                      value="${val}" min="0" max="24" step="0.5"
                      onchange="App.updateTimesheetHours('${r.id}','${formatDateKey(d)}',this.value)"
                      onfocus="this.select()">
                  </td>`;
                }).join('')}
                <td class="total-col">${rowTotal || '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td style="text-align:left;font-weight:700">Daily Total</td>
              ${dayTotals.map((t, i) => `<td class="${isToday(weekDays[i]) ? 'today-col' : ''}" style="font-weight:700">${t || '—'}</td>`).join('')}
              <td class="total-col" style="font-weight:700;color:var(--color-primary)">${weekTotal}h</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;
  }

  function renderTeamTimesheet(weekStart, weekDays, weekLabel) {
    const designers = DataService.getDesigners();
    const targetPerWeek = 40;

    const teamData = designers.map(d => {
      let total = 0;
      const reqs = DataService.getRequests({ assignedTo: d.id }).filter(r => !['live'].includes(r.status));
      reqs.forEach(r => {
        weekDays.forEach(day => {
          const key = `${r.id}:${formatDateKey(day)}`;
          total += timesheetData[key] || 0;
        });
      });
      return { ...d, totalHours: total, requestCount: reqs.length };
    });

    const grandTotal = teamData.reduce((s, d) => s + d.totalHours, 0);

    return `<div class="view-container">
      <div class="view-header">
        <h1>Timesheet</h1>
      </div>

      <div class="timesheet-tabs">
        <button class="timesheet-tab ${timesheetTab === 'my' ? 'active' : ''}" onclick="App.switchTimesheetTab('my')">My Timesheet</button>
        <button class="timesheet-tab ${timesheetTab === 'team' ? 'active' : ''}" onclick="App.switchTimesheetTab('team')">Team Overview</button>
      </div>

      <div class="timesheet-controls">
        <div class="timesheet-week-nav">
          <button class="btn btn-ghost btn-sm" onclick="App.timesheetPrevWeek()"><i data-lucide="chevron-left"></i></button>
          <span class="timesheet-week-label">${weekLabel}</span>
          <button class="btn btn-ghost btn-sm" onclick="App.timesheetNextWeek()"><i data-lucide="chevron-right"></i></button>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="App.timesheetThisWeek()">This Week</button>
      </div>

      <div class="timesheet-summary-cards">
        <div class="timesheet-summary-card">
          <div class="timesheet-summary-label">Team Total</div>
          <div class="timesheet-summary-value">${grandTotal}h</div>
        </div>
        <div class="timesheet-summary-card">
          <div class="timesheet-summary-label">Target</div>
          <div class="timesheet-summary-value">${targetPerWeek * designers.length}h</div>
        </div>
        <div class="timesheet-summary-card">
          <div class="timesheet-summary-label">Team Members</div>
          <div class="timesheet-summary-value">${designers.length}</div>
        </div>
      </div>

      <div class="timesheet-team-grid">
        ${teamData.map(d => {
          const pct = Math.min(100, Math.round((d.totalHours / targetPerWeek) * 100));
          const barColor = pct >= 100 ? 'var(--color-success)' : pct >= 60 ? 'var(--color-primary)' : 'var(--color-text-faint)';
          return `<div class="timesheet-team-card" onclick="App.switchTimesheetTab('my');App.switchTimesheetUser('${d.id}')">
            <div class="timesheet-team-header">
              ${renderAvatar(d, 'sm')}
              <div class="timesheet-team-name">${d.name}</div>
            </div>
            <div class="timesheet-team-hours">${d.totalHours}h <span class="text-xs text-muted" style="font-weight:400">/ ${targetPerWeek}h</span></div>
            <div class="text-xs text-muted">${d.requestCount} active tasks</div>
            <div class="timesheet-team-bar">
              <div class="timesheet-team-bar-fill" style="width:${pct}%;background:${barColor}"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function updateTimesheetHours(reqId, dateKey, value) {
    const key = `${reqId}:${dateKey}`;
    const hrs = parseFloat(value) || 0;
    if (hrs > 0) {
      timesheetData[key] = hrs;
    } else {
      delete timesheetData[key];
    }
    // Re-render to update totals
    document.getElementById('viewContainer').innerHTML = renderTimesheet();
    lucide.createIcons();
  }

  function switchTimesheetTab(tab) {
    timesheetTab = tab;
    document.getElementById('viewContainer').innerHTML = renderTimesheet();
    lucide.createIcons();
  }

  function switchTimesheetUser(userId) {
    timesheetUserId = userId;
    timesheetTab = 'my';
    document.getElementById('viewContainer').innerHTML = renderTimesheet();
    lucide.createIcons();
  }

  function timesheetPrevWeek() {
    const ws = getTimesheetWeekStart();
    ws.setDate(ws.getDate() - 7);
    timesheetWeekStart = ws.toISOString();
    document.getElementById('viewContainer').innerHTML = renderTimesheet();
    lucide.createIcons();
  }

  function timesheetNextWeek() {
    const ws = getTimesheetWeekStart();
    ws.setDate(ws.getDate() + 7);
    timesheetWeekStart = ws.toISOString();
    document.getElementById('viewContainer').innerHTML = renderTimesheet();
    lucide.createIcons();
  }

  function timesheetThisWeek() {
    timesheetWeekStart = null;
    document.getElementById('viewContainer').innerHTML = renderTimesheet();
    lucide.createIcons();
  }

  // ── Timesheet CTA helpers ──
  function isManagerUser() {
    // creative_lead and approver roles are considered "managers"
    const currentUser = DataService.getUserById(timesheetUserId);
    return currentUser && (currentUser.role === 'creative_lead' || currentUser.role === 'approver');
  }

  function formatTsClock() {
    let totalSec = tsAccumulated;
    if (tsClockState === 'running' && tsClockStart) {
      totalSec += Math.floor((Date.now() - tsClockStart.getTime()) / 1000);
    }
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function _tsUpdateClockDisplay() {
    const el = document.getElementById('tsClockTime');
    if (el) el.textContent = formatTsClock();
  }

  function _tsStopInterval() {
    if (_tsInterval) { clearInterval(_tsInterval); _tsInterval = null; }
  }

  function _tsRecordHours() {
    // Record accumulated time to today's cell for the active request
    if (!tsActiveReqId) return;
    let totalSec = tsAccumulated;
    if (tsClockState === 'running' && tsClockStart) {
      totalSec += Math.floor((Date.now() - tsClockStart.getTime()) / 1000);
    }
    const hours = Math.round((totalSec / 3600) * 2) / 2; // round to nearest 0.5
    if (hours > 0) {
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const key = `${tsActiveReqId}:${dateKey}`;
      timesheetData[key] = (timesheetData[key] || 0) + hours;
    }
    return hours;
  }

  function tsStart() {
    const selTask = document.getElementById('tsTaskSelect');
    const reqId = selTask ? selTask.value : '';
    if (!reqId) { showToast('Select a task first', 'error'); return; }
    // If already running on a different task, end the current first
    if (tsClockState === 'running' && tsActiveReqId && tsActiveReqId !== reqId) {
      _tsRecordHours();
    }
    _tsStopInterval();
    tsActiveReqId = reqId;
    tsClockState = 'running';
    tsClockStart = new Date();
    tsAccumulated = 0;
    _tsInterval = setInterval(_tsUpdateClockDisplay, 1000);
    _refreshTimesheet();
    showToast('Timer started', 'success');
  }

  function tsShiftJob() {
    if (tsClockState !== 'running') { showToast('No active timer to shift', 'error'); return; }
    const selTask = document.getElementById('tsTaskSelect');
    const newReqId = selTask ? selTask.value : '';
    if (!newReqId) { showToast('Select the new task first', 'error'); return; }
    if (newReqId === tsActiveReqId) { showToast('Already tracking this task', 'error'); return; }
    // Record hours for old task
    _tsRecordHours();
    // Start new task
    tsActiveReqId = newReqId;
    tsClockStart = new Date();
    tsAccumulated = 0;
    _refreshTimesheet();
    showToast('Shifted to new task', 'success');
  }

  let _tsLastReqId = null; // remember last tracked task for Start Again
  function tsStartAgain() {
    if (tsClockState === 'running') { showToast('Timer is already running', 'error'); return; }
    // Resume the last tracked task
    const reqId = _tsLastReqId || tsActiveReqId;
    if (!reqId) { showToast('No previous task to resume. Use Start instead.', 'error'); return; }
    tsActiveReqId = reqId;
    tsClockState = 'running';
    tsClockStart = new Date();
    tsAccumulated = 0;
    _tsInterval = setInterval(_tsUpdateClockDisplay, 1000);
    _refreshTimesheet();
    showToast('Timer restarted', 'success');
  }

  function tsEnd() {
    if (tsClockState === 'idle') { showToast('No active timer', 'error'); return; }
    _tsStopInterval();
    const hours = _tsRecordHours();
    const taskName = tsActiveReqId ? (DataService.getRequestById(tsActiveReqId) || {}).title || '' : '';
    _tsLastReqId = tsActiveReqId; // remember for Start Again
    tsClockState = 'idle';
    tsActiveReqId = null;
    tsClockStart = null;
    tsAccumulated = 0;
    _refreshTimesheet();
    showToast(`Logged ${hours || 0}h for ${taskName || 'task'}`, 'success');
  }

  let _tsReassignOpen = false;
  function tsChangeAssignedPerson() {
    if (!isManagerUser()) { showToast('Manager access required', 'error'); return; }
    const selTask = document.getElementById('tsTaskSelect');
    const reqId = selTask ? selTask.value : '';
    if (!reqId) { showToast('Select a task first', 'error'); return; }
    _tsReassignOpen = true;
    _tsReassignReqId = reqId;
    _refreshTimesheet();
  }
  let _tsReassignReqId = null;
  function tsConfirmReassign() {
    const el = document.getElementById('tsReassignSelect');
    if (!el || !el.value) { showToast('Select a person', 'error'); return; }
    const newPersonId = el.value;
    const req = DataService.getRequestById(_tsReassignReqId);
    if (req && req.deliverables) {
      req.deliverables.forEach(d => {
        DataService.assignDeliverable(_tsReassignReqId, d.id, newPersonId);
      });
    }
    const person = DataService.getUserById(newPersonId);
    showToast(`Task reassigned to ${person ? person.name : 'team member'}`, 'success');
    _tsReassignOpen = false;
    _tsReassignReqId = null;
    _refreshTimesheet();
  }
  function tsCancelReassign() {
    _tsReassignOpen = false;
    _tsReassignReqId = null;
    _refreshTimesheet();
  }

  function _refreshTimesheet() {
    if (currentView === 'timesheet') {
      document.getElementById('viewContainer').innerHTML = renderTimesheet();
      lucide.createIcons();
    }
  }

  /* ── 9. SETTINGS ───────────────────────────────────────────────────── */
  function renderSettings() {
    const assetTypes = DataService.getAssetTypes();
    const platforms = DataService.getPlatforms();
    const users = DataService.getUsers();

    return `<div class="view-container">
      <div class="view-header"><h1>Settings</h1></div>

      <!-- Data Management -->
      <div class="settings-section">
        <h2>Data Management</h2>
        <p class="text-xs text-muted" style="margin-bottom:var(--space-4)">All data is stored locally in your browser. Use export/import to back up or share data across devices.</p>
        <div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="App.exportData()"><i data-lucide="download"></i> Export Data (JSON)</button>
          ${window.Permissions && window.Permissions.isLead() ? `<button class="btn btn-secondary btn-sm" onclick="App.importData()"><i data-lucide="upload"></i> Import Data</button>
          <button class="btn btn-ghost btn-sm" onclick="App.resetData()" style="color:var(--color-error)"><i data-lucide="trash-2"></i> Reset to Default Data</button>` : ''}
        </div>
        <input type="file" id="importFileInput" accept=".json" style="display:none" onchange="App.handleImportFile(event)">
      </div>

      <div class="settings-section">
        <h2>Asset Types & SLA</h2>
        <div class="data-table-container">
          <table class="data-table settings-table">
            <thead><tr><th>Asset Type</th><th>SLA (Days)</th><th>Stages</th></tr></thead>
            <tbody>
              ${assetTypes.map(a => `<tr>
                <td class="flex gap-2 items-center"><i data-lucide="${a.icon}" style="width:14px;height:14px;color:var(--color-text-muted)"></i> ${a.name}</td>
                <td class="font-mono">${a.slaDays}</td>
                <td class="text-xs text-muted">${a.stages.map(s => STATUSES[s] ? STATUSES[s].label : s).join(' → ')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="settings-section">
        <h2>Platforms</h2>
        <div class="data-table-container">
          <table class="data-table settings-table">
            <thead><tr><th>Platform</th><th>Color</th><th>Icon</th></tr></thead>
            <tbody>
              ${platforms.map(p => `<tr>
                <td class="flex gap-2 items-center"><span class="platform-dot platform-${p.id}"></span> ${p.name}</td>
                <td class="text-xs font-mono text-muted">${p.dotClass}</td>
                <td><i data-lucide="${p.icon}" style="width:14px;height:14px;color:var(--color-text-muted)"></i></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="settings-section">
        <h2>Users</h2>
        <div class="data-table-container">
          <table class="data-table settings-table">
            <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Skills</th></tr></thead>
            <tbody>
              ${users.map(u => `<tr>
                <td><div class="flex gap-2 items-center">${renderAvatar(u,'sm')} ${u.name}</div></td>
                <td class="text-xs text-muted">${u.email}</td>
                <td><span class="badge badge-gray">${u.role.replace(/_/g,' ')}</span></td>
                <td class="text-xs text-muted">${u.skills.join(', ')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="attribution-footer" style="margin-top:var(--space-8)">
        <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer">Created with Perplexity Computer</a>
      </div>
    </div>`;
  }

  function exportData() {
    try {
      const json = SupabaseClient.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creativeops-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported successfully', 'success');
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error');
    }
  }

  function importData() {
    document.getElementById('importFileInput')?.click();
  }

  function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        SupabaseClient.importData(e.target.result);
        showToast('Data imported. Reloading...', 'success');
        setTimeout(() => window.location.reload(), 500);
      } catch (err) {
        showToast('Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function resetData() {
    if (!confirm('Reset all data to defaults? This cannot be undone.')) return;
    SupabaseClient.resetData();
    showToast('Data reset. Reloading...', 'success');
    setTimeout(() => window.location.reload(), 500);
  }

  // Keep stubs so old references don't crash
  function saveSupabaseConfig() { showToast('Supabase is no longer used. Data is stored locally.', 'info'); }
  function testSupabaseConnection() { showToast('Supabase is no longer used. Data is stored locally.', 'info'); }

  /* ── 10. ASSETS / DAM VIEW ──────────────────────────────────────── */
  function renderAssetCard(r) {
    const icon = r.assetType ? r.assetType.icon : 'file';
    const gradientClass = 'asset-gradient-' + icon;
    const upload = assetUploads[r.id];
    const hasUpload = upload && upload.dataUrl;
    return `<div class="asset-card-v2">
      <div class="asset-thumb-v2 ${hasUpload ? '' : gradientClass}" onclick="App.openRequestDetail('${r.id}')">
        ${hasUpload ? (upload.type === 'video'
          ? '<video src="' + upload.dataUrl + '" style="width:100%;height:100%;object-fit:cover;" muted></video>'
          : '<img src="' + upload.dataUrl + '" style="width:100%;height:100%;object-fit:cover;" alt="asset">') 
          : '<i data-lucide="' + icon + '" class="asset-thumb-icon-v2"></i>'}
      </div>
      <div class="asset-card-body-v2">
        <div class="asset-card-title-v2">${r.title}</div>
        <div class="asset-card-row">
          <span class="flex gap-1 items-center">${platformDots(r.platformObjects)}</span>
          ${statusBadge(r.status)}
          <span class="asset-version-badge">v${r.latestVersion}</span>
        </div>
        <div class="asset-card-footer-v2">
          ${r.assignee ? renderAvatar(r.assignee, 'sm') : '<span></span>'}
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();App.triggerAssetUpload('${r.id}')" title="Upload file">
            <i data-lucide="upload"></i>
          </button>
        </div>
      </div>
    </div>`;
  }

  function renderAssetListRow(r) {
    const icon = r.assetType ? r.assetType.icon : 'file';
    return `<tr onclick="App.openRequestDetail('${r.id}')" style="cursor:pointer">
      <td><div class="flex gap-2 items-center"><i data-lucide="${icon}" style="width:14px;height:14px;color:var(--color-text-muted)"></i><span class="text-sm">${r.title}</span></div></td>
      <td class="text-xs text-muted">${r.campaign ? r.campaign.name.substring(0,25) : '\u2014'}</td>
      <td><div class="flex gap-1 items-center">${platformDots(r.platformObjects)}</div></td>
      <td>${statusBadge(r.status)}</td>
      <td><span class="asset-version-badge">v${r.latestVersion}</span></td>
      <td>${r.assignee ? renderAvatar(r.assignee, 'sm') : ''}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();App.triggerAssetUpload('${r.id}')" title="Upload file"><i data-lucide="upload"></i></button></td>
    </tr>`;
  }

  function renderAssets() {
    const campaigns = DataService.getCampaigns();
    const assetTypes = DataService.getAssetTypes();
    const assets = DataService.getAssetsWithVersions(assetFilters);

    // Group assets by campaign
    const grouped = {};
    assets.forEach(r => {
      const cName = r.campaign ? r.campaign.name : 'Uncategorized';
      if (!grouped[cName]) grouped[cName] = [];
      grouped[cName].push(r);
    });
    const campaignGroups = Object.entries(grouped);

    const isGrid = assetViewMode === 'grid';

    let contentHTML = '';
    if (assets.length === 0) {
      contentHTML = emptyState('folder', 'No assets found', 'Assets appear here when requests have uploaded versions.');
    } else if (isGrid) {
      contentHTML = campaignGroups.map(([cName, items]) => `
        <div class="asset-campaign-group">
          <div class="asset-campaign-header" onclick="this.parentElement.classList.toggle('collapsed')">
            <div class="flex gap-2 items-center">
              <i data-lucide="chevron-down" class="asset-collapse-icon" style="width:14px;height:14px"></i>
              <span class="asset-campaign-name">${cName}</span>
              <span class="asset-campaign-count">${items.length}</span>
            </div>
          </div>
          <div class="asset-campaign-body">
            <div class="asset-grid-v2">${items.map(r => renderAssetCard(r)).join('')}</div>
          </div>
        </div>
      `).join('');
    } else {
      contentHTML = campaignGroups.map(([cName, items]) => `
        <div class="asset-campaign-group">
          <div class="asset-campaign-header" onclick="this.parentElement.classList.toggle('collapsed')">
            <div class="flex gap-2 items-center">
              <i data-lucide="chevron-down" class="asset-collapse-icon" style="width:14px;height:14px"></i>
              <span class="asset-campaign-name">${cName}</span>
              <span class="asset-campaign-count">${items.length}</span>
            </div>
          </div>
          <div class="asset-campaign-body">
            <div class="table-container"><table class="data-table">
              <thead><tr><th>Title</th><th>Campaign</th><th>Platforms</th><th>Status</th><th>Version</th><th>Assignee</th><th></th></tr></thead>
              <tbody>${items.map(r => renderAssetListRow(r)).join('')}</tbody>
            </table></div>
          </div>
        </div>
      `).join('');
    }

    return `<div class="view-container">
      <div class="view-header">
        <h1>Assets <span class="text-muted text-xs" style="font-weight:400">(${assets.length})</span></h1>
        <div class="asset-view-toggle">
          <button class="asset-view-btn ${isGrid ? 'active' : ''}" onclick="App.setAssetView('grid')" title="Grid view"><i data-lucide="layout-grid"></i></button>
          <button class="asset-view-btn ${!isGrid ? 'active' : ''}" onclick="App.setAssetView('list')" title="List view"><i data-lucide="list"></i></button>
        </div>
      </div>

      <div class="filter-bar">
        <select class="filter-select" onchange="App.filterAssets('campaignId', this.value)">
          <option value="">All Campaigns</option>
          ${campaigns.map(c => `<option value="${c.id}" ${assetFilters.campaignId===c.id?'selected':''}>${c.name}</option>`).join('')}
        </select>
        <select class="filter-select" onchange="App.filterAssets('assetTypeId', this.value)">
          <option value="">All Asset Types</option>
          ${assetTypes.map(a => `<option value="${a.id}" ${assetFilters.assetTypeId===a.id?'selected':''}>${a.name}</option>`).join('')}
        </select>
        <select class="filter-select" onchange="App.filterAssets('status', this.value)">
          <option value="">All Statuses</option>
          ${Object.entries(STATUSES).map(([k,v]) => `<option value="${k}" ${assetFilters.status===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
        ${Object.keys(assetFilters).length > 0 ? '<button class="btn btn-ghost btn-sm" onclick="App.clearAssetFilters()"><i data-lucide="x"></i> Clear</button>' : ''}
      </div>

      ${contentHTML}
      <input type="file" id="assetFileInput" accept="image/*,video/*" style="display:none" onchange="App.handleAssetFile(event)">
    </div>`;
  }

  function setAssetView(mode) {
    assetViewMode = mode;
    document.getElementById('viewContainer').innerHTML = renderAssets();
    lucide.createIcons();
  }

  function filterAssets(key, value) {
    if (value) { assetFilters[key] = value; }
    else { delete assetFilters[key]; }
    document.getElementById('viewContainer').innerHTML = renderAssets();
    lucide.createIcons();
  }

  function clearAssetFilters() {
    assetFilters = {};
    document.getElementById('viewContainer').innerHTML = renderAssets();
    lucide.createIcons();
  }

  let pendingAssetUploadId = null;

  function triggerAssetUpload(reqId) {
    pendingAssetUploadId = reqId;
    const input = document.getElementById('assetFileInput');
    if (input) {
      input.value = '';
      input.click();
    }
  }

  function handleAssetFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || !pendingAssetUploadId) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      showToast('Please upload an image or video file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      assetUploads[pendingAssetUploadId] = {
        type: isVideo ? 'video' : 'image',
        dataUrl: e.target.result,
        filename: file.name
      };
      showToast(`Uploaded ${file.name}`, 'success');
      // Re-render the assets view
      document.getElementById('viewContainer').innerHTML = renderAssets();
      lucide.createIcons();
      pendingAssetUploadId = null;
    };
    reader.readAsDataURL(file);
  }

  /* ── 11. SEARCH / COMMAND PALETTE (Cmd+K) ─────────────────────── */
  function openCommandPalette() {
    const overlay = document.getElementById('cmdPaletteOverlay');
    const input = document.getElementById('cmdPaletteInput');
    overlay.classList.add('open');
    input.value = '';
    renderSearchResults('');
    setTimeout(() => input.focus(), 100);
    lucide.createIcons();
  }

  function closeCommandPalette() {
    document.getElementById('cmdPaletteOverlay').classList.remove('open');
  }

  function handleSearchInput() {
    const q = document.getElementById('cmdPaletteInput')?.value || '';
    renderSearchResults(q);
  }

  function renderSearchResults(query) {
    const container = document.getElementById('cmdPaletteResults');
    if (!query.trim()) {
      container.innerHTML = '<div class="cmd-empty">Type to search requests and campaigns...</div>';
      return;
    }
    const results = DataService.getRequests({ search: query }).slice(0, 8);
    if (results.length === 0) {
      container.innerHTML = '<div class="cmd-empty">No results found</div>';
      return;
    }
    container.innerHTML = results.map(r => {
      const icon = r.assetType ? r.assetType.icon : 'file-text';
      return `<div class="cmd-result-item" onclick="App.openSearchResult('${r.id}')">
        <div class="cmd-result-icon"><i data-lucide="${icon}"></i></div>
        <div class="cmd-result-info">
          <div class="cmd-result-title">${r.title}</div>
          <div class="cmd-result-meta">${r.campaign ? r.campaign.name : '—'} · ${r.assetType ? r.assetType.name : ''}</div>
        </div>
        <div class="cmd-result-badges">
          ${statusBadge(r.status)}
        </div>
      </div>`;
    }).join('');
    lucide.createIcons();
  }

  function openSearchResult(reqId) {
    closeCommandPalette();
    openRequestDetail(reqId);
  }

  /* ── EMPTY STATE ───────────────────────────────────────────────────── */
  function emptyState(icon, title, desc, action) {
    return `<div class="empty-state">
      <div class="empty-state-icon"><i data-lucide="${icon}"></i></div>
      <h3>${title}</h3>
      <p>${desc}</p>
      ${action ? `<button class="btn btn-primary btn-sm" onclick="${action.onclick}">${action.label}</button>` : ''}
    </div>`;
  }

  /* ── SIDEBAR CONTROLS ──────────────────────────────────────────────── */
  function toggleSidebar() {
    document.getElementById('appLayout').classList.toggle('sidebar-collapsed');
  }

  function toggleMobileSidebar() {
    document.getElementById('sidebar').classList.toggle('mobile-open');
    document.getElementById('mobileOverlay').classList.toggle('open');
  }

  function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('mobileOverlay').classList.remove('open');
  }

  /* ── THEME ─────────────────────────────────────────────────────────── */
  function toggleTheme() {
    const root = document.documentElement;
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { document.cookie = 'creativeops-theme=' + next + ';path=/;max-age=31536000'; } catch(_e) { /* sandboxed */ }

    const icon = document.getElementById('themeIcon');
    if (icon) { icon.setAttribute('data-lucide', next === 'dark' ? 'moon' : 'sun'); }
    lucide.createIcons();

    // Rebuild chart if on dashboard
    if (currentView === 'dashboard' && chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
      initDashboardChart();
    }
  }

  function focusSearch() {
    openCommandPalette();
  }

  /* ── KEYBOARD TABLE NAV ────────────────────────────────────────────── */
  let kbSelectedRow = -1;
  function navigateTableRows(dir) {
    const rows = [...document.querySelectorAll('.data-table tbody tr')];
    if (rows.length === 0) return;
    rows.forEach(r => r.classList.remove('kb-selected'));
    kbSelectedRow += dir;
    if (kbSelectedRow < 0) kbSelectedRow = 0;
    if (kbSelectedRow >= rows.length) kbSelectedRow = rows.length - 1;
    rows[kbSelectedRow].classList.add('kb-selected');
    rows[kbSelectedRow].scrollIntoView({ block: 'nearest' });
  }

  /* ── NOTIFICATIONS ─────────────────────────────────────────────────── */
  let notificationsRead = new Set();

  function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      renderNotifications();
    }
  }

  function closeNotifications() {
    document.getElementById('notificationsPanel').classList.remove('open');
  }

  function renderNotifications() {
    const activity = DataService.getRecentActivity(30);
    const body = document.getElementById('notificationsBody');
    if (activity.length === 0) {
      body.innerHTML = '<div class="notifications-empty"><i data-lucide="bell-off" style="width:24px;height:24px;margin-bottom:var(--space-2)"></i>No notifications yet</div>';
      lucide.createIcons();
      return;
    }
    body.innerHTML = activity.map(a => {
      const isRead = notificationsRead.has(a.id);
      return `<div class="notification-item ${isRead ? '' : 'unread'}" onclick="App.handleNotificationClick('${a.id}','${a.requestId}')">
        ${a.user ? renderAvatar(a.user, 'sm') : '<span class="avatar avatar-sm" style="background:var(--color-text-faint)">?</span>'}
        <div class="notification-content">
          <div class="notification-text"><strong>${a.user ? a.user.name : 'System'}</strong> ${a.detail}</div>
          <div class="notification-time">${timeAgo(a.timestamp)}</div>
        </div>
      </div>`;
    }).join('');
    lucide.createIcons();
    updateNotificationCount();
  }

  function handleNotificationClick(actId, reqId) {
    notificationsRead.add(actId);
    updateNotificationCount();
    renderNotifications();
    if (reqId) {
      closeNotifications();
      openRequestDetail(reqId);
    }
  }

  function markAllNotificationsRead() {
    const activity = DataService.getRecentActivity(30);
    activity.forEach(a => notificationsRead.add(a.id));
    updateNotificationCount();
    renderNotifications();
    showToast('All notifications marked as read', 'info');
  }

  function updateNotificationCount() {
    const activity = DataService.getRecentActivity(30);
    const unread = activity.filter(a => !notificationsRead.has(a.id)).length;
    const badge = document.getElementById('notifCount');
    if (badge) {
      if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  /* ── SHORTCUTS MODAL ───────────────────────────────────────────────── */
  function openShortcuts() {
    document.getElementById('shortcutsOverlay').classList.add('open');
    lucide.createIcons();
  }

  function closeShortcuts() {
    document.getElementById('shortcutsOverlay').classList.remove('open');
  }

  /* ── CONTEXT MENU ──────────────────────────────────────────────────── */
  let activeContextMenu = null;

  function showContextMenu(e, reqId) {
    e.preventDefault();
    closeContextMenu();
    const r = DataService.getRequestById(reqId);
    if (!r) return;
    const designers = DataService.getDesigners();
    const stages = r.assetType ? r.assetType.stages : [];
    const currentIdx = stages.indexOf(r.status);
    const nextStatus = currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    const P = window.Permissions;
    menu.innerHTML = `
      <button class="context-menu-item" onclick="App.openRequestDetail('${reqId}')"><i data-lucide="eye" style="width:14px;height:14px"></i> View Details<span class="context-shortcut">Enter</span></button>
      ${nextStatus && P && P.canAdvanceStatus(r) ? `<button class="context-menu-item" onclick="App.advanceStatus('${reqId}');App.closeContextMenu()"><i data-lucide="arrow-right" style="width:14px;height:14px"></i> Advance to ${STATUSES[nextStatus].label}</button>` : ''}
      ${P && P.canAdvanceStatus(r) ? `<div class="context-menu-divider"></div>
      <button class="context-menu-item" onclick="App.inlineSetPriority('${reqId}','urgent');App.closeContextMenu()"><i data-lucide="alert-triangle" style="width:14px;height:14px;color:var(--color-error)"></i> Set Urgent</button>
      <button class="context-menu-item" onclick="App.inlineSetPriority('${reqId}','high');App.closeContextMenu()"><i data-lucide="arrow-up" style="width:14px;height:14px;color:var(--color-warning)"></i> Set High</button>` : ''}
      ${P && P.canCreateRequest() ? `<div class="context-menu-divider"></div>
      <button class="context-menu-item" onclick="App.duplicateRequest('${reqId}');App.closeContextMenu()"><i data-lucide="copy" style="width:14px;height:14px"></i> Duplicate</button>` : ''}
    `;
    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${Math.min(e.clientX, window.innerWidth - 200)}px`;
    document.body.appendChild(menu);
    activeContextMenu = menu;
    lucide.createIcons();
    setTimeout(() => document.addEventListener('click', closeContextMenuOnClick), 10);
  }

  function closeContextMenu() {
    if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; }
    document.removeEventListener('click', closeContextMenuOnClick);
  }

  function closeContextMenuOnClick() { closeContextMenu(); }

  /* ── INLINE EDIT HELPERS ───────────────────────────────────────────── */
  function inlineSetPriority(reqId, priority) {
    const req = REQUESTS.find(r => r.id === reqId);
    if (req) {
      req.priority = priority;
      SupabaseClient.updateRequestField(reqId, 'priority', priority).catch(() => {});
      showToast(`Priority set to ${PRIORITIES[priority].label}`, 'success');
      renderView(currentView);
    }
  }

  function duplicateRequest(reqId) {
    const orig = DataService.getRequestById(reqId);
    if (!orig) return;
    DataService.createRequest({
      title: orig.title + ' (copy)',
      campaignId: orig.campaignId,
      assetTypeId: orig.assetTypeId,
      platforms: orig.platforms,
      goLiveDate: orig.goLiveDate,
      priority: orig.priority,
      brief: orig.brief || {},
    });
    showToast('Request duplicated', 'success');
    renderView(currentView);
  }

  /* ── TABLE SORT ────────────────────────────────────────────────────── */
  function sortTable(key) {
    if (sortState.key === key) {
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState.key = key;
      sortState.dir = 'asc';
    }
    document.getElementById('viewContainer').innerHTML = renderRequests();
    lucide.createIcons();
  }

  /* ── REQUEST TEMPLATES ─────────────────────────────────────────────── */
  function applyTemplate(tpl) {
    const templates = {
      yt_thumb: { assetTypeId: 'yt_thumbnail', platforms: ['youtube'], title: 'YouTube Thumbnail \u2014 ', brief: { objective: 'Drive clicks from YT browse/search', mandatories: 'Show title, key art face, ep number. 1280x720.' } },
      ig_post: { assetTypeId: 'static_poster', platforms: ['instagram'], title: 'Instagram Post \u2014 ', brief: { objective: 'Drive engagement on IG feed', mandatories: '1080x1080 or 1080x1350. Brand colors.' } },
      key_art: { assetTypeId: 'static_poster', platforms: ['instagram','facebook','x'], title: 'Key Art Poster \u2014 ', brief: { objective: 'Hero visual for campaign launch', mandatories: 'Key cast, show logo, release date' } },
      motion: { assetTypeId: 'motion_poster', platforms: ['instagram','youtube'], title: 'Motion Teaser \u2014 ', brief: { objective: 'Build anticipation for upcoming premiere', mandatories: 'Max 30s. Music bed. End card with release date.' } },
      email: { assetTypeId: 'email_template', platforms: ['email'], title: 'Email Banner \u2014 ', brief: { objective: 'Drive opens/clicks in CRM email', mandatories: '600px wide. CTA button. Mobile-safe.' } },
    };
    const t = templates[tpl];
    if (!t) return;

    // Select template card visually
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
    event.currentTarget.classList.add('selected');

    // Fill title
    const titleInput = document.getElementById('reqTitle');
    if (titleInput && !titleInput.value) titleInput.value = t.title;

    // Populate first deliverable with template values
    if (modalDeliverables.length > 0) {
      modalDeliverables[0].assetTypeId = t.assetTypeId;
      modalDeliverables[0].platforms = [...t.platforms];
      renderDeliverablesBuilder();
    }

    // Fill brief
    if (t.brief) {
      const obj = document.getElementById('reqObjective');
      if (obj && !obj.value) obj.value = t.brief.objective || '';
      const mand = document.getElementById('reqMandatories');
      if (mand && !mand.value) mand.value = t.brief.mandatories || '';
    }

    lucide.createIcons();
  }

  /* ── KPI COUNT-UP ANIMATION ────────────────────────────────────────────── */
  function animateCountUp() {
    document.querySelectorAll('.kpi-value[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target, 10);
      if (isNaN(target) || target === 0) { el.textContent = '0'; return; }
      let current = 0;
      const duration = 600;
      const steps = 20;
      const increment = target / steps;
      const interval = duration / steps;
      const counter = setInterval(() => {
        current += increment;
        if (current >= target) { current = target; clearInterval(counter); }
        el.textContent = Math.round(current);
      }, interval);
    });
  }

  /* ── INIT ──────────────────────────────────────────────────────────── */
  /* ── DELIVERABLE HELPERS ──────────────────────────────────────────── */
  function advanceDeliverableStatus(reqId, delId) {
    const r = DataService.getRequestById(reqId);
    if (!r) return;
    const del = r.deliverables.find(d => d.id === delId);
    if (!del || !del.assetType) return;
    const stages = del.assetType.stages || [];
    const idx = stages.indexOf(del.status);
    if (idx < stages.length - 1) {
      DataService.updateDeliverableStatus(reqId, delId, stages[idx + 1]);
      showToast(`Deliverable moved to ${STATUSES[stages[idx+1]].label}`, 'success');
      openRequestDetail(reqId);
      if (currentView === 'kanban') { renderView('kanban'); }
    }
  }

  function toggleDelAssigneeDropdown(event, reqId, delId) {
    event.stopPropagation();
    closeDropdowns();
    const trigger = event.currentTarget;
    const designers = DataService.getDesigners();
    const dropdown = document.createElement('div');
    dropdown.className = 'action-dropdown';
    dropdown.style.cssText = 'max-height:200px;overflow-y:auto;';
    dropdown.innerHTML = designers.map(d =>
      `<button class="action-dropdown-item" onclick="App.assignDeliverableToDesigner('${reqId}','${delId}','${d.id}')">
        ${renderAvatar(d, 'sm')} ${d.name}
      </button>`
    ).join('');
    trigger.style.position = 'relative';
    trigger.appendChild(dropdown);
    activeDropdown = dropdown;
    lucide.createIcons();
    setTimeout(() => document.addEventListener('click', closeDropdownOnClick), 10);
  }

  function assignDeliverableToDesigner(reqId, delId, userId) {
    closeDropdowns();
    DataService.assignDeliverable(reqId, delId, userId);
    const user = DataService.getUserById(userId);
    showToast(`Deliverable assigned to ${user ? user.name : userId}`, 'success');
    openRequestDetail(reqId);
    renderView(currentView);
  }

  function init() {
    // Set theme
    var _savedTheme = 'dark'; try { _savedTheme = (document.cookie.match(/creativeops-theme=(\w+)/)||[])[1] || 'dark'; } catch(_e) { /* sandboxed */ }
    document.documentElement.setAttribute('data-theme', _savedTheme);

    // Hash routing
    const hash = window.location.hash.slice(1) || 'dashboard';
    navigate(hash);

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.slice(1) || 'dashboard';
      navigate(h);
    });

    // Keyboard shortcut system
    let pendingG = false;
    let pendingGTimer = null;
    document.addEventListener('keydown', (e) => {
      // Skip if typing in input/textarea/select
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') { document.activeElement.blur(); }
        return;
      }

      // Cmd/Ctrl+K — search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      // Escape — close things
      if (e.key === 'Escape') {
        closeCommandPalette();
        closeDetailPanel();
        closeNotifications();
        closeShortcuts();
        closeContextMenu();
        return;
      }

      // ? — show shortcuts
      if (e.key === '?') { e.preventDefault(); openShortcuts(); return; }

      // N — new request
      if (e.key === 'n' || e.key === 'N') { if (window.Permissions && window.Permissions.canCreateRequest()) { e.preventDefault(); openNewRequestModal(); } return; }

      // Arrow keys — table row navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigateTableRows(e.key === 'ArrowDown' ? 1 : -1);
        return;
      }

      // Enter — open selected row
      if (e.key === 'Enter') {
        const selected = document.querySelector('.kb-selected');
        if (selected) {
          const id = selected.dataset.id || selected.querySelector('[data-id]')?.dataset.id;
          if (id) openRequestDetail(id);
          else selected.click();
        }
        return;
      }

      // G + letter — go to view
      if (pendingG) {
        clearTimeout(pendingGTimer);
        pendingG = false;
        const goMap = { d: 'dashboard', c: 'campaigns', r: 'requests', k: 'kanban', w: 'workload', l: 'calendar', a: 'assets', t: 'timesheet', s: 'settings' };
        const dest = goMap[e.key.toLowerCase()];
        if (dest) { e.preventDefault(); navigate(dest); }
        return;
      }
      if (e.key === 'g') {
        pendingG = true;
        pendingGTimer = setTimeout(() => { pendingG = false; }, 500);
        return;
      }
    });

    // Search input handler
    const cmdInput = document.getElementById('cmdPaletteInput');
    if (cmdInput) {
      cmdInput.addEventListener('input', handleSearchInput);
    }

    // Close search on overlay click
    const cmdOverlay = document.getElementById('cmdPaletteOverlay');
    if (cmdOverlay) {
      cmdOverlay.addEventListener('click', (e) => {
        if (e.target === cmdOverlay) closeCommandPalette();
      });
    }

    lucide.createIcons();
    updateNotificationCount();
  }

  async function boot() {
    var user = await SupabaseClient.checkAuth();
    if (!user) {
      document.getElementById('bootLoader').style.display = 'none';
      document.getElementById('loginScreen').style.display = '';
      return;
    }

    window.__currentUser = user;
    window.Permissions = buildPermissions(user);

    try {
      await SupabaseClient.loadAll();
      applyCurrentUserToUI();
      showApp();
      init();
    } catch (e) {
      console.error('Data load failed:', e);
      window.USERS = window.USERS || [];
      window.CAMPAIGNS = window.CAMPAIGNS || [];
      window.REQUESTS = window.REQUESTS || [];
      window.PLATFORMS = window.PLATFORMS || [];
      window.ASSET_TYPES = window.ASSET_TYPES || [];
      window.ACTIVITY_LOG = window.ACTIVITY_LOG || [];
      window.COMMENTS = window.COMMENTS || [];
      window.VERSIONS = window.VERSIONS || [];
      window.KNOWLEDGE_BASE = window.KNOWLEDGE_BASE || [];
      window.CONTENT_SCHEDULE = window.CONTENT_SCHEDULE || [];
      window.STATUSES = window.STATUSES || {
        intake: { label: 'Intake', color: 'gray', cssClass: 'status-intake' },
        brief_approved: { label: 'Brief Approved', color: 'blue', cssClass: 'status-brief-approved' },
        in_progress: { label: 'In Progress', color: 'blue', cssClass: 'status-in-progress' },
        first_cut: { label: 'First Cut', color: 'blue', cssClass: 'status-first-cut' },
        under_review: { label: 'Under Review', color: 'orange', cssClass: 'status-under-review' },
        changes_in_progress: { label: 'Changes in Progress', color: 'orange', cssClass: 'status-changes' },
        final_approved: { label: 'Final Approved', color: 'green', cssClass: 'status-approved' },
        scheduled: { label: 'Scheduled', color: 'green', cssClass: 'status-scheduled' },
        live: { label: 'Live', color: 'green', cssClass: 'status-live' },
      };
      window.PRIORITIES = window.PRIORITIES || {
        low: { label: 'Low', color: 'var(--color-text-muted)', dot: '#888' },
        medium: { label: 'Medium', color: 'var(--color-primary)', dot: '#2dd4bf' },
        high: { label: 'High', color: 'var(--color-warning)', dot: '#fbbf24' },
        urgent: { label: 'Urgent', color: 'var(--color-error)', dot: '#f87171' },
      };
      applyCurrentUserToUI();
      showApp();
      try { init(); } catch (initErr) { console.error('Init failed:', initErr); }
      App.showToast('Failed to load data: ' + (e.message || e), 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ── PUBLIC API ────────────────────────────────────────────────────── */
  return {
    init, navigate, toggleSidebar, toggleMobileSidebar, closeMobileSidebar, toggleTheme,
    openNewRequestModal, onAssetTypeChange, submitModal, closeModal,
    addModalDeliverable, removeModalDeliverable, updateModalDeliverable, toggleModalDelPlatform,
    advanceDeliverableStatus, toggleDelAssigneeDropdown, assignDeliverableToDesigner,
    openRequestDetail, closeDetailPanel, advanceStatus, addComment,
    filterRequests, clearFilters,
    prevMonth, nextMonth, calendarToday, showDayPopup, confirmCalendarDrag, cancelCalendarDrag,
    showWorkloadDetail, focusSearch, kanbanCardClick, workloadCardClick,
    uploadVersion, toggleApprovalDropdown, handleApproval,
    toggleAssigneeDropdown, assignToDesigner, showToast,
    openNewCampaignModal,
    filterAssets, clearAssetFilters, triggerAssetUpload, handleAssetFile, setAssetView,
    openCommandPalette, closeCommandPalette, openSearchResult,
    saveSupabaseConfig, testSupabaseConnection, exportData, importData, handleImportFile, resetData,
    updateTimesheetHours, switchTimesheetTab, switchTimesheetUser,
    timesheetPrevWeek, timesheetNextWeek, timesheetThisWeek,
    tsStart, tsShiftJob, tsStartAgain, tsEnd, tsChangeAssignedPerson,
    tsConfirmReassign, tsCancelReassign,
    toggleNotifications, closeNotifications, handleNotificationClick, markAllNotificationsRead,
    openShortcuts, closeShortcuts,
    showContextMenu, closeContextMenu,
    inlineSetPriority, duplicateRequest, sortTable, applyTemplate,
    switchCampaignTab, submitKnowledgeEntry, deleteKnowledgeEntry,
    submitContentItem, advanceContentStatus, deleteContentItem,
    filterCreativeTeam, assignCreativeTeamDeliverable, advanceCreativeTeamDeliverable,
    updateAutoPriority,
  };
})();
