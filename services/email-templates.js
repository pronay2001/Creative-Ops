const APP_URL = process.env.APP_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://localhost:5000');

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

function ctaButton(text, url) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
<tr><td style="background:linear-gradient(-60deg,#d20820,#6d0550);border-radius:10px;padding:12px 28px;">
<a href="${url}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">${text}</a>
</td></tr></table>`;
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

function taskAssignment(request, assignee) {
  const url = `${APP_URL}/#requests/${request.id}`;
  return layout(`
<h2 style="color:#e2e8f0;font-size:18px;margin:0 0 8px;">New Task Assigned</h2>
<p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">Hi ${esc(assignee.name)}, you have been assigned a new task.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#222222;border-radius:10px;padding:16px;margin-bottom:16px;">
<tr><td style="padding:16px;">
<p style="color:#e2e8f0;font-size:16px;font-weight:600;margin:0 0 12px;">${esc(request.title)}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0">
<tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Priority:</span></td><td style="padding:4px 12px;">${priorityBadge(request.priority)}</td></tr>
<tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Deadline:</span></td><td style="padding:4px 12px;"><span style="color:#e2e8f0;font-size:13px;">${request.internal_deadline || request.go_live_date || 'Not set'}</span></td></tr>
<tr><td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;">Asset Type:</span></td><td style="padding:4px 12px;"><span style="color:#e2e8f0;font-size:13px;">${request.asset_type_id || ''}</span></td></tr>
</table>
${request.brief && request.brief.objective ? `<p style="color:#9ca3af;font-size:13px;margin:12px 0 0;border-top:1px solid #2a3441;padding-top:12px;">${esc(typeof request.brief === 'string' ? '' : request.brief.objective)}</p>` : ''}
</td></tr>
</table>
${ctaButton('View Task', url)}
  `);
}

function statusChange(request, oldStatus, newStatus) {
  const url = `${APP_URL}/#requests/${request.id}`;
  const isApproval = newStatus === 'final_approved';
  const isRegression = ['intake', 'in_progress', 'changes_in_progress'].includes(newStatus) && ['under_review', 'final_approved'].includes(oldStatus);

  let heading = 'Status Updated';
  if (isApproval) heading = 'Task Approved';
  if (isRegression) heading = 'Changes Requested';

  return layout(`
<h2 style="color:#e2e8f0;font-size:18px;margin:0 0 8px;">${esc(heading)}</h2>
<p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">${esc(request.title)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#222222;border-radius:10px;margin-bottom:16px;">
<tr><td style="padding:16px;text-align:center;">
<span style="color:#6b7280;font-size:14px;">${esc(statusLabel(oldStatus))}</span>
<span style="color:#d20820;font-size:18px;margin:0 16px;">→</span>
<span style="color:#d20820;font-size:14px;font-weight:600;">${esc(statusLabel(newStatus))}</span>
</td></tr>
</table>
${ctaButton('View Task', url)}
  `);
}

function newComment(request, commenter, commentText) {
  const url = `${APP_URL}/#requests/${request.id}`;
  const commenterName = commenter ? commenter.name : 'Someone';
  return layout(`
<h2 style="color:#e2e8f0;font-size:18px;margin:0 0 8px;">New Comment</h2>
<p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">on ${esc(request.title)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#222222;border-radius:10px;margin-bottom:16px;">
<tr><td style="padding:16px;">
<p style="color:#d20820;font-size:13px;font-weight:600;margin:0 0 8px;">${esc(commenterName)}</p>
<p style="color:#e2e8f0;font-size:14px;margin:0;line-height:1.5;">${esc(commentText)}</p>
</td></tr>
</table>
${ctaButton('Reply', url)}
  `);
}

function approvalDecision(request, approver, isApproved, comment) {
  const url = `${APP_URL}/#requests/${request.id}`;
  const heading = isApproved ? 'Task Approved!' : 'Changes Needed';
  const color = isApproved ? '#2dd4bf' : '#fbbf24';
  const approverName = approver ? approver.name : 'An approver';

  return layout(`
<h2 style="color:${color};font-size:18px;margin:0 0 8px;">${heading}</h2>
<p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">${esc(request.title)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#222222;border-radius:10px;margin-bottom:16px;">
<tr><td style="padding:16px;">
<p style="color:#e2e8f0;font-size:14px;margin:0 0 8px;"><strong>${esc(approverName)}</strong> ${isApproved ? 'approved this task' : 'requested changes'}</p>
${comment ? `<p style="color:#9ca3af;font-size:13px;margin:8px 0 0;border-top:1px solid #2a3441;padding-top:8px;">${esc(comment)}</p>` : ''}
</td></tr>
</table>
${ctaButton(isApproved ? 'View Task' : 'Make Changes', url)}
  `);
}

module.exports = { taskAssignment, statusChange, newComment, approvalDecision };
