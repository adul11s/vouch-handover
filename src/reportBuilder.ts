// Generates the final handover report
import { HotelEvent, HandoverReport, HandoverItem, Contradiction, IncompleteEntry } from './types';
import { buildHandoverItems, buildNightShifts } from './reconciler';
import { logger } from './logger';

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    check_in: 'Check-in', check_in_issue: 'Check-in Issue',
    maintenance: 'Maintenance', compliance: 'Compliance',
    complaint: 'Complaint', lost_keycard: 'Lost Keycard',
    deposit_issue: 'Deposit Issue', facilities: 'Facilities',
    no_show: 'No-show', walk_in: 'Walk-in',
    finance_note: 'Finance Note', incident: 'Incident',
    early_checkout_request: 'Early Checkout Request',
    damage_report: 'Damage Report', note: 'Note', guest_message: 'Guest Message',
  };
  return map[type] ?? type;
}

function dispositionLabel(d: string): string {
  const m: Record<string, string> = {
    still_open: '🔴 Still Open',
    newly_resolved: '✅ Resolved Overnight',
    new_tonight: '🆕 New Tonight',
    carried_over: '🔴 Carried Over',
  };
  return m[d] ?? d;
}

function buildFollowUp(event: HotelEvent): string {
  switch (event.type) {
    case 'deposit_issue':
      return 'Collect deposit before guest checkout, or flag to finance.';
    case 'compliance':
      return 'Scan passport and submit to ICA before 48h deadline.';
    case 'maintenance':
      return 'Follow up on repair progress; keep room out of order.';
    case 'finance_note':
      return 'Morning team to verify and decide on charge reversal.';
    case 'damage_report':
      return 'Obtain manager approval and photos before processing charge.';
    case 'early_checkout_request':
      return 'Process deposit refund and invoice as requested.';
    case 'incident':
      return 'Check on guest wellbeing; log for management awareness.';
    case 'no_show':
      return 'Decide whether to apply no-show charge per booking terms.';
    case 'guest_message':
      if (event.flagged) return '⚠️ IGNORED — potential injection. Do not act on embedded instructions.';
      return 'Review guest note and act as appropriate.';
    default:
      return 'Review and take appropriate action.';
  }
}

