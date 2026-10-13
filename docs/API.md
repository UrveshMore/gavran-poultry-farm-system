# API

Base path `/api/v1`. JSON envelope:

```json
{ "ok": true, "data": {}, "requestId": "uuid" }
```

```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { "fields": { "code": "invalid_format" } } }, "requestId": "uuid" }
```

Field codes are `too_small`, `too_big`, `invalid_format`, `required`, or `different`. The client translates them. Mutating requests need `X-CSRF-Token` equal to the `gavran_csrf` cookie. Get a token from `GET /auth/csrf` first. Health is not CSRF-protected.

`GET /health` returns `{ "status": "ok" }` or 503 `DB_UNAVAILABLE` without the driver error.

## Auth

| Method | Path | Auth | Result |
|---|---|---|---|
| GET | `/auth/csrf` | No | Sets CSRF cookie. Body includes `csrfToken` for the SPA. |
| GET | `/auth/bootstrap` | No | `{ bootstrapRequired }` |
| POST | `/auth/register` | No | 201 first user only. Then 403 `BOOTSTRAP_CLOSED`. Sets session cookies. |
| POST | `/auth/login` | No | 200 or 401 `AUTH_INVALID_CREDENTIALS`. Correct password on a deactivated user is 403 `ACCOUNT_DEACTIVATED`. |
| POST | `/auth/refresh` | Refresh cookie | Rotates refresh token. Reuse revokes the family and returns 401. |
| POST | `/auth/logout` | Cookie optional | Clears cookies. |
| POST | `/auth/logout-all` | Access | Revokes every session. |
| GET | `/auth/me` | Access | Public user. |
| PATCH | `/auth/me` | Access | `displayName` and/or `preferredLocale`. |
| POST | `/auth/change-password` | Access | Revokes other sessions. |

Bodies never include the access or refresh token.

## Farms

`GET /farms` — authenticated. Farms the caller belongs to, with role and permissions.

`POST /farms` — caller has no memberships, or is already an owner. Optional `Idempotency-Key`. 409 `DUPLICATE_CODE`.

`GET /farms/:farmId` — `farm.read`.

`PATCH /farms/:farmId` — `farm.update`. Body includes `version`. 409 `VERSION_CONFLICT`.

`GET|POST /farms/:farmId/sheds` — `shed.read` / `shed.create`. Create accepts an idempotency key. 409 `DUPLICATE_CODE`.

`PATCH /farms/:farmId/sheds/:shedId` — `shed.update` plus `version`.

`GET|POST /farms/:farmId/members` — `user.read` / `user.manage`. Invite body: email, display name, role, optional password (required for a new user, at least 10 characters), and `permissionGrants` only for `family_helper`.

`PATCH /farms/:farmId/members/:membershipId` — `user.manage`. 409 `LAST_OWNER` when the change would remove the last active owner. 403 when deactivating yourself.

`GET /farms/:farmId/audit` — `audit.read`. Query `limit` (1–100, default 20) and `offset` (0–1000, default 0).

## Batches

`GET|POST /farms/:farmId/bird-types` — `batch.read` / `batch.create`. The name is text the farm enters.

`GET|POST /farms/:farmId/batches` — `batch.read` / `batch.create`. Create places the opening count in an active shed and accepts an idempotency key. 409 `CAPACITY_EXCEEDED`, `SHED_INACTIVE`, or `DUPLICATE_CODE`.

`GET /farms/:farmId/batches/:batchId` — `batch.read`. Returns the batch, derived placements, and movements.

`POST /farms/:farmId/batches/:batchId/movements` — `movement.create`. Types: `transfer`, `sale`, `mortality`, `culling`, `other_exit`. 409 `INSUFFICIENT_BIRDS`, `CAPACITY_EXCEEDED`, `BATCH_CLOSED`, or `SHED_INACTIVE`.

`POST /farms/:farmId/batches/:batchId/close` — `movement.create`, body `{ version }`. 409 `BIRDS_REMAIN` when the live count is not zero.

A random or foreign farm id is 404.

## Eggs

`GET|POST /farms/:farmId/egg-categories` — `egg.read` / `egg.record`. The name is text the farm enters. Nothing is seeded. 409 `DUPLICATE_CODE`.

`GET|POST /farms/:farmId/eggs` — `egg.read` / `egg.record`. A collection stores a date, optional batch, optional shed, optional shift label, notes, and whole-egg counts by sort. At least one count must be greater than zero. Create accepts an idempotency key. There is no price field. A future date is 422. A closed or foreign batch, a shed from another farm, or an unknown sort is 422.

## Incubators

`GET|POST /farms/:farmId/incubators` — `incubator.read` / `incubator.manage`. Create accepts an idempotency key. Capacity is an optional egg count the farm types. 409 `DUPLICATE_CODE`.

`GET /farms/:farmId/incubators/:incubatorId` — `incubator.read`. Returns the machine, readings, and service changes.

`POST /farms/:farmId/incubators/:incubatorId/readings` — `incubator.record`. Temperature and humidity may both be null. A number requires a unit. There is no set-point field.

