import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { memoryStore, DisputeRow } from '../../db/memoryStore';
import { sendSuccess, sendError } from '../../utils/response';
import { authMiddleware } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { requireRoles } from '../../middleware/rbac';

const router = Router();

const CreateDisputeSchema = z.object({
  transferId: z.string().uuid(),
  reason: z.string().min(3),
  description: z.string().min(10),
  evidence: z.array(z.string()).optional()
});

const ResolveDisputeSchema = z.object({
  resolution: z.enum(['ACCEPTED', 'REJECTED']),
  resolutionNotes: z.string().min(5)
});

// POST /disputes (Customer raises dispute on completed transfer)
router.post('/', authMiddleware, validateBody(CreateDisputeSchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { transferId, reason, description, evidence } = req.body;

  const transfer = memoryStore.transfers.get(transferId);
  if (!transfer) {
    return sendError(res, 'TRANSFER_NOT_FOUND', 'Transfer not found.', null, 404);
  }
  if (transfer.status !== 'COMPLETED') {
    return sendError(res, 'CANNOT_DISPUTE', 'Only COMPLETED transfers can be disputed.', null, 400);
  }

  // Check if dispute already exists
  const existingDispute = Array.from(memoryStore.disputes.values()).find(d => d.transfer_id === transferId);
  if (existingDispute) {
    return sendError(res, 'DISPUTE_EXISTS', 'A dispute is already open for this transfer.', { disputeId: existingDispute.id }, 409);
  }

  const disputeId = uuidv4();
  const now = new Date().toISOString();

  const dispute: DisputeRow = {
    id: disputeId,
    transfer_id: transferId,
    claimant_id: user.userId,
    amount: transfer.amount,
    currency: transfer.currency,
    reason,
    description,
    status: 'OPEN',
    evidence: evidence || [],
    resolved_by: null,
    resolution_notes: null,
    reversal_journal_id: null,
    created_at: now,
    updated_at: now
  };

  memoryStore.disputes.set(disputeId, dispute);
  await db.recordAuditLog(user.userId, user.role, 'DISPUTE_FILED', 'DISPUTE', disputeId, req.ip, null, { transferId, reason });

  return sendSuccess(res, { dispute }, {}, 201);
});

// GET /disputes
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  let disputes = Array.from(memoryStore.disputes.values());

  if (user.role === 'customer') {
    disputes = disputes.filter(d => d.claimant_id === user.userId);
  }

  disputes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return sendSuccess(res, { disputes, total: disputes.length });
});

// GET /disputes/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const dispute = memoryStore.disputes.get(req.params.id);

  if (!dispute) {
    return sendError(res, 'DISPUTE_NOT_FOUND', 'Dispute not found.', null, 404);
  }
  if (user.role === 'customer' && dispute.claimant_id !== user.userId) {
    return sendError(res, 'FORBIDDEN', 'Access to dispute denied.', null, 403);
  }

  const transfer = memoryStore.transfers.get(dispute.transfer_id);
  return sendSuccess(res, { dispute, transfer });
});

// POST /disputes/:id/resolve (Operations Analyst or Support resolves dispute)
router.post('/:id/resolve', authMiddleware, requireRoles('operations_analyst', 'support_agent', 'platform_administrator'), validateBody(ResolveDisputeSchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const dispute = memoryStore.disputes.get(req.params.id);

  if (!dispute) {
    return sendError(res, 'DISPUTE_NOT_FOUND', 'Dispute not found.', null, 404);
  }
  if (dispute.status === 'ACCEPTED' || dispute.status === 'REJECTED') {
    return sendError(res, 'DISPUTE_CLOSED', `Dispute is already resolved as ${dispute.status}.`, null, 400);
  }

  const { resolution, resolutionNotes } = req.body;
  const transfer = memoryStore.transfers.get(dispute.transfer_id);

  if (!transfer) {
    return sendError(res, 'TRANSFER_NOT_FOUND', 'Linked transfer not found.', null, 404);
  }

  let reversalJournalId: string | null = null;

  // If dispute is ACCEPTED, execute atomic ledger reversal
  if (resolution === 'ACCEPTED') {
    const sourceWallet = memoryStore.wallets.get(transfer.source_wallet_id);
    let destAccountId: string;
    if (transfer.destination_wallet_id) {
      const destWallet = memoryStore.wallets.get(transfer.destination_wallet_id);
      destAccountId = destWallet!.ledger_account_id;
    } else {
      const clearing = Array.from(memoryStore.ledgerAccounts.values()).find(a => a.is_system && a.type === 'ASSET');
      destAccountId = clearing!.id;
    }

    const journal = db.postJournalEntry(
      `DISPUTE-REV-${dispute.id}`,
      'DISPUTE_ADJUSTMENT',
      `Chargeback refund for dispute ${dispute.id} on transfer ${transfer.id}`,
      [
        { accountId: destAccountId, entrySide: 'DEBIT', amount: transfer.amount, currency: transfer.currency },
        { accountId: sourceWallet!.ledger_account_id, entrySide: 'CREDIT', amount: transfer.amount, currency: transfer.currency }
      ]
    );

    reversalJournalId = journal.id;
    transfer.status = 'REVERSED';
    transfer.reversal_journal_id = journal.id;
  }

  dispute.status = resolution;
  dispute.resolved_by = user.userId;
  dispute.resolution_notes = resolutionNotes;
  dispute.reversal_journal_id = reversalJournalId;
  dispute.updated_at = new Date().toISOString();

  await db.recordAuditLog(user.userId, user.role, 'DISPUTE_RESOLVED', 'DISPUTE', dispute.id, req.ip, null, {
    resolution,
    reversalJournalId,
    notes: resolutionNotes
  });

  return sendSuccess(res, {
    message: `Dispute successfully marked ${resolution}.`,
    dispute,
    transferStatus: transfer.status,
    reversalJournalId
  });
});

export default router;

