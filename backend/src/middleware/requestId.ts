import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingId = req.header('X-Request-Id');
  const requestId = incomingId && incomingId.trim().length > 0 ? incomingId.trim() : uuidv4();
  (req as any).id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
