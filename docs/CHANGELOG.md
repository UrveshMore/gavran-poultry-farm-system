# Changelog

## 0.36.0 — 2026-10-14

The owner's desi flow, on the new-flow branch.

- Egg lots store where the eggs came from. Each incubator can have trays. Each tray has its own set date.
- A hatch can be written over more than one day. Each day with live chicks opens its own Gavran flock. The page shows live chicks, eggs set minus live, and live divided by eggs set. That ratio is not an official hatch percent.
- After hatch, the flock page lists the first day: 4 to 5 hours in the incubator, then a chick guard and paper, jaggery or sugar water for 2 hours, then the day-wise medicine paper. Brooding stays 28 days.
- Birds that left can be died, sold, or eaten. A sale asks for an amount and a unit.
- Kharch can take a quantity and a rate. When both are typed, the stored amount is quantity times rate. Income and kharch stay side by side for the same typed unit.
- The home page asks you to pick summer, winter, or rainy. It does not decide the months. The daily routine uses the words that were asked for.
- The bird-type form, range form, rooster and hen counts, the full movement form, and the parentage menu stay in the program and are not on the menu. Vaccination, medicines, and Gavran Saathi stay.

## 0.35.0 — 2026-10-14

Home fixes. Charts, a chat button, and phone alarms that repeat.

- Gavran Saathi answers hello. A Gemini key is tried before it is kept, and the page says Key saved and tested OK. A photo is shrunk before it is sent. The round button sits on every farm screen.
- Home draws egg counts, birds lost, feed used, roosters and hens by flock, and income next to kharch. A death rate is not set. Income minus kharch uses the same typed unit.
- The phone app repeats morning medicine and low feed at 8:00, and evening medicine and today's egg entry at 17:00, including after the app is closed. Opening the farm refreshes the words once that day. Each person can turn a line off. Text messages are not sent.
- Dates are typed as dd/mm/yyyy. The guided tour is stored once per person. A second owner is invited from People. An empty shed list can add a shed on the flock form. Egg lines can be For incubator, For sale, Eaten at home, and Broken. A flock shows incubator, brooding, or grow-out. Brooding is 28 days because that is the length that was asked for.

## 0.34.0 — 2026-10-14

My medicines. The owner or a manager types the dose.

- A medicine has a name, a photo, the diseases it treats, an amount and a unit, how to give it, the days, a note, a precaution, and where it came from. A new disease can be added with signs and a photo. Every line is labelled Added by owner. The amount is only what was typed.
- Adding it to a flock, from a date or an age day, puts it on that flock's day list, on Today's medicine, on the alert, and on Mark given. The training-paper schedule can stay unchecked.
- Gavran Saathi reads these lines. A sick-bird photo match cites Added by owner and still says possible - confirm with vet. A change or a removal is kept in the change list.

## 0.33.0 — 2026-10-14

Gavran Saathi. Speak or type, then tap Save.

- English, Hindi, and Marathi. The mic uses the phone's speech tool. A recording is sent to Gemini only when that tool is missing and a key is stored. The reply is written and spoken.
- Eggs, losses, hatch results, a dose tick, a job, feed used, and a sale or an expense become a card. The card shows the flock, the number, and the day. Nothing is written until Save. A missing flock or day asks again.
- An egg or chick photo shows a count and boxes. You type the real count, then the same card appears. A bird photo is an age guess and visible signs. A sick bird is matched only to the farm papers, with the page, and labelled possible - confirm with vet. A dose is not invented. The photo, the model result, and your correction are kept.
- The Gemini key is typed in farm details and stored locked on the computer. The full key is not sent back.
- The local parser matched 45 of 45 sample lines. Gemini photo counts were not measured: no key was set for this run. Drawn pictures with known counts 3 and 4 are in `server/test/fixtures/saathi/`.

## 0.32.0 — 2026-10-14

A phone app, rows that wait on the device, and one process for a laptop that stays on.

- The Android app is the same screens. The first open asks for the computer address and remembers it.
- Eggs, a medicine tick, a job, a loss, and who came today wait on the device when the computer cannot be reached. They send themselves when it can. If someone else already changed an egg, tick, job, or loss, the screen says so. Who-came-today still stays as a conflict. Feed, money, medicine records, and yard notes do not wait.
- On the phone app, opening the farm sets a reminder for today's morning medicine and low feed at 8:00, and for evening medicine and missing eggs at 17:00.
- `npm run laptop` builds the screens and serves them from the API. `scripts/install-startup-task.ps1` starts that when Windows signs in. A small laptop can use MySQL installed on the PC, with no Docker.

