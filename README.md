# Gavran Poultry Farm Management System

Phase 1 records the farm, its sheds, and the people who work there. Phase 2 records batches. The live bird count comes from movements, and a sale stores a count with no price. Phase 3 records egg collections as counts of owner-named sorts. Fertile and table are optional labels. A collection can leave the batch and shed blank. No price is stored. Phase 4 records incubators. Temperature and humidity are optional readings with no set-point. Phase 7 records tasks. Summer heat, monsoon, and winter checklists start empty, and a task can be completed only once. Phase 8 records feed and water quantities. A target weight exists only after the farm types it. Phase 9 lists every page of the three training PDFs. A page cannot drive medicine or a vaccine task until the owner approves it in writing. Phase 10 records a loss as a note. There is no predator list and no mortality rate. Phase 11 records customers, draft orders, and prices only after someone types them. Invoices are not posted. Medicines and taxes are not filled in by the app. Hindi and Marathi text is provisional and needs a fluent review.

The blueprint is `docs/blueprint.md`. The build order is `docs/ROADMAP.md`. The owner's training PDFs in `docs/sources/` are the later disease knowledge base. They are not approved doses.

## Requirements

- Node.js 22 or newer
- Docker with Compose

## Run locally

```bash
cp .env.example .env
npm ci
npm run db:up
npm run db:migrate
npm run dev
```

- App: http://127.0.0.1:4317
- API: http://127.0.0.1:4318
- MySQL on the host: port 3307

The first visit can create the owner account. After that, people join by invitation from the farm's People screen. Nothing is emailed. Share the temporary password yourself.

`npm run db:seed` creates a local owner only when `SEED_DEV=true` (the script sets that). Default seed email is `owner@gavran.local` and the password is `change-me-local-only`. The command does not print the password and does not create a farm. Do not enable seeding in production.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` uses the database `gavran_test` and refuses to run unless the database name ends with `_test`.

## Local passwords

`gavran_local` and `gavran_root_local` are for this development database only. They are in `docker-compose.yml` and `.env.example`. Replace `JWT_SECRET` before any shared deployment. The API refuses to start in production with a sample JWT secret.

## Layout

- `client` — React, TypeScript, Vite, Tailwind, PWA shell
- `server` — Express, TypeScript, mysql2
- `shared` — Zod schemas and the permission catalog
- `database/migrations` — versioned SQL

Stop the database with `npm run db:down`. That keeps the Docker volume. Add `-v` yourself only when you intend to delete the data.
