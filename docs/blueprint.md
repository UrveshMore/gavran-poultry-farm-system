# GAVRAN POULTRY FARM MANAGEMENT SYSTEM
## Master Project Blueprint, SRS, Business Workflows & Delivery Plan
**Version:** 2.0 — Expanded planning baseline  
**Purpose:** Single source of truth for product planning, implementation, testing, deployment, and operations  
**Status:** Proposed blueprint; farm-specific business rules and veterinary schedules must be verified before production use.

---

## Document control

| Field | Value |
|---|---|
| Product | Gavran Poultry Farm Management System |
| Primary users | Farm owner, manager, workers, family helpers, veterinarian/advisor |
| Target interface | Mobile-first responsive web application / installable PWA |
| Initial stack | React + TypeScript + Vite; Node.js + Express + TypeScript; MySQL 8 |
| Database access | `mysql2/promise`, prepared statements, versioned SQL migrations |
| Languages | Marathi, Hindi, English |
| Primary goal | Traceable farm operations from egg/breeder source through incubation, bird batches, care, stock, sales, and financial reporting |
| Document owner | Product owner / farm owner |
| Approval required | Business rules, veterinary SOPs, accounting rules, deployment/security decisions |

> This blueprint expands the supplied 35-module / 26-phase concept. It is a planning baseline, not proof that software has been implemented or validated. Do not invent farm policies, medical schedules, dosage values, prices, or legal/tax requirements.

# 1. Executive summary

Build a reliable, easy-to-use, mobile-first poultry farm management system for Gavran/Desi poultry operations. The system should replace paper registers, improve traceability, prevent missed tasks, monitor flock health and stock, manage customers and money, and provide dependable reports.

The product must prioritize:
1. Accurate operational records and traceability.
2. Simple daily workflows for workers with basic smartphone skills.
3. Farm- and role-scoped access control.
4. Safe, auditable handling of veterinary schedules and AI-assisted observations.
5. Offline-friendly data capture with explicit synchronization status.
6. Reconciled inventory and financial movements.
7. Tested, reversible releases and verified backups.

## 1.1 Product outcomes

- Trace eggs from collection/source to incubator allocation, hatch, chick batch, movement, and eventual sale or closure.
- Calculate current bird counts from opening counts and recorded movements, not manually edited totals.
- Track feed, water, weight, health observations, mortality, medicine/vaccine records, and stock.
- Assign and verify recurring tasks with timestamps and optional photo evidence.
- Manage orders, delivery, invoices, receipts, expenses, supplier payments, and receivables.
- Show reliable operational and financial dashboards with date ranges and data freshness indicators.
- Support English, Hindi, and Marathi, with mobile-first worker screens.
- Support offline entry where safe, and never silently discard or double-apply a queued operation.

## 1.2 Non-goals for the first release

- Autonomous diagnosis or treatment decisions.
- Automatic veterinary dosage invention.
- Full accounting/ERP compliance without an approved accounting design.
- IoT automation without hardware validation and fail-safe rules.
- Public customer/supplier portals before core authorization and data isolation are proven.
- Predictive AI presented as fact without validation data and uncertainty display.

# 2. Scope and prioritization

## 2.1 Release tiers

### P0 — Foundation and operational MVP
Authentication, farm setup, role/permission enforcement, sheds, batch lifecycle, incubator/incubation batches, candling/hatching, daily tasks, mortality, feed, water, basic health records, inventory movements, egg collection, customers/orders/sales, expenses/receipts, essential reports, audit trail, backup/restore, and core tests.

### P1 — Operational maturity
Worker attendance and training, breeding/parentage, detailed supplier workflows, invoices and returns, advanced reports, notifications, document/media management, PWA installation, offline-safe capture, multilingual polish, advanced search, and scheduled reports.

### P2 — Optional/advanced
AI-assisted image triage, weather, voice entry, sensor/IoT integration, advanced forecasting, customer/supplier portals, farm map, route planning, native mobile app, and custom ML model training.

**Rule:** Prioritize based on validated farm value and dependencies, not visual novelty. AI, portals, predictive analytics, and IoT must not delay reliable core operations.

# 3. Users, roles, and authorization

Use deny-by-default authorization. UI visibility is a usability feature, not a security boundary. Every API and object lookup must enforce permission and farm scope on the server.

| Role | Typical access | Restrictions |
|---|---|---|
| Owner | Full farm operations, finance, reports, users, configuration, approvals | Cannot bypass immutable audit/history controls without a logged correction flow |
| Manager | Batches, sheds, incubators, tasks, health records, stock, orders and operational reports | No finance access unless explicitly granted; cannot change protected SOPs |
| Worker | Assigned tasks, permitted data capture, photos, own task history | No financial data, user administration, unrestricted reports, or other workers' private data |
| Family helper | Explicitly granted read or data-entry permissions | No implied access; sensitive finance hidden unless granted |
| Vet/advisor | Relevant health history, observations, review and advice | No finance; advice must be attributed and timestamped; no autonomous prescription |
| System administrator (technical) | Deployment and technical maintenance | Business data access should be minimized and audited; no routine business approval powers |

