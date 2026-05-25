/**
 * Shared Winston Logger
 * Phase 5: Code Quality Refactoring
 *
 * Centralized logger singleton to avoid
 * multiple logger instances across modules.
 *
 * Usage: import { logger } from '../lib/logger';
 */

import winston from 'winston';
import path from 'path';

const isDevelopment = process.env.NODE_ENV === 'development';

// Create logs directory path
const logDir = path.join(process.cwd(), 'logs');

export const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        }),
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
  ],
});

// Export convenience methods
export const logInfo = (msg: string, meta?: object) => logger.info(msg, meta);
export const logError = (msg: string, meta?: object) => logger.error(msg, meta);
export const logWarn = (msg: string, meta?: object) => logger.warn(msg, meta);
export const logDebug = (msg: string, meta?: object) => logger.debug(msg, meta);