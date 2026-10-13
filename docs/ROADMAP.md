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

## Phase 3 — Egg collection (recommended next)

WF-02. Counts only. Egg categories stay unset until decision 2 is answered. No sale prices.

## Phase 4 — Incubators

WF-04 equipment records only. Do not hardcode temperature or humidity set-points. Leave them empty until an approved SOP exists.

## Phase 5 — Incubation and candling

WF-03 and WF-05. Do not invent candling or hatch day numbers. Refuse date calculations until an approved rule is recorded in `docs/DECISIONS.md`.

## Phase 6 — Hatch

WF-06. Hatch event links eggs to a new chick batch. Hatch-rate formula stays labelled proposed until decision 4 is answered.

## Phase 7 — Tasks

WF-08, online only. Offline queue is not part of this phase.

## Phase 8 — Feed, water, and inventory

WF-10, WF-11, WF-12. Quantities and user-entered item names. No prices until the owner enters them. No stock valuation method until decision 7.

## Phase 9 — Health observations and the disease knowledge base

WF-09, plus a Disease & Treatment Knowledge Base. Build that base only from the owner's Patil Poultry House Training PDFs in `docs/sources/` (saved 2026-10-13):

- `patil-poultry-step-by-step-process.pdf` — shed preparation and the steps around receiving chicks (27 pages).
- `patil-poultry-antibiotics.pdf` — named products, what they are used for, and how they are given (18 pages).
- `patil-poultry-diseases-symptoms-medicines.pdf` — diseases, symptoms, prevention, and listed medicines or vaccines (18 pages).

Extract diseases, symptoms, prevention, recommended treatments, and vaccination schedules faithfully from those pages. Do not add a disease, dose, day number, or product that is not in the PDFs. Every entry stores the source file and page. Every entry is labelled “owner/vet must verify before use” and starts unapproved. The owner can set an approval flag. Health observations may link to an entry. Vaccine tasks may be created from a schedule only after that entry is approved. Recording that a medicine was given stays blocked until the linked entry is approved. Do not invent withdrawal periods.

## Phase 10 — Mortality

Mortality and culling events that adjust the derived bird count. Mortality-rate formula stays labelled proposed until decision 4.

## Phase 11 — Customers and orders

WF-13 with user-entered prices. Invoice posting stays disabled until decision 8 (when a sale is posted).

## Phase 12 — Expenses

WF-15 expense capture without GST or other tax rules. Accounting basis stays open (decision 9).

## Phase 13 — Essential reports

WF-17. Every formula is labelled proposed until the owner confirms it. Show the date range and the source rows.

## Phase 14 — Backup, restore, and P0 hardening

WF-20, threat-model notes, retention once decision 15 is answered, and a demonstrated restore in an isolated database. This closes blueprint P0.

## Explicitly later

P1 and P2 in the blueprint (attendance, breeding, invoices, offline sync, notifications, AI, IoT, portals) wait until P0 phases above are accepted. Offline capture must not silently merge stock, finance, mortality, or treatment records.
