import { LogEntry } from './types';
import { v4 as uuidv4 } from 'uuid';

export function createLogger() {
  function log(entry: Omit<LogEntry, 'timestamp'>) {
    const full: LogEntry = {
      level: entry.level,
      timestamp: new Date().toISOString(),
      correlationId: entry.correlationId ?? 'unknown',
      message: entry.message,
      context: entry.context,
    };
    console.log(JSON.stringify(full));
  }

  return {
    info: (message: string, context?: Record<string, unknown>, correlationId?: string) =>
      log({ level: 'info', message, correlationId: correlationId ?? 'unknown', context }),
    warn: (message: string, context?: Record<string, unknown>, correlationId?: string) =>
      log({ level: 'warn', message, correlationId: correlationId ?? 'unknown', context }),
    error: (message: string, context?: Record<string, unknown>, correlationId?: string) =>
      log({ level: 'error', message, correlationId: correlationId ?? 'unknown', context }),
    debug: (message: string, context?: Record<string, unknown>, correlationId?: string) =>
      log({ level: 'debug', message, correlationId: correlationId ?? 'unknown', context }),
    newId: () => uuidv4(),
  };
}

export const logger = createLogger();