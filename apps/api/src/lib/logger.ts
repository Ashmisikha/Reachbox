type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const base = {
    timestamp,
    level,
    message,
    ...context,
  };
  return JSON.stringify(base);
}

export const logger = {
  info(message: string, context?: LogContext): void {
    console.log(formatLog('info', message, context));
  },
  warn(message: string, context?: LogContext): void {
    console.warn(formatLog('warn', message, context));
  },
  error(message: string, context?: LogContext): void {
    console.error(formatLog('error', message, context));
  },
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog('debug', message, context));
    }
  },
};
