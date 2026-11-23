import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/crypto';
import { sendError } from '../utils/response';
import { db } from '../db';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication token required.', null, 401);
  }

  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const payload = verifyAccessToken(token);

    // Verify user exists and is active in database
    const userRes = await db.query(
      'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      return sendError(res, 'USER_INACTIVE_OR_NOT_FOUND', 'User account does not exist or has been deactivated.', null, 401);
    }

    (req as any).user = {
      userId: userRes.rows[0].id,
      email: userRes.rows[0].email,
      fullName: userRes.rows[0].full_name,
      role: userRes.rows[0].role
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'TOKEN_EXPIRED', 'Access token has expired. Please refresh your session.', null, 401);
    }
    return sendError(res, 'INVALID_TOKEN', 'Invalid authentication credentials provided.', null, 401);
  }
}

