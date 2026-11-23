import request from 'supertest';
import { app } from '../src/app';
import { memoryStore } from '../src/db/memoryStore';

describe('Assessment 04: Financial Identity & Authorization Test Suite', () => {
  beforeEach(() => {
    memoryStore.reset();
  });

  it('should register a new customer and return JWT tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@fincore.local',
        password: 'Password123!',
        fullName: 'New Customer',
        role: 'customer'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('newuser@fincore.local');
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();

    // Verify password is NOT stored as plaintext
    const storedUser = Array.from(memoryStore.users.values()).find(u => u.email === 'newuser@fincore.local');
    expect(storedUser?.password_hash).not.toBe('Password123!');
    expect(storedUser?.password_hash.startsWith('$2a$')).toBe(true);
  });

  it('should require MFA upon login and verify TOTP challenge', async () => {
    // 1. Initial login returns requiresMfa: true
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'customer@fincore.local',
        password: 'Password123!'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.requiresMfa).toBe(true);
    const userId = loginRes.body.data.userId;

    // 2. Invalid MFA code rejected
    const badMfaRes = await request(app)
      .post('/api/v1/auth/mfa/verify')
      .send({
        userId,
        code: '999999'
      });
    expect(badMfaRes.status).toBe(401);
    expect(badMfaRes.body.error.code).toBe('INVALID_MFA_CODE');

    // 3. Valid sandbox TOTP code '123456' succeeds
    const goodMfaRes = await request(app)
      .post('/api/v1/auth/mfa/verify')
      .send({
        userId,
        code: '123456'
      });
    expect(goodMfaRes.status).toBe(200);
    expect(goodMfaRes.body.data.tokens.accessToken).toBeDefined();
  });

  it('should rotate refresh tokens and reject revoked tokens', async () => {
    // Login Alex
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: 'customer@fincore.local', password: 'Password123!' });
    const mfaRes = await request(app).post('/api/v1/auth/mfa/verify').send({ userId: loginRes.body.data.userId, code: '123456' });
    const originalRefreshToken = mfaRes.body.data.tokens.refreshToken;

    // Refresh session
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalRefreshToken });

    expect(refreshRes.status).toBe(200);
    const newRefreshToken = refreshRes.body.data.tokens.refreshToken;
    expect(newRefreshToken).not.toBe(originalRefreshToken);

    // Old refresh token must now be revoked and rejected
    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalRefreshToken });
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('should enforce 5-role RBAC restrictions', async () => {
    // 1. Authenticate Customer Alex
    const loginAlex = await request(app).post('/api/v1/auth/login').send({ email: 'customer@fincore.local', password: 'Password123!' });
    const mfaAlex = await request(app).post('/api/v1/auth/mfa/verify').send({ userId: loginAlex.body.data.userId, code: '123456' });
    const customerToken = mfaAlex.body.data.tokens.accessToken;

    // Customer attempts to access Admin-only Chart of Accounts
    const forbiddenRes = await request(app)
      .get('/api/v1/ledger/accounts')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');

    // 2. Authenticate Finance Admin Elena
    const loginElena = await request(app).post('/api/v1/auth/login').send({ email: 'finance@fincore.local', password: 'Password123!' });
    const mfaElena = await request(app).post('/api/v1/auth/mfa/verify').send({ userId: loginElena.body.data.userId, code: '123456' });
    const adminToken = mfaElena.body.data.tokens.accessToken;

    // Finance admin can view Chart of Accounts
    const allowedRes = await request(app)
      .get('/api/v1/ledger/accounts')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(allowedRes.status).toBe(200);
    expect(allowedRes.body.data.accounts.length).toBeGreaterThan(0);
  });
});

