import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import { db } from './db';
import { sendSuccess } from './utils/response';

import authRoutes from './modules/auth/auth.routes';
import walletsRoutes from './modules/wallets/wallets.routes';
import beneficiariesRoutes from './modules/beneficiaries/beneficiaries.routes';
import transfersRoutes from './modules/transfers/transfers.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import disputesRoutes from './modules/disputes/disputes.routes';
import statementsRoutes from './modules/statements/statements.routes';
import reconciliationRoutes from './modules/reconciliation/reconciliation.routes';
import riskRoutes from './modules/risk/risk.routes';
import ledgerRoutes from './modules/ledger/ledger.routes';
import auditRoutes from './modules/audit/audit.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(requestIdMiddleware);

  // Health and Metrics endpoints
  app.get('/health', async (req: Request, res: Response) => {
    const invariant = db.verifyGlobalBalanceInvariant();
    return res.status(200).json({
      status: 'UP',
      service: 'FinCore Core Business REST API',
      version: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      database: db.isPostgres() ? 'postgresql' : 'transactional-memory-store',
      ledgerInvariant: invariant.isBalanced ? 'HEALTHY_BALANCED' : 'UNBALANCED_ERROR',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/metrics', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(
      `# HELP fincore_process_uptime_seconds Total process uptime\n` +
      `# TYPE fincore_process_uptime_seconds gauge\n` +
      `fincore_process_uptime_seconds ${process.uptime()}\n` +
      `# HELP fincore_ledger_invariant_balanced Whether ledger sum of debits equals credits\n` +
      `# TYPE fincore_ledger_invariant_balanced gauge\n` +
      `fincore_ledger_invariant_balanced ${db.verifyGlobalBalanceInvariant().isBalanced ? 1 : 0}\n`
    );
  });

  // REST API v1 Modules
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/wallets', walletsRoutes);
  app.use('/api/v1/beneficiaries', beneficiariesRoutes);
  app.use('/api/v1/transfers', transfersRoutes);
  app.use('/api/v1/payments', paymentsRoutes);
  app.use('/api/v1/disputes', disputesRoutes);
  app.use('/api/v1/statements', statementsRoutes);
  app.use('/api/v1/reconciliation', reconciliationRoutes);
  app.use('/api/v1/risk', riskRoutes);
  app.use('/api/v1/ledger', ledgerRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);

  // Central Error Handler
  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createApp();

