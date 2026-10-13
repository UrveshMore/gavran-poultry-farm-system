# Roadmap

Source: `docs/blueprint.md` (master blueprint / SRS, v2.0, 13 Oct 2026).

This file splits blueprint **P0** into ordered build phases. Later runs continue from the first phase that is not marked done. Do not invent veterinary dosages, prices, or legal/tax rules. Record owner answers in `docs/DECISIONS.md`.

## Phase 1 — Foundation (this release)

Done in this repository.

- Monorepo: shared schemas, Express API, Vite PWA shell.
- MySQL 8 via Docker Compose, versioned SQL migrations, prepared statements.
- Authentication: bootstrap owner, cookie sessions, refresh rotation, CSRF, password change.
- Farm and shed setup (WF-01, without batch assignment).
- Deny-by-default roles and farm-scoped permissions.
- Audit log foundation and idempotency keys on farm, shed, and invite creates.
- English, Hindi, and Marathi scaffold. Hindi and Marathi are provisional.
- Mobile-first login, farm, shed, people, and activity screens.
- Backend unit tests and API tests for auth and authorization.

## Phase 2 — Batch lifecycle and movements

Done in this repository. Blueprint WF-07, without prices or medicine.

- The farm types the bird-type name. Nothing is preloaded as a species or strain. Decision 3 is still open.
- A batch opens with a placement movement. Live count is the sum of movements, not a typed balance.
- Transfers, sales, mortality, culling, and other exits are movement types. A sale stores a count only.
- A destination shed must be active, and the birds already there plus the movement cannot pass the shed's usable capacity.
- A batch closes only when the live count is zero. The timeline stays.

## Phase 3 — Egg collection

Done in this repository. WF-02, counts only. On 2026-10-13 the owner said this farm sorts fertile eggs and table eggs. Those two names are a button the owner can press, rename, or ignore. No other sorts are preloaded. A collection can name a batch and a shed, and both can be left blank so a backyard or free-range pickup is not blocked. No sale price.

## Phase 4 — Incubators

Done in this repository. WF-04 equipment records only. Temperature and humidity are optional readings with a unit the farm types. No set-point is stored. An incubator can be marked out of service. Broody hens are the parallel path in Phase 5.

## Phase 5 — Incubation, candling, and broody hens

Done in this repository. A sitting is either an in-service incubator or a named broody hen. Egg count is what the farm types. Candling outcomes are labels the farm types on that record, and the counts must add up. No hatch day, candling day, or broody period is calculated.

## Phase 6 — Hatch

Done in this repository. A hatch from an open sitting records eggs set, live chicks, losses, and other. If those counts do not add up, a note is required. Live chicks open a chick batch. The rate live chicks ÷ eggs set × 100 is labelled proposed. It is not an approved formula.

## Phase 7 — Tasks and seasonal checklists

Done in this repository. WF-08, online only. Offline queue is not part of this phase. Summer heat, monsoon, and winter are owner-editable checklist templates with empty steps until the owner writes them. No care task is preloaded. A task is not generated from batch age. Completing a task twice is refused.

## Phase 8 — Feed, water, inventory, and owner-set growth

Done in this repository. WF-10, WF-11, WF-12. Quantities and user-entered item names. A price is stored only when the owner types an amount on a receipt. No stock valuation method until decision 7. No feed formula is invented. Target weights are numbers the owner types per bird type and age. There is no built-in standard weight. FCR is not calculated.

## Phase 9 — Health observations and the disease knowledge base

Done in this repository. WF-09, plus a Disease & Treatment Knowledge Base. The base is one row per page of the three Patil PDFs in `docs/sources/`. Each row stores the file, the page, and that page's text layer. Those files do not keep Marathi vowel signs in the text layer, so the app does not reconstruct a dose from it. Every row says “owner/vet must verify before use” and starts unapproved. Medicine records and vaccine tasks stay blocked until the owner writes a verification note and approves that page. The medicine record stores what the person typed, not a dose or a withdrawal date. Biosecurity steps are typed by the owner, or copied from `patil-poultry-step-by-step-process.pdf` with the page number and the unapproved flag. A copied step uses the text layer, not text the browser sends.

## Phase 10 — Mortality and predator losses

Done in this repository. A loss note is text the farm writes, with a count, and an optional link to a mortality movement. There is no predator list. The mortality rate is not calculated. The response says decision 4 is still open.

