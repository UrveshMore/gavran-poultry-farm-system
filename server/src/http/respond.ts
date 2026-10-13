import type { Response } from 'express';

export function sendData(res: Response, status: number, data: unknown, requestId: string): void {
  res.status(status).json({ ok: true, data, requestId });
}