### Authorization requirements
- Permission keys should be granular, e.g. `batch.read`, `batch.create`, `mortality.record`, `medicine.administer.record`, `finance.read`, `finance.approve`, `sop.publish`, `user.manage`.
- Check tenant/farm scope, role permission, object ownership/scope, and record state on every request.
- Record actor, action, entity, entity ID, timestamp, request/correlation ID, and a safe change summary in audit logs.
- Never log passwords, access tokens, full payment credentials, or unnecessary sensitive payloads.
- Deactivate users and revoke sessions/tokens promptly.
- Protect privileged actions with re-authentication or explicit confirmation where appropriate.

# 4. Functional modules

The existing 35 modules are retained as the broad scope. Each module needs its own detailed requirements, screen map, data contract, workflow, API contract, permissions, test cases, and acceptance criteria before implementation.

1. Dashboard and alerts
2. Batch / flock lifecycle
3. Incubator management
4. Incubation batch and egg loading
5. Candling and hatch records
6. Egg collection, grading, allocation, inventory, wastage and sales
7. Health observations and clinical records
8. Medicine/vaccine catalog and approved SOP schedules
9. AI-assisted health triage (optional, guarded)
10. Feed catalog, purchasing, stock, consumption, wastage and FCR
11. Water source, quality observations and change records
12. General inventory, lots, expiry, movements and adjustments
13. Mortality and culling
14. Customer, order, delivery, sales, invoice and returns
15. Supplier, purchase order, goods receipt and supplier payments
16. Finance, accounts, receipts, expenses, cash flow and batch costing
17. Worker profiles, attendance, tasks and performance
18. Worker training, guides, quizzes and completion records
19. Breeding groups, breeders, parentage and offspring traceability
20. Reports, exports and scheduled delivery
21. Notifications and escalation
22. Media and document management
23. Global search and filters
24. PWA and offline-safe workflows
25. IoT/device integration (future)
26. AI assistant and voice capture (future)
27. Weather integration (future)
28. Calendar and scheduling
29. Farm/shed map (optional)
30. Security, sessions and access control
31. Audit history
32. Backup, restore and disaster recovery
33. Localization and accessibility
34. Analytics and trends
35. Logistics, customer/supplier portal, support and other optional extras

# 5. Core end-to-end workflows

Each workflow must be implemented as a tested business journey, not merely a set of CRUD screens.

## WF-01 — Farm and shed setup
1. Owner creates farm profile, timezone, locale, units, and contact details.
2. Owner creates sheds with type, usable capacity, status, and notes.
3. System validates unique farm-scoped codes and capacity values.
4. Manager can assign a batch only if the shed is active and capacity policy permits.
5. Every configuration change is audited.
**Exceptions:** Duplicate code, inactive shed, capacity exceeded, unauthorized user, concurrent assignments.

## WF-02 — Egg collection and inventory
1. Worker selects date, shed, source flock/batch, and collection shift.
2. Worker enters counts by quality: usable, dirty, cracked/broken, rejected; categories must be mutually exclusive.
3. System validates non-negative integer counts and calculates total collected.
4. Approved entries create inventory movements by egg grade/source/lot.
5. Owner/manager can correct a posted record only through a reason-required adjustment; original history remains.
6. Dashboard and reports update from committed movements.
**Invariants:** No negative available inventory; no silent overwrites; each adjustment is traceable.

## WF-03 — Egg allocation to incubator
1. User creates an incubation batch and selects incubator, source lot(s), loading timestamp, egg count, and operator.
2. System checks incubator status/capacity and available egg inventory.
3. Allocation is committed transactionally: decrement available inventory and record the allocation.
4. System calculates the expected hatch date from an approved configurable incubation rule; show it as an estimate.
5. Schedule candling tasks using the farm-approved SOP.
6. Any cancellation/unloading requires a reason and reversing inventory movement.
**Exceptions:** Insufficient eggs, inactive incubator, capacity conflict, duplicate submit, interrupted transaction.

## WF-04 — Incubator monitoring and maintenance
1. Worker selects incubator and records time, temperature, humidity, power status, and notes.
2. System stores units, operator, source (manual/sensor), and timestamp.
3. Alerts are based only on owner-approved thresholds and configured duration; show the threshold and reading.
4. Maintenance takes incubator out of service when required and blocks new loading if policy says so.
5. Sensor failures or stale readings are displayed as unknown/stale, not normal.
**Important:** Do not hard-code universal temperature/humidity values into business logic; use verified SOP configuration.

## WF-05 — Candling
1. Task is generated from the approved schedule.
2. Worker records inspected count and outcome categories defined by the farm SOP.
3. Counts must reconcile to the inspected quantity.
4. System updates the incubation batch summary without deleting raw observations.
5. A second candling event is a separate record, not an overwrite.
6. Uncertain or abnormal outcomes can be escalated to manager/vet.

## WF-06 — Hatching and chick batch creation
1. Authorized user records hatch date/time, eggs set, hatch outcomes, live chicks, losses, and other approved categories.
2. Validation checks totals against loaded eggs and candling/previous hatch records; differences require explanation.
3. Hatch rate formula is displayed with its denominator, e.g. live chicks ÷ eggs set × 100; alternate industry denominators must be labelled explicitly if used.
4. System creates a new chick batch linked to incubation batch, egg sources, hatch record, and parent flock where known.
5. Initial live count is derived from the hatch record; sex counts may be unknown rather than forced.
6. Repeated submission is prevented with idempotency and uniqueness rules.
**Exceptions:** Partial hatch, late hatch, corrected hatch, missing sex information, duplicate event, mixed source lots.

