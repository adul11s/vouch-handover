"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllNights = getAllNights;
exports.buildNightShifts = buildNightShifts;
exports.buildHandoverItems = buildHandoverItems;
const utils_1 = require("./utils");
function issueKey(e) {
    return `${e.room ?? '_'}_${e.type}`;
}
// Determine if two events refer to the same issue across different nights
function sameIssue(a, b) {
    if (a.night && b.night && a.night === b.night)
        return false;
    if (!a.room || !b.room)
        return a.type === b.type && a.type === 'compliance';
    return a.room === b.room && a.type === b.type;
}
function getAllNights(events) {
    const nights = new Set(events.map((e) => e.night).filter(Boolean));
    return Array.from(nights).sort();
}
function buildNightShifts(events) {
    const nights = getAllNights(events);
    const shifts = [];
    // Running registry: maps issueKey → event that has the open thread
    // Tracks unresolved events from ALL previous nights, keyed by room+type
    const openThreads = new Map();
    for (const night of nights) {
        const nightEvents = events.filter((e) => e.night === night);
        // Start with events already in the running open threads (carried from previous nights)
        const carriedOver = nightEvents.filter((e) => {
            const key = issueKey(e);
            return openThreads.has(key) && (e.status === 'unresolved' || e.status === 'pending');
        });
        // Newly unresolved events on this night (not seen before)
        const newUnresolved = nightEvents.filter((e) => {
            if (e.status === 'resolved')
                return false;
            const key = issueKey(e);
            return !openThreads.has(key);
        });
        // Resolved events on this night that close a thread
        const newlyResolved = nightEvents.filter((e) => {
            if (e.status !== 'resolved')
                return false;
            const key = issueKey(e);
            return openThreads.has(key);
        });
        // Update running registry
        for (const e of newlyResolved) {
            openThreads.delete(issueKey(e));
        }
        for (const e of newUnresolved) {
            openThreads.set(issueKey(e), e);
        }
        // New tonight (unresolved, never seen before)
        const seenBefore = new Set(events
            .filter((e) => e.night && e.night < night)
            .map((e) => issueKey(e)));
        const newTonight = nightEvents.filter((e) => {
            if (e.status === 'resolved')
                return false;
            return !seenBefore.has(issueKey(e));
        });
        // Contradictions
        const contradictions = [];
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
        const incompleteEntries = [];
        const injectionEvent = nightEvents.find((e) => e.flagged);
        if (injectionEvent) {
            incompleteEntries.push({
                eventId: injectionEvent.id,
                reason: '⚠️ FLAGGED: potential prompt injection — embedded instructions ignored.',
            });
        }
        for (const event of nightEvents) {
            if ((event.status === 'pending' || event.status === 'unresolved') &&
                event.type !== 'compliance' &&
                event.type !== 'maintenance' &&
                event.type !== 'deposit_issue') {
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
function buildHandoverItems(events, night) {
    const shift = buildNightShifts(events).find((s) => s.date === night);
    if (!shift)
        return [];
    const items = [];
    // New tonight
    for (const e of shift.newTonight) {
        items.push({
            id: e.id,
            room: e.room ?? undefined,
            guest: e.guest ?? undefined,
            type: (0, utils_1.typeLabel)(e.type),
            disposition: 'new_tonight',
            summary: e.description,
            sources: [e.id],
            flagged: e.flagged,
            flagReason: e.flagReason,
            followUp: (0, utils_1.buildFollowUp)(e),
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
            type: (0, utils_1.typeLabel)(e.type),
            disposition: 'still_open',
            summary: e.description,
            sources: [e.id],
            flagged: e.flagged,
            flagReason: e.flagReason,
            followUp: (0, utils_1.buildFollowUp)(e),
        });
    }
    // Newly resolved
    for (const e of shift.newlyResolved) {
        items.push({
            id: e.id,
            room: e.room ?? undefined,
            guest: e.guest ?? undefined,
            type: (0, utils_1.typeLabel)(e.type),
            disposition: 'newly_resolved',
            summary: e.description,
            sources: [e.id],
            followUp: undefined,
        });
    }
    return items;
}
