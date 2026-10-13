import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { exec, many, one, type Db } from '../../db/sql.js';

export type AttendanceRow = {
  id: string;
  userId: string;
  displayName: string;
  attendedOn: string;
  attendedTime: string | null;
  methodLabel: string;
  note: string;
};

export type TrainingItem = {
  id: string;
  title: string;
  body: string;
  versionLabel: string;
};

export type TrainingAssignment = {
  id: string;
  itemId: string;
  itemTitle: string;
  versionLabel: string;
  userId: string;
  displayName: string;
  dueOn: string | null;
  completionId: string | null;
  completionNote: string | null;
};

export type TaskTrainingLink = {
  id: string;
  taskId: string;
  taskTitle: string;
  itemId: string;
  itemTitle: string;
};

function asDate(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function listAttendance(db: Db, farmId: string, userId: string | null): Promise<AttendanceRow[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      user_id: string;
      display_name: string;
      attended_on: Date | string;
      attended_time: string | null;
      method_label: string;
      note: string;
    }
  >(
    db,
    `SELECT a.id, a.user_id, u.display_name, a.attended_on, a.attended_time, a.method_label, a.note
     FROM attendance_records a
     JOIN users u ON u.id = a.user_id
     WHERE a.farm_id = ? AND (? IS NULL OR a.user_id = ?)
     ORDER BY a.attended_on DESC, a.created_at DESC`,
    [farmId, userId, userId],
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    attendedOn: asDate(row.attended_on) ?? '',
    attendedTime: row.attended_time,
    methodLabel: row.method_label,
    note: row.note,
  }));
}

export async function insertAttendance(
  db: Db,
  input: {
    farmId: string;
    userId: string;
    attendedOn: string;
    attendedTime: string | null;
    methodLabel: string;
    note: string;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO attendance_records
      (id, farm_id, user_id, attended_on, attended_time, method_label, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.userId, input.attendedOn, input.attendedTime, input.methodLabel, input.note, input.createdBy],
  );
  return id;
}

export async function listItems(db: Db, farmId: string): Promise<TrainingItem[]> {
  const rows = await many<RowDataPacket & TrainingItem & { version_label: string }>(
    db,
    `SELECT id, title, body, version_label
     FROM training_items
     WHERE farm_id = ?
     ORDER BY created_at DESC`,
    [farmId],
  );
  return rows.map((row) => ({ id: row.id, title: row.title, body: row.body, versionLabel: row.version_label }));
}

export async function itemOnFarm(db: Db, farmId: string, itemId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM training_items WHERE farm_id = ? AND id = ?`, [farmId, itemId]);
  return Boolean(row);
}

export async function insertItem(
  db: Db,
  input: { farmId: string; title: string; body: string; versionLabel: string; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO training_items (id, farm_id, title, body, version_label, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.title, input.body, input.versionLabel, input.createdBy],
  );
  return id;
}

export async function listAssignments(db: Db, farmId: string, userId: string | null): Promise<TrainingAssignment[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      item_id: string;
      item_title: string;
      version_label: string;
      user_id: string;
      display_name: string;
      due_on: Date | string | null;
      completion_id: string | null;
      completion_note: string | null;
    }
  >(
    db,
    `SELECT a.id, a.item_id, i.title AS item_title, i.version_label, a.user_id, u.display_name, a.due_on,
            c.id AS completion_id, c.note AS completion_note
     FROM training_assignments a
     JOIN training_items i ON i.id = a.item_id
     JOIN users u ON u.id = a.user_id
     LEFT JOIN training_completions c ON c.assignment_id = a.id
     WHERE a.farm_id = ? AND (? IS NULL OR a.user_id = ?)
     ORDER BY a.created_at DESC`,
    [farmId, userId, userId],
  );
  return rows.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemTitle: row.item_title,
    versionLabel: row.version_label,
    userId: row.user_id,
    displayName: row.display_name,
    dueOn: asDate(row.due_on),
    completionId: row.completion_id,
    completionNote: row.completion_note,
  }));
}

export async function insertAssignment(
  db: Db,
  input: { farmId: string; itemId: string; userId: string; dueOn: string | null; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO training_assignments (id, farm_id, item_id, user_id, due_on, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.itemId, input.userId, input.dueOn, input.createdBy],
  );
  return id;
}

export async function findAssignment(db: Db, farmId: string, assignmentId: string): Promise<{ id: string; userId: string; completed: boolean } | null> {
  const row = await one<RowDataPacket & { id: string; user_id: string; completion_id: string | null }>(
    db,
    `SELECT a.id, a.user_id, c.id AS completion_id
     FROM training_assignments a
     LEFT JOIN training_completions c ON c.assignment_id = a.id
     WHERE a.farm_id = ? AND a.id = ?`,
    [farmId, assignmentId],
  );
  if (!row) return null;
  return { id: row.id, userId: row.user_id, completed: row.completion_id !== null };
}

export async function insertCompletion(db: Db, input: { farmId: string; assignmentId: string; note: string; completedBy: string }): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO training_completions (id, farm_id, assignment_id, note, completed_by)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.farmId, input.assignmentId, input.note, input.completedBy],
  );
  return id;
}

export async function listRequirements(db: Db, farmId: string): Promise<TaskTrainingLink[]> {
  const rows = await many<RowDataPacket & { id: string; task_id: string; task_title: string; item_id: string; item_title: string }>(
    db,
    `SELECT r.id, r.task_id, t.title AS task_title, r.item_id, i.title AS item_title
     FROM task_training_requirements r
     JOIN tasks t ON t.id = r.task_id
     JOIN training_items i ON i.id = r.item_id
     WHERE r.farm_id = ?
     ORDER BY r.created_at DESC`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    itemId: row.item_id,
    itemTitle: row.item_title,
  }));
}

export async function taskOnFarm(db: Db, farmId: string, taskId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM tasks WHERE farm_id = ? AND id = ?`, [farmId, taskId]);
  return Boolean(row);
}

export async function insertRequirement(
  db: Db,
  input: { farmId: string; taskId: string; itemId: string; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO task_training_requirements (id, farm_id, task_id, item_id, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.farmId, input.taskId, input.itemId, input.createdBy],
  );
  return id;
}

export async function actorMissingTraining(db: Db, farmId: string, taskId: string, userId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(
    db,
    `SELECT r.item_id
     FROM task_training_requirements r
     WHERE r.farm_id = ? AND r.task_id = ?
       AND NOT EXISTS (
         SELECT 1
         FROM training_assignments a
         JOIN training_completions c ON c.assignment_id = a.id
         WHERE a.farm_id = r.farm_id AND a.item_id = r.item_id AND a.user_id = ?
       )
     LIMIT 1`,
    [farmId, taskId, userId],
  );
  return Boolean(row);
}