## WF-07 — Batch lifecycle and movement
1. Create batch manually or from a hatch record.
2. Assign batch code, source, hatch/birth date, species/strain/type, initial count, and current location.
3. Record transfers between sheds/locations with from/to, count, date, reason, and authorizer.
4. Source batch decreases and destination increases atomically; counts cannot become negative.
5. Record sales, mortality, culling, and other exits as separate movement types.
6. Batch close/archive requires zero unexplained birds and resolution of outstanding stock/health tasks or a documented exception.
7. Maintain a timeline of all lifecycle events.
**Invariant:** Current live count = opening live count + incoming movements − outgoing movements − mortality − culling, according to explicitly defined movement semantics.

## WF-08 — Daily task assignment and completion
1. Tasks are generated from approved schedule templates and batch age/event dates.
2. Manager reviews generated tasks, assigns a worker, due window, instructions, and proof requirements.
3. Worker sees only assigned/authorized tasks in a simple mobile list.
4. Worker marks started/completed, records actual quantity/time and optional required photo.
5. System prevents a task from being completed twice; edits after completion require permission and reason.
6. Overdue or failed tasks are escalated based on configuration.
7. Offline completion is queued with a visible pending-sync status and stable operation ID.

## WF-09 — Health observation, treatment and withdrawal
1. Worker reports symptoms/observation, affected batch/bird count, onset time, severity, and optional image.
2. Manager/vet reviews and records an assessment; AI may offer non-diagnostic triage only if enabled.
3. Medicine/vaccine administration must reference an approved, versioned SOP or authorized vet instruction.
4. Record product, batch/lot, expiry, quantity, route/method where approved, operator, timestamp, and source instruction.
5. Deduct stock transactionally and retain the treatment history.
6. Calculate withdrawal end date only from a verified rule and actual administration record; show uncertainty or require vet review if data is incomplete.
7. Escalate critical signs and unusual mortality according to the approved farm protocol.
**Safety:** AI must not invent diagnoses, products, dosage, route, or withdrawal periods. No automatic treatment based solely on a photo.

## WF-10 — Feed purchasing, stock and consumption
1. Record purchase order/goods receipt with supplier, feed type, lot, quantity, unit, cost, and expiry if relevant.
2. Stock increases only when receipt is confirmed.
3. Worker records batch/shed consumption, date/shift, quantity, and wastage.
4. Consumption reduces stock in a transaction; negative stock is blocked unless a specifically approved exception is used and audited.
5. FCR calculation must document the chosen formula, period, weight gain source, and mortality/transfer treatment.
6. Low-stock alerts use reorder thresholds and lead time.
7. Corrections use reversing movements rather than deleting posted transactions.

## WF-11 — Water and environment records
1. Worker selects shed/batch and records water service/change, source, quantity if measured, sanitizer/quality observation if applicable, time, and notes.
2. Schedule frequency is configured by approved farm SOP and season, not hidden in code.
3. Missed service or abnormal observations create tasks/alerts.
4. Sensor readings must include timestamp, unit, device/source, and freshness.
5. Water records do not claim laboratory quality unless a real test result is entered.

## WF-12 — Inventory and expiry
1. Create item with category, base unit, conversion rules, reorder level, and tracking requirements.
2. Receive a lot with quantity, cost, supplier, received date, expiry, and lot number.
3. Issue stock against a purpose and optionally a batch/task.
4. Transfers and adjustments require source/destination or reason.
5. Use FIFO/FEFO only if approved for the item category; do not assume all items use the same valuation/issue method.
6. Expired/blocked stock is unavailable for normal use.
7. All movements are immutable; corrections are compensating entries.

## WF-13 — Customer order to payment
1. Create customer and order with item, quantity, agreed price, delivery date, and terms.
2. Reserve/allocate stock only if the chosen order policy requires it.
3. Confirm order, pick/pack, deliver, and record proof/status.
4. Post sale/invoice only at the configured business event; do not create duplicate invoices on retries.
5. Record partial/full payment with method, reference, date, and account.
6. Handle cancellation, returns, credit notes, refunds, and damaged goods using explicit reversal workflows.
7. Outstanding = posted receivable − allocated receipts/credits under the chosen accounting rules.
8. WhatsApp/email sends must be retry-safe and show delivery status where provider supports it.

## WF-14 — Supplier purchase and payment
1. Create purchase request/order if used.
2. Receive goods and record actual accepted/rejected quantities.
3. Update inventory only for accepted receipts.
4. Record supplier invoice and payable separately from cash payment.
5. Record partial/full payments and supplier credits.
6. Reconcile purchase, stock movement, invoice, and payment references.
7. Corrections retain audit trail and do not erase historical stock/cash movement.

