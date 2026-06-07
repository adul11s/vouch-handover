import { LogEntry } from './types';
import { v4 as uuidv4 } from 'uuid';

const correlationId = uuidv4();

export function createLogger() {
  function log(entry: Omit<LogEntry, 'timestamp' | 'correlationId'>) {
    const full: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      correlationId,
    };
    // Structured JSON to stdout — can be piped to Datadog/Splunk
    console.log(JSON.stringify(full));
  }

  return {
    info: (message: string, context?: Record<string, unknown>) =>
      log({ level: 'info', message, context }),
    warn: (message: string, context?: Record<string, unknown>) =>
      log({ level: 'warn', message, context }),
    error: (message: string, context?: Record<string, unknown>) =>
      log({ level: 'error', message, context }),
    debug: (message: string, context?: Record<string, unknown>) =>
      log({ level: 'debug', message, context }),
    correlationId,
  };
}

export const logger = createLogger();