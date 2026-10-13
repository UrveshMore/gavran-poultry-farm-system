import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { exec, iso, many, one, type Db } from '../../db/sql.js';

export type Notice = {
  id: string;
  userId: string;
  displayName: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export async function listNotices(db: Db, farmId: string, userId: string | null): Promise<Notice[]> {
  const rows = await many<RowDataPacket & { id: string; user_id: string; display_name: string; title: string; body: string; read_at: Date | null; created_at: Date }>(
    db,
    `SELECT n.id, n.user_id, u.display_name, n.title, n.body, n.read_at, n.created_at
     FROM notifications n JOIN users u ON u.id = n.user_id
     WHERE n.farm_id = ? AND (? IS NULL OR n.user_id = ?)
     ORDER BY n.created_at DESC`,
    [farmId, userId, userId],
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    title: row.title,
    body: row.body,
    readAt: row.read_at ? iso(row.read_at) : null,
    createdAt: iso(row.created_at),
  }));
}

export async function insertNotice(db: Db, input: { farmId: string; userId: string; title: string; body: string; createdBy: string }): Promise<string> {
  const id = randomUUID();
  await exec(db, `INSERT INTO notifications (id, farm_id, user_id, title, body, created_by) VALUES (?, ?, ?, ?, ?, ?)`, [
    id, input.farmId, input.userId, input.title, input.body, input.createdBy,
  ]);
  return id;
}

export async function markRead(db: Db, farmId: string, noticeId: string, userId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM notifications WHERE farm_id = ? AND id = ? AND user_id = ?`, [farmId, noticeId, userId]);
  if (!row) return false;
  await exec(db, `UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP(3)) WHERE farm_id = ? AND id = ? AND user_id = ?`, [farmId, noticeId, userId]);
  return true;
}
