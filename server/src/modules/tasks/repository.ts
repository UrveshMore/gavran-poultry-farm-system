import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { exec, many, one, type Db } from '../../db/sql.js';

export type TaskSeason = 'summer_heat' | 'monsoon' | 'winter';
export type TemplateStep = { id: string; position: number; body: string; status: 'active' | 'skipped' };
export type TaskTemplate = {
  id: string;
  name: string;
  season: TaskSeason | null;
  steps: TemplateStep[];
};

export type TaskStep = { position: number; body: string };

export type FarmTask = {
  id: string;
  title: string;
  instructions: string | null;
  dueOn: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  proofRequired: boolean;
  status: 'open' | 'done';
  templateId: string | null;
  templateName: string | null;
  completionNote: string | null;
  completedAt: string | null;
  steps: TaskStep[];
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function asStamp(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export async function listTemplates(db: Db, farmId: string): Promise<TaskTemplate[]> {
  const rows = await many<RowDataPacket & { id: string; name: string; season: TaskSeason | null }>(
    db,
    `SELECT id, name, season FROM task_templates WHERE farm_id = ? ORDER BY name`,
    [farmId],
  );
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const steps = await many<RowDataPacket & TemplateStep>(
    db,
    `SELECT id, template_id, position, body, status
     FROM task_template_steps
     WHERE template_id IN (${ids.map(() => '?').join(', ')})
     ORDER BY position`,
    ids,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    season: row.season,
    steps: steps
      .filter((step) => (step as TemplateStep & { template_id: string }).template_id === row.id)
      .map((step) => ({ id: step.id, position: Number(step.position), body: step.body, status: step.status })),
  }));
}

export async function insertTemplate(
  db: Db,
  farmId: string,
  name: string,
  season: TaskSeason | null,
  createdBy: string,
): Promise<string> {
  const id = randomUUID();
  await exec(db, `INSERT INTO task_templates (id, farm_id, name, season, created_by) VALUES (?, ?, ?, ?, ?)`, [
    id,
    farmId,
    name,
    season,
    createdBy,
  ]);
  return id;
}

export async function renameTemplate(db: Db, farmId: string, templateId: string, name: string): Promise<boolean> {
  const result = await exec(db, `UPDATE task_templates SET name = ? WHERE farm_id = ? AND id = ?`, [name, farmId, templateId]);
  return result.affectedRows === 1;
}

