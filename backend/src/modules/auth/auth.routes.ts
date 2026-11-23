import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { memoryStore } from '../../db/memoryStore';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  generateReauthToken,
  verifyMfaToken
} from '../../utils/crypto';
import { sendSuccess, sendError } from '../../utils/response';
import { validateBody } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2),
  role: z.enum(['customer', 'support_agent', 'operations_analyst', 'finance_administrator', 'platform_administrator']).default('customer')
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const MfaVerifySchema = z.object({
  userId: z.string().uuid(),
  code: z.string().length(6)
});

const ReauthSchema = z.object({
  password: z.string().optional(),
  mfaCode: z.string().optional(),
  action: z.string().min(1)
});

// POST /register
router.post('/register', validateBody(RegisterSchema), async (req: Request, res: Response) => {
  const { email, password, fullName, role } = req.body;
  const existingUser = Array.from(memoryStore.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return sendError(res, 'USER_EXISTS', 'A user with this email address already exists.', null, 409);
  }

  const hashedPassword = await hashPassword(password);
  const userId = uuidv4();
  const now = new Date().toISOString();

  // Create User
  const newUser = {
    id: userId,
    email: email.toLowerCase(),
    password_hash: hashedPassword,
    full_name: fullName,
    role,
    mfa_enabled: true,
    mfa_secret: 'JBSWY3DPEHPK3PXP', // Simulated standard base32 TOTP secret
    is_active: true,
    created_at: now,
    updated_at: now
  };
  memoryStore.users.set(userId, newUser);

  // If customer, automatically create default USD wallet and linked liability account
  if (role === 'customer') {
    const accountId = uuidv4();
    const walletId = uuidv4();
    const accountCode = `2000-CUST-${email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '')}-USD`;

    memoryStore.ledgerAccounts.set(accountId, {
      id: accountId,
      code: accountCode,
      name: `${fullName} Deposit Liability USD`,
      type: 'LIABILITY',
      currency: 'USD',
      is_system: false,
      status: 'ACTIVE',
      created_at: now
    });

    memoryStore.wallets.set(walletId, {
      id: walletId,
      user_id: userId,
      currency: 'USD',
      status: 'ACTIVE',
      ledger_account_id: accountId,
      created_at: now,
      updated_at: now
    });
  }

  await db.recordAuditLog(userId, role, 'USER_REGISTERED', 'USER', userId, req.ip, null, { email, role, fullName });

  const tokenPayload = { userId, email: newUser.email, role: newUser.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  memoryStore.refreshTokens.set(refreshToken.token, {
    id: uuidv4(),
    user_id: userId,
    token_hash: refreshToken.hash,
    revoked: false,
    expires_at: refreshToken.expiresAt.toISOString(),
    created_at: now
  });

  return sendSuccess(res, {
    user: { id: userId, email: newUser.email, fullName: newUser.full_name, role: newUser.role },
    tokens: {
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn: '15m'
    }
  }, {}, 201);
});

// POST /login
router.post('/login', validateBody(LoginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = Array.from(memoryStore.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user || !user.is_active) {
    return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password provided.', null, 401);
  }

  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password provided.', null, 401);
  }

  // If MFA is enabled, return MFA challenge required
  if (user.mfa_enabled) {
    return sendSuccess(res, {
      requiresMfa: true,
      userId: user.id,
      message: 'MFA challenge required. Provide 6-digit TOTP code (or sandbox default 123456).'
    });
  }

  const tokenPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  memoryStore.refreshTokens.set(refreshToken.token, {
    id: uuidv4(),
    user_id: user.id,
    token_hash: refreshToken.hash,
    revoked: false,
    expires_at: refreshToken.expiresAt.toISOString(),
    created_at: new Date().toISOString()
  });

  await db.recordAuditLog(user.id, user.role, 'USER_LOGIN', 'SESSION', user.id, req.ip);

  return sendSuccess(res, {
    requiresMfa: false,
    user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
    tokens: {
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn: '15m'
    }
  });
});

