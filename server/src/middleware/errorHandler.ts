import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isDup } from '../db/sql.js';
import { AppError, zodFieldErrors } from '../http/errors.js';
import { logger } from '../logger.js';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({
    ok: false,
    error: { code: 'NOT_FOUND', message: 'Not found.' },
    requestId: req.requestId,
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the highlighted fields.',
        details: { fields: zodFieldErrors(err) },
      },
      requestId: req.requestId,
    });
    return;
  }
  if (err instanceof AppError) {
    const level = err.status >= 500 ? 'error' : 'info';
    logger[level]({ requestId: req.requestId, code: err.code, status: err.status }, err.message);
    res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      requestId: req.requestId,
    });
    return;
  }
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    res.status(400).json({
      ok: false,
      error: { code: 'BAD_JSON', message: 'The request body is not valid JSON.' },
      requestId: req.requestId,
    });
    return;
  }
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      ok: false,
      error: { code: 'FILE_TOO_LARGE', message: 'That file is larger than 5 MB.' },
      requestId: req.requestId,
    });
    return;
  }
  if (isDup(err)) {
    res.status(409).json({
      ok: false,
      error: { code: 'CONFLICT', message: 'That value is already in use.' },
      requestId: req.requestId,
    });
    return;
  }
  logger.error({ requestId: req.requestId, err }, 'unhandled error');
  res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL', message: 'Something went wrong.' },
    requestId: req.requestId,
  });
};
