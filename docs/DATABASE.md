# Database

MySQL 8.4, `utf8mb4` / `utf8mb4_0900_ai_ci`, session time zone `+00:00`. Migrations live in `database/migrations` as `NNN_name.sql` with a matching `.down.sql`. The migrator creates `schema_migrations` and records the numeric prefix after each file. MySQL commits DDL implicitly, so a failure in the middle of a file can leave partial tables. Roll back with `npm run db:rollback` only when the down script matches what was applied.

## 001 identity

- `users` — email unique, lowercase in the application. `status` is `active` or `deactivated`. `platform_role` is `system_administrator` or null.
- `roles`, `permissions`, `role_permissions` — seeded Phase 1 catalog. Fixed UUIDs `00000000-0000-4000-8000-000000000001` through `000000000006` for roles and `000000000101` through `000000000108` for permissions.
- `sessions` — refresh token stored as SHA-256, `family_id` for reuse detection, `revoked_at`, `replaced_by`.
- `password_reset_tokens` — table only. No reset endpoint until a delivery channel exists.

## 002 farm

- `farms` — `version` for optimistic concurrency, status `active` or `archived` (no archive API yet).
- `farm_settings` — unused. Do not store invented SOP, dosage, price, or tax values.
- `farm_memberships` — unique `(farm_id, user_id)`, status `active` or `revoked`.
- `membership_permission_grants` — extra keys for a family helper.
- `sheds` — unique `(farm_id, code)`, `usable_capacity >= 0`, capacity unit stored as `birds`.

## 003 audit

- `audit_logs` — `farm_id` nullable. No hard delete.
- `idempotency_keys` — unique `(user_id, idempotency_key)`. Placeholder row uses `response_status` 0 until the transaction finishes.

Queries use `mysql2` `execute()` (server-side prepared statements). Audit list `LIMIT` and `OFFSET` are interpolated only after the values are checked as integers, because the binary protocol rejects placeholders there.
