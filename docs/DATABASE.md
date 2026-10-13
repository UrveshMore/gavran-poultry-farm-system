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

## 013 sales

- `customers` — name unique per farm. Phone and notes are optional.
- `market_prices` — item name, amount, and unit label the farm types. No row is seeded.
- `orders` — `status` is only `draft`. No posted state.
- `order_lines` — description, quantity above zero, unit price of zero or more. No tax column.
- Permissions `000000000132` and `000000000133`: `sale.read`, `sale.record`. Owner and manager receive both. Worker and vet / advisor receive neither.

## 014 expenses

- `expense_categories` — a name the farm types. No category is seeded.
- `expense_entries` — date, direction `expense` or `income`, amount, and a money unit the farm types. Optional counterparty, reference, notes, and batch. `reverses_entry_id` points at the row a correction undoes. That earlier row is not updated. No tax column.
- Permissions `000000000134` and `000000000135`: `expense.read`, `expense.record`. Owner and manager receive both. Worker and vet / advisor receive neither.

## 015 reports

- No report table. A report is calculated from the rows already stored.
- Permission `000000000136`: `report.read`. Owner and manager receive it. Worker and vet / advisor do not.

## Restore drill

There is no backup table. `npm run restore-drill -w @gavran/server` creates `gavran_restore_drill`, migrates it, restores one user row from an in-memory copy, checks the row, and drops that database. The application database name is refused.

## 016 desi flock

- `bird_types.strain_note` — optional text. No breed catalog.
- `range_areas` — a name that is not a shed. No row is seeded.
- `batch_movements` gains `to_range` and `from_range`, plus optional range-area links. An exit may start from a range area.
- `sex_counts` — rooster count and hen count the farm types. No ratio column and no recommended value.

## 017 attendance and training

- Permissions `000000000137` through `000000000141`: `attendance.read`, `attendance.record`, `training.read`, `training.manage`, `training.complete`. Owner and manager receive all five. A worker receives all except `training.manage`. Vet / advisor receives none.
- `attendance_records` — date, optional clock time, method label, note. No unique day. No score.
- `training_items` — title, body, version label. Unique per farm, title, and version.
- `training_assignments` — one row per item and person. Due date may be null.
- `training_completions` — one row per assignment.
- `task_training_requirements` — optional link from a task to a training item.

## 018 parentage

- Permissions `000000000142` and `000000000143`: `breeding.read`, `breeding.record`. Owner, manager, and worker receive both. Vet / advisor receives `breeding.read`.
- `parentage_records` — typed sire and dam text, optional batch links on the same farm. No coefficient column.

## 019 suppliers

- Permissions `000000000144` and `000000000145`: `supplier.read`, `supplier.record`. Owner and manager only.
- `suppliers` — a name. None are seeded.
- `purchase_orders` — status only `draft`. `purchase_order_lines.unit_price` and `price_unit` are null together unless typed.
- `goods_receipts` — accepted and rejected quantities. No stock foreign key.
- `supplier_bills` and `supplier_payments` — separate typed amounts. No tax column.

## 020 invoice documents

- No new permission. `sale.read` and `sale.record` cover these rows.
- `invoice_documents.status` is only `unposted`.
- `invoice_lines` — quantity and unit. Price and money unit are null together unless typed.
- `sale_returns` — a new row pointing at a document. The document is not removed. No balance column.

## 021 notices

- Permissions `000000000146` and `000000000147`: `notification.read`, `notification.write`. Owner and manager receive both. Worker and vet / advisor receive `notification.read`.
- `notifications` — title, body, and an optional read time. No delivery column.

## 022 files

- Permissions `000000000148` and `000000000149`: `document.read`, `document.record`. Owner and manager only.
- `farm_files` — original name, stored name, media type, byte size, and a note. Bytes live under `uploads/` and are not removed by a schedule. No scan-result column.

## 023 named reports

- No new permission. `report.read` covers these rows.
- `report_schedules` — a name, a note, and `named_on`. No clock column and no delivery address.

Queries use `mysql2` `execute()` (server-side prepared statements). Audit list `LIMIT` and `OFFSET` are interpolated only after the values are checked as integers, because the binary protocol rejects placeholders there.
