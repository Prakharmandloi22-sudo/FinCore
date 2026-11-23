import request from 'supertest';
import { app } from '../src/app';
import { memoryStore } from '../src/db/memoryStore';

describe('Assessment 03, 12: Disputes, Holds & Double-Entry Invariants Suite', () => {
  let customerToken: string;
  let opsToken: string;
  let alexWalletId: string;
  let aliceWalletId: string;

  beforeEach(async () => {
    memoryStore.reset();
    const loginAlex = await request(app).post('/api/v1/auth/login').send({ email: 'customer@fincore.local', password: 'Password123!' });
    const mfaAlex = await request(app).post('/api/v1/auth/mfa/verify').send({ userId: loginAlex.body.data.userId, code: '123456' });
    customerToken = mfaAlex.body.data.tokens.accessToken;

    const loginOps = await request(app).post('/api/v1/auth/login').send({ email: 'ops@fincore.local', password: 'Password123!' });
    const mfaOps = await request(app).post('/api/v1/auth/mfa/verify').send({ userId: loginOps.body.data.userId, code: '123456' });
    opsToken = mfaOps.body.data.tokens.accessToken;

    alexWalletId = '33333333-3333-3333-3333-333333333001';
    aliceWalletId = '33333333-3333-3333-3333-333333333003';
  });

  it('should process a dispute lifecycle and reverse funds on acceptance', async () => {
    // 1. Alex transfers $150 to Alice
    const txRes = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        sourceWalletId: alexWalletId,
        destinationWalletId: aliceWalletId,
        amount: 150.0,
        currency: 'USD'
      });
    const transferId = txRes.body.data.transfer.id;

    // 2. Alex raises dispute
    const disputeRes = await request(app)
      .post('/api/v1/disputes')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        transferId,
        reason: 'UNRECOGNIZED_TRANSACTION',
        description: 'I did not authorize this simulated transfer.'
      });

    expect(disputeRes.status).toBe(201);
    const disputeId = disputeRes.body.data.dispute.id;

    // 3. Operations analyst resolves and ACCEPTS dispute
    const resolveRes = await request(app)
      .post(`/api/v1/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        resolution: 'ACCEPTED',
        resolutionNotes: 'Investigation confirmed claim. Reversing funds to Alex.'
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.dispute.status).toBe('ACCEPTED');
    expect(resolveRes.body.data.reversalJournalId).toBeDefined();

    // Invariant check
    expect(memoryStore.verifyGlobalBalanceInvariant().isBalanced).toBe(true);
  });

  it('should reserve and release balance holds accurately', async () => {
    // Starting available: 5000.0000
    const holdRes = await request(app)
      .post('/api/v1/ledger/holds')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        walletId: alexWalletId,
        amount: 1000.0,
        referenceId: 'AUTH-HOLD-001',
        durationMinutes: 30
      });

    expect(holdRes.status).toBe(201);
    const holdId = holdRes.body.data.hold.id;

    // Available balance should now be 4000.0000, Total still 5000.0000
    const balAfterHold = memoryStore.getWalletBalances(alexWalletId);
    expect(balAfterHold.total).toBe('5000.0000');
    expect(balAfterHold.held).toBe('1000.0000');
    expect(balAfterHold.available).toBe('4000.0000');

    // Release hold
    const releaseRes = await request(app)
      .post(`/api/v1/ledger/holds/${holdId}/release`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(releaseRes.status).toBe(200);
    const balAfterRelease = memoryStore.getWalletBalances(alexWalletId);
    expect(balAfterRelease.available).toBe('5000.0000');
    expect(balAfterRelease.held).toBe('0.0000');
  });

  it('should strictly throw error when an unbalanced journal entry is attempted', () => {
    // Attempting to post an entry with $500 Debit and $400 Credit (Unbalanced)
    expect(() => {
      memoryStore.postJournalEntry(
        'TEST-UNBALANCED',
        'TRANSFER',
        'Illegal unbalanced entry attempt',
        [
          { accountId: '11111111-1111-1111-1111-111111111000', entrySide: 'DEBIT', amount: '500.0000', currency: 'USD' },
          { accountId: '22222222-2222-2222-2222-222222222001', entrySide: 'CREDIT', amount: '400.0000', currency: 'USD' }
        ]
      );
    }).toThrow(/Unbalanced journal entry/);
  });

  it('should verify global ledger balance invariant at all times', async () => {
    const res = await request(app)
      .get('/api/v1/ledger/verify-invariants')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PASS');
    expect(res.body.data.globalInvariantResult.isBalanced).toBe(true);
    expect(res.body.data.globalInvariantResult.difference).toBe('0.0000');
  });
});

