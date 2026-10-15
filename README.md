# Gavran Poultry Farm Management System

Phase 1 records the farm, its sheds, and the people who work there. Phase 2 records batches. The live bird count comes from movements, and a sale stores a count with no price. Phase 3 records egg collections as counts of owner-named sorts. Fertile and table are optional labels. A collection can leave the batch and shed blank. No price is stored. Phase 4 records incubators. Temperature and humidity are optional readings with no set-point. Phase 7 records tasks. Summer heat, monsoon, and winter checklists start empty, and a task can be completed only once. Phase 8 records feed and water quantities. A target weight exists only after the farm types it. Phase 9 lists every page of the three training PDFs. A page cannot drive medicine or a vaccine task until the owner approves it in writing. Phase 10 records a loss as a note. There is no predator list and no mortality rate. Phase 11 records customers, draft orders, and prices only after someone types them. Invoices are not posted. Phase 12 records expenses as typed amounts. A correction is a new reversing row. There is no tax and no profit figure. Phase 13 shows a date range and the source rows. The hatch figure stays proposed, and the mortality rate stays uncalculated. Phase 14 checks a restore in a separate database. How long records are kept, and the recovery targets, are not set. A range area is a place you name, not a shed. A strain is text you type. Rooster and hen counts are the ratio, with no recommended ratio. Phase 26 stores a name, a note, and a date for a report. Running it uses dates typed at that moment. Nothing is sent out, and no clock is stored. Phase 25 searches names on this farm. A percent sign is not a wildcard, and a worker does not see suppliers, expenses, or invoice notes. Phase 24 follows the chosen language on the page. Hindi and Marathi stay provisional, and the screen says a fluent review is still needed. Phase 23 lets eggs, a medicine tick, a job, a loss, and an attendance row wait on the device. Stock, money, and medicine records are not stored there. An attendance conflict does not replace the farm row. The other waiting rows are sent, and the screen says someone else changed them. Phase 22 shows an install button when the browser offers one. Farm records still come from the network. Phase 21 stores a photo or a PDF with a note. No scan is claimed, and how long the file is kept is not chosen. Phase 20 stores a notice in the app. Nothing is sent out, and no urgent rule is stored. Phase 19 adds shed, batch, and category filters to a report, and the download uses the same filters. Phase 18 keeps invoice documents unposted and stores a return as a new row. Posting a sale is still refused. Phase 17 records suppliers, draft orders, receipts, bills, and payments as typed amounts. A receipt does not change stock, and there is no tax column. Phase 16 stores a sire and a dam as text or as a batch on the same farm. No pairing rule is stored. Phase 15 records attendance as rows and training as text the farm types. The row count is not a score. A task can wait until that training is finished. Medicines are not filled in by the app. Hindi and Marathi text is provisional and needs a fluent review.

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

- App: http://127.0.0.1:5317 (`CLIENT_PORT`)
- API: http://127.0.0.1:5318 (`PORT`; the app sends `/api` there)
- MySQL on the host: port 3317 (`MYSQL_PORT` and `DB_PORT`)

Those sample ports are in `.env.example`. They are not 4317, 4318, or 3307, because Cursor on the owner's Windows PC already forwards those. Automated tests still set `DB_PORT` to 3307.

`npm run laptop` builds once and serves the screens from the API port. On a small Windows laptop, use MySQL installed on the PC and skip Docker. Phone install and Tailscale are in `docs/WINDOWS_SETUP.md`.

On the flow-3 branch the farm menu is Home, Incubator, Batch, Medicine, Feed, Eggs, Birds, and Hisaab. Older screens, including Gavran Saathi, stay in the program and are not on that menu. The farmer guide is `docs/USER_GUIDE.md`. Account can store a server address on the device.

Gavran Saathi is under Daily work. Speak or type in English, Hindi, or Marathi. A card shows the flock, the number, and the day. Nothing is written until Save. The Gemini key is typed in farm details and stored on the computer. A sick-bird photo is matched to the farm papers and to medicines the owner typed, and labelled possible - confirm with vet. An owner medicine is labelled Added by owner. The amount is only what the owner typed.

The first visit can create the owner account with a mail address and a long secret phrase. After that, People can add a worker with a name, a mobile number, and a PIN of four to six digits. The worker signs in with that number and PIN. Nothing is sent. Tell them the PIN yourself. A mail address is still there for a manager who uses one.

`npm run db:seed` creates a local owner only when `SEED_DEV=true` (the script sets that). Default seed email is `owner@gavran.local` and the password is `change-me-local-only`. The command does not print the password and does not create a farm. Do not enable seeding in production.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` uses the database `gavran_test` and refuses to run unless the database name ends with `_test`.

`npm run restore-drill -w @gavran/server` copies one row into a separate database named `gavran_restore_drill`, checks that row, and drops that database. It does not set a recovery time or a retention period.

## Local passwords

`gavran_local` and `gavran_root_local` are for this development database only. They are in `docker-compose.yml` and `.env.example`. Replace `JWT_SECRET` before any shared deployment. The API refuses to start in production with a sample JWT secret.

## Layout

- `client` — React, TypeScript, Vite, Tailwind, PWA shell
- `server` — Express, TypeScript, mysql2
- `shared` — Zod schemas and the permission catalog
- `database/migrations` — versioned SQL

Stop the database with `npm run db:down`. That keeps the Docker volume. Add `-v` yourself only when you intend to delete the data.
