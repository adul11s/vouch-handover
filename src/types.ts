// Types for the Vouch Handover Service

export type EventStatus = 'resolved' | 'unresolved' | 'pending';
export type IssueDisposition = 'still_open' | 'newly_resolved' | 'new_tonight' | 'carried_over';

export interface HotelEvent {
  id: string;
  timestamp: string; // ISO 8601 with timezone
  type:
    | 'check_in'
    | 'check_in_issue'
    | 'maintenance'
    | 'compliance'
    | 'complaint'
    | 'lost_keycard'
    | 'deposit_issue'
    | 'facilities'
    | 'no_show'
    | 'walk_in'
    | 'finance_note'
    | 'incident'
    | 'early_checkout_request'
    | 'damage_report'
    | 'note'
    | 'guest_message';
  room: string | null;
  guest: string | null;
  description: string;
  status: EventStatus;
  source: 'structured' | 'night_log';
  night?: string; // e.g. "2026-05-27" — the shift date (start of shift)
  flagged?: boolean; // true when content is suspicious/injection
  flagReason?: string;
}

export interface NightShift {
  date: string; // YYYY-MM-DD — the date at 23:00 start
  events: HotelEvent[];
  openIssues: HotelEvent[];
  newlyResolved: HotelEvent[];
  newTonight: HotelEvent[];
  contradictions: Contradiction[];
  incompleteEntries: IncompleteEntry[];
}

export interface Contradiction {
  issue: string;
  sources: string[];
  description: string;
}

export interface IncompleteEntry {
  eventId: string;
  reason: string;
}

export interface HandoverReport {
  hotel: {
    id: string;
    name: string;
    generatedAt: string;
    period: string; // e.g. "2026-05-29 to 2026-05-30"
  };
  summary: {
    totalIssues: number;
    stillOpen: number;
    newlyResolved: number;
    newTonight: number;
  };
  sections: {
    heading: string;
    items: HandoverItem[];
  }[];
  contradictions: Contradiction[];
  incompleteEntries: IncompleteEntry[];
  rawSources: string[]; // event IDs included for traceability
}

export interface HandoverItem {
  id: string;
  room?: string;
  guest?: string;
  type: string;
  disposition: IssueDisposition;
  summary: string;
  sources: string[];
  flagged?: boolean;
  flagReason?: string;
  followUp?: string; // what the morning team needs to do
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  timestamp: string;
  correlationId: string;
  message: string;
  context?: Record<string, unknown>;
}