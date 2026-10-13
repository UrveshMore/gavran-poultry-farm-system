# Changelog

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
