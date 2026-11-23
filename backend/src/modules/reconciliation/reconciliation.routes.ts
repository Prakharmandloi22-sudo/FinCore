import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { memoryStore, SettlementRow } from '../../db/memoryStore';
import { sendSuccess, sendError } from '../../utils/response';
import { authMiddleware } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';

const router = Router();

const RunReconciliationSchema = z.object({
  batchId: z.string().min(3),
  providerId: z.string().min(3),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  externalSettlementRecords: z.array(z.object({
    referenceId: z.string(),
    providerEventId: z.string(),
    amount: z.number().positive(),
    fee: z.number().nonnegative(),
    net: z.number().positive(),
    status: z.string()
  }))
});

// GET /reconciliation/batches
router.get('/batches', authMiddleware, requireRoles('operations_analyst', 'finance_administrator', 'platform_administrator'), async (req: Request, res: Response) => {
  const settlements = Array.from(memoryStore.settlements.values());
  return sendSuccess(res, { settlements, total: settlements.length });
});

// POST /reconciliation/run
router.post('/run', authMiddleware, requireRoles('operations_analyst', 'finance_administrator', 'platform_administrator'), validateBody(RunReconciliationSchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { batchId, providerId, currency, externalSettlementRecords } = req.body;

  // Gather internal completed transfers/intents matching batch
  const internalTransfers = Array.from(memoryStore.transfers.values()).filter(t => t.currency === currency && t.status === 'COMPLETED');
  const internalIntents = Array.from(memoryStore.paymentIntents.values()).filter(pi => pi.currency === currency && pi.status === 'SUCCEEDED');

  const internalMap = new Map<string, number>();
  internalTransfers.forEach(t => internalMap.set(t.id, parseFloat(t.amount)));
  internalIntents.forEach(pi => {
    internalMap.set(pi.id, parseFloat(pi.amount));
    if (pi.provider_intent_id) internalMap.set(pi.provider_intent_id, parseFloat(pi.amount));
  });

  let matchedCount = 0;
  let discrepancyCount = 0;
  let totalProviderVolume = 0;
  let totalInternalVolume = 0;
  const reconciliationItems: any[] = [];

  for (const ext of externalSettlementRecords) {
    totalProviderVolume += ext.net;
    const internalAmt = internalMap.get(ext.referenceId);

    if (internalAmt !== undefined) {
      totalInternalVolume += internalAmt;
      const variance = Math.abs(internalAmt - ext.amount);
      if (variance < 0.0001) {
        matchedCount++;
        reconciliationItems.push({
          referenceId: ext.referenceId,
          status: 'MATCHED',
          internalAmount: internalAmt.toFixed(4),
          providerAmount: ext.amount.toFixed(4),
          variance: '0.0000',
          details: 'Full ledger and settlement match.'
        });
      } else {
        discrepancyCount++;
        reconciliationItems.push({
          referenceId: ext.referenceId,
          status: 'VARIANCE',
          internalAmount: internalAmt.toFixed(4),
          providerAmount: ext.amount.toFixed(4),
          variance: variance.toFixed(4),
          details: `Variance detected between ledger and provider settlement.`
        });
      }
    } else {
      discrepancyCount++;
      reconciliationItems.push({
        referenceId: ext.referenceId,
        status: 'MISSING_IN_LEDGER',
        internalAmount: null,
        providerAmount: ext.amount.toFixed(4),
        variance: (-ext.amount).toFixed(4),
        details: 'Provider settlement event not found in internal ledger.'
      });
    }
  }

  const netVariance = (totalInternalVolume - totalProviderVolume).toFixed(4);
  const status = discrepancyCount === 0 ? 'RECONCILED' : 'VARIANCE_FLAGGED';

  const settlementRecord: SettlementRow = {
    id: uuidv4(),
    batch_id: batchId,
    provider_id: providerId,
    currency,
    total_amount: totalProviderVolume.toFixed(4),
    fee_amount: '0.0000',
    net_amount: totalProviderVolume.toFixed(4),
    status,
    internal_calculated_net: totalInternalVolume.toFixed(4),
    variance: netVariance,
    created_at: new Date().toISOString()
  };

  memoryStore.settlements.set(settlementRecord.id, settlementRecord);
  await db.recordAuditLog(user.userId, user.role, 'RECONCILIATION_RUN', 'SETTLEMENT', settlementRecord.id, req.ip, null, {
    batchId,
    status,
    matchedCount,
    discrepancyCount,
    netVariance
  });

  return sendSuccess(res, {
    batchId,
    providerId,
    reconciliationStatus: status,
    matchedCount,
    discrepancyCount,
    totalProviderVolume: totalProviderVolume.toFixed(4),
    totalInternalVolume: totalInternalVolume.toFixed(4),
    netVariance,
    items: reconciliationItems
  });
});

export default router;