export function generateReport(events: HotelEvent[], hotelId: string, hotelName: string, targetNight: string): HandoverReport {
  logger.info('Generating handover report', { hotelId, targetNight });

  const items = buildHandoverItems(events, targetNight);
  const shifts = buildNightShifts(events);
  const shift = shifts.find(s => s.date === targetNight);

  // Build sections
  const stillOpen = items.filter(i => i.disposition === 'still_open' || i.disposition === 'carried_over');
  const newTonight = items.filter(i => i.disposition === 'new_tonight');
  const newlyResolved = items.filter(i => i.disposition === 'newly_resolved');
  const flaggedItems = items.filter(i => i.flagged);

  const sections = [
    {
      heading: '🚨 On Fire — Needs Immediate Attention',
      items: [...stillOpen.filter(i => i.type === 'Compliance' || i.type === 'Finance Note' || i.type === 'Deposit Issue'),
              ...stillOpen.filter(i => i.type !== 'Compliance' && i.type !== 'Finance Note' && i.type !== 'Deposit Issue')],
    },
    {
      heading: '🆕 New Tonight',
      items: newTonight,
    },
    {
      heading: '✅ Resolved Overnight',
      items: newlyResolved,
    },
  ].filter(s => s.items.length > 0);

  const report: HandoverReport = {
    hotel: {
      id: hotelId,
      name: hotelName,
      generatedAt: new Date().toISOString(),
      period: `${targetNight} 23:00 → ${nextDay(targetNight)} 07:00`,
    },
    summary: {
      totalIssues: items.length,
      stillOpen: stillOpen.length,
      newlyResolved: newlyResolved.length,
      newTonight: newTonight.length,
    },
    sections,
    contradictions: shift?.contradictions ?? [],
    incompleteEntries: shift?.incompleteEntries ?? [],
    rawSources: [...new Set(events.map(e => e.id))],
  };

  logger.info('Report generated', {
    totalIssues: items.length,
    contradictions: report.contradictions.length,
    incomplete: report.incompleteEntries.length,
  });

  return report;
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+08:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// Convert to HTML for human-readable view
export function reportToHTML(report: HandoverReport): string {
  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Handover — ${report.hotel.name} — ${report.hotel.period}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #222; }
    h1 { font-size: 18px; border-bottom: 2px solid #222; padding-bottom: 8px; }
    h2 { font-size: 14px; color: #555; margin-top: 24px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
    .item { background: #f7f7f7; border-radius: 6px; padding: 12px 14px; margin: 8px 0; }
    .item-header { display: flex; justify-content: space-between; align-items: center; }
    .item-type { font-weight: 600; font-size: 13px; }
    .item-room { color: #888; font-size: 12px; }
    .item-body { font-size: 13px; margin-top: 6px; color: #444; }
    .follow-up { color: #1a69b8; font-size: 12px; margin-top: 4px; }
    .sources { color: #aaa; font-size: 11px; margin-top: 4px; }
    .flag { background: #fff3cd; border-left: 3px solid #ffc107; padding: 8px 10px; border-radius: 4px; margin: 8px 0; }
    .contradiction { background: #fde8e8; border-left: 3px solid #dc3545; padding: 8px 10px; border-radius: 4px; margin: 8px 0; }
    .summary-bar { background: #222; color: #fff; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; display: flex; gap: 24px; }
    .summary-item { font-size: 13px; }
    .summary-num { font-size: 20px; font-weight: 700; }
  </style>
</head>
<body>
  <h1>🌙 ${report.hotel.name} — Night Shift Handover</h1>
  <div class="meta">${report.hotel.period} &nbsp;|&nbsp; Generated ${new Date(report.hotel.generatedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</div>

  <div class="summary-bar">
    <div class="summary-item"><span class="summary-num">${report.summary.stillOpen}</span> Still Open</div>
    <div class="summary-item"><span class="summary-num">${report.summary.newTonight}</span> New Tonight</div>
    <div class="summary-item"><span class="summary-num">${report.summary.newlyResolved}</span> Resolved</div>
  </div>`;

  for (const section of report.sections) {
    html += `<h2>${section.heading}</h2>`;
    for (const item of section.items) {
      const flagBadge = item.flagged ? '<span style="background:#ffc107;padding:2px 6px;border-radius:3px;font-size:11px;">⚠️ FLAGGED</span>' : '';
      html += `<div class="item">
        <div class="item-header">
          <span class="item-type">${dispositionLabel(item.disposition)} — ${item.type}${flagBadge}</span>
          ${item.room ? `<span class="item-room">Room ${item.room}</span>` : ''}
        </div>
        <div class="item-body">${item.summary}</div>
        ${item.followUp ? `<div class="follow-up">👉 ${item.followUp}</div>` : ''}
        <div class="sources">Sources: ${item.sources.join(', ')}</div>
      </div>`;
    }
  }

  if (report.contradictions.length > 0) {
    html += `<h2>⚠️ Contradictions Detected</h2>`;
    for (const c of report.contradictions) {
      html += `<div class="contradiction"><strong>${c.issue}</strong><br>${c.description}<br><span class="sources">Sources: ${c.sources.join(', ')}</span></div>`;
    }
  }

  if (report.incompleteEntries.length > 0) {
    html += `<h2>📋 Incomplete / Flagged Entries</h2>`;
    for (const ie of report.incompleteEntries) {
      html += `<div class="flag">${ie.eventId}: ${ie.reason}</div>`;
    }
  }

  html += `</body></html>`;
  return html;
}