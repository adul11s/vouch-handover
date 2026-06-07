"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeStructuredEvents = normalizeStructuredEvents;
exports.normalizeNightLogEvents = normalizeNightLogEvents;
const logger_1 = require("./logger");
const utils_1 = require("./utils");
// Normalize structured events from events.json
function normalizeStructuredEvents(data) {
    logger_1.logger.info('Normalizing structured events', { count: data.events.length });
    return data.events.map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        type: e.type,
        room: e.room ?? null,
        guest: e.guest ?? null,
        description: e.description,
        status: e.status,
        source: 'structured',
        night: (0, utils_1.deriveNightDate)(e.timestamp),
        flagged: false,
    }));
}
// Normalize night log parsed events
function normalizeNightLogEvents(parsed) {
    logger_1.logger.info('Normalizing night log events', { count: parsed.events.length });
    return parsed.events.map((e, i) => ({
        id: `nl_${Date.now()}_${i}`,
        timestamp: e.timestamp,
        type: e.type,
        room: e.room ?? null,
        guest: e.guest ?? null,
        description: e.description,
        status: e.status,
        source: 'night_log',
        night: (0, utils_1.deriveNightDate)(e.timestamp),
        flagged: e.flagged ?? false,
        flagReason: e.flagReason,
    }));
}
