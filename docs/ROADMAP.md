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

WF-08, online only. Offline queue is not part of this phase. Summer heat, monsoon, and winter are owner-editable checklist templates with empty steps until the owner writes them. Do not preload care tasks.

## Phase 8 — Feed, water, inventory, and owner-set growth

WF-10, WF-11, WF-12. Quantities and user-entered item names. No prices until the owner enters them. No stock valuation method until decision 7. No feed formula is invented. Target weights for a slower Desi growth curve are numbers the owner types per bird type. There is no built-in standard weight.

## Phase 9 — Health observations and the disease knowledge base

WF-09, plus a Disease & Treatment Knowledge Base. Build that base only from the owner's Patil Poultry House Training PDFs in `docs/sources/` (saved 2026-10-13):

- `patil-poultry-step-by-step-process.pdf` — shed preparation and the steps around receiving chicks (27 pages).
- `patil-poultry-antibiotics.pdf` — named products, what they are used for, and how they are given (18 pages).
- `patil-poultry-diseases-symptoms-medicines.pdf` — diseases, symptoms, prevention, and listed medicines or vaccines (18 pages).

Extract diseases, symptoms, prevention, recommended treatments, and vaccination schedules faithfully from those pages. Do not add a disease, dose, day number, or product that is not in the PDFs. Every entry stores the source file and page. Every entry is labelled “owner/vet must verify before use” and starts unapproved. The owner can set an approval flag. Health observations may link to an entry. Vaccine tasks may be created from a schedule only after that entry is approved. Recording that a medicine was given stays blocked until the linked entry is approved. Do not invent withdrawal periods.

Biosecurity is a separate owner-editable checklist. Steps may be copied from `patil-poultry-step-by-step-process.pdf` only with the source page and the same unapproved flag. Do not add a biosecurity step that is not on that page or typed by the owner.

## Phase 10 — Mortality and predator losses

Mortality and culling events that adjust the derived bird count. A predator or other loss incident is a note the owner writes (what happened, and a count). It can link to a mortality movement. Do not preload a predator list. Mortality-rate formula stays labelled proposed until decision 4.

## Phase 11 — Customers, orders, and local prices

WF-13 with prices the owner types, including a local market price list that stays empty until the owner enters each rate. No default market price. Invoice posting stays disabled until decision 8 (when a sale is posted).

## Phase 12 — Expenses

WF-15 expense capture without GST or other tax rules. Accounting basis stays open (decision 9).

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
