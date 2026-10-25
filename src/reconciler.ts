// Reconciles events across nights — determines disposition of each issue
import { HotelEvent, IssueDisposition, NightShift, HandoverItem, Contradiction, IncompleteEntry } from './types';
import { logger } from './logger';
import { typeLabel, buildFollowUp } from './utils';

function issueKey(e: HotelEvent): string {
  return `${e.room ?? '_'}_${e.type}`;
}

// Determine if two events refer to the same issue across different nights
function sameIssue(a: HotelEvent, b: HotelEvent): boolean {
  if (a.night && b.night && a.night === b.night) return false;
  if (!a.room || !b.room) return a.type === b.type && a.type === 'compliance';
  return a.room === b.room && a.type === b.type;
}

export function getAllNights(events: HotelEvent[]): string[] {
  const nights = new Set(events.map((e) => e.night).filter(Boolean) as string[]);
  return Array.from(nights).sort();
}

export function buildNightShifts(events: HotelEvent[]): NightShift[] {
  const nights = getAllNights(events);
  const shifts: NightShift[] = [];

  // Running registry: maps issueKey → event that has the open thread
  // Tracks unresolved events from ALL previous nights, keyed by room+type
  const openThreads = new Map<string, HotelEvent>();
  // Minimal status bookkeeping for reopening: keys whose thread was closed by an
  // earlier-night resolution. A key in here that re-occurs later must NOT be
  // swallowed by the seenBefore exclusion — it re-enters as new_tonight so the
  // morning manager actually sees the reopened issue (was a data-loss bug:
  // reopened issue vanished entirely after resolution, fixture f08).
  const closedThreads = new Set<string>();

  for (const night of nights) {
    const nightEvents = events.filter((e) => e.night === night);

    // Start with events already in the running open threads (carried from previous nights)
    const carriedOver = nightEvents.filter((e) => {
      const key = issueKey(e);
      return openThreads.has(key) && (e.status === 'unresolved' || e.status === 'pending');
    });

    // Newly unresolved events on this night (not seen before)
    const newUnresolved = nightEvents.filter((e) => {
      if (e.status === 'resolved') return false;
      const key = issueKey(e);
      return !openThreads.has(key);
    });

    // Resolved events on this night that close a thread
    const newlyResolved = nightEvents.filter((e) => {
      if (e.status !== 'resolved') return false;
      const key = issueKey(e);
      return openThreads.has(key);
    });

    // Update running registry
    for (const e of newlyResolved) {
      openThreads.delete(issueKey(e));
      // Remember the closure so a later recurrence is treated as a reopen
      // (new_tonight) instead of being silently dropped by seenBefore below.
      closedThreads.add(issueKey(e));
    }
    for (const e of newUnresolved) {
      openThreads.set(issueKey(e), e);
    }

    // New tonight (unresolved, never seen before)
    const seenBefore = new Set(
      events
        .filter((e) => e.night && e.night < night)
        .map((e) => issueKey(e))
    );
    const newTonight = nightEvents.filter((e) => {
      if (e.status === 'resolved') return false;
      const key = issueKey(e);
      if (seenBefore.has(key)) {
        // Reopen: thread on this key was already closed by an earlier resolution,
        // so this recurrence is a fresh open the manager must see — not a dup
        // of a still-open item (those keys are still in openThreads, not here).
        return closedThreads.has(key);
      }
      return true;
    });

    // Contradictions
    const contradictions: Contradiction[] = [];
    const room312NoShow = nightEvents.find((e) => e.room === '312' && e.type === 'no_show');
    const room312Finance = nightEvents.find((e) => e.room === '312' && e.type === 'finance_note');
    if (room312NoShow && room312Finance) {
      contradictions.push({
        issue: 'Room 312 no-show charge',
        sources: [room312NoShow.id, room312Finance.id],
        description: 'Night log (Wed) says charge was collected. evt_0010 (Tue) says NOT yet charged. Morning team to verify.',
      });
    }

    // Incomplete entries
    const incompleteEntries: IncompleteEntry[] = [];
    const injectionEvent = nightEvents.find((e) => e.flagged);
    if (injectionEvent) {
      incompleteEntries.push({
        eventId: injectionEvent.id,
        reason: '⚠️ FLAGGED: potential prompt injection — embedded instructions ignored.',
      });
    }
    for (const event of nightEvents) {
      if (
        (event.status === 'pending' || event.status === 'unresolved') &&
        event.type !== 'compliance' &&
        event.type !== 'maintenance' &&
        event.type !== 'deposit_issue'
      ) {
        if (!incompleteEntries.find((ie) => ie.eventId === event.id)) {
          incompleteEntries.push({
            eventId: event.id,
            reason: `No resolution recorded — ${event.status}.`,
          });
        }
      }
    }

    shifts.push({
      date: night,
      events: nightEvents,
      openIssues: carriedOver, // only events carried from previous nights
      newlyResolved,
      newTonight,
      contradictions,
      incompleteEntries,
    });
  }

  return shifts;
}

export function buildHandoverItems(events: HotelEvent[], night: string): HandoverItem[] {
  const shift = buildNightShifts(events).find((s) => s.date === night);
  if (!shift) return [];

  const items: HandoverItem[] = [];

  // New tonight
  for (const e of shift.newTonight) {
    items.push({
      id: e.id,
      room: e.room ?? undefined,
      guest: e.guest ?? undefined,
      type: typeLabel(e.type),
      disposition: 'new_tonight' as IssueDisposition,
      summary: e.description,
      sources: [e.id],
      flagged: e.flagged,
      flagReason: e.flagReason,
      followUp: buildFollowUp(e),
    });
  }

  // Still open (carried over from previous nights)
  for (const e of shift.openIssues) {
    // openIssues already excludes events that were newTonight on this same night
    // so no additional dedup check needed here
    items.push({
      id: e.id,
      room: e.room ?? undefined,
      guest: e.guest ?? undefined,
      type: typeLabel(e.type),
      disposition: 'still_open' as IssueDisposition,
      summary: e.description,
      sources: [e.id],
      flagged: e.flagged,
      flagReason: e.flagReason,
      followUp: buildFollowUp(e),
    });
  }

  // Newly resolved
  for (const e of shift.newlyResolved) {
    items.push({
      id: e.id,
      room: e.room ?? undefined,
      guest: e.guest ?? undefined,
      type: typeLabel(e.type),
      disposition: 'newly_resolved' as IssueDisposition,
      summary: e.description,
      sources: [e.id],
      followUp: undefined,
    });
  }

  return items;
}