export async function findTemplate(db: Db, farmId: string, templateId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM task_templates WHERE farm_id = ? AND id = ?`, [farmId, templateId]);
  return Boolean(row);
}

export async function insertStep(db: Db, templateId: string, body: string): Promise<void> {
  const row = await one<RowDataPacket & { next_pos: number | string | null }>(
    db,
    `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM task_template_steps WHERE template_id = ?`,
    [templateId],
  );
  const position = Number(row?.next_pos ?? 1);
  await exec(db, `INSERT INTO task_template_steps (id, template_id, position, body) VALUES (?, ?, ?, ?)`, [
    randomUUID(),
    templateId,
    position,
    body,
  ]);
}

export async function setStepStatus(
  db: Db,
  farmId: string,
  templateId: string,
  stepId: string,
  status: 'active' | 'skipped',
): Promise<boolean> {
  const result = await exec(
    db,
    `UPDATE task_template_steps s
     JOIN task_templates t ON t.id = s.template_id
     SET s.status = ?
     WHERE t.farm_id = ? AND s.template_id = ? AND s.id = ?`,
    [status, farmId, templateId, stepId],
  );
  return result.affectedRows === 1;
}

export async function findActiveMember(db: Db, farmId: string, userId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(
    db,
    `SELECT u.id
     FROM farm_memberships m
     JOIN users u ON u.id = m.user_id
     WHERE m.farm_id = ? AND u.id = ? AND m.status = 'active' AND u.status = 'active'`,
    [farmId, userId],
  );
  return Boolean(row);
}

export async function insertTask(
  db: Db,
  input: {
    farmId: string;
    templateId: string | null;
    title: string;
    instructions: string | null;
    dueOn: string;
    assigneeUserId: string | null;
    proofRequired: boolean;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO tasks
      (id, farm_id, template_id, title, instructions, due_on, assignee_user_id, proof_required, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.templateId,
      input.title,
      input.instructions,
      input.dueOn,
      input.assigneeUserId,
      input.proofRequired ? 1 : 0,
      input.createdBy,
    ],
  );
  if (input.templateId) {
    const steps = await many<RowDataPacket & { body: string }>(
      db,
      `SELECT body FROM task_template_steps WHERE template_id = ? AND status = 'active' ORDER BY position`,
      [input.templateId],
    );
    let position = 1;
    for (const step of steps) {
      await exec(db, `INSERT INTO task_steps (id, task_id, position, body) VALUES (?, ?, ?, ?)`, [
        randomUUID(),
        id,
        position,
        step.body,
      ]);
      position += 1;
    }
  }
  return id;
}

type TaskRow = RowDataPacket & {
  id: string;
  title: string;
  instructions: string | null;
  due_on: Date | string;
  assignee_user_id: string | null;
  assignee_name: string | null;
  proof_required: number;
  status: 'open' | 'done';
  template_id: string | null;
  template_name: string | null;
  completion_note: string | null;
  completed_at: Date | string | null;
};

const TASK_SELECT = `SELECT t.id, t.title, t.instructions, t.due_on, t.assignee_user_id, u.display_name AS assignee_name,
  t.proof_required, t.status, t.template_id, p.name AS template_name, t.completion_note, t.completed_at
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assignee_user_id
  LEFT JOIN task_templates p ON p.id = t.template_id`;

async function withSteps(db: Db, rows: TaskRow[]): Promise<FarmTask[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const steps = await many<RowDataPacket & { task_id: string; position: number; body: string }>(
    db,
    `SELECT task_id, position, body FROM task_steps WHERE task_id IN (${ids.map(() => '?').join(', ')}) ORDER BY position`,
    ids,
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    dueOn: asDate(row.due_on),
    assigneeUserId: row.assignee_user_id,
    assigneeName: row.assignee_name,
    proofRequired: Number(row.proof_required) === 1,
    status: row.status,
    templateId: row.template_id,
    templateName: row.template_name,
    completionNote: row.completion_note,
    completedAt: asStamp(row.completed_at),
    steps: steps
      .filter((step) => step.task_id === row.id)
      .map((step) => ({ position: Number(step.position), body: step.body })),
  }));
}

export async function listTasks(db: Db, farmId: string, assigneeUserId: string | null): Promise<FarmTask[]> {
  const rows = await many<TaskRow>(
    db,
    `${TASK_SELECT} WHERE t.farm_id = ? AND (? IS NULL OR t.assignee_user_id = ?) ORDER BY t.due_on, t.created_at LIMIT 100`,
    [farmId, assigneeUserId, assigneeUserId],
  );
  return withSteps(db, rows);
}

export async function findTask(db: Db, farmId: string, taskId: string, assigneeUserId: string | null): Promise<FarmTask | null> {
  const row = await one<TaskRow>(
    db,
    `${TASK_SELECT} WHERE t.farm_id = ? AND t.id = ? AND (? IS NULL OR t.assignee_user_id = ?)`,
    [farmId, taskId, assigneeUserId, assigneeUserId],
  );
  if (!row) return null;
  const [task] = await withSteps(db, [row]);
  return task ?? null;
}

export async function completeTask(db: Db, farmId: string, taskId: string, note: string | null, userId: string): Promise<boolean> {
  const result = await exec(
    db,
    `UPDATE tasks
     SET status = 'done', completion_note = ?, completed_at = CURRENT_TIMESTAMP(3), completed_by = ?
     WHERE farm_id = ? AND id = ? AND status = 'open'`,
    [note, userId, farmId, taskId],
  );
  return result.affectedRows === 1;
}
