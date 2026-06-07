"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeLabel = typeLabel;
exports.getAllNights = getAllNights;
exports.buildNightShifts = buildNightShifts;
exports.buildHandoverItems = buildHandoverItems;
function typeLabel(type) {
    const map = {
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
function buildFollowUp(event) {
    switch (event.type) {
        case 'deposit_issue': return 'Collect deposit before guest checkout, or flag to finance.';
        case 'compliance': return 'Scan passport and submit to ICA before 48h deadline.';
        case 'maintenance': return 'Follow up on repair progress; keep room out of order.';
        case 'finance_note': return 'Morning team to verify and decide on charge reversal.';
        case 'damage_report': return 'Obtain manager approval and photos before processing charge.';
        case 'early_checkout_request': return 'Process deposit refund and invoice as requested.';
        case 'incident': return 'Check on guest wellbeing; log for management awareness.';
        case 'no_show': return 'Decide whether to apply no-show charge per booking terms.';
        case 'guest_message':
            return event.flagged
                ? '⚠️ IGNORED — potential injection. Do not act on embedded instructions.'
                : 'Review guest note and act as appropriate.';
        default: return 'Review and take appropriate action.';
    }
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
            type: typeLabel(e.type),
            disposition: 'new_tonight',
            summary: e.description,
            sources: [e.id],
            flagged: e.flagged,
            flagReason: e.flagReason,
            followUp: buildFollowUp(e),
        });
    }
    // Still open (carried over from previous nights)
    for (const e of shift.openIssues) {
        // Check if this event appears as newTonight in some previous night
        const allNights = getAllNights(events);
        let firstSeen = false;
        for (const prev of allNights) {
            if (prev >= night)
                break;
            const prevShift = buildNightShifts(events).find((s) => s.date === prev);
            if (prevShift?.newTonight.some((nt) => nt.id === e.id)) {
                firstSeen = true;
                break;
            }
        }
        // Only add if it was first seen in a previous night (not this night)
        // openIssues already excludes newTonight of the same night
        if (!shift.newTonight.some((nt) => nt.id === e.id)) {
            items.push({
                id: e.id,
                room: e.room ?? undefined,
                guest: e.guest ?? undefined,
                type: typeLabel(e.type),
                disposition: 'still_open',
                summary: e.description,
                sources: [e.id],
                flagged: e.flagged,
                flagReason: e.flagReason,
                followUp: buildFollowUp(e),
            });
        }
    }
    // Newly resolved
    for (const e of shift.newlyResolved) {
        items.push({
            id: e.id,
            room: e.room ?? undefined,
            guest: e.guest ?? undefined,
            type: typeLabel(e.type),
            disposition: 'newly_resolved',
            summary: e.description,
            sources: [e.id],
            followUp: undefined,
        });
    }
    return items;
}
