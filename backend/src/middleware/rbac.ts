import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export type UserRole =
  | 'customer'
  | 'support_agent'
  | 'operations_analyst'
  | 'finance_administrator'
  | 'platform_administrator';

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required.', null, 401);
    }

    if (!allowedRoles.includes(user.role as UserRole)) {
      return sendError(
        res,
        'FORBIDDEN',
        `Access denied. Role '${user.role}' lacks permission for this endpoint. Required: [${allowedRoles.join(', ')}]`,
        null,
        403
      );
    }

    next();
  };
}

export function requireSelfOrRole(
  getOwnerId: (req: Request) => string | undefined,
  ...privilegedRoles: UserRole[]
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required.', null, 401);
    }

    const ownerId = getOwnerId(req);
    const isOwner = ownerId && ownerId === user.userId;
    const hasPrivilege = privilegedRoles.includes(user.role as UserRole);

    if (!isOwner && !hasPrivilege) {
      return sendError(
        res,
        'FORBIDDEN',
        'Resource access violation: You are not authorized to view or mutate another user\'s financial records.',
        null,
        403
      );
    }

    next();
  };
}
