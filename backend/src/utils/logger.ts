export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  requestId?: string;
  actorId?: string;
  context?: Record<string, any>;
  error?: any;
}

export const logger = {
  info(message: string, context: Record<string, any> = {}, requestId?: string, actorId?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      requestId,
      actorId,
      context
    };
    console.log(JSON.stringify(entry));
  },

  warn(message: string, context: Record<string, any> = {}, requestId?: string, actorId?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      requestId,
      actorId,
      context
    };
    console.warn(JSON.stringify(entry));
  },

  error(message: string, error?: any, context: Record<string, any> = {}, requestId?: string, actorId?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      requestId,
      actorId,
      context,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error
    };
    console.error(JSON.stringify(entry));
  },

  debug(message: string, context: Record<string, any> = {}, requestId?: string) {
    if (process.env.NODE_ENV !== 'production') {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'debug',
        message,
        requestId,
        context
      };
      console.debug(JSON.stringify(entry));
    }
  }
};
