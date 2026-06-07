"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReport = generateReport;
exports.reportToHTML = reportToHTML;
const reconciler_1 = require("./reconciler");
const logger_1 = require("./logger");
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function dispositionLabel(d) {
    const m = {
        still_open: '🔴 Still Open',
        newly_resolved: '✅ Resolved Overnight',
        new_tonight: '🆕 New Tonight',
        carried_over: '🔴 Carried Over',
    };
    return m[d] ?? d;
}
function generateReport(events, hotelId, hotelName, targetNight) {
    logger_1.logger.info('Generating handover report', { hotelId, targetNight });
    const items = (0, reconciler_1.buildHandoverItems)(events, targetNight);
    const shifts = (0, reconciler_1.buildNightShifts)(events);
    const shift = shifts.find(s => s.date === targetNight);
    // Build sections
    const stillOpen = items.filter(i => i.disposition === 'still_open' || i.disposition === 'carried_over');
    const newTonight = items.filter(i => i.disposition === 'new_tonight');
    const newlyResolved = items.filter(i => i.disposition === 'newly_resolved');
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
    const report = {
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
    logger_1.logger.info('Report generated', {
        totalIssues: items.length,
        contradictions: report.contradictions.length,
        incomplete: report.incompleteEntries.length,
    });
    return report;
}
function nextDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00+08:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}
// Convert to HTML for human-readable view
function reportToHTML(report) {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Handover — ${escapeHtml(report.hotel.name)} — ${escapeHtml(report.hotel.period)}</title>
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
  <h1>🌙 ${escapeHtml(report.hotel.name)} — Night Shift Handover</h1>
  <div class="meta">${escapeHtml(report.hotel.period)} &nbsp;|&nbsp; Generated ${new Date(report.hotel.generatedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</div>

  <div class="summary-bar">
    <div class="summary-item"><span class="summary-num">${report.summary.stillOpen}</span> Still Open</div>
    <div class="summary-item"><span class="summary-num">${report.summary.newTonight}</span> New Tonight</div>
    <div class="summary-item"><span class="summary-num">${report.summary.newlyResolved}</span> Resolved</div>
  </div>`;
    for (const section of report.sections) {
        html += `<h2>${escapeHtml(section.heading)}</h2>`;
        for (const item of section.items) {
            const flagBadge = item.flagged ? '<span style="background:#ffc107;padding:2px 6px;border-radius:3px;font-size:11px;">&#9888; FLAGGED</span>' : '';
            html += `<div class="item">
        <div class="item-header">
          <span class="item-type">${dispositionLabel(item.disposition)} — ${escapeHtml(item.type)}${flagBadge}</span>
          ${item.room ? `<span class="item-room">Room ${escapeHtml(item.room)}</span>` : ''}
        </div>
        <div class="item-body">${escapeHtml(item.summary)}</div>
        ${item.followUp ? `<div class="follow-up">&#8594; ${escapeHtml(item.followUp)}</div>` : ''}
        <div class="sources">Sources: ${item.sources.join(', ')}</div>
      </div>`;
        }
    }
    if (report.contradictions.length > 0) {
        html += `<h2>&#9888; Contradictions Detected</h2>`;
        for (const c of report.contradictions) {
            html += `<div class="contradiction"><strong>${escapeHtml(c.issue)}</strong><br>${escapeHtml(c.description)}<br><span class="sources">Sources: ${c.sources.join(', ')}</span></div>`;
        }
    }
    if (report.incompleteEntries.length > 0) {
        html += `<h2>&#128203; Incomplete / Flagged Entries</h2>`;
        for (const ie of report.incompleteEntries) {
            html += `<div class="flag">${escapeHtml(ie.eventId)}: ${escapeHtml(ie.reason)}</div>`;
        }
    }
    html += `</body></html>`;
    return html;
}
