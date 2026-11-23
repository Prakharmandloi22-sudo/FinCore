import request from 'supertest';
import { app } from '../src/app';
import { memoryStore } from '../src/db/memoryStore';
import { signWebhookPayload } from '../src/utils/crypto';
import { config } from '../src/config';

describe('Assessment 08 & 12: Payment Integrations, Signed Webhooks & Deduplication Suite', () => {
  let customerToken: string;
  let alexWalletId: string;

  beforeEach(async () => {
    memoryStore.reset();
    const loginAlex = await request(app).post('/api/v1/auth/login').send({ email: 'customer@fincore.local', password: 'Password123!' });
    const mfaAlex = await request(app).post('/api/v1/auth/mfa/verify').send({ userId: loginAlex.body.data.userId, code: '123456' });
    customerToken = mfaAlex.body.data.tokens.accessToken;
    alexWalletId = '33333333-3333-3333-3333-333333333001';
  });

  it('should create and confirm a payment intent, crediting wallet on ledger', async () => {
    // 1. Create payment intent
    const createRes = await request(app)
      .post('/api/v1/payments/intents')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        walletId: alexWalletId,
        amount: 300.0,
        currency: 'USD',
        paymentMethodType: 'CARD'
      });

    expect(createRes.status).toBe(201);
    const intentId = createRes.body.data.paymentIntent.id;

    // 2. Confirm payment intent
    const confirmRes = await request(app)
      .post(`/api/v1/payments/intents/${intentId}/confirm`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.paymentIntent.status).toBe('SUCCEEDED');

    // Balance should have increased from 5000 to 5300
    const alexBalances = memoryStore.getWalletBalances(alexWalletId);
    expect(alexBalances.total).toBe('5300.0000');
    expect(memoryStore.verifyGlobalBalanceInvariant().isBalanced).toBe(true);
  });

  it('should verify signed webhooks and reject invalid/tampered signatures', async () => {
    const payload = {
      id: 'evt_test_12345',
      type: 'charge.succeeded',
      data: { object: { id: 'pi_test_001', amount: 5000 } }
    };
    const rawBody = JSON.stringify(payload);

    // 1. Unsigned or invalid signature rejected
    const badRes = await request(app)
      .post('/api/v1/payments/webhook')
      .set('fin-signature', 't=123456,v1=tampered_signature_hex')
      .send(payload);

    expect(badRes.status).toBe(400);
    expect(badRes.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');

    // 2. Valid HMAC SHA-256 signature accepted
    const { signature } = signWebhookPayload(rawBody, config.payments.webhookSecret);
    const goodRes = await request(app)
      .post('/api/v1/payments/webhook')
      .set('fin-signature', signature)
      .send(payload);

    expect(goodRes.status).toBe(200);
    expect(goodRes.body.data.received).toBe(true);
    expect(goodRes.body.data.deduplicated).toBe(false);
  });

  it('should deduplicate provider webhook events on replay without double crediting', async () => {
    const payload = {
      id: 'evt_payment_unique_9999',
      type: 'charge.succeeded',
      data: { object: { id: 'pi_test_002', amount: 1000 } }
    };
    const rawBody = JSON.stringify(payload);
    const { signature } = signWebhookPayload(rawBody, config.payments.webhookSecret);

    // First arrival
    const res1 = await request(app)
      .post('/api/v1/payments/webhook')
      .set('fin-signature', signature)
      .send(payload);
    expect(res1.status).toBe(200);
    expect(res1.body.data.deduplicated).toBe(false);

    // Duplicate replay arrival
    const res2 = await request(app)
      .post('/api/v1/payments/webhook')
      .set('fin-signature', signature)
      .send(payload);
    expect(res2.status).toBe(200);
    expect(res2.body.data.deduplicated).toBe(true);
    expect(res2.body.data.status).toBe('DUPLICATE_IGNORED');

    // Assert only one webhook event record stored
    const events = Array.from(memoryStore.webhookEvents.values()).filter(e => e.provider_event_id === 'evt_payment_unique_9999');
    expect(events.length).toBe(1);
  });
});

