import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logger } from '../logger.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.get('x-request-id');
  req.requestId = incoming && UUID_RE.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

export const requestLogger: RequestHandler = (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    logger.info({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - started,
    });
  });
  next();
};

export function clientIp(req: { ip?: string; socket: { remoteAddress?: string | null } }): string {
  return (req.ip || req.socket.remoteAddress || 'unknown').slice(0, 64);
}

export function clientUserAgent(req: { get(name: string): string | undefined }): string | null {
  const value = req.get('user-agent');
  if (!value) return null;
  return value.slice(0, 255);
}
