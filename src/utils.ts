// Shared utilities — single source of truth for cross-module functions
import { HotelEvent } from './types';

export function typeLabel(type: string): string {
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

export function buildFollowUp(event: HotelEvent): string {
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

// Derive the shift date from a timestamp.
// Night shifts run 23:00–07:00, spanning two calendar dates.
// A timestamp between 00:00–06:59 belongs to the PREVIOUS day's shift.
// A timestamp between 23:00–23:59 belongs to THAT day's shift.
export function deriveNightDate(timestamp: string): string {
  const localHour = parseInt(timestamp.split('T')[1].slice(0, 2), 10);

  if (localHour >= 23) {
    // 23:00–23:59 → shift started on this date
    return timestamp.split('T')[0];
  } else {
    // 00:00–06:59 → shift started on the previous calendar day
    // Parse in local timezone by extracting Y/M/D and subtracting 1 day
    const [year, month, day] = timestamp.split('T')[0].split('-').map(Number);
    const d = new Date(year, month - 1, day); // local time
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dy}`;
  }
}