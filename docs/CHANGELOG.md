# Changelog

## 0.22.0 — 2026-10-13

Phase 21 files.

- A photo or PDF is stored with a note the farm types.
- No scan is claimed, and no retention period is stored.

## 0.21.0 — 2026-10-13

Phase 20 notices.

- A notice stays in the app. The recipient can mark it read.
- No urgent rule is stored.

## 0.20.0 — 2026-10-13

Phase 19 reports.

- A report can filter by shed, batch, or category, and the download uses the same filters.
- New sections list attendance, parentage, receipts, unposted documents, and returns.
- No feed conversion and no profit.

## 0.19.0 — 2026-10-13

Phase 18 invoice documents and returns.

- A document stays unposted. Posting a sale is still refused.
- A return is a new row. The document stays. No balance is calculated.

## 0.18.0 — 2026-10-13

Phase 17 suppliers.

- A draft order stores a price only when someone types the amount and the money unit.
- A receipt does not change stock. A bill and a payment are separate rows.
- There is no tax column.

## 0.17.0 — 2026-10-13

Phase 16 parentage.

- A sire or a dam is text, or a batch on the same farm.
- No pairing rule is stored.

## 0.16.0 — 2026-10-13

Phase 15 attendance and training.

- An attendance row stores the method the farm types. The row count is not a score.
- A worker reads and writes only their own attendance.
- Training stores a version label the farm types. A task can wait until that training is finished. There is no score.

## 0.15.0 — 2026-10-13

Desi flock details after P0.

- A named area that is not a shed can hold birds. They stay in the live count.
- A strain is text on a bird type. There is no breed list.
- Rooster and hen counts are the ratio. No recommended ratio is stored.

## 0.14.0 — 2026-10-13

Phase 14 safeguards. This closes P0.

- A restore drill uses a separate database and then removes it.
- Retention, backup schedule, RPO, and RTO stay unset.

## 0.13.0 — 2026-10-13

Phase 13 reports.

- A report needs a start date and an end date, and it lists the source rows.
- The hatch figure stays proposed. The mortality rate stays uncalculated. There is no feed conversion and no profit.

## 0.12.0 — 2026-10-13

Phase 12 expenses.

- An amount is stored only when someone types it, with a money unit they type.
- A correction adds a reversing row. The first row stays.
- There is no tax column and no profit figure.

## 0.11.0 — 2026-10-13

Phase 11 customers, draft orders, and typed prices.

- A market price exists only after someone types the amount and the unit.
- Orders stay drafts. Posting an invoice is refused until the farm decides when a sale is posted.
- There is no tax column.

## 0.10.0 — 2026-10-13

Phase 10 loss notes.

- A loss is a note and a count the farm writes.
- It can point at a mortality movement. There is no predator list and no mortality rate.

## 0.9.0 — 2026-10-13

Phase 9 health pages.

- All 63 training-PDF pages are listed with file, page, and the PDF text layer.
- Each page starts unapproved. Medicine and vaccine tasks wait for a note the owner or vet writes.
- No dose or withdrawal date is stored by the app.

## 0.8.0 — 2026-10-13

Phase 8 feed, water, and growth.

- Stock is a quantity ledger. An amount is stored only when someone types it on a receipt.
- No stock value and no feed conversion rate are calculated.
- Target weights and ages are numbers the farm types. There is no standard weight.

## 0.7.0 — 2026-10-13

Phase 7 tasks.

- Seasonal checklists for summer heat, monsoon, and winter start with no steps.
- A task can be completed once. A second completion is refused.
- There is no offline queue and no schedule generated from batch age.

## 0.6.0 — 2026-10-13

Phase 6 hatch.

- A hatch can open a chick batch from live chicks.
- The hatch rate is labelled proposed: live chicks ÷ eggs set × 100.

## 0.5.0 — 2026-10-13

Phase 5 incubation.

- A sitting is an in-service incubator or a named broody hen.
- Candling stores the labels the farm types. No hatch day is calculated.

## 0.4.0 — 2026-10-13

Phase 4 incubators.

- Equipment records with an optional egg capacity the farm types.
- Readings may omit temperature and humidity. There is no set-point.
- A machine can be marked out of service.

## 0.3.0 — 2026-10-13

Phase 3 egg collection.

- Owner-named egg sorts. Fertile and table are a button, not a required seed.
- A collection can omit batch and shed. Counts are whole eggs. No price is stored.

## 0.2.0 — 2026-10-13

Phase 2 batch ledger.

- Owner-entered bird type names, opening placements, and movements.
- Live bird count is derived. Sales store a count and no price.
- A batch closes only at zero birds.

## 0.1.0 — 2026-10-13

Phase 1 foundation.

- Monorepo, Docker Compose MySQL 8.4, versioned SQL migrations.
- Cookie sessions, bootstrap registration, farm and shed setup, farm-scoped roles, audit log, idempotency keys.
- Mobile-first shell in English, with provisional Hindi and Marathi.
- Backend unit and API tests for auth and authorization.

No veterinary dosages, prices, or tax rules are included. The owner's disease and treatment PDFs are stored in `docs/sources/` for the later knowledge base. See `docs/ROADMAP.md` for Phase 2.