## WF-15 — Expenses, receipts and batch costing
1. User enters income/expense with date, category, account, amount, payment status, counterparty, reference, and optional batch allocation.
2. Validate decimal precision, currency, and required fields.
3. Posted finance entries are not silently edited; use reversal/correction entries.
4. Cash/bank movement is distinct from invoice or payable/receivable recognition.
5. Batch cost allocation policy is explicit (direct costs, shared overhead, allocation basis).
6. Profit report labels cash basis/accrual basis and the included/excluded categories.
7. GST/tax features remain disabled until rules are reviewed by a qualified local professional.

## WF-16 — Worker attendance and training
1. Manager creates worker profile and grants least-privilege access.
2. Attendance captures date/time and permitted method.
3. Manager assigns training material/quiz with due date.
4. Worker completes content and assessment; completion is recorded with version.
5. Restricted tasks can require specific training completion.
6. Performance reporting uses transparent, documented metrics and allows corrections.

## WF-17 — Reports and dashboard
1. Every metric has a written formula, date basis, source tables, and timezone.
2. Filters include farm, shed, batch, date range, and relevant category.
3. Totals reconcile to underlying records and movement ledgers.
4. Report exports use the same filters as the visible report.
5. Large exports are asynchronous and permission-checked.
6. Reports display generated time and whether offline/pending data is excluded.
7. Financial reports distinguish cash flow, sales, receivables, expenses, and profit.

## WF-18 — Offline capture and synchronization
1. Cache only the minimum authorized reference data.
2. Every offline write receives a UUID operation ID, device timestamp, user ID, schema version, and sync state.
3. Queue is encrypted/isolated where platform capability permits; do not store secrets in local storage.
4. On reconnection, send operations with idempotency keys and server-side deduplication.
5. Server validates current permission, record version, and business invariants.
6. Conflicts are resolved by explicit policy: append-only events where possible; otherwise present conflict for review. Never silently use last-write-wins for stock, finance, mortality, or treatment.
7. Show pending, syncing, synced, conflict, and failed states with retry guidance.
8. Logout/revocation clears or securely isolates user-specific local data.

## WF-19 — AI-assisted health triage
1. User uploads image and structured observations with consent/authorization.
2. Backend validates type, size, metadata, and malware risk; strips sensitive metadata where appropriate.
3. AI returns possible visual observations, uncertainty, limitations, and a request for vet review—not a definitive diagnosis.
4. No drug/dose is generated unless retrieved from a current approved, attributable source and reviewed by an authorized person.
5. Critical flags trigger a configured escalation, not automated treatment.
6. Store model/provider/version, prompt/template version, input reference, output, reviewer decision, and timestamp with access controls.
7. Evaluate on representative labelled images before relying on outputs; monitor false negatives/positives and allow the feature to be disabled.

## WF-20 — Backup, restore and incident response
1. Automated backups run on a documented schedule.
2. Backups are encrypted, access-controlled, and stored separately from the primary database.
3. Monitor backup success/failure and alert the owner/technical administrator.
4. Perform a restore drill to an isolated environment on a defined cadence.
5. Document recovery point objective (RPO) and recovery time objective (RTO) with the owner.
6. Incident process: contain, preserve logs, restore safely, validate data, communicate, and document corrective actions.

# 6. Business rules and metric definitions

These are proposed defaults for design, not replacements for farm-approved policy. Confirm each before production.

- **Live birds:** Opening live count + valid incoming transfers − outgoing transfers − recorded mortality − recorded culling/sales, avoiding double-counted exit events.
- **Eggs collected:** Sum of mutually exclusive quality categories for a collection record.
- **Egg availability:** Opening available quantity + accepted collections/returns − incubator allocations − sales − wastage ± approved adjustments.
- **Hatch rate:** Define denominator explicitly. A common operational measure is live chicks ÷ eggs set × 100; fertility-based hatch rate uses a different denominator and must be labelled separately.
- **Mortality rate:** Mortality count divided by a defined population-at-risk denominator over a defined period. Do not use a changing live count without documenting the formula.
- **Feed conversion ratio (FCR):** Feed consumed ÷ defined live-weight gain for a stated cohort and period. Define treatment of mortality, transfers, and missing weights.
- **Stock on hand:** Opening balance + receipts + transfers in − issues − transfers out − wastage ± approved adjustments.
- **Customer outstanding:** Posted receivables − allocated receipts − credit notes/write-offs, per approved accounting policy.
- **Batch profitability:** Revenue recognized under chosen policy − direct costs − allocated shared costs, with allocation method and exclusions shown.
- **Age:** Calculated from configured local date/time and hatch/birth date; timezone and partial-day handling must be consistent.
- **Capacity:** Current occupancy + proposed assignment must not exceed active capacity unless an authorized, audited override policy exists.

### Global invariants
- Counts and quantities cannot be negative unless a documented exception is approved.
- Posted operational/financial events are never hard-deleted through normal UI.
- Corrections create an auditable reversal or adjustment.
- Every stock change has a source event, actor, timestamp, unit, and reference.
- Every batch has a unique farm-scoped code and lifecycle history.
- Every scheduled task is traceable to its template/version and triggering batch/event.
- All dates are stored consistently (UTC timestamps for instants, explicit local farm timezone for schedules/date-only events where applicable).
- All monetary amounts use fixed-precision decimal types, never floating-point arithmetic.
- Idempotency is required for retries of consequential operations.

# 7. Data model requirements

