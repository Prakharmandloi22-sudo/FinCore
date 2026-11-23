import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { memoryStore, TransferRow } from '../../db/memoryStore';
import { sendSuccess, sendError } from '../../utils/response';
import { authMiddleware } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { requireRoles } from '../../middleware/rbac';
import { verifyReauthToken } from '../../utils/crypto';

const router = Router();

// Mutex lock map to simulate strict row-level lock serialization per wallet ID
const walletLocks: Map<string, Promise<void>> = new Map();

async function acquireWalletLock(walletId: string): Promise<() => void> {
  while (walletLocks.has(walletId)) {
    await walletLocks.get(walletId);
  }
  let resolver: () => void;
  const promise = new Promise<void>(resolve => {
    resolver = resolve;
  });
  walletLocks.set(walletId, promise);
  return () => {
    walletLocks.delete(walletId);
    resolver();
  };
}

const CreateTransferSchema = z.object({
  sourceWalletId: z.string().uuid(),
  destinationWalletId: z.string().uuid().optional(),
  beneficiaryId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  description: z.string().min(1).max(255).optional(),
  idempotencyKey: z.string().min(8).max(255).optional()
});

// POST /transfers (Atomic Double-Entry Transfer)
router.post('/', authMiddleware, validateBody(CreateTransferSchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const {
    sourceWalletId,
    destinationWalletId,
    beneficiaryId,
    amount,
    currency,
    description
  } = req.body;

  // 1. Idempotency Key Handling
  const idempotencyKey = req.header('Idempotency-Key') || req.body.idempotencyKey || uuidv4();
  
  const existingTransfer = Array.from(memoryStore.transfers.values()).find(
    t => t.idempotency_key === idempotencyKey
  );

  if (existingTransfer) {
    // If payload parameters differ for the same key, reject with 422
    if (
      existingTransfer.source_wallet_id !== sourceWalletId ||
      parseFloat(existingTransfer.amount) !== amount ||
      existingTransfer.currency !== currency
    ) {
      return sendError(
        res,
        'IDEMPOTENCY_PAYLOAD_MISMATCH',
        'Idempotency key reused with different transaction parameters.',
        null,
        422
      );
    }

    if (existingTransfer.status === 'PROCESSING') {
      res.setHeader('Retry-After', '2');
      return sendError(res, 'CONCURRENT_REQUEST', 'Transaction is currently processing. Retry shortly.', null, 409);
    }

    // Safe idempotent replay: return already completed transaction
    res.setHeader('Idempotent-Replay', 'true');
    return sendSuccess(res, {
      transfer: existingTransfer,
      idempotentReplay: true
    });
  }

  // 2. Sensitive Action Reauth: Transfers >= $1,000 require valid X-Reauth-Token
  if (amount >= 1000.0) {
    const reauthToken = req.header('X-Reauth-Token');
    if (!reauthToken) {
      return sendError(
        res,
        'REAUTH_REQUIRED',
        'High-value transfer (>= $1,000.00) requires step-up reauthentication. Provide valid X-Reauth-Token.',
        { threshold: 1000.0, action: 'HIGH_VALUE_TRANSFER' },
        403
      );
    }
    try {
      const decoded = verifyReauthToken(reauthToken);
      if (decoded.userId !== user.userId) {
        return sendError(res, 'REAUTH_MISMATCH', 'Reauthentication token belongs to a different session.', null, 403);
      }
    } catch {
      return sendError(res, 'REAUTH_INVALID', 'Reauthentication token is expired or invalid.', null, 403);
    }
  }

  // 3. Validate Source Wallet Ownership
  const sourceWallet = memoryStore.wallets.get(sourceWalletId);
  if (!sourceWallet) {
    return sendError(res, 'WALLET_NOT_FOUND', 'Source wallet does not exist.', null, 404);
  }
  if (user.role === 'customer' && sourceWallet.user_id !== user.userId) {
    return sendError(res, 'FORBIDDEN', 'Cannot transfer funds from a wallet you do not own.', null, 403);
  }
  if (sourceWallet.status !== 'ACTIVE') {
    return sendError(res, 'WALLET_FROZEN', `Source wallet is ${sourceWallet.status}.`, null, 403);
  }
  if (sourceWallet.currency !== currency) {
    return sendError(res, 'CURRENCY_MISMATCH', `Wallet currency (${sourceWallet.currency}) does not match transfer currency (${currency}).`, null, 422);
  }

  // 4. Resolve Destination Account
  let destAccountId: string;
  let targetWallet: any = null;

  if (destinationWalletId) {
    targetWallet = memoryStore.wallets.get(destinationWalletId);
    if (!targetWallet) {
      return sendError(res, 'DESTINATION_NOT_FOUND', 'Destination wallet does not exist.', null, 404);
    }
    if (targetWallet.currency !== currency) {
      return sendError(res, 'CURRENCY_MISMATCH', 'Destination wallet has a different currency.', null, 422);
    }
    destAccountId = targetWallet.ledger_account_id;
  } else if (beneficiaryId) {
    const beneficiary = memoryStore.beneficiaries.get(beneficiaryId);
    if (!beneficiary) {
      return sendError(res, 'BENEFICIARY_NOT_FOUND', 'Beneficiary not found.', null, 404);
    }
    // Route to system clearing account for external payment settlement
    const clearingAccount = Array.from(memoryStore.ledgerAccounts.values()).find(
      acc => acc.is_system && acc.code.includes('GATEWAY-CLEARING') && acc.currency === currency
    ) || Array.from(memoryStore.ledgerAccounts.values()).find(acc => acc.is_system && acc.type === 'ASSET');
    
    if (!clearingAccount) {
      return sendError(res, 'LEDGER_CONFIG_ERROR', 'No clearing account configured for payout.', null, 500);
    }
    destAccountId = clearingAccount.id;
  } else {
    return sendError(res, 'DESTINATION_REQUIRED', 'Either destinationWalletId or beneficiaryId must be provided.', null, 422);
  }

  // 5. Calculate Fee (Flat $1.00 if amount >= $10, otherwise $0.00)
  const feeAmount = amount >= 10.0 ? 1.0 : 0.0;
  const totalDebitRequired = amount + feeAmount;

  // 6. Concurrency Control: Acquire row lock on source wallet
  // (In multi-account transactions, sort IDs lexicographically to prevent deadlocks)
  const lockAccounts = [sourceWalletId, destinationWalletId || ''].filter(Boolean).sort();
  const unlockSource = await acquireWalletLock(lockAccounts[0]);
  let unlockDest: (() => void) | null = null;
  if (lockAccounts.length > 1) {
    unlockDest = await acquireWalletLock(lockAccounts[1]);
  }

  try {
    // Check available balance with lock held
    const balanceInfo = memoryStore.getWalletBalances(sourceWalletId);
    const available = parseFloat(balanceInfo.available);

    if (available < totalDebitRequired) {
      return sendError(
        res,
        'INSUFFICIENT_FUNDS',
        `Insufficient available funds. Required: ${totalDebitRequired.toFixed(4)} ${currency}, Available: ${available.toFixed(4)} ${currency}.`,
        { required: totalDebitRequired.toFixed(4), available: balanceInfo.available, currency },
        422
      );
    }

    const transferId = uuidv4();
    const now = new Date().toISOString();

    // 7. Atomic Double-Entry Ledger Post:
    // DEBIT Source Customer Liability Account (Amount + Fee) -> Decreases Customer Balance
    // CREDIT Destination Account (Amount) -> Increases Destination Balance
    // CREDIT Fee Revenue Account (Fee, if > 0) -> Increases Platform Revenue
    const feeAccount = Array.from(memoryStore.ledgerAccounts.values()).find(
      acc => acc.is_system && acc.code.includes('FEE-REVENUE')
    );

    const ledgerLines: Array<{ accountId: string; entrySide: 'DEBIT' | 'CREDIT'; amount: string; currency: string }> = [
      {
        accountId: sourceWallet.ledger_account_id,
        entrySide: 'DEBIT',
        amount: totalDebitRequired.toFixed(4),
        currency
      },
      {
        accountId: destAccountId,
        entrySide: 'CREDIT',
        amount: amount.toFixed(4),
        currency
      }
    ];

    if (feeAmount > 0 && feeAccount) {
      ledgerLines.push({
        accountId: feeAccount.id,
        entrySide: 'CREDIT',
        amount: feeAmount.toFixed(4),
        currency
      });
    }

    const journal = db.postJournalEntry(
      transferId,
      'TRANSFER',
      description || `Transfer ${amount.toFixed(4)} ${currency} from wallet ${sourceWalletId}`,
      ledgerLines
    );

    // 8. Record Transfer Entity
    const transferRecord: TransferRow = {
      id: transferId,
      source_wallet_id: sourceWalletId,
      destination_wallet_id: destinationWalletId || null,
      beneficiary_id: beneficiaryId || null,
      idempotency_key: idempotencyKey,
      amount: amount.toFixed(4),
      fee: feeAmount.toFixed(4),
      currency,
      status: 'COMPLETED',
      journal_entry_id: journal.id,
      reversal_journal_id: null,
      failure_reason: null,
      created_at: now,
      updated_at: now
    };
    memoryStore.transfers.set(transferId, transferRecord);

    // 9. Audit Log & Outbox Notification
    await db.recordAuditLog(
      user.userId,
      user.role,
      'TRANSFER_COMPLETED',
      'TRANSFER',
      transferId,
      req.ip,
      null,
      { amount, fee: feeAmount, currency, sourceWalletId, destinationWalletId }
    );

    // Send sandbox notification
    const notificationId = uuidv4();
    memoryStore.notifications.set(notificationId, {
      id: notificationId,
      user_id: user.userId,
      type: 'EMAIL',
      destination: user.email,
      subject: `Simulated Transfer Completed: ${amount.toFixed(2)} ${currency}`,
      body: `Your simulated transfer of ${amount.toFixed(2)} ${currency} (Fee: ${feeAmount.toFixed(2)} ${currency}) has been posted to the immutable ledger.`,
      status: 'SENT',
      sent_at: now
    });

    const updatedSourceBalance = memoryStore.getWalletBalances(sourceWalletId);

    return sendSuccess(res, {
      transfer: transferRecord,
      balances: updatedSourceBalance,
      journalEntryId: journal.id
    }, {}, 201);

  } finally {
    if (unlockDest) unlockDest();
    unlockSource();
  }
});

