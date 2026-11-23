import request from 'supertest';
import { app } from '../src/app';
import { memoryStore } from '../src/db/memoryStore';

describe('Assessment 07 & 12: Atomic Double-Entry Transfers & Concurrency Suite', () => {
  let customerToken: string;
  let opsToken: string;
  let alexWalletId: string;
  let aliceWalletId: string;

  beforeEach(async () => {
    memoryStore.reset();

    // Authenticate Customer Alex
    const loginAlex = await request(app).post('/api/v1/auth/login').send({ email: 'customer@fincore.local', password: 'Password123!' });
    const mfaAlex = await request(app).post('/api/v1/auth/mfa/verify').send({ userId: loginAlex.body.data.userId, code: '123456' });
    customerToken = mfaAlex.body.data.tokens.accessToken;

    // Authenticate Operations Analyst Jordan
    const loginOps = await request(app).post('/api/v1/auth/login').send({ email: 'ops@fincore.local', password: 'Password123!' });
    const mfaOps = await request(app).post('/api/v1/auth/mfa/verify').send({ userId: loginOps.body.data.userId, code: '123456' });
    opsToken = mfaOps.body.data.tokens.accessToken;

    alexWalletId = '33333333-3333-3333-3333-333333333001'; // $5,000 USD
    aliceWalletId = '33333333-3333-3333-3333-333333333003'; // $2,000 USD
  });

  it('should execute an atomic double-entry transfer with fee and update balances', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        sourceWalletId: alexWalletId,
        destinationWalletId: aliceWalletId,
        amount: 100.0,
        currency: 'USD',
        description: 'Peer to peer payment test'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.transfer.status).toBe('COMPLETED');
    expect(res.body.data.transfer.fee).toBe('1.0000'); // $1 fee applied

    // Verify Alex's balance decreased by 101.0000 (100 amount + 1 fee)
    // Starting balance was 5000.0000 -> 4899.0000
    const alexBalances = memoryStore.getWalletBalances(alexWalletId);
    expect(alexBalances.total).toBe('4899.0000');

    // Verify Alice's balance increased by 100.0000
    // Starting balance was 2000.0000 -> 2100.0000
    const aliceBalances = memoryStore.getWalletBalances(aliceWalletId);
    expect(aliceBalances.total).toBe('2100.0000');

    // Verify global ledger remains strictly balanced: SUM(debits) === SUM(credits)
    const invariant = memoryStore.verifyGlobalBalanceInvariant();
    expect(invariant.isBalanced).toBe(true);
  });

  it('should reject transfers exceeding available balance (insufficient funds)', async () => {
    // Obtain step-up reauthentication token for high-value transfer authorization
    const reauthRes = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ password: 'Password123!', action: 'HIGH_VALUE_TRANSFER' });
    const reauthToken = reauthRes.body.data.reauthToken;

    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('X-Reauth-Token', reauthToken)
      .send({
        sourceWalletId: alexWalletId,
        destinationWalletId: aliceWalletId,
        amount: 999999.0, // Exceeds $5,000 balance
        currency: 'USD'
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');

    // Balance should remain unchanged
    const alexBalances = memoryStore.getWalletBalances(alexWalletId);
    expect(alexBalances.total).toBe('5000.0000');
  });

  it('should enforce idempotency: retrying identical request produces no duplicate debit', async () => {
    const idempotencyKey = 'fixed-test-key-abc-123456';

    // 1. First execution
    const res1 = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        sourceWalletId: alexWalletId,
        destinationWalletId: aliceWalletId,
        amount: 50.0,
        currency: 'USD'
      });

    expect(res1.status).toBe(201);
    const transferId = res1.body.data.transfer.id;

    // 2. Immediate duplicate replay with same Idempotency-Key
    const res2 = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        sourceWalletId: alexWalletId,
        destinationWalletId: aliceWalletId,
        amount: 50.0,
        currency: 'USD'
      });

    expect(res2.status).toBe(200);
    expect(res2.body.data.transfer.id).toBe(transferId);
    expect(res2.body.data.idempotentReplay).toBe(true);

    // Assert that Alex was debited ONLY ONCE ($51 including fee) -> $4949
    const alexBalances = memoryStore.getWalletBalances(alexWalletId);
    expect(alexBalances.total).toBe('4949.0000');
  });

  it('should safely handle concurrent transfers without double-spending or overdraft', async () => {
    // Alex starts with $5,000.
    // Fire 10 parallel transfers of $600 each (Total: $6,000 + fees, which exceeds $5,000).
    // Concurrency control must ensure only eligible transfers succeed, and total balance never becomes negative.
    const concurrentRequests = Array.from({ length: 10 }).map((_, i) =>
      request(app)
        .post('/api/v1/transfers')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', `concurrent-tx-${i}-${Date.now()}`)
        .send({
          sourceWalletId: alexWalletId,
          destinationWalletId: aliceWalletId,
          amount: 600.0,
          currency: 'USD'
        })
    );

    const results = await Promise.all(concurrentRequests);
    const succeeded = results.filter(r => r.status === 201);
    const rejected = results.filter(r => r.status === 422);

    expect(succeeded.length).toBe(8); // 8 * 601 = 4808 <= 5000. 9th would need 5409 > 5000.
    expect(rejected.length).toBe(2);

    // Final balance must be non-negative and exact: 5000 - 8*601 = 192.0000
    const finalBalance = memoryStore.getWalletBalances(alexWalletId);
    expect(finalBalance.total).toBe('192.0000');
    expect(parseFloat(finalBalance.total)).toBeGreaterThanOrEqual(0);

    // Ledger must be 100% balanced
    expect(memoryStore.verifyGlobalBalanceInvariant().isBalanced).toBe(true);
  });

  it('should reverse a completed transfer and restore customer balances and fee', async () => {
    // 1. Execute transfer
    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        sourceWalletId: alexWalletId,
        destinationWalletId: aliceWalletId,
        amount: 200.0,
        currency: 'USD'
      });
    const transferId = res.body.data.transfer.id;

    // Alex: 5000 - 201 = 4799
    expect(memoryStore.getWalletBalances(alexWalletId).total).toBe('4799.0000');

    // 2. Operations analyst reverses transfer
    const revRes = await request(app)
      .post(`/api/v1/transfers/${transferId}/reversal`)
      .set('Authorization', `Bearer ${opsToken}`);

    expect(revRes.status).toBe(200);
    expect(revRes.body.data.transfer.status).toBe('REVERSED');

    // Alex balance restored to 5000.0000
    expect(memoryStore.getWalletBalances(alexWalletId).total).toBe('5000.0000');
    // Alice balance restored to 2000.0000
    expect(memoryStore.getWalletBalances(aliceWalletId).total).toBe('2000.0000');
    // Invariant holds
    expect(memoryStore.verifyGlobalBalanceInvariant().isBalanced).toBe(true);
  });
});
