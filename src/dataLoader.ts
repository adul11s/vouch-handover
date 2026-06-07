// Loads and normalizes raw input data (structured events + night logs)
import { HotelEvent } from './types';
import { logger } from './logger';

interface RawEvent {
  id: string;
  timestamp: string;
  type: string;
  room: string | null;
  guest: string | null;
  description: string;
  status: string;
}

interface RawEventsData {
  hotel: { id: string; name: string; rooms: number; timezone: string };
  events: RawEvent[];
}

// Normalize structured events from events.json
export function normalizeStructuredEvents(data: RawEventsData): HotelEvent[] {
  logger.info('Normalizing structured events', { count: data.events.length });

  return data.events.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    type: e.type as HotelEvent['type'],
    room: e.room ?? null,
    guest: e.guest ?? null,
    description: e.description,
    status: e.status as HotelEvent['status'],
    source: 'structured' as const,
    night: deriveNightDate(e.timestamp),
    flagged: false,
  }));
}

// Derive the shift date from a timestamp.
// Night shifts run 23:00–07:00, spanning two calendar dates.
// A timestamp between 00:00–06:59 belongs to the PREVIOUS day's shift.
// A timestamp between 23:00–23:59 belongs to THAT day's shift.
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

// Night log parser output (parsed by AI from free-text)
export interface NightLogParsed {
  events: Omit<HotelEvent, 'id' | 'source'>[];
  rawText: string;
}

// Normalize night log parsed events
export function normalizeNightLogEvents(parsed: NightLogParsed): HotelEvent[] {
  logger.info('Normalizing night log events', { count: parsed.events.length });

  return parsed.events.map((e, i) => ({
    id: `nl_${Date.now()}_${i}`,
    timestamp: e.timestamp,
    type: e.type as HotelEvent['type'],
    room: e.room ?? null,
    guest: e.guest ?? null,
    description: e.description,
    status: e.status as HotelEvent['status'],
    source: 'night_log' as const,
    night: deriveNightDate(e.timestamp),
    flagged: e.flagged ?? false,
    flagReason: e.flagReason,
  }));
}

export function loadAllEvents(
  structuredData: RawEventsData,
  nightLogParsed: NightLogParsed
): HotelEvent[] {
  const structured = normalizeStructuredEvents(structuredData);
  const nightLog = normalizeNightLogEvents(nightLogParsed);
  return [...structured, ...nightLog].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}