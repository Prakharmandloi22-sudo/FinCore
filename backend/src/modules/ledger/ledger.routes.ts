import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { memoryStore, HoldRow } from '../../db/memoryStore';
import { sendSuccess, sendError } from '../../utils/response';
import { authMiddleware } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';

const router = Router();

const CreateHoldSchema = z.object({
  walletId: z.string().uuid(),
  amount: z.number().positive(),
  referenceId: z.string().min(1),
  durationMinutes: z.number().positive().default(60)
});

// GET /ledger/accounts (Chart of Accounts with live calculated balances)
router.get('/accounts', authMiddleware, requireRoles('finance_administrator', 'platform_administrator', 'operations_analyst'), async (req: Request, res: Response) => {
  const accounts = Array.from(memoryStore.ledgerAccounts.values()).map(acc => {
    const balance = memoryStore.calculateAccountBalance(acc.id);
    return {
      ...acc,
      currentBalance: balance
    };
  });

  return sendSuccess(res, { accounts, count: accounts.length });
});

// GET /ledger/journals (List all Journal Entries and their immutable ledger lines)
router.get('/journals', authMiddleware, requireRoles('finance_administrator', 'platform_administrator', 'operations_analyst'), async (req: Request, res: Response) => {
  const journals = Array.from(memoryStore.journalEntries.values());
  journals.sort((a, b) => b.entry_number - a.entry_number);

  const enrichedJournals = journals.map(j => {
    const lines = Array.from(memoryStore.ledgerEntries.values()).filter(l => l.journal_entry_id === j.id);
    return {
      ...j,
      lines: lines.map(l => {
        const acc = memoryStore.ledgerAccounts.get(l.account_id);
        return {
          ...l,
          accountCode: acc?.code,
          accountName: acc?.name,
          accountType: acc?.type
        };
      })
    };
  });

  return sendSuccess(res, { journals: enrichedJournals, count: enrichedJournals.length });
});

// GET /ledger/verify-invariants (Global Double-Entry Invariant Audit)
router.get('/verify-invariants', authMiddleware, async (req: Request, res: Response) => {
  const invariant = db.verifyGlobalBalanceInvariant();
  return sendSuccess(res, {
    auditTimestamp: new Date().toISOString(),
    globalInvariantResult: invariant,
    status: invariant.isBalanced ? 'PASS' : 'FAIL',
    rule: 'SUM(ALL_DEBITS) - SUM(ALL_CREDITS) === 0.0000 across immutable ledger_entries'
  });
});

// POST /ledger/holds (Create balance hold)
router.post('/holds', authMiddleware, validateBody(CreateHoldSchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { walletId, amount, referenceId, durationMinutes } = req.body;

  const wallet = memoryStore.wallets.get(walletId);
  if (!wallet) return sendError(res, 'WALLET_NOT_FOUND', 'Wallet not found.', null, 404);

  const balances = memoryStore.getWalletBalances(walletId);
  if (parseFloat(balances.available) < amount) {
    return sendError(res, 'INSUFFICIENT_FUNDS_FOR_HOLD', 'Available balance is insufficient for hold reservation.', { available: balances.available, amount }, 422);
  }

  const holdId = uuidv4();
  const expiresAt = new Date(Date.now() + durationMinutes * 60000).toISOString();

  const hold: HoldRow = {
    id: holdId,
    wallet_id: walletId,
    reference_id: referenceId,
    amount: amount.toFixed(4),
    status: 'ACTIVE',
    expires_at: expiresAt,
    created_at: new Date().toISOString()
  };

  memoryStore.holds.set(holdId, hold);
  await db.recordAuditLog(user.userId, user.role, 'HOLD_CREATED', 'HOLD', holdId, req.ip, null, { amount, expiresAt });

  return sendSuccess(res, { hold, balances: memoryStore.getWalletBalances(walletId) }, {}, 201);
});

// POST /ledger/holds/:id/release (Release balance hold)
router.post('/holds/:id/release', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const hold = memoryStore.holds.get(req.params.id);

  if (!hold) return sendError(res, 'HOLD_NOT_FOUND', 'Hold not found.', null, 404);
  if (hold.status !== 'ACTIVE') return sendError(res, 'HOLD_INACTIVE', `Hold is already ${hold.status}.`, null, 400);

  hold.status = 'RELEASED';
  await db.recordAuditLog(user.userId, user.role, 'HOLD_RELEASED', 'HOLD', hold.id, req.ip);

  return sendSuccess(res, {
    message: 'Hold released successfully.',
    hold,
    balances: memoryStore.getWalletBalances(hold.wallet_id)
  });
});

export default router;