## 0.31.0 — 2026-10-14

Chick-day medicine lines, and a phone notice that says what happened.

- The day-by-day lines from `patil-poultry-step-by-step-process.pdf` pages 17–27 are a schedule. Each line keeps the page. The hatch date is day 1 on that paper. A flock page shows today, tomorrow, and this week. A tick records that the line was given. The sample farm's copy is marked checked, and the note starts with Sample. One line, Coryza at 600 g, has no day and no amount and says to check with the vet.
- Home has a Today's medicine card, grouped by flock, morning and evening.
- Pictures come from that PDF or a plain drawing. An owner can add a photo. A white background is cleared when the local tool can do it.
- **Tell me on this phone** always writes a result on the page. A plain network address cannot show a notice. `HTTPS=1` serves a local certificate so a phone on the same Wi-Fi can.

## 0.30.0 — 2026-10-14

A local sample farm, and a home screen of today's numbers.

- `npm run db:seed:demo` fills one farm with sample birds, eggs, machines, jobs, feed, money, and two workers. It will not run when `NODE_ENV` is `production`. The demo owner password is short only for that one account.
- The home screen shows live birds, roosters and hens, flock age in days, eggs, jobs, and vaccine or medicine days the owner set. A bell and a coloured strip show late jobs, low feed, and due care. Hatch day stays "not set". Writing the medicine for that same page marks the open job done.
- Every list a person may add to has a large add button in the header. An empty list shows the same button inside the empty card.

## 0.29.0 — 2026-10-14

Worker sign-in by mobile number, and ports from the environment.

- The owner adds a worker with a name, a mobile number, and a PIN of four to six digits. The worker signs in with large buttons. The owner still uses a mail address and a long secret phrase.
- The PIN is stored only as a hash. Five wrong tries lock that number until the window passes. The owner or a manager can set a new PIN. A worker cannot.
- `CLIENT_PORT`, `PORT`, `MYSQL_PORT`, and `DB_PORT` come from `.env`. The sample is 5317, 5318, and 3317, because 4317, 4318, and 3307 are already forwarded on the owner's Windows PC. Tests still use database port 3307.

## 0.28.0 — 2026-10-14

Farmer navigation, knowledge notes, and a guided tour.

- Home is a few large tiles: daily work, birds and eggs, incubator, health, feed, sales and money, counts, people, farm setup, and help.
- A worker does not see money or people. Technical tools sit under farm setup.
- A hatch day after the day the flock opened says so, in English, Hindi, and Marathi.
- Disease and medicine notes are one name each, with signs, use, how the paper said to give it, and the source page. Broken page titles were removed. Amounts are only those written on the paper.
- The first visit starts a short tour. Help replays it and explains every screen.
- Today lists jobs that are due and links to eggs, losses, feed, who came, and the yard book.
- The yard book stores when the birds went out, when they were shut in, and a free note. No clock time is suggested.
- Every field has an example or a short hint. A date picker cannot go before 2000 or, unless the field allows it, after today.
- Help explains every screen. The same words are in `docs/USER_GUIDE.md` and `docs/USER_GUIDE.pdf`, with a picture of each screen.

## 0.27.0 — 2026-10-13

Phase 26 named reports.

- A name, a note, and a date are what the farm types.
- Running it uses dates typed at that moment.
- Nothing is sent out, and no clock is stored.

## 0.26.0 — 2026-10-13

Phase 25 search.

- A search needs two characters, and a percent sign is not a wildcard.
- A worker does not see suppliers, expenses, or invoice notes.
- A price is not part of a result.

## 0.25.0 — 2026-10-13

Phase 24 languages.

- The page language follows Hindi or Marathi when that locale is chosen.
- The screen says those translations still need a fluent review.

## 0.24.0 — 2026-10-13

Phase 23 offline capture.

- An attendance row can wait on the device and is sent with the same key.
- Stock, money, losses, and medicine are not stored on the device.
- A conflict does not replace the farm row.

## 0.23.0 — 2026-10-13

Phase 22 install.

- An install button appears when the browser offers one.
- Farm records are still loaded from the network.

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
