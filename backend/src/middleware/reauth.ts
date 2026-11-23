import { Request, Response, NextFunction } from 'express';
import { verifyReauthToken } from '../utils/crypto';
import { sendError } from '../utils/response';

export function requireSensitiveReauth(actionName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const reauthToken = req.header('X-Reauth-Token');
    if (!reauthToken) {
      return sendError(
        res,
        'REAUTH_REQUIRED',
        `Sensitive action '${actionName}' requires step-up reauthentication. Provide valid 'X-Reauth-Token' header.`,
        { action: actionName },
        403
      );
    }

    try {
      const decoded = verifyReauthToken(reauthToken);
      const user = (req as any).user;
      if (user && decoded.userId !== user.userId) {
        return sendError(res, 'REAUTH_MISMATCH', 'Reauthentication token belongs to a different session.', null, 403);
      }
      next();
    } catch {
      return sendError(res, 'REAUTH_EXPIRED_OR_INVALID', 'Reauthentication token has expired or is invalid. Please confirm your password or MFA.', null, 403);
    }
  };
}
