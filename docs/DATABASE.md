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

## 004 batches

- `bird_types` — a name the farm enters. Unique per farm.
- `batches` — code, optional hatch date, `open` or `closed`.
- `batch_movements` — opening, transfer, sale, mortality, culling, or other exit. Live count is the sum of these rows. A sale does not store a price.
- Permissions `000000000109` through `000000000111`: `batch.read`, `batch.create`, `movement.create`.

## 005 eggs

- `egg_categories` — a sort name the farm enters. Unique per farm. No rows are seeded.
- `egg_collections` — date, optional batch, optional shed, optional shift label, notes. No price column.
- `egg_collection_lines` — whole-egg count, `egg_count >= 0`. A line with zero is not inserted.
- Permissions `000000000112` and `000000000113`: `egg.read`, `egg.record`. Owner, manager, and worker receive both. Vet / advisor receives read only.

## 006 incubators

- `incubators` — code, name, optional egg capacity, `in_service` or `out_of_service`. No set-point columns.
- `incubator_readings` — optional temperature and humidity values with the unit the farm typed. Power is `on`, `off`, or `unknown`.
- `incubator_maintenance` — a service change. The incubator status follows the latest change.
- Permissions `000000000114` through `000000000116`: `incubator.read`, `incubator.record`, `incubator.manage`.

## 007 incubation

- `incubation_batches` — `incubator` with an incubator id, or `broody_hen` with a hen name. No hatch-date column.
- `candling_records` and `candling_lines` — each look is its own record. Line labels are text, not a seeded list.
- Permissions `000000000117` and `000000000118`: `incubation.read`, `incubation.record`. Vet / advisor receives read only.

## 008 hatch

- `hatch_records` — eggs set, live chicks, losses, other, optional difference note, optional chick batch. No approved rate column.
- Permission `000000000119`: `hatch.record` for owner, manager, and worker.

## 009 tasks

- `task_templates` — a name the farm types. Season is `summer_heat`, `monsoon`, `winter`, or null. No steps are seeded.
- `task_template_steps` — text the farm adds. Status is `active` or `skipped`.
- `tasks` — title, due date, optional assignee, optional instructions, `open` or `done`. Proof is a completion note when requested. No photo column and no sync table.
- `task_steps` — a copy of the active template steps at the moment the task was created.
- Permissions `000000000120` through `000000000122`: `task.read`, `task.manage`, `task.complete`. Owner and manager receive all three. Worker receives read and complete. Vet / advisor receives read only.

## 010 stock

- `stock_items` — a name and a unit label the farm types. Optional reorder level. No price column.
- `stock_movements` — receipt, use, wastage, or reversal. Quantity is always positive, with direction `in` or `out`. `unit_cost` is nullable and is not a valuation. Rows are not deleted.
- `water_records` — optional quantity and unit together. `test_note` is a laboratory result only when the farm typed one. No schedule.
- `growth_targets` — age in days and target weight the farm types for a bird type. No standard weight is seeded.
- `growth_weighings` — a measured weight. `age_days` is nullable and is not derived from a hatch date.
- Permissions `000000000123` through `000000000125`: `stock.read`, `stock.record`, `stock.manage`. Owner and manager receive all three. Worker receives read and record. Vet / advisor receives read only.

## 011 health

- `knowledge_entries` — one row per page of the three Patil PDFs. `text_layer` is the PDF text layer, not a reconstructed dose. 63 rows.
- `knowledge_approvals` — per farm. Starts absent, which the API reports as unapproved. A note is required to approve.
- `health_observations` — a date, notes, optional batch, optional bird count, optional page link.
- `medicine_records` — the approved page and notes the person typed. No dose column and no withdrawal column.
- `biosecurity_steps` — `owner` or `pdf`. A PDF step must name `patil-poultry-step-by-step-process.pdf` and a page, and starts unapproved.
- Permissions `000000000126` through `000000000129`: `health.read`, `health.record`, `health.approve`, `health.treat`. Owner and manager receive all four. Worker and vet / advisor receive read and record.

## 012 losses

- `loss_incidents` — date, bird count, and a note the farm writes. Optional link to a `batch_movements` row of type `mortality`. No predator column and no rate column.
- Permissions `000000000130` and `000000000131`: `loss.read`, `loss.record`. Owner, manager, and worker receive both. Vet / advisor receives read only.

Queries use `mysql2` `execute()` (server-side prepared statements). Audit list `LIMIT` and `OFFSET` are interpolated only after the values are checked as integers, because the binary protocol rejects placeholders there.
