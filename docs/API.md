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
