import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { memoryStore, PaymentIntentRow, WebhookEventRow } from '../../db/memoryStore';
import { sendSuccess, sendError } from '../../utils/response';
import { authMiddleware } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { verifyWebhookSignature, signWebhookPayload } from '../../utils/crypto';
import { config } from '../../config';

const router = Router();

const CreateIntentSchema = z.object({
  walletId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  paymentMethodType: z.enum(['CARD', 'ACH', 'INSTANT']).default('CARD'),
  idempotencyKey: z.string().min(8).optional()
});

const ConfirmIntentSchema = z.object({
  paymentMethodDetails: z.object({
    cardNumber: z.string().optional(),
    cvv: z.string().optional()
  }).optional()
});

const RefundSchema = z.object({
  paymentIntentId: z.string().uuid(),
  reason: z.string().min(3)
});

// POST /payments/intents
router.post('/intents', authMiddleware, validateBody(CreateIntentSchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { walletId, amount, currency, paymentMethodType } = req.body;
  const idempotencyKey = req.header('Idempotency-Key') || req.body.idempotencyKey || uuidv4();

  const existing = Array.from(memoryStore.paymentIntents.values()).find(
    pi => pi.idempotency_key === idempotencyKey
  );
  if (existing) {
    return sendSuccess(res, { paymentIntent: existing, idempotentReplay: true });
  }

  const wallet = memoryStore.wallets.get(walletId);
  if (!wallet) {
    return sendError(res, 'WALLET_NOT_FOUND', 'Target wallet not found.', null, 404);
  }
  if (user.role === 'customer' && wallet.user_id !== user.userId) {
    return sendError(res, 'FORBIDDEN', 'Cannot deposit to another customer\'s wallet.', null, 403);
  }

  const intentId = uuidv4();
  const providerIntentId = `pi_mock_${uuidv4().substring(0, 16)}`;
  const now = new Date().toISOString();

  const intent: PaymentIntentRow = {
    id: intentId,
    user_id: user.userId,
    wallet_id: walletId,
    amount: amount.toFixed(4),
    currency,
    status: 'REQUIRES_PAYMENT_METHOD',
    provider_intent_id: providerIntentId,
    idempotency_key: idempotencyKey,
    payment_method_type: paymentMethodType,
    journal_entry_id: null,
    created_at: now,
    updated_at: now
  };

  memoryStore.paymentIntents.set(intentId, intent);
  await db.recordAuditLog(user.userId, user.role, 'PAYMENT_INTENT_CREATED', 'PAYMENT_INTENT', intentId, req.ip, null, { amount, currency });

  return sendSuccess(res, { paymentIntent: intent }, {}, 201);
});

// POST /payments/intents/:id/confirm (Simulate checkout confirmation)
router.post('/intents/:id/confirm', authMiddleware, validateBody(ConfirmIntentSchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const intent = memoryStore.paymentIntents.get(req.params.id);

  if (!intent) {
    return sendError(res, 'INTENT_NOT_FOUND', 'Payment intent not found.', null, 404);
  }
  if (intent.status === 'SUCCEEDED') {
    return sendSuccess(res, { paymentIntent: intent, message: 'Intent already confirmed.' });
  }
  if (intent.status !== 'REQUIRES_PAYMENT_METHOD' && intent.status !== 'PROCESSING') {
    return sendError(res, 'INVALID_INTENT_STATUS', `Cannot confirm intent in state ${intent.status}.`, null, 400);
  }

  intent.status = 'PROCESSING';
  const wallet = memoryStore.wallets.get(intent.wallet_id);
  if (!wallet) {
    return sendError(res, 'WALLET_NOT_FOUND', 'Wallet not found.', null, 404);
  }

  // Find clearing account
  const clearingAccount = Array.from(memoryStore.ledgerAccounts.values()).find(
    acc => acc.is_system && acc.code.includes('GATEWAY-CLEARING') && acc.currency === intent.currency
  ) || Array.from(memoryStore.ledgerAccounts.values()).find(acc => acc.is_system && acc.type === 'ASSET');

  // Atomic Double-Entry Ledger Post:
  // DEBIT Payment Clearing Asset Account (Amount)
  // CREDIT Customer Wallet Liability Account (Amount)
  const journal = db.postJournalEntry(
    intent.id,
    'DEPOSIT',
    `Payment gateway deposit intent ${intent.provider_intent_id} via ${intent.payment_method_type}`,
    [
      { accountId: clearingAccount!.id, entrySide: 'DEBIT', amount: intent.amount, currency: intent.currency },
      { accountId: wallet.ledger_account_id, entrySide: 'CREDIT', amount: intent.amount, currency: intent.currency }
    ]
  );

  intent.status = 'SUCCEEDED';
  intent.journal_entry_id = journal.id;
  intent.updated_at = new Date().toISOString();

  await db.recordAuditLog(user.userId, user.role, 'PAYMENT_INTENT_SUCCEEDED', 'PAYMENT_INTENT', intent.id, req.ip, null, { journalId: journal.id });

  return sendSuccess(res, {
    paymentIntent: intent,
    journalEntryId: journal.id,
    balances: memoryStore.getWalletBalances(wallet.id)
  });
});