## Phase 11 — Customers, orders, and local prices

Done in this repository. WF-13 with prices the owner types. The local market price list stays empty until the owner enters each rate. No default market price. Orders stay drafts. Invoice posting stays disabled until decision 8 (when a sale is posted). No GST.

## Phase 12 — Expenses

Done in this repository. WF-15 amounts the farm types. Categories start empty. A correction is a new reversing row; the first row is not edited or deleted. No GST or other tax column. No profit figure. Accounting basis stays open (decision 9).

## Phase 13 — Essential reports

Done in this repository. WF-17 for one date range. Each section lists the source rows and a formula status. Egg counts are a sum of those rows. The hatch figure stays proposed. The mortality rate stays not calculated. Expense rows are listed with a sum per money unit, and that sum is not a profit. Accounting basis stays open. Feed conversion is not calculated. The response includes the range, the farm timezone, and the time it was generated. There is no offline queue to exclude.

## Phase 14 — Backup, restore, and P0 hardening

Done in this repository. A restore drill writes one row into the separate database `gavran_restore_drill`, reads it back, and drops that database. It does not touch the application database. No backup schedule, off-site copy, RPO, or RTO is stored. Retention stays a placeholder until decision 15. This closes blueprint P0.

## After P0 — Desi flock details

Done in this repository.

- A range area is a place the farm names. It is not a shed. A movement can send birds out to that area and bring them back. Birds on the area still count as live. There is no stocking density.
- A bird type can carry a strain note the farm types. No breed catalog is seeded. Saying the flock is Desi/Gavran does not fill in strains.
- Rooster and hen counts are numbers the farm types. The ratio is those two numbers. There is no recommended ratio.

## Phase 15 — Attendance and training

Done in this repository. WF-16. An attendance row stores the date, an optional clock time, the check method the farm types, and a note. A second row is a correction. Nothing is edited or deleted. The count of rows is not a score. A worker adds and reads only their own rows. A training item stores the title, the text, and a version label the farm types. An assignment may have a future due date. Finishing it once stores a note and no score. A task can require that item. The person finishing the task must have finished the item first. No course list is seeded.

## Phase 16 — Breeding and parentage

Done in this repository. A parentage note stores the sire and dam as text the farm types, and it may point at batches on the same farm. There is no pairing rule, no coefficient, and no catalog.

## Phase 17 — Supplier workflows

Done in this repository. WF-14. A supplier is a name the farm types. A purchase order stays a draft. A line price and its money unit exist only when someone types them. A goods receipt stores accepted and rejected quantities and does not change stock. A bill and a payment are separate typed amounts. There is no tax column and no stock value.

## Phase 18 — Invoice documents and returns

Done in this repository. An invoice document is text and lines the farm types. Its status is only `unposted`. `POST /invoices` still returns 409 until decision 8. A return is a new row that points at the document. The document stays. No balance is calculated. There is no tax column.

## Phase 19 — Advanced reports

Done in this repository. The same date range can also name a shed, a batch, or a category. The download uses those same filters. Extra sections list attendance rows, parentage notes, goods receipts, unposted invoice documents, and returns. The hatch figure stays proposed. Mortality stays uncalculated. There is no feed conversion and no profit.

## Phase 20 — Notifications

Done in this repository. A notice is a title and a message for one person on the farm. It stays in the app. The recipient can mark it read. `urgent.status` is `not_chosen` because decision 14 is open. Nothing is sent out.

## Phase 21 — Documents and media

Done in this repository. A file is a JPEG, PNG, WebP, or PDF, at most 5 MB, checked by its bytes. The note is text the farm types. Workers cannot open these files. Nothing is deleted. `scan.status` is `not_claimed`. `retention.status` is `not_chosen` because decision 15 is open.

## Phase 22 — PWA install

Done in this repository. The install control appears when the browser offers a prompt, or on an iPhone as a note to use the share menu. Farm records stay on the network. The service worker does not cache `/api`.

## Explicitly later

P1 continues with offline-safe capture, multilingual polish, search, and scheduled reports. P2 (AI image triage, weather, voice, sensors, forecasting, portals, farm map, route planning, a native app, custom model training) stays unstarted. Offline capture must not silently merge stock, finance, mortality, or treatment records. Medical and feeding standards stay owner-editable and sourced. Nothing in those standards is invented. Invoice posting stays off until the farm decides when a sale is posted.
