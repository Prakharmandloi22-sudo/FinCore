import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { memoryStore } from '../../db/memoryStore';
import { sendSuccess, sendError } from '../../utils/response';
import { authMiddleware } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';

const router = Router();

const CreateWalletSchema = z.object({
  currency: z.enum(['USD', 'EUR', 'GBP'])
});

const SimulateDepositSchema = z.object({
  amount: z.number().positive(),
  description: z.string().optional()
});

// GET /wallets (User wallets with exact ledger and available balance)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userWallets = Array.from(memoryStore.wallets.values()).filter(w => w.user_id === user.userId);

  const enrichedWallets = userWallets.map(wallet => {
    const balanceInfo = memoryStore.getWalletBalances(wallet.id);
    return {
      id: wallet.id,
      currency: wallet.currency,
      status: wallet.status,
      ledgerAccountId: wallet.ledger_account_id,
      balances: {
        total: balanceInfo.total,
        held: balanceInfo.held,
        available: balanceInfo.available,
        disclaimer: 'SIMULATED FUNDS ONLY - NO REAL BANKING CREDENTIALS OR VALUE'
      },
      createdAt: wallet.created_at
    };
  });

  return sendSuccess(res, { wallets: enrichedWallets });
});

// GET /wallets/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const wallet = memoryStore.wallets.get(req.params.id);

  if (!wallet) {
    return sendError(res, 'WALLET_NOT_FOUND', 'Requested wallet was not found.', null, 404);
  }

  // Role check: customer can only view own wallet
  if (user.role === 'customer' && wallet.user_id !== user.userId) {
    return sendError(res, 'FORBIDDEN', 'Cannot access another user\'s wallet.', null, 403);
  }

  const balanceInfo = memoryStore.getWalletBalances(wallet.id);
  return sendSuccess(res, {
    wallet: {
      id: wallet.id,
      userId: wallet.user_id,
      currency: wallet.currency,
      status: wallet.status,
      ledgerAccountId: wallet.ledger_account_id,
      balances: balanceInfo,
      createdAt: wallet.created_at
    }
  });
});

// POST /wallets/create (create additional currency wallet)
router.post('/create', authMiddleware, validateBody(CreateWalletSchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { currency } = req.body;

  const existing = Array.from(memoryStore.wallets.values()).find(
    w => w.user_id === user.userId && w.currency === currency
  );
  if (existing) {
    return sendError(res, 'WALLET_EXISTS', `A ${currency} wallet already exists for this account.`, null, 409);
  }

  const now = new Date().toISOString();
  const accountId = uuidv4();
  const walletId = uuidv4();
  const userRecord = memoryStore.users.get(user.userId);
  const accountCode = `2000-CUST-${user.userId.substring(0, 8).toUpperCase()}-${currency}`;

  // 1. Create Ledger Account
  memoryStore.ledgerAccounts.set(accountId, {
    id: accountId,
    code: accountCode,
    name: `${userRecord?.full_name || 'Customer'} Deposit Liability ${currency}`,
    type: 'LIABILITY',
    currency,
    is_system: false,
    status: 'ACTIVE',
    created_at: now
  });

  // 2. Create Wallet
  const newWallet = {
    id: walletId,
    user_id: user.userId,
    currency,
    status: 'ACTIVE',
    ledger_account_id: accountId,
    created_at: now,
    updated_at: now
  };
  memoryStore.wallets.set(walletId, newWallet);

  await db.recordAuditLog(user.userId, user.role, 'WALLET_CREATED', 'WALLET', walletId, req.ip, null, { currency });

  return sendSuccess(res, {
    wallet: {
      id: walletId,
      currency,
      status: 'ACTIVE',
      balances: { total: '0.0000', held: '0.0000', available: '0.0000' }
    }
  }, {}, 201);
});

// POST /wallets/:id/deposit-simulate (Sandbox simulated deposit creating balanced double-entry)
router.post('/:id/deposit-simulate', authMiddleware, validateBody(SimulateDepositSchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const wallet = memoryStore.wallets.get(req.params.id);

  if (!wallet) {
    return sendError(res, 'WALLET_NOT_FOUND', 'Wallet not found.', null, 404);
  }

  if (user.role === 'customer' && wallet.user_id !== user.userId) {
    return sendError(res, 'FORBIDDEN', 'Cannot deposit into another customer\'s wallet.', null, 403);
  }

  const amount = req.body.amount;
  const formattedAmount = amount.toFixed(4);

  // Find system cash reserve account for this currency
  const reserveAccount = Array.from(memoryStore.ledgerAccounts.values()).find(
    acc => acc.is_system && acc.type === 'ASSET' && acc.currency === wallet.currency
  );
  if (!reserveAccount) {
    return sendError(res, 'LEDGER_CONFIG_ERROR', `No system reserve account found for ${wallet.currency}`, null, 500);
  }

  // Atomically post balanced double-entry deposit:
  // DEBIT Asset Cash Reserve (Increases Asset)
  // CREDIT Customer Deposit Liability (Increases Customer Balance)
  const journal = db.postJournalEntry(
    `SIM-DEP-${uuidv4().substring(0, 8)}`,
    'DEPOSIT',
    req.body.description || `Simulated sandbox deposit to wallet ${wallet.id}`,
    [
      { accountId: reserveAccount.id, entrySide: 'DEBIT', amount: formattedAmount, currency: wallet.currency },
      { accountId: wallet.ledger_account_id, entrySide: 'CREDIT', amount: formattedAmount, currency: wallet.currency }
    ]
  );

  const updatedBalances = memoryStore.getWalletBalances(wallet.id);
  await db.recordAuditLog(user.userId, user.role, 'SIMULATED_DEPOSIT', 'WALLET', wallet.id, req.ip, null, { amount: formattedAmount, journalId: journal.id });

  return sendSuccess(res, {
    message: 'Simulated funds successfully credited via double-entry journal entry.',
    journalId: journal.id,
    balances: updatedBalances
  });
});

export default router;
