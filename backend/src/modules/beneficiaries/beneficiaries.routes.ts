import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { memoryStore } from '../../db/memoryStore';
import { sendSuccess, sendError } from '../../utils/response';
import { authMiddleware } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';

const router = Router();

const AddBeneficiarySchema = z.object({
  name: z.string().min(2, 'Beneficiary name required'),
  accountNumber: z.string().min(6, 'Account number must be at least 6 alphanumeric characters').regex(/^[A-Za-z0-9]+$/, 'Account number must be alphanumeric'),
  routingCode: z.string().min(4, 'Valid routing / BIC / sort code required'),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  bankName: z.string().min(2, 'Bank name required')
});

// GET /beneficiaries
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const list = Array.from(memoryStore.beneficiaries.values()).filter(b => b.user_id === user.userId);
  return sendSuccess(res, { beneficiaries: list });
});

// POST /beneficiaries
router.post('/', authMiddleware, validateBody(AddBeneficiarySchema), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name, accountNumber, routingCode, currency, bankName } = req.body;

  // Duplicate check
  const duplicate = Array.from(memoryStore.beneficiaries.values()).find(
    b => b.user_id === user.userId && b.account_number === accountNumber && b.currency === currency
  );
  if (duplicate) {
    return sendError(res, 'BENEFICIARY_EXISTS', 'A beneficiary with this account number and currency already exists.', null, 409);
  }

  const id = uuidv4();
  const newBeneficiary = {
    id,
    user_id: user.userId,
    name,
    account_number: accountNumber,
    routing_code: routingCode,
    currency,
    bank_name: bankName,
    is_verified: true,
    created_at: new Date().toISOString()
  };

  memoryStore.beneficiaries.set(id, newBeneficiary);
  await db.recordAuditLog(user.userId, user.role, 'BENEFICIARY_ADDED', 'BENEFICIARY', id, req.ip, null, { name, bankName, currency });

  return sendSuccess(res, { beneficiary: newBeneficiary }, {}, 201);
});

// DELETE /beneficiaries/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const beneficiary = memoryStore.beneficiaries.get(req.params.id);

  if (!beneficiary) {
    return sendError(res, 'BENEFICIARY_NOT_FOUND', 'Beneficiary not found.', null, 404);
  }

  if (beneficiary.user_id !== user.userId && user.role === 'customer') {
    return sendError(res, 'FORBIDDEN', 'Cannot delete another user\'s beneficiary.', null, 403);
  }

  memoryStore.beneficiaries.delete(req.params.id);
  await db.recordAuditLog(user.userId, user.role, 'BENEFICIARY_DELETED', 'BENEFICIARY', req.params.id, req.ip);

  return sendSuccess(res, { message: 'Beneficiary removed successfully.' });
});

export default router;
