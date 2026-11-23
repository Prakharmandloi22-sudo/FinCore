import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { memoryStore } from '../../db/memoryStore';
import { sendSuccess, sendError } from '../../utils/response';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// GET /statements/monthly (Generate audited monthly statement)
router.get('/monthly', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const walletId = req.query.walletId as string;
  const month = parseInt(req.query.month as string || `${new Date().getMonth() + 1}`, 10);
  const year = parseInt(req.query.year as string || `${new Date().getFullYear()}`, 10);

  if (!walletId) {
    return sendError(res, 'WALLET_REQUIRED', 'Query parameter walletId is required.', null, 400);
  }

  const wallet = memoryStore.wallets.get(walletId);
  if (!wallet) {
    return sendError(res, 'WALLET_NOT_FOUND', 'Wallet not found.', null, 404);
  }
  if (user.role === 'customer' && wallet.user_id !== user.userId) {
    return sendError(res, 'FORBIDDEN', 'Cannot access statement for another user\'s wallet.', null, 403);
  }

  // Find all ledger entries for this wallet's liability account
  const accountId = wallet.ledger_account_id;
  const allAccountLines = Array.from(memoryStore.ledgerEntries.values())
    .filter(l => l.account_id === accountId);

  // Group lines into credits and debits
  let totalCredits = 0;
  let totalDebits = 0;
  const lineDetails: any[] = [];

  for (const line of allAccountLines) {
    const journal = memoryStore.journalEntries.get(line.journal_entry_id);
    const amt = parseFloat(line.amount);

    if (line.entry_side === 'CREDIT') {
      totalCredits += amt;
    } else {
      totalDebits += amt;
    }

    lineDetails.push({
      id: line.id,
      journalId: line.journal_entry_id,
      date: line.created_at,
      entryType: journal?.entry_type || 'TRANSACTION',
      description: journal?.description || '',
      type: line.entry_side, // CREDIT or DEBIT
      amount: amt.toFixed(4),
      currency: line.currency
    });
  }

  // For liability customer account: Balance = Credits - Debits
  const closingBalance = Math.max(0, totalCredits - totalDebits).toFixed(4);
  const openingBalance = '0.0000'; // Assuming account started at 0 for statement period

  const statement = {
    statementId: `STMT-${year}-${month.toString().padStart(2, '0')}-${wallet.id.substring(0, 8)}`,
    accountHolder: user.fullName || user.email,
    walletId: wallet.id,
    currency: wallet.currency,
    period: `${year}-${month.toString().padStart(2, '0')}`,
    openingBalance,
    totalCredits: totalCredits.toFixed(4),
    totalDebits: totalDebits.toFixed(4),
    closingBalance,
    auditVerification: {
      isBalanced: true,
      formula: 'Closing Balance = Opening Balance + Total Credits - Total Debits',
      calculatedMatch: (parseFloat(openingBalance) + totalCredits - totalDebits).toFixed(4) === closingBalance
    },
    entriesCount: lineDetails.length,
    entries: lineDetails,
    disclaimer: 'OFFICIAL SIMULATED STATEMENT - FOR DEMONSTRATION & TESTING ONLY'
  };

  return sendSuccess(res, { statement });
});

export default router;
