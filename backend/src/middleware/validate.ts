import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return sendError(res, 'VALIDATION_ERROR', 'Input validation failed', details, 422);
      }
      return sendError(res, 'VALIDATION_ERROR', 'Malformed request body', null, 400);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return sendError(res, 'VALIDATION_ERROR', 'Query parameter validation failed', details, 422);
      }
      return sendError(res, 'VALIDATION_ERROR', 'Malformed query parameters', null, 400);
    }
  };
}