The original table inventory is a useful starting list, but it is not a complete database schema. Before implementation, produce `docs/DATABASE.md` and executable migrations containing:

- Table purpose, columns, data types, nullability, defaults, primary keys, foreign keys, unique constraints, check constraints, and indexes.
- Farm-scoped uniqueness and access isolation.
- Creation/update timestamps, actor references, and version/concurrency fields where appropriate.
- Soft deletion only for appropriate master records; never use it to hide posted ledger history.
- Explicit status transitions and constraints.
- Migration rollback/forward strategy and tested seed data.
- Retention and privacy policy for media, health records, worker records, and audit logs.

### Required entity groups
- Identity: users, roles, permissions, role_permissions, sessions/refresh tokens, password reset tokens, audit logs.
- Farm structure: farms, farm_memberships, farm_settings, sheds, equipment, locations.
- Flock: batches, batch_events, batch_movements, batch_weights, batch_status_history, batch_media.
- Incubation: incubators, incubator_readings, incubation_batches, egg_allocations, candling_records, hatch_records, maintenance_records.
- Eggs: egg_collection_records, egg_lots, egg_movements, egg_quality_records, egg_sales.
- Health: health_observations, diagnoses/assessments, treatments, medicine_catalog, vaccine_catalog, SOP documents/versions, administration records, withdrawal rules, AI triage records.
- Feed/water: feed_catalog, feed_lots, feed_movements, consumption_records, water_sources, water_service_records, environment_readings.
- Inventory: stock_items, stock_lots, stock_movements, suppliers, purchase_orders, goods_receipts, purchase_invoice records.
- Commerce: customers, orders, order_items, deliveries, sales/invoices, receipts, credit_notes, returns.
- Finance: accounts, transactions, expense_categories, expenses, payment allocations, batch cost allocations.
- Workforce: workers/user links, attendance, tasks, task templates, assignments, task evidence, training courses/modules/results.
- Platform: notifications, files/media, backup records, sync operations, integration logs, job runs, settings, migration history.

**Design note:** Avoid duplicated, independently editable counts. Derive balances from movements or maintain cached balances only with transactional updates and reconciliation jobs.

# 8. API and service conventions

- Version the API, e.g. `/api/v1/...`, and publish an OpenAPI specification.
- Use consistent success/error envelopes, stable error codes, and correlation IDs.
- Validate request params, query, and body with Zod on the server.
- Use prepared SQL statements; never concatenate user input into SQL.
- Apply authentication, farm scope, permission checks, rate limits, and safe error handling centrally.
- Use transactions for multi-record operations (egg allocation, hatch-to-batch creation, transfer, stock issue, sale/receipt posting).
- Use pagination, filtering, sorting allowlists, and maximum page/export limits.
- Add idempotency keys to critical create/post operations.
- Use optimistic concurrency/version checks for edits where concurrent updates can occur.
- Do not expose stack traces, SQL errors, filesystem paths, or secrets to clients.
- Use background jobs for exports, notifications, scheduled tasks, and AI processing; track retries and terminal failures.
- Document each endpoint's permissions, request/response schema, status codes, and tests.

Example API groups:
`/api/v1/auth`, `/users`, `/farms`, `/sheds`, `/batches`, `/movements`, `/incubators`, `/incubation-batches`, `/candling`, `/hatches`, `/eggs`, `/health`, `/sops`, `/feed`, `/water`, `/inventory`, `/suppliers`, `/customers`, `/orders`, `/deliveries`, `/invoices`, `/payments`, `/expenses`, `/workers`, `/tasks`, `/training`, `/reports`, `/notifications`, `/media`, `/sync`, `/audit`, `/backups`, `/settings`.

# 9. Technical architecture

## Frontend
- React + TypeScript + Vite.
- Tailwind CSS and shadcn/ui where useful.
- React Router, TanStack Query, React Hook Form + Zod, i18next, Recharts.
- Keep API clients, domain logic, components, and pages separated.
- Use accessible forms, clear loading/empty/error/offline/conflict states, and 44px+ touch targets.
- Avoid adding libraries without a concrete need and maintenance assessment.

## Backend
- Node.js LTS + Express + TypeScript strict mode.
- Modular route/controller/service/repository boundaries.
- `mysql2/promise`, connection pooling, prepared statements, transaction helpers.
- Central error handling, structured logging, request IDs, validation and authorization middleware.
- Background jobs must be retry-safe and observable.

## Database and files
- MySQL 8 with versioned SQL migrations.
- Local storage only for development; production object storage should be private with short-lived signed access where appropriate.
- Store metadata and ownership in database; validate file size, MIME/signature, authorization, and safe filenames.
- Do not put uploaded production files in a publicly served folder by default.

## Deployment
- Separate development, staging, and production environments.
- Secrets managed via environment/secret manager, never committed.
- HTTPS, database network restrictions, least-privilege service accounts, health checks, log/metric monitoring, automated backups.
- Pin dependencies and use lockfiles; scan dependencies and container/build artifacts where applicable.
- Document deployment, migration, rollback, restore, and incident steps.

## Authentication note
JWT is not a complete session design by itself. Decide access-token lifetime, refresh-token rotation/revocation, cookie or header storage, CSRF posture, logout behavior, and device/session management. For browser applications, prefer a carefully designed secure cookie strategy where appropriate; do not store long-lived credentials in localStorage.