// GET /transfers (List user or platform transfers)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const status = req.query.status as string;
  const currency = req.query.currency as string;

  let allTransfers = Array.from(memoryStore.transfers.values());

  if (user.role === 'customer') {
    const userWalletIds = new Set(
      Array.from(memoryStore.wallets.values())
        .filter(w => w.user_id === user.userId)
        .map(w => w.id)
    );
    allTransfers = allTransfers.filter(
      t => userWalletIds.has(t.source_wallet_id) || (t.destination_wallet_id && userWalletIds.has(t.destination_wallet_id))
    );
  }

  if (status) {
    allTransfers = allTransfers.filter(t => t.status === status.toUpperCase());
  }
  if (currency) {
    allTransfers = allTransfers.filter(t => t.currency === currency.toUpperCase());
  }

  // Sort newest first
  allTransfers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return sendSuccess(res, {
    transfers: allTransfers,
    total: allTransfers.length
  });
});

// GET /transfers/:id (Details with ledger lines)
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const transfer = memoryStore.transfers.get(req.params.id);
  if (!transfer) {
    return sendError(res, 'TRANSFER_NOT_FOUND', 'Transfer not found.', null, 404);
  }

  const user = (req as any).user;
  if (user.role === 'customer') {
    const sourceWallet = memoryStore.wallets.get(transfer.source_wallet_id);
    const destWallet = transfer.destination_wallet_id ? memoryStore.wallets.get(transfer.destination_wallet_id) : null;
    if (sourceWallet?.user_id !== user.userId && destWallet?.user_id !== user.userId) {
      return sendError(res, 'FORBIDDEN', 'Access to another user\'s transfer denied.', null, 403);
    }
  }

  const journal = transfer.journal_entry_id ? memoryStore.journalEntries.get(transfer.journal_entry_id) : null;
  const lines = transfer.journal_entry_id ?
    Array.from(memoryStore.ledgerEntries.values()).filter(l => l.journal_entry_id === transfer.journal_entry_id) : [];

  return sendSuccess(res, {
    transfer,
    journalEntry: journal,
    ledgerLines: lines
  });
});