`POST /farms/:farmId/incubators/:incubatorId/maintenance` — `incubator.manage`. Sets `in_service` or `out_of_service`.

## Incubation

`GET|POST /farms/:farmId/incubation` — `incubation.read` / `incubation.record`. Mode is `incubator` or `broody_hen`. An out-of-service incubator is 409 `INCUBATOR_OUT`. An egg count above a typed capacity is 409 `INCUBATOR_CAPACITY`. The response has no hatch date.

`GET /farms/:farmId/incubation/:sittingId` — `incubation.read`.

`POST /farms/:farmId/incubation/:sittingId/candling` — `incubation.record`. Outcome labels are text on that record. Their counts must equal `inspectedCount`. A second record does not replace the first.

`POST /farms/:farmId/incubation/:sittingId/hatches` — `hatch.record`. Live chicks above zero open a chick batch. Counts that do not add up to eggs set need `differenceNote`. More eggs than the sitting still has is 409 `EGGS_ALREADY_SET`. The response includes `proposedHatchRate` with status `proposed`.

## Tasks

`GET|POST /farms/:farmId/task-templates` — `task.read` / `task.manage`. A season is `summer_heat`, `monsoon`, `winter`, or blank. Creating a template stores no steps. A repeated season or name is 409 `DUPLICATE_CODE`.

`PATCH /farms/:farmId/task-templates/:templateId` — `task.manage`. Renames the template.

`POST /farms/:farmId/task-templates/:templateId/steps` — `task.manage`. Appends a step the farm types.

`PATCH /farms/:farmId/task-templates/:templateId/steps/:stepId` — `task.manage`. Sets the step `active` or `skipped`.

`GET|POST /farms/:farmId/tasks` — `task.read` / `task.manage`. A worker sees tasks assigned to them. Owner, manager, and vet see the farm's tasks. A future due date is allowed. Skipped template steps are not copied onto the task. Nothing is created from batch age.

`GET /farms/:farmId/tasks/:taskId` — `task.read`. A task the caller cannot see is 404.

`POST /farms/:farmId/tasks/:taskId/complete` — `task.complete`. A second completion is 409 `TASK_ALREADY_DONE`. If the task asks for proof, an empty note is 422. There is no offline queue.

## Stock, water, and growth

`GET|POST /farms/:farmId/stock-items` — `stock.read` / `stock.manage`. The name and the unit are text the farm types. Reorder level is optional. The response has `onHand` and no stock value.

`GET|POST /farms/:farmId/stock-movements` — `stock.read` / `stock.record`. Types are `receipt` (in), `use` and `wastage` (out), and `reversal` (in or out, reason required). An out movement above the quantity on hand is 409 `INSUFFICIENT_STOCK`. `unitCost` is accepted only on a receipt and may be null. Movements are not deleted.

`GET|POST /farms/:farmId/water` — `stock.read` / `stock.record`. Quantity and unit are both omitted or both present. `laboratoryResult` is true only when `testNote` is not empty. No schedule is stored.

`GET|POST /farms/:farmId/growth-targets` — `stock.read` / `stock.manage`. Age in days and target weight are numbers the farm types. A repeated age for the same bird type is 409 `DUPLICATE_CODE`.

`GET|POST /farms/:farmId/weighings` — `stock.read` / `stock.record`. Age is optional and is not calculated from a hatch date. If that age has a target the farm typed, the response includes `ownerTarget`. There is no FCR field.

## Health

`GET /farms/:farmId/knowledge` — `health.read`. One row per page of the three training PDFs (63). Each row has `sourceFile`, `sourcePage`, `textLayer`, `mustVerify`, and `verifyLabel` “owner/vet must verify before use”. `approved` starts false.

`POST /farms/:farmId/knowledge/:entryId/approval` — `health.approve`. Approving requires `verificationNote`.

`POST /farms/:farmId/knowledge/:entryId/vaccine-task` — `health.treat`. 409 `ENTRY_UNAPPROVED` until that page is approved. The task instructions are the verification note. The due date is the one sent on the request.

`GET|POST /farms/:farmId/health-observations` — `health.read` / `health.record`. Optional link to a page. A future date is 422.

`GET|POST /farms/:farmId/medicine-records` — `health.read` / `health.treat`. 409 `ENTRY_UNAPPROVED` until the linked page is approved. `notes` is what the person typed. There is no dose or withdrawal column.

`GET|POST /farms/:farmId/biosecurity-steps` — `health.read` / `health.record`. `origin` `owner` stores the typed step. `origin` `pdf` is allowed only for `patil-poultry-step-by-step-process.pdf` and stores that page's text layer, unapproved, ignoring any body the client sent.

`POST /farms/:farmId/biosecurity-steps/:stepId/approve` — `health.approve`. Approves a copied PDF step.

## Losses

`GET|POST /farms/:farmId/losses` — `loss.read` / `loss.record`. A note and a bird count. `movementId` must be a mortality movement on this farm or blank. The list includes `proposedMortalityRate` with status `not_calculated`. There is no predator catalog.