# 10. UI/UX and accessibility requirements

- Mobile-first worker flows with minimal typing and large actions.
- Role-based navigation and task-focused home screens.
- Persistent farm context where multi-farm support exists.
- Clear labels, units, date/time, language, and validation messages.
- Confirm destructive or irreversible actions; show reason field for corrections.
- Status vocabulary must be consistent across screens and reports.
- Every screen must include loading, empty, error, success, permission-denied, and offline/sync states where relevant.
- Keyboard navigation, visible focus, labels, contrast, screen-reader semantics, and WCAG 2.2 AA target.
- Do not rely on color alone for status.
- Test on low-end Android devices, narrow screens, slow networks, and large text settings.
- Marathi/Hindi translation must be reviewed by a fluent person; machine translation alone is not approval.

# 11. Security, privacy and reliability

Minimum security baseline:
- Deny-by-default RBAC and farm-level authorization.
- Password hashing with a suitable modern password-hashing algorithm and reviewed parameters.
- Rate limits and abuse protection for login, reset, uploads, AI, and expensive reports.
- Secure headers, strict CORS allowlist, TLS, request size limits, and safe cookie settings.
- SQL injection protection, XSS prevention, CSRF protection where cookie authentication requires it.
- Upload validation, private storage, malware scanning where feasible, and access-controlled media links.
- Audit logging for permission changes, user administration, SOP publication, stock/finance posting, corrections, exports, and backups.
- Data minimization, retention/deletion policy, and consent/notice for external AI services.
- Dependency scanning, secret scanning, vulnerability triage, and documented incident response.
- No real secrets, `.env`, customer data, or private media in Git commits.
- Backup encryption and periodic restore drills.

# 12. AI and veterinary safety policy

AI health functionality is optional and must remain assistive.
- Clearly label AI output as a possibility/observation, not a confirmed diagnosis.
- Display uncertainty, limitations, and when the model cannot assess an image.
- Require human/veterinary review for treatment decisions.
- Never fabricate drug names, doses, routes, schedules, or withdrawal periods.
- Retrieval must be limited to approved, current SOP/veterinary sources with source/version attribution.
- Keep a human-readable review trail: submitted observations, model/provider/version, result, reviewer, decision, and timestamp.
- Evaluate using representative, consented, labelled farm images and document model performance and limitations.
- Provide a kill switch, fallback manual workflow, and incident reporting.
- Protect health images and avoid sending them to third-party AI services without an approved privacy and cost decision.

# 13. Testing and quality gates

## Test layers
- Unit: calculations, state transitions, permissions, validators, scheduling, and idempotency.
- Integration: database transactions, repositories, API authorization, migrations, background jobs.
- End-to-end: key workflows listed in Section 5.
- Security: unauthorized object access, privilege escalation, injection, XSS/CSRF, rate limits, upload abuse, secret leakage.
- Offline: duplicate retry, expired session, stale reference data, conflict, app restart, partial sync, device time drift.
- Accessibility and responsive tests.
- Backup/restore and deployment smoke tests.

## Mandatory phase exit checklist
- [ ] Scope and acceptance criteria approved.
- [ ] Database migration and rollback/forward plan reviewed.
- [ ] API contracts and permission matrix updated.
- [ ] Business rules and formulas documented.
- [ ] Unit and integration tests pass.
- [ ] E2E tests added for affected critical workflows.
- [ ] Negative, boundary, duplicate-submit, and concurrency cases tested.
- [ ] Accessibility/mobile/offline states reviewed as applicable.
- [ ] Security review passed for affected surface.
- [ ] `typecheck`, `lint`, `test`, and production `build` pass.
- [ ] No secrets or real environment files staged.
- [ ] Documentation and changelog updated.
- [ ] Reviewer signs off; defects classified and tracked.
- [ ] Git diff reviewed; focused commit created.
- [ ] Push to configured remote verified when available and authorized.
- [ ] If any command fails or remote is unavailable, report exact failure; never claim success.

Coverage target such as 70% may be a baseline, but critical business logic should have stronger targeted coverage. Coverage percentage alone does not prove correctness.

# 14. Expanded delivery roadmap

The original 26 phases are reorganized into dependency-aware gates. Some can be split into smaller tickets; do not implement all modules in one giant prompt.

