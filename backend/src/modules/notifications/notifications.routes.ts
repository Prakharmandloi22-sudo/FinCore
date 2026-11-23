import { Router, Request, Response } from 'express';
import { memoryStore } from '../../db/memoryStore';
import { sendSuccess } from '../../utils/response';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// GET /notifications (Query sandbox notification outbox)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  let notifications = Array.from(memoryStore.notifications.values());

  if (user.role === 'customer') {
    notifications = notifications.filter(n => n.user_id === user.userId);
  }

  notifications.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
  return sendSuccess(res, {
    notifications,
    total: notifications.length,
    sandboxMode: true
  });
});

export default router;

