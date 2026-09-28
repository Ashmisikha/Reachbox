import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { config } from '../config';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = isAppError
    ? err.message
    : config.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message;

  logger.error('API Error', {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    code,
    message: err.message,
    stack: config.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(isAppError && err.details ? { details: err.details } : {}),
    },
  });
}
