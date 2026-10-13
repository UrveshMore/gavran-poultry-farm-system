import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, exec, iso, many, one, parseJson, type Db } from '../../db/sql.js';
import { redact } from '../../security/redact.js';

export type AuditEvent = {
  farmId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string;
  summary: unknown;
};

export async function writeAudit(db: Db, event: AuditEvent): Promise<void> {
  const summary = JSON.stringify(redact(event.summary));
  await exec(
    db,
    `INSERT INTO audit_logs
      (id, farm_id, actor_user_id, action, entity_type, entity_id, request_id, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      event.farmId,
      event.actorUserId,
      event.action,
      event.entityType,
      event.entityId,
      event.requestId,
      summary,
    ],
  );
}

type AuditRow = RowDataPacket & {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: unknown;
  created_at: Date | string;
  request_id: string;
  actor_name: string | null;
};

export type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: unknown;
  createdAt: string;
  requestId: string;
  actorName: string | null;
};

export async function listAudit(
  db: Db,
  farmId: string,
  limit: number,
  offset: number,
): Promise<{ items: AuditItem[]; total: number }> {
  if (!Number.isInteger(limit) || !Number.isInteger(offset) || limit < 1 || limit > 100 || offset < 0 || offset > 1000) {
    throw new Error('Invalid audit page.');
  }
  const count = await one<RowDataPacket & { total: number | string | bigint }>(
    db,
    'SELECT COUNT(*) AS total FROM audit_logs WHERE farm_id = ?',
    [farmId],
  );
  // LIMIT/OFFSET are validated integers. mysql2's binary protocol rejects placeholders here.
  const rows = await many<AuditRow>(
    db,
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.summary, a.created_at, a.request_id,
            u.display_name AS actor_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_user_id
     WHERE a.farm_id = ?
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    [farmId],
  );
  return {
    total: count ? asNumber(count.total) : 0,
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      summary: parseJson(row.summary),
      createdAt: iso(row.created_at),
      requestId: row.request_id,
      actorName: row.actor_name,
    })),
  };
}
