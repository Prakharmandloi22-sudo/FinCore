import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';

export function errorHandlerMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = (req as any).id || 'unknown';
  const actorId = (req as any).user?.userId;

  logger.error(
    `Unhandled error in [${req.method}] ${req.path}: ${err?.message || 'Internal error'}`,
    err,
    { path: req.path, method: req.method },
    requestId,
    actorId
  );

  // Database / Ledger constraint violations
  if (err?.message?.includes('FinCore Ledger Violation')) {
    return sendError(res, 'LEDGER_IMMUTABILITY_VIOLATION', err.message, null, 403);
  }
  if (err?.message?.includes('Unbalanced journal entry')) {
    return sendError(res, 'UNBALANCED_LEDGER_ENTRY', err.message, null, 422);
  }
  if (err?.code === '23505') { // Postgres unique violation
    return sendError(res, 'DUPLICATE_RESOURCE', 'Resource with this key already exists.', { detail: err.detail }, 409);
  }
  if (err?.code === '23503') { // Postgres foreign key violation
    return sendError(res, 'FOREIGN_KEY_VIOLATION', 'Referenced entity does not exist.', null, 400);
  }

  const statusCode = err.statusCode || (err.status >= 400 && err.status < 600 ? err.status : 500);
  const errorCode = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');
  const message = statusCode === 500 ? 'An unexpected error occurred while processing the financial transaction.' : (err.message || 'Operation failed');

  return sendError(res, errorCode, message, err.details || null, statusCode);
}