// POST /payments/webhook (Signed provider webhook receiver with deduplication)
router.post('/webhook', async (req: Request, res: Response) => {
  const signatureHeader = req.header('fin-signature') || req.header('stripe-signature') || '';
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // 1. Signature Verification
  const isValidSig = verifyWebhookSignature(rawBody, signatureHeader, config.payments.webhookSecret);
  if (!isValidSig) {
    return sendError(res, 'INVALID_WEBHOOK_SIGNATURE', 'HMAC SHA-256 signature verification failed.', null, 400);
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const eventId = event.id || event.eventId || event.provider_event_id;

  if (!eventId) {
    return sendError(res, 'MALFORMED_WEBHOOK', 'Missing event id in webhook body.', null, 400);
  }

  // 2. Event Deduplication: Ensure duplicate webhooks never execute twice
  const existingEvent = Array.from(memoryStore.webhookEvents.values()).find(
    e => e.provider_event_id === eventId
  );

  if (existingEvent) {
    return sendSuccess(res, {
      received: true,
      deduplicated: true,
      status: 'DUPLICATE_IGNORED',
      message: 'Provider event already processed. Duplicate ignored safely without duplicate ledger credit.'
    });
  }

  const webhookRow: WebhookEventRow = {
    id: uuidv4(),
    provider_event_id: eventId,
    event_type: event.type || 'payment.succeeded',
    payload: event,
    status: 'PROCESSED',
    signature: signatureHeader,
    received_at: new Date().toISOString()
  };
  memoryStore.webhookEvents.set(webhookRow.id, webhookRow);

  // 3. Process business event
  if (event.type === 'payment_intent.succeeded' && event.data?.object) {
    const obj = event.data.object;
    const intent = Array.from(memoryStore.paymentIntents.values()).find(
      pi => pi.provider_intent_id === obj.id || pi.id === obj.id
    );

    if (intent && intent.status !== 'SUCCEEDED') {
      const wallet = memoryStore.wallets.get(intent.wallet_id);
      if (wallet) {
        const clearing = Array.from(memoryStore.ledgerAccounts.values()).find(acc => acc.is_system && acc.type === 'ASSET');
        const journal = db.postJournalEntry(
          intent.id,
          'DEPOSIT',
          `Webhook confirmed deposit ${intent.provider_intent_id}`,
          [
            { accountId: clearing!.id, entrySide: 'DEBIT', amount: intent.amount, currency: intent.currency },
            { accountId: wallet.ledger_account_id, entrySide: 'CREDIT', amount: intent.amount, currency: intent.currency }
          ]
        );
        intent.status = 'SUCCEEDED';
        intent.journal_entry_id = journal.id;
        intent.updated_at = new Date().toISOString();
      }
    }
  }

  await db.recordAuditLog(null, 'SYSTEM', 'WEBHOOK_PROCESSED', 'WEBHOOK_EVENT', eventId, req.ip, null, { type: event.type });

  return sendSuccess(res, {
    received: true,
    deduplicated: false,
    status: 'PROCESSED'
  });
});

// POST /payments/simulate-webhook (Utility for tests & demos to generate properly signed mock webhooks)
router.post('/simulate-webhook', async (req: Request, res: Response) => {
  const payload = req.body;
  const { signature } = signWebhookPayload(payload, config.payments.webhookSecret);
  return sendSuccess(res, {
    payload,
    signatureHeader: signature,
    hint: 'Use this signature in the fin-signature header when calling /api/v1/payments/webhook'
  });
});

// POST /payments/refunds (Refund payment intent)
router.post('/refunds', authMiddleware, validateBody(RefundSchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { paymentIntentId, reason } = req.body;
  const intent = memoryStore.paymentIntents.get(paymentIntentId);

  if (!intent) {
    return sendError(res, 'INTENT_NOT_FOUND', 'Payment intent not found.', null, 404);
  }
  if (intent.status !== 'SUCCEEDED') {
    return sendError(res, 'CANNOT_REFUND', 'Only SUCCEEDED payment intents can be refunded.', null, 400);
  }

  const wallet = memoryStore.wallets.get(intent.wallet_id);
  if (!wallet) {
    return sendError(res, 'WALLET_NOT_FOUND', 'Associated wallet not found.', null, 404);
  }

  const clearing = Array.from(memoryStore.ledgerAccounts.values()).find(acc => acc.is_system && acc.type === 'ASSET');

  // Reversing Journal Entry:
  // DEBIT Customer Wallet Liability Account (Amount) -> Decreases Customer Balance
  // CREDIT Payment Clearing Asset Account (Amount)
  const refundJournal = db.postJournalEntry(
    `REF-${intent.id}`,
    'REVERSAL',
    `Refund of payment intent ${intent.id}: ${reason}`,
    [
      { accountId: wallet.ledger_account_id, entrySide: 'DEBIT', amount: intent.amount, currency: intent.currency },
      { accountId: clearing!.id, entrySide: 'CREDIT', amount: intent.amount, currency: intent.currency }
    ]
  );

  intent.status = 'CANCELED';
  intent.updated_at = new Date().toISOString();

  await db.recordAuditLog(user.userId, user.role, 'PAYMENT_INTENT_REFUNDED', 'PAYMENT_INTENT', intent.id, req.ip, null, { refundJournalId: refundJournal.id });

  return sendSuccess(res, {
    message: 'Payment intent refunded and ledger reversed.',
    paymentIntent: intent,
    refundJournalId: refundJournal.id,
    balances: memoryStore.getWalletBalances(wallet.id)
  });
});

export default router;
