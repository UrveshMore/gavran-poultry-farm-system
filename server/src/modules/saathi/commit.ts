import { fieldValue, type PermissionCode, type SaathiAction, type SaathiCard } from '@gavran/shared';
import { z } from 'zod';
import { AppError } from '../../http/errors.js';
import type { AuthUser } from '../auth/types.js';
import { markDose } from '../doses/service.js';
import { createEggCollection } from '../eggs/service.js';
import { createEntry } from '../expenses/service.js';
import type { FarmAccess } from '../farms/access.js';
import { createHatch } from '../hatch/service.js';
import { createLoss } from '../losses/service.js';
import { createOrder } from '../sales/service.js';
import { createMovement } from '../stock/service.js';
import { createTask } from '../tasks/service.js';

const cardSchema = z.object({
  action: z.enum(['eggs', 'loss', 'hatch', 'dose', 'task', 'feed', 'sale', 'expense']),
  confidence: z.number().min(0).max(1),
  fields: z.array(z.object({ key: z.string().max(40), value: z.string().max(1000) })).max(24),
});

const NEED: Record<SaathiAction, string> = {
  eggs: 'egg.record',
  loss: 'loss.record',
  hatch: 'hatch.record',
  dose: 'health.record',
  task: 'task.manage',
  feed: 'stock.record',
  sale: 'sale.record',
  expense: 'expense.record',
};

type Actor = { user: AuthUser; requestId: string };
type Idempotency = { key: string | null; method: string; path: string };

function num(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new AppError(422, 'VALIDATION_ERROR', 'Check the number.', { fields: { count: 'invalid_format' } });
  return parsed;
}

function required(card: SaathiCard, key: string): string {
  const value = fieldValue(card, key).trim();
  if (!value) throw new AppError(422, 'VALIDATION_ERROR', 'Fill in the card before saving.', { fields: { [key]: 'required' } });
  return value;
}

/** Runs only after the person taps Save. */
export async function commitCard(actor: Actor, access: FarmAccess, body: unknown, idempotency: Idempotency) {
  const card = cardSchema.parse(body) as SaathiCard;
  const permission = NEED[card.action];
  if (!access.permissions.includes(permission as PermissionCode)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do that.');
  }
  if (card.action === 'eggs') {
    return createEggCollection(actor, access, {
      collectedOn: required(card, 'collectedOn'),
      batchId: fieldValue(card, 'batchId'),
      shedId: '',
      shiftLabel: '',
      notes: fieldValue(card, 'notes'),
      lines: [{ categoryId: required(card, 'categoryId'), eggCount: num(required(card, 'eggCount')) }],
    }, idempotency);
  }
  if (card.action === 'loss') {
    return createLoss(actor, access, {
      occurredOn: required(card, 'occurredOn'),
      birdCount: num(required(card, 'birdCount')),
      note: required(card, 'note'),
      movementId: '',
    }, idempotency);
  }
  if (card.action === 'hatch') {
    return createHatch(actor, access, required(card, 'sittingId'), {
      hatchedOn: required(card, 'hatchedOn'),
      eggsSet: num(required(card, 'eggsSet')),
      liveChicks: num(required(card, 'liveChicks')),
      losses: num(fieldValue(card, 'losses') || '0'),
      otherCount: num(fieldValue(card, 'otherCount') || '0'),
      differenceNote: fieldValue(card, 'differenceNote'),
      batchCode: fieldValue(card, 'batchCode'),
      birdTypeId: fieldValue(card, 'birdTypeId'),
      shedId: fieldValue(card, 'shedId'),
    }, idempotency);
  }
  if (card.action === 'dose') {
    const saved = await markDose(actor, access, required(card, 'batchId'), { rowId: required(card, 'rowId'), givenOn: required(card, 'givenOn') });
    return { mode: 'created' as const, status: 201, data: saved };
  }
  if (card.action === 'task') {
    return createTask(actor, access, {
      title: required(card, 'title'),
      dueOn: required(card, 'dueOn'),
      instructions: fieldValue(card, 'instructions'),
      assigneeUserId: '',
      proofRequired: false,
      templateId: '',
    }, idempotency);
  }
  if (card.action === 'feed') {
    return createMovement(actor, access, {
      itemId: required(card, 'itemId'),
      movementType: 'use',
      direction: 'out',
      quantity: num(required(card, 'quantity')),
      occurredOn: required(card, 'occurredOn'),
      batchId: fieldValue(card, 'batchId'),
      shedId: '',
      lotCode: '',
      expiresOn: '',
      unitCost: null,
      supplierName: '',
      reason: 'Saathi',
    }, idempotency);
  }
  if (card.action === 'sale') {
    return createOrder(actor, access, {
      customerId: required(card, 'customerId'),
      orderedOn: required(card, 'orderedOn'),
      lines: [{ description: fieldValue(card, 'description') || 'birds', quantity: num(required(card, 'quantity')), unitPrice: num(required(card, 'unitPrice')) }],
    }, idempotency);
  }
  return createEntry(actor, access, {
    occurredOn: required(card, 'occurredOn'),
    direction: 'expense',
    categoryId: required(card, 'categoryId'),
    amount: num(required(card, 'amount')),
    unitLabel: required(card, 'unitLabel'),
    counterparty: '',
    referenceNote: '',
    notes: fieldValue(card, 'notes'),
    batchId: fieldValue(card, 'batchId'),
  }, idempotency);
}