| Phase | Deliverable | Exit evidence |
|---|---|---|
| 0 | Discovery and decisions | Approved MVP, terminology, SOP sources, metrics, risks, open questions |
| 1 | Repository and development foundation | Reproducible setup, scripts, env validation, CI baseline |
| 2 | Architecture and database baseline | ERD, migrations, seed strategy, API conventions |
| 3 | Authentication and sessions | Login/logout/refresh/revoke tests and secure defaults |
| 4 | Farm scope, roles and permissions | Permission matrix and negative authorization tests |
| 5 | UI design system and layouts | Mobile/desktop shell, accessible component showcase |
| 6 | Farm, shed and equipment setup | CRUD, capacity rules, audit history |
| 7 | Batch lifecycle and movements | Count reconciliation and transfer invariants |
| 8 | Incubator and readings | Logs, maintenance, stale-reading behavior |
| 9 | Egg collection and egg inventory | Quality categories, ledger, reconciliation |
| 10 | Incubation allocation and candling | Capacity/inventory transaction, schedule traceability |
| 11 | Hatching and chick-batch creation | Idempotent hatch workflow and source lineage |
| 12 | Task templates, schedules and assignment | Generated tasks, reassignment, proof, escalation |
| 13 | Feed and water | Stock/consumption ledger and configured SOP tasks |
| 14 | Health observations and treatments | Approved references, audit, withdrawal safeguards |
| 15 | Mortality/culling | Count reconciliation and configurable alerts |
| 16 | General inventory and suppliers | Lots, receipts, expiry, movement reconciliation |
| 17 | Customers, orders, delivery and sales | State transitions, invoice, returns and duplicate prevention |
| 18 | Expenses, payments and costing | Reconciled transactions and documented accounting policy |
| 19 | Worker management and training | Permissions, training completion and task linkage |
| 20 | Reports and dashboard | Metric dictionary and reconciliation tests |
| 21 | Notifications and calendar | Retry-safe jobs, deduplication, delivery state |
| 22 | Media, documents and search | Secure upload, retention, scoped search |
| 23 | Localization and accessibility hardening | Reviewed translations and device tests |
| 24 | PWA and offline sync | Idempotency, conflict handling, sync tests |
| 25 | AI-assisted triage (optional) | Safety evaluation, human review, kill switch |
| 26 | Weather/IoT/voice/map/portals (optional) | Integration-specific risk and acceptance evidence |
| 27 | Production readiness | Load/security checks, backup restore drill, monitoring, rollback plan |
| 28 | Pilot and release | Real-user acceptance, issue log, training, sign-off |
| 29 | Post-launch improvement | Usage metrics, incident reviews, prioritized backlog |

**Timeline:** Do not promise a fixed two-month delivery. Estimate after Phase 0 and a working technical spike; include testing, data migration, user training, deployment, and pilot time.

# 15. Agent workflow and AI coding protocol

Suggested roles:
1. Product/Project Manager — scope, tasks, dependencies, acceptance criteria; does not silently change product rules.
2. Architect — domain model, API/data/security decisions and architecture decision records.
3. UI/UX Designer — screen flows, mobile interactions, accessibility and design tokens.
4. Developer — implements one bounded ticket/phase and adds tests.
5. QA/Tester — independent verification, negative tests and evidence.
6. Security Reviewer — threat review for auth, uploads, permissions, AI, offline sync and finance.
7. Database Specialist — schema, migrations, indexes, transaction correctness and reconciliation.
8. Release Owner — CI status, changelog, backup/rollback and deployment readiness.

A single AI agent may simulate roles, but the project must still preserve independent review steps and evidence. Multiple chat tabs do not automatically guarantee independence.

## Per-ticket workflow
1. Read the relevant requirements and current repository state.
2. Inspect `git status`, branch, recent commits, scripts, and existing implementation.
3. Write a small plan and list assumptions/open questions.
4. Update requirements/API/schema before coding if the contract changes.
5. Implement only the approved scope.
6. Add tests before claiming completion.
7. Run the repository's actual scripts; do not assume `typecheck` or `test` scripts exist.
8. Inspect the diff for unrelated changes, unsafe migrations, secrets, and generated artifacts.
9. QA/security reviewer returns PASS/FAIL with evidence.
10. Fix and retest failures.
11. Commit only after checks pass; push only if a configured remote exists and the user/workflow authorizes it.
12. Report changed files, commands/results, known gaps, commit hash, and push status truthfully.

## Definition of done
A task is not done because code was generated. It is done only when the agreed behavior exists, the relevant tests pass, permissions and failure paths are checked, documentation is updated, and Git/release status is accurately reported.

# 16. Repository and documentation layout

```text
gavran-poultry/
  AGENTS.md
  README.md
  .gitignore
  .env.example
  docs/
    PRODUCT.md
    SRS.md
    WORKFLOWS.md
    ARCHITECTURE.md
    DATABASE.md
    API.md
    PERMISSIONS.md
    BUSINESS-RULES.md
    METRICS.md
    UI-DESIGN.md
    OFFLINE-SYNC.md
    AI-SAFETY.md
    SECURITY.md
    TEST-PLAN.md
    DEPLOYMENT.md
    BACKUP-RESTORE.md
    ROADMAP.md
    DECISIONS.md
    CHANGELOG.md
  prompts/
    phase-00-discovery.md
    phase-01-foundation.md
    ...
  client/
  server/
  database/
    migrations/
    seeds/
  tests/
    unit/
    integration/
    e2e/
    security/
  infra/
    deployment/
    monitoring/
```

Use the actual repository layout if it already exists; do not reorganize everything without inspecting the current codebase and proposing a safe migration plan.

# 17. Required project artifacts before major coding

- Product scope and MVP decision log.
- Glossary of farm terminology and units.
- User role/permission matrix.
- Workflow diagrams and exception paths.
- Entity relationship diagram and migration plan.
- API/OpenAPI contract.
- Metric/formula dictionary.
- Approved medicine/vaccine/feed SOP register with source, version, approval date, and responsible reviewer.
- Threat model and data-retention plan.
- Offline conflict/idempotency design.
- Test plan and traceability matrix linking requirement → workflow → tests.
- Deployment, rollback, backup, and restore runbooks.
- Pilot checklist and worker training plan.

