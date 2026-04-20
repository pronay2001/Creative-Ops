function layout(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0d0d0d;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0d0d0d;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#191919;border-radius:16px;overflow:hidden;">
<tr><td style="padding:24px 32px;background:linear-gradient(-60deg,#d20820,#6d0550);border-bottom:none;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td><span style="display:inline-block;width:32px;height:32px;background:#fff;border-radius:8px;text-align:center;line-height:32px;font-size:18px;font-weight:bold;color:#d20820;margin-right:10px;vertical-align:middle;">H</span><span style="font-size:16px;font-weight:700;color:#ffffff;vertical-align:middle;letter-spacing:-0.02em;">Hoichoi Creative Ops</span></td></tr>
</table>
</td></tr>
<tr><td style="padding:32px;">
${content}
</td></tr>
<tr><td style="padding:16px 32px;background-color:#111111;text-align:center;">
<span style="font-size:12px;color:#666;">This is an automated notification from Hoichoi Creative Ops</span>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function detailRow(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">${label}:</span></td><td style="padding:4px 12px;"><span style="color:#e2e8f0;font-size:13px;">${esc(String(value))}</span></td></tr>`;
}

function priorityBadge(priority) {
  const colors = { urgent: '#d20820', high: '#fbbf24', medium: '#4ade80', low: '#6b7280' };
  const color = colors[priority] || '#6b7280';
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;background-color:${color}20;color:${color};font-size:12px;font-weight:600;border:1px solid ${color};">${(priority || 'medium').toUpperCase()}</span>`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function statusLabel(status) {
  return (status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(d) {
  if (!d) return 'Not set';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; }
}

function briefBlock(brief) {
  if (!brief || typeof brief === 'string') return '';
  const parts = [];
  if (brief.objective) parts.push(`<p style="color:#9ca3af;font-size:13px;margin:0 0 6px;"><strong style="color:#e2e8f0;">Objective:</strong> ${esc(brief.objective)}</p>`);
  if (brief.keyMessage) parts.push(`<p style="color:#9ca3af;font-size:13px;margin:0 0 6px;"><strong style="color:#e2e8f0;">Key Message:</strong> ${esc(brief.keyMessage)}</p>`);
  if (brief.targetGroup) parts.push(`<p style="color:#9ca3af;font-size:13px;margin:0 0 6px;"><strong style="color:#e2e8f0;">Target Group:</strong> ${esc(brief.targetGroup)}</p>`);
  if (brief.mandatories) parts.push(`<p style="color:#9ca3af;font-size:13px;margin:0 0 6px;"><strong style="color:#e2e8f0;">Mandatories:</strong> ${esc(brief.mandatories)}</p>`);
  if (brief.languages && brief.languages.length) parts.push(`<p style="color:#9ca3af;font-size:13px;margin:0 0 6px;"><strong style="color:#e2e8f0;">Languages:</strong> ${brief.languages.join(', ')}</p>`);
  if (brief.copyDraft) parts.push(`<p style="color:#9ca3af;font-size:13px;margin:0;"><strong style="color:#e2e8f0;">Copy Draft:</strong> <em>${esc(brief.copyDraft)}</em></p>`);
  if (!parts.length) return '';
  return `<div style="border-top:1px solid #2a3441;padding-top:12px;margin-top:12px;">${parts.join('')}</div>`;
}

function taskAssignment(request, assignee) {
  return layout(`
<h2 style="color:#e2e8f0;font-size:18px;margin:0 0 8px;">New Task Assigned</h2>
<p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">Hi ${esc(assignee.name)}, you have been assigned a new task.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#222222;border-radius:10px;margin-bottom:16px;">
<tr><td style="padding:16px;">
<p style="color:#e2e8f0;font-size:16px;font-weight:600;margin:0 0 12px;">${esc(request.title)}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0">
<tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Priority:</span></td><td style="padding:4px 12px;">${priorityBadge(request.priority)}</td></tr>
${detailRow('Status', statusLabel(request.status))}
${detailRow('Asset Type', request.asset_type_id)}
${detailRow('Campaign', request.campaign_name || (request.campaign && request.campaign.name))}
${detailRow('Deadline', formatDate(request.go_live_date))}
${detailRow('Created By', request.creator_name)}
${detailRow('Vertical', request.vertical)}
</table>
${briefBlock(request.brief)}
</td></tr>
</table>
  `);
}

function statusChange(request, oldStatus, newStatus) {
  const isApproval = newStatus === 'final_approved';
  const isRegression = ['intake', 'in_progress', 'changes_in_progress'].includes(newStatus) && ['under_review', 'final_approved'].includes(oldStatus);

  let heading = 'Status Updated';
  if (isApproval) heading = 'Task Approved';
  if (isRegression) heading = 'Changes Requested';

  return layout(`
<h2 style="color:#e2e8f0;font-size:18px;margin:0 0 8px;">${esc(heading)}</h2>
<p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">${esc(request.title)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#222222;border-radius:10px;margin-bottom:16px;">
<tr><td style="padding:16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:12px;">
<tr><td style="text-align:center;">
<span style="color:#6b7280;font-size:14px;">${esc(statusLabel(oldStatus))}</span>
<span style="color:#d20820;font-size:18px;margin:0 16px;">→</span>
<span style="color:#d20820;font-size:14px;font-weight:600;">${esc(statusLabel(newStatus))}</span>
</td></tr>
</table>
<table role="presentation" cellspacing="0" cellpadding="0" border="0">
<tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Priority:</span></td><td style="padding:4px 12px;">${priorityBadge(request.priority)}</td></tr>
${detailRow('Asset Type', request.asset_type_id)}
${detailRow('Campaign', request.campaign_name || (request.campaign && request.campaign.name))}
${detailRow('Deadline', formatDate(request.go_live_date))}
${detailRow('Assigned To', request.assignee_name)}
${detailRow('Vertical', request.vertical)}
</table>
</td></tr>
</table>
  `);
}

function newComment(request, commenter, commentText) {
  const commenterName = commenter ? commenter.name : 'Someone';
  return layout(`
<h2 style="color:#e2e8f0;font-size:18px;margin:0 0 8px;">New Comment</h2>
<p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">on ${esc(request.title)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#222222;border-radius:10px;margin-bottom:16px;">
<tr><td style="padding:16px;">
<p style="color:#d20820;font-size:13px;font-weight:600;margin:0 0 8px;">${esc(commenterName)}</p>
<p style="color:#e2e8f0;font-size:14px;margin:0 0 12px;line-height:1.5;">${esc(commentText)}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #2a3441;padding-top:8px;">
<tr><td style="padding:8px 0 0;">
<span style="color:#6b7280;font-size:12px;">Task: ${esc(request.title)}</span><br>
<span style="color:#6b7280;font-size:12px;">Priority: </span>${priorityBadge(request.priority)}
</td></tr>
${detailRow('Asset Type', request.asset_type_id)}
${detailRow('Deadline', formatDate(request.go_live_date))}
</table>
</td></tr>
</table>
  `);
}

function approvalDecision(request, approver, isApproved, comment) {
  const heading = isApproved ? 'Task Approved!' : 'Changes Needed';
  const color = isApproved ? '#2dd4bf' : '#fbbf24';
  const approverName = approver ? approver.name : 'An approver';

  return layout(`
<h2 style="color:${color};font-size:18px;margin:0 0 8px;">${heading}</h2>
<p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">${esc(request.title)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#222222;border-radius:10px;margin-bottom:16px;">
<tr><td style="padding:16px;">
<p style="color:#e2e8f0;font-size:14px;margin:0 0 12px;"><strong>${esc(approverName)}</strong> ${isApproved ? 'approved this task' : 'requested changes'}</p>
${comment ? `<p style="color:#9ca3af;font-size:13px;margin:0 0 12px;border-top:1px solid #2a3441;padding-top:8px;">${esc(comment)}</p>` : ''}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #2a3441;padding-top:8px;">
<tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Priority:</span></td><td style="padding:4px 12px;">${priorityBadge(request.priority)}</td></tr>
${detailRow('Asset Type', request.asset_type_id)}
${detailRow('Campaign', request.campaign_name || (request.campaign && request.campaign.name))}
${detailRow('Deadline', formatDate(request.go_live_date))}
${detailRow('Assigned To', request.assignee_name)}
${detailRow('Vertical', request.vertical)}
</table>
</td></tr>
</table>
  `);
}

function memberAssigned(request, assigneeName) {
  return layout(`
<h2 style="color:#e2e8f0;font-size:18px;margin:0 0 8px;">Team Member Assigned</h2>
<p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">${esc(request.title)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#222222;border-radius:10px;margin-bottom:16px;">
<tr><td style="padding:16px;">
<p style="color:#e2e8f0;font-size:14px;margin:0 0 16px;"><strong style="color:#d20820;">${esc(assigneeName)}</strong> has been assigned to work on your request.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0">
<tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Priority:</span></td><td style="padding:4px 12px;">${priorityBadge(request.priority)}</td></tr>
${detailRow('Asset Type', request.asset_type_id)}
${detailRow('Campaign', request.campaign_name || (request.campaign && request.campaign.name))}
${detailRow('Deadline', formatDate(request.go_live_date))}
${detailRow('Assigned To', assigneeName)}
${detailRow('Vertical', request.vertical)}
</table>
</td></tr>
</table>
  `);
}

module.exports = { taskAssignment, statusChange, newComment, approvalDecision, memberAssigned };