// POST /mfa/verify
router.post('/mfa/verify', validateBody(MfaVerifySchema), async (req: Request, res: Response) => {
  const { userId, code } = req.body;
  const user = memoryStore.users.get(userId);

  if (!user || !user.is_active) {
    return sendError(res, 'USER_NOT_FOUND', 'User does not exist or is inactive.', null, 404);
  }

  const isValid = verifyMfaToken(user.mfa_secret, code);
  if (!isValid) {
    return sendError(res, 'INVALID_MFA_CODE', 'Invalid or expired 6-digit MFA verification code.', null, 401);
  }

  const tokenPayload = { userId: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  memoryStore.refreshTokens.set(refreshToken.token, {
    id: uuidv4(),
    user_id: user.id,
    token_hash: refreshToken.hash,
    revoked: false,
    expires_at: refreshToken.expiresAt.toISOString(),
    created_at: new Date().toISOString()
  });

  await db.recordAuditLog(user.id, user.role, 'MFA_VERIFIED', 'SESSION', user.id, req.ip);

  return sendSuccess(res, {
    user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
    tokens: {
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn: '15m'
    }
  });
});

// POST /refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshTokenInput = req.body.refreshToken || req.header('X-Refresh-Token');
  if (!refreshTokenInput) {
    return sendError(res, 'TOKEN_REQUIRED', 'Refresh token required.', null, 400);
  }

  const record = memoryStore.refreshTokens.get(refreshTokenInput);
  if (!record || record.revoked || new Date(record.expires_at) < new Date()) {
    return sendError(res, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid, expired, or has been revoked.', null, 401);
  }

  const user = memoryStore.users.get(record.user_id);
  if (!user || !user.is_active) {
    return sendError(res, 'USER_INACTIVE', 'User account not active.', null, 401);
  }

  // Revoke old refresh token (rotation policy)
  record.revoked = true;

  // Issue new token pair
  const tokenPayload = { userId: user.id, email: user.email, role: user.role };
  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  memoryStore.refreshTokens.set(newRefreshToken.token, {
    id: uuidv4(),
    user_id: user.id,
    token_hash: newRefreshToken.hash,
    revoked: false,
    expires_at: newRefreshToken.expiresAt.toISOString(),
    created_at: new Date().toISOString()
  });

  return sendSuccess(res, {
    tokens: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken.token,
      expiresIn: '15m'
    }
  });
});

// POST /reauth (for sensitive financial actions)
router.post('/reauth', authMiddleware, validateBody(ReauthSchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { password, mfaCode, action } = req.body;
  const userRecord = memoryStore.users.get(user.userId);

  if (!userRecord) {
    return sendError(res, 'USER_NOT_FOUND', 'User record not found.', null, 404);
  }

  let verified = false;
  if (password) {
    verified = await verifyPassword(password, userRecord.password_hash);
  } else if (mfaCode) {
    verified = verifyMfaToken(userRecord.mfa_secret, mfaCode);
  }

  if (!verified) {
    return sendError(res, 'REAUTH_FAILED', 'Invalid password or MFA code provided for sensitive action authorization.', null, 401);
  }

  const reauthToken = generateReauthToken(user.userId, action);
  await db.recordAuditLog(user.userId, user.role, 'SENSITIVE_REAUTH_COMPLETED', 'SECURITY', user.userId, req.ip, null, { action });

  return sendSuccess(res, {
    reauthToken,
    expiresIn: '5m',
    authorizedAction: action
  });
});

// GET /me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const user = memoryStore.users.get(authUser.userId);
  if (!user) {
    return sendError(res, 'USER_NOT_FOUND', 'User record not found.', null, 404);
  }

  return sendSuccess(res, {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      mfaEnabled: user.mfa_enabled,
      createdAt: user.created_at
    }
  });
});

export default router;
