// Loads and normalizes raw input data (structured events + night logs)
import { HotelEvent } from './types';
import { logger } from './logger';
import { deriveNightDate } from './utils';

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

