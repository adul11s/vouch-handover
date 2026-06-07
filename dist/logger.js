"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
const uuid_1 = require("uuid");
function createLogger() {
    function log(entry) {
        const full = {
            level: entry.level,
            timestamp: new Date().toISOString(),
            correlationId: entry.correlationId ?? 'unknown',
            message: entry.message,
            context: entry.context,
        };
        console.log(JSON.stringify(full));
    }
    return {
        info: (message, context, correlationId) => log({ level: 'info', message, correlationId: correlationId ?? 'unknown', context }),
        warn: (message, context, correlationId) => log({ level: 'warn', message, correlationId: correlationId ?? 'unknown', context }),
        error: (message, context, correlationId) => log({ level: 'error', message, correlationId: correlationId ?? 'unknown', context }),
        debug: (message, context, correlationId) => log({ level: 'debug', message, correlationId: correlationId ?? 'unknown', context }),
        newId: () => (0, uuid_1.v4)(),
    };
}
exports.logger = createLogger();