// POST /transfers/:id/reversal (Atomic Ledger Reversal)
router.post('/:id/reversal', authMiddleware, requireRoles('operations_analyst', 'finance_administrator', 'platform_administrator'), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const transfer = memoryStore.transfers.get(req.params.id);

  if (!transfer) {
    return sendError(res, 'TRANSFER_NOT_FOUND', 'Transfer not found.', null, 404);
  }
  if (transfer.status !== 'COMPLETED') {
    return sendError(res, 'CANNOT_REVERSE', `Cannot reverse transfer with status ${transfer.status}. Only COMPLETED transfers can be reversed.`, null, 400);
  }

  const sourceWallet = memoryStore.wallets.get(transfer.source_wallet_id);
  if (!sourceWallet) {
    return sendError(res, 'WALLET_NOT_FOUND', 'Original source wallet not found.', null, 404);
  }

  let destAccountId: string;
  if (transfer.destination_wallet_id) {
    const destWallet = memoryStore.wallets.get(transfer.destination_wallet_id);
    if (!destWallet) return sendError(res, 'DEST_WALLET_NOT_FOUND', 'Destination wallet not found.', null, 404);
    destAccountId = destWallet.ledger_account_id;
  } else {
    const clearingAccount = Array.from(memoryStore.ledgerAccounts.values()).find(
      acc => acc.is_system && acc.code.includes('GATEWAY-CLEARING') && acc.currency === transfer.currency
    ) || Array.from(memoryStore.ledgerAccounts.values()).find(acc => acc.is_system && acc.type === 'ASSET');
    destAccountId = clearingAccount!.id;
  }

  const feeAccount = Array.from(memoryStore.ledgerAccounts.values()).find(
    acc => acc.is_system && acc.code.includes('FEE-REVENUE')
  );

  const amount = parseFloat(transfer.amount);
  const fee = parseFloat(transfer.fee);
  const totalAmount = amount + fee;

  // Exact Reversing Ledger Entry:
  // DEBIT Destination Account (Amount) -> Decreases Destination Balance
  // DEBIT Transfer Fee Revenue Account (Fee, if > 0) -> Decreases Platform Revenue
  // CREDIT Source Customer Liability Account (Amount + Fee) -> Restores Customer Balance
  const reversingLines: Array<{ accountId: string; entrySide: 'DEBIT' | 'CREDIT'; amount: string; currency: string }> = [
    {
      accountId: destAccountId,
      entrySide: 'DEBIT',
      amount: amount.toFixed(4),
      currency: transfer.currency
    },
    {
      accountId: sourceWallet.ledger_account_id,
      entrySide: 'CREDIT',
      amount: totalAmount.toFixed(4),
      currency: transfer.currency
    }
  ];

  if (fee > 0 && feeAccount) {
    reversingLines.push({
      accountId: feeAccount.id,
      entrySide: 'DEBIT',
      amount: fee.toFixed(4),
      currency: transfer.currency
    });
  }

  const reversalJournal = db.postJournalEntry(
    `REV-${transfer.id}`,
    'REVERSAL',
    `Reversal of transfer ${transfer.id} approved by ${user.role} ${user.email}`,
    reversingLines
  );

  transfer.status = 'REVERSED';
  transfer.reversal_journal_id = reversalJournal.id;
  transfer.updated_at = new Date().toISOString();

  await db.recordAuditLog(
    user.userId,
    user.role,
    'TRANSFER_REVERSED',
    'TRANSFER',
    transfer.id,
    req.ip,
    { status: 'COMPLETED' },
    { status: 'REVERSED', reversalJournalId: reversalJournal.id }
  );

  return sendSuccess(res, {
    message: 'Transfer successfully reversed on ledger.',
    transfer,
    reversalJournalId: reversalJournal.id
  });
});

export default router;

