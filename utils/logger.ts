export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

const resolveLogLevel = (): LogLevel => {
  const configuredLevel = process.env.LOG_LEVEL?.toLowerCase();

  switch (configuredLevel) {
    case "debug":
      return LogLevel.DEBUG;
    case "warn":
      return LogLevel.WARN;
    case "error":
      return LogLevel.ERROR;
    case "info":
    case undefined:
      return LogLevel.INFO;
    default:
      return LogLevel.INFO;
  }
};

const writeLog = (
  level: keyof typeof LogLevel,
  minLevel: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
  error?: Error
) => {
  if (resolveLogLevel() < minLevel) {
    return;
  }

  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (meta && Object.keys(meta).length > 0) {
    payload.meta = meta;
  }

  if (error) {
    payload.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  console.log(JSON.stringify(payload));
};

export const logger = {
  error(message: string, error?: Error, meta?: Record<string, unknown>) {
    writeLog("ERROR", LogLevel.ERROR, message, meta, error);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    writeLog("WARN", LogLevel.WARN, message, meta);
  },
  info(message: string, meta?: Record<string, unknown>) {
    writeLog("INFO", LogLevel.INFO, message, meta);
  },
  debug(message: string, meta?: Record<string, unknown>) {
    writeLog("DEBUG", LogLevel.DEBUG, message, meta);
  },
};

export default logger;