# 18. Product decisions that must be answered

Do not let the AI invent these decisions. Record the answer and date in `docs/DECISIONS.md`.

1. Is this single-farm only initially, or must it support multiple farms/tenants from day one?
2. Which egg categories and inventory units are actually used on the farm?
3. Which bird types/species/strains and batch statuses are required?
4. What are the official hatch-rate, mortality-rate, and FCR formulas for the owner's reports?
5. Which source documents are authoritative for vaccines, medicine, feed, water and incubation SOPs?
6. Who can approve and publish SOP changes?
7. What are the stock issue and valuation methods by category?
8. When is a sale/invoice posted: order confirmation, dispatch, or delivery?
9. Which accounting basis and batch-cost allocation policy are required?
10. Which offline workflows are essential, and which operations must require online approval?
11. What devices, internet quality, language defaults, and worker phone-sharing patterns exist?
12. What hosting budget, storage budget, AI budget, uptime, RPO, and RTO are acceptable?
13. Is external AI processing of farm images allowed?
14. Which alerts require urgent escalation, and who receives them?
15. What data must be retained, exported, anonymized, or deleted, and for how long?

# 19. `.cursorrules` / `AGENTS.md` operating rules

- Treat `docs/PRODUCT.md`, `docs/SRS.md`, `docs/WORKFLOWS.md`, `docs/BUSINESS-RULES.md`, and `docs/DECISIONS.md` as the source of truth.
- Inspect the current repository before changing files; preserve working behavior.
- Work on one small approved task at a time.
- Do not use Prisma; use `mysql2/promise` and prepared statements, as selected for this project.
- Use strict TypeScript; avoid `any` and unsafe casts.
- Validate all untrusted inputs on the server with Zod or an equivalent approved schema.
- Enforce permissions and farm scope in the backend.
- Use transactions for multi-record business operations.
- Never invent medicine doses, vaccine schedules, veterinary advice, or farm policy.
- Do not silently edit or delete posted ledger/history records.
- Make retries idempotent for critical writes and background jobs.
- Do not claim a test passed unless it was run and passed.
- Read `package.json` and use scripts that actually exist; if a required script is missing, report it and propose a safe fix.
- Run typecheck, lint, unit/integration tests, relevant E2E tests, and production build.
- Do not modify unrelated modules.
- Never commit `.env`, secrets, tokens, private user data, or production uploads.
- Review `git diff` and `git status` before commit.
- Commit focused, meaningful changes; push only when remote and authorization are available.
- If a command fails, show the real failure and continue diagnosis; do not hide errors or claim success.
- Ask the owner when a business rule is ambiguous.
- Update docs and changelog when behavior or contracts change.

# 20. Master acceptance criteria

The system is ready for a pilot only when:
- A full egg-to-hatch-to-batch-to-sale trace can be reconstructed.
- Bird, egg, feed, medicine and inventory balances reconcile to movement history.
- Unauthorized users cannot access protected APIs or another farm's records.
- Core workflows survive duplicate requests and expected concurrent operations.
- Worker can record core tasks on the target mobile device and see sync status clearly.
- Offline conflicts never silently corrupt stock, finance, mortality, or treatment records.
- Reports reconcile to underlying data and show formulas/date ranges.
- Backup restoration has been demonstrated in an isolated environment.
- Critical workflow tests, security tests, production build, and smoke tests pass.
- Owner/manager/workers complete a pilot acceptance checklist.
- Known limitations and unresolved decisions are visible and approved.
- Deployment, rollback, incident, and support procedures are documented.

# 21. Recommended first prompt for Cursor/OpenCode

```text
You are the engineering team for Gavran Poultry Farm Management System.

First, read the project documentation and inspect the existing repository. Do not start implementing all modules. Do not overwrite or reorganize existing files blindly.

Step 1: Report repository status, current stack, scripts, existing features, tests, migrations, branch, remote configuration, and current failures.
Step 2: Compare the implementation with the master blueprint and produce a gap analysis with evidence (file paths and commands).
Step 3: Identify conflicting or unanswered business decisions. Ask concise questions only where needed; do not invent veterinary, financial, or farm-specific rules.
Step 4: Propose a prioritized MVP plan and a requirement-to-workflow-to-test traceability matrix.
Step 5: Implement only the next explicitly approved phase/ticket.
Step 6: Run the actual available typecheck, lint, test, E2E, and build scripts. Fix failures in scope and report unresolved failures honestly.
Step 7: Review permissions, transactions, idempotency, audit trail, offline behavior, and secrets as applicable.
Step 8: Inspect git diff/status. Commit only when checks pass. Push only if a remote is configured and push is authorized.
Do not claim a feature, test, commit, or push succeeded without evidence.
```

# 22. Final recommendation

Use this blueprint as the master document and split it into focused files under `docs/` as implementation begins. Keep business rules, SOP source documents, data model, workflows, API contracts, test cases, and decisions synchronized. Start with a dependable operational MVP, validate it with real farm users, and add AI/IoT/portals only after the core records and controls are reliable.
