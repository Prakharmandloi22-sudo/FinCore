import { Router, Request, Response } from 'express';
import { memoryStore } from '../../db/memoryStore';
import { sendSuccess } from '../../utils/response';
import { authMiddleware } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';

const router = Router();

// GET /audit (Query immutable audit trail)
router.get('/', authMiddleware, requireRoles('platform_administrator', 'operations_analyst', 'finance_administrator'), async (req: Request, res: Response) => {
  let logs = Array.from(memoryStore.auditLogs.values());

  const entityType = req.query.entityType as string;
  const actorId = req.query.actorId as string;
  const action = req.query.action as string;

  if (entityType) {
    logs = logs.filter(l => l.entity_type.toLowerCase() === entityType.toLowerCase());
  }
  if (actorId) {
    logs = logs.filter(l => l.actor_id === actorId);
  }
  if (action) {
    logs = logs.filter(l => l.action.toLowerCase() === action.toLowerCase());
  }

  // Sort newest first
  logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return sendSuccess(res, {
    logs,
    total: logs.length,
    immutabilityNotice: 'Audit logs are append-only. Modification and deletion prohibited by database security triggers.'
  });
});

export default router;
