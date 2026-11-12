import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { AppError, ErrorCode } from './lib/errors.js';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin, allowedHeaders: ['Content-Type', 'X-User-Id'] }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiRouter);
  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, ErrorCode.NOT_FOUND, 'Route not found', { resource: 'route' }));
  });

  // 오류 응답 형식: { error: { code, message, details? } }
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: ErrorCode.VALIDATION_ERROR, message: 'Malformed JSON body' } });
      return;
    }
    console.error(err);
    res.status(500).json({ error: { code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' } });
  };
  app.use(errorHandler);
  return app;
}
