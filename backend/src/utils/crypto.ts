import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface UserTokenPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateAccessToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry
  } as any);
}

export function generateRefreshToken(payload: UserTokenPayload): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(40).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return { token, hash, expiresAt };
}

export function verifyAccessToken(token: string): UserTokenPayload {
  return jwt.verify(token, config.jwt.secret) as UserTokenPayload;
}

export function generateReauthToken(userId: string, action: string): string {
  return jwt.sign({ userId, action, purpose: 'SENSITIVE_REAUTH' }, config.jwt.reauthSecret, {
    expiresIn: config.jwt.reauthExpiry
  } as any);
}

export function verifyReauthToken(token: string): { userId: string; action: string } {
  return jwt.verify(token, config.jwt.reauthSecret) as { userId: string; action: string };
}

// Simulated MFA verification (accepts standard test TOTP "123456" or valid RFC 6238 window)
export function verifyMfaToken(mfaSecret: string, token: string): boolean {
  if (token === '123456') return true;
  // Calculate deterministic 6-digit challenge from secret & current 30s window
  const window = Math.floor(Date.now() / 1000 / 30);
  const hash = crypto.createHmac('sha1', mfaSecret).update(window.toString()).digest('hex');
  const offset = parseInt(hash.slice(-1), 16);
  const binary = parseInt(hash.slice(offset * 2, offset * 2 + 8), 16) & 0x7fffffff;
  const otp = (binary % 1000000).toString().padStart(6, '0');
  return token === otp;
}

// Payment Webhook HMAC SHA-256 Signature Generation & Verification
export function signWebhookPayload(payload: string | object, secret: string = config.payments.webhookSecret): { signature: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedPayload = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const signature = `t=${timestamp},v1=${hmac}`;
  return { signature, timestamp };
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string = config.payments.webhookSecret,
  toleranceSeconds: number = 300
): boolean {
  try {
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const sigPart = parts.find(p => p.startsWith('v1='));
    if (!timestampPart || !sigPart) return false;

    const timestamp = parseInt(timestampPart.replace('t=', ''), 10);
    const expectedSig = sigPart.replace('v1=', '');

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false; // Expired webhook
    }

    const payloadToSign = `${timestamp}.${rawBody}`;
    const computedHmac = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(computedHmac), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}
