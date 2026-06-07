"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
const uuid_1 = require("uuid");
const correlationId = (0, uuid_1.v4)();
function createLogger() {
    function log(entry) {
        const full = {
            ...entry,
            timestamp: new Date().toISOString(),
            correlationId,
        };
        // Structured JSON to stdout — can be piped to Datadog/Splunk
        console.log(JSON.stringify(full));
    }
    return {
        info: (message, context) => log({ level: 'info', message, context }),
        warn: (message, context) => log({ level: 'warn', message, context }),
        error: (message, context) => log({ level: 'error', message, context }),
        debug: (message, context) => log({ level: 'debug', message, context }),
        correlationId,
    };
}
exports.logger = createLogger();
