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

WF-17. Every formula is labelled proposed until the owner confirms it. Show the date range and the source rows.

## Phase 14 — Backup, restore, and P0 hardening

WF-20, threat-model notes, retention once decision 15 is answered, and a demonstrated restore in an isolated database. This closes blueprint P0.

## After P0 — Desi flock details

These fit this farm and wait until the P0 phases above are done, so they do not delay eggs, hatch, feed, health, or sales.

- Free-range and backyard areas as locations that are not sheds, so a movement can record birds out on range.
- Breed or strain as text on a bird type. The owner already said the flock is Desi/Gavran. Named strains are still typed by the owner. No breed catalog.
- Rooster and hen counts the owner enters. The ratio is those two numbers. There is no recommended ratio.

## Explicitly later

P1 and P2 in the blueprint (attendance, breeding beyond the counts above, invoices, offline sync, notifications, AI, IoT, portals) wait until P0 is accepted. Offline capture must not silently merge stock, finance, mortality, or treatment records. Medical and feeding standards stay owner-editable and sourced. Nothing in those standards is invented.
