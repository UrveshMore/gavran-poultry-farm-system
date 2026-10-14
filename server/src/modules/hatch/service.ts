import { hatchInputSchema, proposedHatchRate } from '@gavran/shared';
import { isDup } from '../../db/sql.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { findActiveBirdType, insertBatch, lockSheds, shedLiveCount } from '../batches/repository.js';
import { todayInTimeZone } from '../batches/service.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';
import { pool } from '../../db/pool.js';
import { listSittings } from '../incubation/repository.js';
import { eggsAlreadySet, insertHatch, listHatches } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

export async function createHatch(actor: Actor, access: FarmAccess, sittingId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = hatchInputSchema.parse(body);
  const farm = await findFarmById(pool, access.farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  if (input.hatchedOn > todayInTimeZone(farm.timezone)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { hatchedOn: 'future_date' } });
  }
  const path = requestPath(idempotency.path);
  try {
    return await withTransaction(async (conn) => {
      const reserved = await reserveIdempotency(conn, {
        userId: actor.user.id,
        farmId: access.farmId,
        key: idempotency.key,
        method: idempotency.method,
        path,
      });
      if (reserved.mode === 'replay') return reserved;
      const sitting = (await listSittings(conn, access.farmId)).find((item) => item.id === sittingId);
      if (!sitting || sitting.status !== 'open') throw new AppError(404, 'NOT_FOUND', 'Not found.');
      const already = await eggsAlreadySet(conn, sittingId);
      if (already + input.eggsSet > sitting.eggCount) {
        throw new AppError(409, 'EGGS_ALREADY_SET', 'Those eggs are more than the sitting still has.');
      }
      let chickBatchId: string | null = null;
      if (input.liveChicks > 0) {
        const birdType = await findActiveBirdType(conn, access.farmId, input.birdTypeId);
        if (!birdType) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a bird type for this farm.', { fields: { birdTypeId: 'invalid_format' } });
        const sheds = await lockSheds(conn, access.farmId, [input.shedId]);
        const shed = sheds.get(input.shedId);
        if (!shed) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a shed on this farm.', { fields: { shedId: 'invalid_format' } });
        if (shed.status !== 'active') throw new AppError(409, 'SHED_INACTIVE', 'Birds can be placed only in an active shed.');
        const living = await shedLiveCount(conn, access.farmId, input.shedId);
        if (living + input.liveChicks > shed.usableCapacity) {
          throw new AppError(409, 'CAPACITY_EXCEEDED', 'That shed does not have room for this count.');
        }
        chickBatchId = await insertBatch(conn, {
          farmId: access.farmId,
          code: input.batchCode.toUpperCase(),
          birdTypeId: birdType.id,
          sourceNote: `hatch ${sitting.code}`,
          hatchDate: input.hatchedOn,
          eggSetOn: sitting.startedOn,
          openedOn: input.hatchedOn,
          shedId: input.shedId,
          birdCount: input.liveChicks,
          createdBy: actor.user.id,
        });
      }
      const id = await insertHatch(conn, {
        farmId: access.farmId,
        sittingId,
        hatchedOn: input.hatchedOn,
        eggsSet: input.eggsSet,
        liveChicks: input.liveChicks,
        losses: input.losses,
        otherCount: input.otherCount,
        differenceNote: input.differenceNote === '' ? null : input.differenceNote,
        chickBatchId,
        createdBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'hatch.recorded',
        entityType: 'hatch_record',
        entityId: id,
        requestId: actor.requestId,
        summary: { sittingId, liveChicks: input.liveChicks, eggsSet: input.eggsSet },
      });
      const data = {
        hatch: (await listHatches(conn, access.farmId, sittingId)).find((item) => item.id === id),
        proposedHatchRate: proposedHatchRate(input.liveChicks, input.eggsSet),
      };
      if (!data.hatch) throw new Error('Hatch insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That batch code is already used.');
    throw error;
  }
}
