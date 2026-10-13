import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import './http/types.js';
import { AppError } from './http/errors.js';
import { asyncHandler } from './http/asyncHandler.js';
import { sendData } from './http/respond.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { requestContext, requestLogger } from './middleware/context.js';
import { authRoutes } from './modules/auth/routes.js';
import { batchRoutes } from './modules/batches/routes.js';
import { eggRoutes } from './modules/eggs/routes.js';
import { hatchRoutes } from './modules/hatch/routes.js';
import { incubationRoutes } from './modules/incubation/routes.js';
import { incubatorRoutes } from './modules/incubators/routes.js';
import { farmRoutes } from './modules/farms/routes.js';
import { saleRoutes } from './modules/sales/routes.js';
import { expenseRoutes } from './modules/expenses/routes.js';
import { reportRoutes } from './modules/reports/routes.js';
import { safeguardRoutes } from './modules/safeguards/routes.js';
import { lossRoutes } from './modules/losses/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { stockRoutes } from './modules/stock/routes.js';
import { taskRoutes } from './modules/tasks/routes.js';
import { workforceRoutes } from './modules/workforce/routes.js';
import { parentageRoutes } from './modules/parentage/routes.js';
import { supplierRoutes } from './modules/suppliers/routes.js';
import { invoiceRoutes } from './modules/invoices/routes.js';
import { notificationRoutes } from './modules/notifications/routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(requestContext);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key', 'X-Request-Id'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(requestLogger);
  app.get(
    '/api/v1/health',
    asyncHandler(async (req, res) => {
      try {
        await pool.query('SELECT 1');
      } catch {
        throw new AppError(503, 'DB_UNAVAILABLE', 'Database is unavailable.');
      }
      sendData(res, 200, { status: 'ok' }, req.requestId);
    }),
  );
  app.use('/api/v1', csrfProtection);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/farms', farmRoutes);
  app.use('/api/v1/farms', batchRoutes);
  app.use('/api/v1/farms', eggRoutes);
  app.use('/api/v1/farms', incubatorRoutes);
  app.use('/api/v1/farms', incubationRoutes);
  app.use('/api/v1/farms', hatchRoutes);
  app.use('/api/v1/farms', taskRoutes);
  app.use('/api/v1/farms', workforceRoutes);
  app.use('/api/v1/farms', parentageRoutes);
  app.use('/api/v1/farms', supplierRoutes);
  app.use('/api/v1/farms', invoiceRoutes);
  app.use('/api/v1/farms', notificationRoutes);
  app.use('/api/v1/farms', stockRoutes);
  app.use('/api/v1/farms', healthRoutes);
  app.use('/api/v1/farms', lossRoutes);
  app.use('/api/v1/farms', saleRoutes);
  app.use('/api/v1/farms', expenseRoutes);
  app.use('/api/v1/farms', reportRoutes);
  app.use('/api/v1/farms', safeguardRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
