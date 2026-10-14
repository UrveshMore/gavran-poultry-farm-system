# Gavran user guide

Gavran is the farm book for a Desi backyard flock. This guide matches the Help screen in the program. Each screen says what it is, where to find it, why it is there, and how to use it.

Hindi and Marathi words still need a person who speaks them well to check the wording. The name Gavran stays in Latin letters.

Open the program, sign in, and tap the farm name. The first visit starts a short tour. An owner, a manager, and a worker each see only their own tiles. Eggs, Flocks, Incubator machines, and Sick birds and medicines explain themselves once. Tap **Explain this screen** there, or **Show me around** on Help, to play a tour again.

## Sample farm on your computer

`npm run db:seed:demo` fills one local farm. It refuses to run when `NODE_ENV` is `production`. Run it again and it keeps the same farm. Every sample row is marked Sample.

| Who | Sign in |
|---|---|
| Owner | `admin@gmail.com` and `admin@123` (choose **I am the owner**) |
| Manager | `meera.demo@gmail.com` and `manager-demo-1` |
| Worker Lata | mobile `9811100011`, PIN `2468` |
| Worker Raju | mobile `9811100022`, PIN `1357` |

The owner password is short only for this demo account. A new account still needs 10 characters. The same steps are in `docs/WINDOWS_SETUP.md`.

## Sign in

A worker signs in with the mobile number and the PIN the owner set. The number keys are large. Spaces in the number are ignored. The PIN is four to six digits.

The owner signs in with a mail address and a long secret phrase. On the sign-in screen, choose **I am the owner**.

Nothing is sent to the worker. The owner says the PIN out loud or writes it down. The owner or a manager can set a new PIN. The old PIN stops working, and that person is signed out. After five wrong tries, sign-in waits.

## Ports on your computer

Copy `.env.example` to `.env` before the first start. The sample is:

- `CLIENT_PORT=5317` — the program in the browser
- `PORT=5318` — the API. The browser program sends `/api` to this port
- `MYSQL_PORT=3317` and `DB_PORT=3317` — MySQL on this computer
- `CORS_ORIGIN=http://127.0.0.1:5317`

These are not 4317, 4318, or 3307, because Cursor on the owner's Windows PC already forwards those ports. The steps are in `docs/WINDOWS_SETUP.md`. Automated tests still use database port 3307.

## Home

![Home](../client/public/guide/home.png)

**What it is.** The first screen after you open a farm. Cards show birds, roosters and hens, each flock's age in days, eggs, eggs set to hatch, jobs, care days, feed, and money. A coloured band lists late jobs, care that is due, and low feed. Tiles for the main jobs sit under the cards.

**Where it is.** Tap the farm name on the farm list. The bell at the top opens the same coloured band.

**Why it is used.** So you see today's farm before you open a long menu. A worker does not see the money card.

**How to use it.**

1. Read the coloured band. Tap a line to open that page.
2. Tap a card to open flocks, eggs, hatch sets, jobs, care, feed, or sales.
3. Tap **Tell me on this phone** if you want this browser to show a notice. The page always answers. On this computer, `http://127.0.0.1:5317` can ask. A phone on a plain `http://192.168…` address cannot. Set `HTTPS=1`, start again, and open the `https://` address on the phone (see the Windows setup notes). The program asks first. It does not send a notice overnight. If notices are blocked or the list is empty, the page says that, and the coloured band is still the list.
4. When you write the medicine for a care day you set, that job is marked done.
5. Tap a tile under the cards. A tile with one job opens that job. A tile with many jobs opens those jobs.
6. The graphs under the cards are egg counts, birds lost, feed used, roosters and hens in each flock, and income next to kharch. Birds lost is a count. A death rate is not set. Income minus kharch appears only when both numbers use the same unit you typed.
7. Phone alerts are on the same page. Morning medicine and low feed default to 8:00. Evening medicine and today's egg entry default to 17:00. Each person can turn a line off. On the phone app these repeat after the app is closed. Opening the farm refreshes the words once that day. Text messages are not sent.

## Today

![Today](../client/public/guide/today.png)

**What it is.** Jobs due today and shortcuts to eggs, losses, feed, who came, health, and the yard book.

**Where it is.** Daily work, then Today. Also the sun icon on a phone.

**Why it is used.** So the morning starts in one place.

**How to use it.**

1. Read the jobs that are due.
2. Tap a shortcut to write eggs, a loss, feed, who came, health, or the yard book.

## Gavran Saathi

![Gavran Saathi](../client/public/guide/saathi.png)

**What it is.** A helper that turns speech, typed words, or a photo into a card you can correct. Nothing is written until you tap Save.

**Where it is.** The round button at the bottom right of every farm screen, and also Daily work, then Gavran Saathi. The key is under Farm details.

**Why it is used.** So a count can be spoken in English, Hindi, or Marathi, and still checked before it is written.

**How to use it.**

1. Type or tap the mic. Hello gets a hello back. The reply is shown and spoken.
2. Read the card. Change the flock, the number, or the day. If the flock or the day is missing, Saathi asks.
3. Tap Save only when it is right.
4. An egg or chick photo shows a count and boxes. Type your count, then confirm. That opens the same card. A bird photo is an age guess, not a hatch date. A sick bird is matched only to the farm papers, with the page. The line says possible - confirm with vet. If the paper has no amount, the page says so.
5. The Gemini key stays on this computer. Paste the whole key. The page says Key saved and tested OK, or it says the key did not work and does not keep it. The full key is not sent back to the phone. A photo is made smaller before it is sent.

## Yard book

![Yard book](../client/public/guide/yard.png)

**What it is.** A notebook for the yard: when the birds went out, when they were shut in, and anything else you saw.

**Where it is.** Daily work, then Yard book. Today also links here.

**Why it is used.** So the morning and the night have a written time, and a note stays with the farm.

**How to use it.**

1. Pick the day.
2. Choose Let the birds out, Shut the birds in, or A note.
3. Type a clock time if you know it, and a short line about what happened.
4. Save the line.

## Jobs

![Jobs](../client/public/guide/tasks.png)

**What it is.** Work you write down, with a day it should be done.

**Where it is.** Daily work, then Jobs.

**Why it is used.** So people know what to do, including heat, rain, and cold lists you fill yourself.

**How to use it.**

1. Add a job, pick a day, and optionally a person.
2. The person marks it done and can write a note.

## Who came to work

![Who came to work](../client/public/guide/workforce.png)

**What it is.** A note of who was on the farm, and training they finished.

**Where it is.** Daily work, then Who came to work.

**Why it is used.** So you remember attendance without a score or a mark.

**How to use it.**

1. Pick the person and the day.
2. Leave the clock blank if you do not use one.
3. Training is lower on the same screen.

## Messages

![Messages](../client/public/guide/notices.png)

**What it is.** A note from one person on the farm to another. It stays in this program.

**Where it is.** Daily work, then Messages.

**Why it is used.** So a worker sees a message without a separate letter or a call from the program.

**How to use it.**

1. Choose the person, write a subject and a message, and save.
2. They open Messages and mark it read.

## Flocks

![Flocks](../client/public/guide/batches.png)

![Medicine days on a flock](../client/public/guide/batch-medicine.png)

**What it is.** A group of birds you started on one day, in one shed. The flock page also lists the chick-day medicine paper.

**Where it is.** Birds and eggs, then Flocks.

**Why it is used.** So later eggs, deaths, and feed can point at the right birds.

**How to use it.**

1. Add a flock: a short code, the shed, how many birds, the day it opened, the hatch day, and the egg set date if you know them. The bird name is saved as Gavran. If there is no shed yet, the form says so and you can add one there. A grey button says why it is waiting.
2. The flock page shows Incubator, Brooding, or Grow-out. Brooding runs 28 days from the hatch day because that is the length that was asked for. It is not an official formula. Near the end it says brooding ends in a few days, and it reminds you about the chick guard and paper. On the hatch day it also lists 4 to 5 hours in the incubator, then the chick guard and paper, jaggery or sugar water for the first 2 hours, then the day-wise medicine paper.
3. To move birds into a bigger shed, open the flock and use Shift to a bigger shed. The older range form, rooster and hen counts, and the full movement form stay in the program and are not on this screen.
4. The hatch day cannot be after the opened day. On the medicine paper, that date is day 1.
5. Open the flock. Medicine days lists today, tomorrow, and this week. Tick **Mark given** after you give that line. If a line has no day, the button says so. The words and amounts are copied from the chick-day paper. One line has no day and no amount; it says to check with the vet.
6. The first time, write a short note that you checked the paper. Until then, a tick is refused. The sample farm is already marked checked, and the note starts with Sample.
7. Each medicine has a picture from that paper, or a plain bottle, powder, or drop drawing. You can add your own photo. The page tries to clear a white background. If it cannot, it keeps the photo as it is.

## Eggs

![Eggs](../client/public/guide/eggs.png)

**What it is.** How many eggs you collected, split by the names you use, such as eating eggs or hatching eggs.

**Where it is.** Birds and eggs, then Eggs. Today also links here.

**Why it is used.** So you know what the hens gave each day. No price is stored.

**How to use it.**

1. Add the sort names you use, or tap Add egg lines for For incubator, For sale, Eaten at home, and Broken. Total is those four added together.
2. Then record a day, optional flock and shed, and a count for each line. Days are typed as dd/mm/yyyy.

## Egg lots

**What it is.** A group of eggs from one place, such as a market, or later from your own hens.

**Where it is.** Birds and eggs, then Egg lots.

**Why it is used.** So you know which eggs went into which tray.

**How to use it.** Write the place, the day, and how many eggs.

## Trays

**What it is.** Trays inside an incubator. Each tray has its own set date. Each hatch day with live chicks becomes its own flock.

**Where it is.** Machines and eggs you are hatching, then Trays.

**Why it is used.** A hatch can finish over more than one day.

**How to use it.** Add a machine first if you have none. Add a tray. Set eggs on that tray. For each hatch day, write the live chicks, the brooder shed, and a short flock code. The page shows live chicks, eggs set minus live, and live divided by eggs set. That ratio is not an official hatch percent.

## Birds that left

**What it is.** Birds that died, birds you sold, and birds eaten at home.

**Where it is.** Birds and eggs, then Birds that left.

**How to use it.** Pick died, sold, or eaten. Write the day and the count. For a sale, write the amount and the money unit, such as Rs.

## Income and kharch

**What it is.** Income you typed next to kharch, for the same money unit.

**Where it is.** Sales and money, then Income and kharch. Kharch is Sales and money, then Kharch.

**How to use it.** On Kharch, a category comes first. Quantity and rate are optional. When you type both, the amount stored is quantity times rate. Home also shows the same lines, and it asks you to pick summer, winter, or rainy. The page does not decide which months are which season.

## Birds lost

![Birds lost](../client/public/guide/losses.png)

**What it is.** A note of birds that died or were taken by an animal, in your own words.

**Where it is.** Birds and eggs, then Birds lost.

**Why it is used.** So you remember what happened. No death rate is calculated.

**How to use it.**

1. Write the day, what happened, and how many.
2. You can point at a death already written on a flock.

## Parents

![Parents](../client/public/guide/parentage.png)

**What it is.** Which birds you believe are the father and mother of a flock.

**Where it is.** Birds and eggs, then Parents.

**Why it is used.** Desi flocks are often bred at home. This only stores what you write. It does not suggest a pair.

**How to use it.**

1. Pick the young flock, write the father and mother in words, and optionally point at their flocks.

## Incubator machines

![Incubator machines](../client/public/guide/incubators.png)

**What it is.** The machines you own. A reading is only the numbers you type.

**Where it is.** Incubator, then Incubator machines.

**Why it is used.** So temperature and care notes stay with the right machine. There is no target temperature built in.

**How to use it.**

1. Add the machine with a name you know.
2. Open it to write a temperature or a repair, only if you measured it.

## Eggs set to hatch

![Eggs set to hatch](../client/public/guide/incubation.png)

**What it is.** A set of eggs under a machine or under a broody hen you name.

**Where it is.** Incubator, then Eggs set to hatch.

**Why it is used.** Desi farms hatch with a hen or a machine. The program does not guess the hatch day.

**How to use it.**

1. Start a sitting, choose machine or hen, and the day.
2. Open it to candle or to write how many chicks came out.

## Sick birds and medicines

![Sick birds and medicines](../client/public/guide/health.png)

**What it is.** Diseases and medicines copied from the Patil training papers, plus what you saw on the farm.

**Where it is.** The Health tile.

**Why it is used.** So a worker can read a named disease. A medicine note stays locked until the owner or a vet writes that they checked it.

**How to use it.**

1. Open a name.
2. Read what it is for, the signs, how it was written to give, and the caution.
3. Do not treat from an unchecked note.

## My medicines

![My medicines](../client/public/guide/medicines.png)

**What it is.** Medicines you type yourself. Each one is labelled Added by owner. They are not copied from the training papers.

**Where it is.** Health, then My medicines. The owner and a manager see this form.

**Why it is used.** So a dose you already use can sit on the flock day list, on today's medicine, and on the alert, with the amount you typed.

**How to use it.**

1. Type the name, the amount, and the unit. Example: tulsi water, 5 ml.
2. Tick a disease from the papers, or add one with the signs you saw. A photo of the bottle is optional. A white background is cleared when the tool on this computer can do it.
3. Choose water, feed, an eye drop, or an injection, and how many days. Write where it came from: your experience, a vet's name, or a paper.
4. Add it to a flock from a date or an age day. 1 means every day. 2 means every other day.
5. Mark given on that flock when you have given it. Change or remove the medicine later. The change list keeps that.

## Feed and stock

![Feed and stock](../client/public/guide/stock.png)

**What it is.** Feed, water, and weights you type. Nothing suggests a formula.

**Where it is.** The Feed and stock tile.

**Why it is used.** So you see what came in and what the birds ate.

**How to use it.**

1. Add an item in your own words, such as bajra or a mash you mix.
2. Then write a quantity in or out.

## Sales

![Sales](../client/public/guide/sales.png)

**What it is.** Customers, what they ordered, and prices you type yourself.

**Where it is.** Sales and money, then Sales.

**Why it is used.** A local market price is only what you last wrote. Nothing is filled in.

**How to use it.**

1. Add a customer.
2. Write a price when you want one.
3. Then write an order with what left the farm.

## Money in and out

![Money in and out](../client/public/guide/expenses.png)

**What it is.** Money you spent or received, with the unit you type, such as rupees.

**Where it is.** Sales and money, then Money in and out.

**Why it is used.** So the farm notebook has a line for each amount. A correction is a new line. The old line stays.

**How to use it.**

1. Add a heading such as feed or medicine.
2. Then write the day, in or out, the amount, and the unit.

## Shops you buy from

![Shops you buy from](../client/public/guide/suppliers.png)

**What it is.** People you buy feed or birds from, what you ordered, what arrived, and what you paid.

**Where it is.** Sales and money, then Shops you buy from.

**Why it is used.** A delivery note does not add feed to stock by itself. You still write stock separately.

**How to use it.**

1. Add the shop.
2. Write an order, then what you accepted, then a bill or a payment if you want those lines.

## Buyer bills

![Buyer bills](../client/public/guide/invoices.png)

**What it is.** A paper list of what a buyer took. It is not sent to a tax office, and no balance is worked out.

**Where it is.** Sales and money, then Buyer bills.

**Why it is used.** So you can read back a sale. Posting into accounts is still not decided, so the line stays unposted.

**How to use it.**

1. Pick a customer and a day.
2. Write what moved.
3. Leave the price blank if you are not writing one.
4. A return is a new line.

## Counts

![Counts](../client/public/guide/reports.png)

**What it is.** Totals for the dates you choose, such as eggs collected.

**Where it is.** The Counts tile.

**Why it is used.** So you can look back over a week or a month. A rate stays marked as proposed until you decide the formula.

**How to use it.**

1. Pick a start day and an end day.
2. The end day cannot be after today.
3. Optional filters narrow a shed, flock, or egg sort.

## People

![People](../client/public/guide/people.png)

**What it is.** Who may open this farm, and what they may change.

**Where it is.** The People tile. A worker does not see this tile.

**Why it is used.** So each person has their own sign-in. Nothing is sent; you tell them the mobile number and the PIN yourself.

**How to use it.**

1. For a worker, write the name, the mobile number, and a PIN of four to six digits, then tell them that PIN.
2. A mail address and a long secret phrase remain for the owner and a manager.
3. Owner sees everything.
4. A worker sees daily jobs, birds, hatch, health, and feed.
5. Add owner invites another owner for this same farm. Tell them the mail address and the secret phrase yourself. Nothing is sent.

## Farm details

![Farm details](../client/public/guide/profile.png)

**What it is.** The farm name, place words, and whether you weigh in kilograms or grams.

**Where it is.** Farm setup, then Farm details.

**Why it is used.** The clock of the farm decides which day is today for dates.

**How to use it.**

1. Open the form.
2. Change the name or the time zone, such as Asia/Kolkata, and save.
3. A worker can read this but not change it.

## Sheds

![Sheds](../client/public/guide/sheds.png)

**What it is.** Houses and pens, with how many birds you say can stand there.

**Where it is.** Farm setup, then Sheds.

**Why it is used.** A new flock must start in a shed that is in use.

**How to use it.**

1. Add a short code, a name, the kind of house, and a bird count you choose.
2. That count is your limit, not a rule from a book.

## Papers and photos

![Papers and photos](../client/public/guide/documents.png)

**What it is.** A photo or a PDF you keep, such as a bill photo or a bird photo.

**Where it is.** Farm setup, then Papers and photos. Workers do not see this.

**Why it is used.** So a paper is next to the farm record. How long it is kept is not decided.

**How to use it.**

1. Choose a JPEG, PNG, WebP, or PDF under 5 MB and a short note.

## Saved count names

![Saved count names](../client/public/guide/schedules.png)

**What it is.** A name you give to a count you run again later. Nothing runs by itself and nothing is sent.

**Where it is.** Farm setup, then Saved count names.

**Why it is used.** So you remember a report you like, without a clock.

**How to use it.**

1. Type a name, a note, and the day you named it.
2. When you want numbers, type a start and end then.

## Spare copy

![Spare copy](../client/public/guide/safeguards.png)

**What it is.** A check that a copy of the records can be opened on this computer. It is not a backup sitting somewhere else.

**Where it is.** Farm setup, then Spare copy. Only an owner or manager sees it.

**Why it is used.** How long to keep records, and how much loss is acceptable, is still not chosen.

**How to use it.**

1. Read the open questions.
2. Run the check only when you mean to test a restore on a separate practice database.

## Saved on this phone

![Saved on this phone](../client/public/guide/offline.png)

**What it is.** Eggs, a medicine tick, a job, a loss, or who came today, written while the computer could not be reached.

**Where it is.** Farm setup, then Saved on this phone.

**Why it is used.** Those rows wait on the phone and send themselves when the computer is back. Feed, money, and medicine records do not wait. If someone else already changed an egg, tick, job, or loss, the screen says so. Who-came-today stays as a conflict and is not rewritten.

**How to use it.**

1. When the computer is back, the waiting rows send themselves. You can also open this screen and tap Send.
2. A line on the other screens says how many rows are waiting.

## Find a record

![Find a record](../client/public/guide/search.png)

**What it is.** Look for a name you typed, such as a flock code or a customer.

**Where it is.** Farm setup, then Find a record.

**Why it is used.** A short way to jump to a record. Prices are not shown in the results.

**How to use it.**

1. Type at least two letters.
2. A percent sign is just a percent sign.

## Who changed what

![Who changed what](../client/public/guide/activity.png)

**What it is.** A list of changes on this farm. Sign-in attempts are not in this list.

**Where it is.** Farm setup, then Who changed what.

**Why it is used.** So you can see who added a flock or a payment.

**How to use it.**

1. Open the list and read the newest lines first.

## What this book does not do

It does not invent a dose, a price, a hatch day, or a tax rule. A buyer slip stays unposted. A yard note does not suggest a clock time. Medicine pages stay unused until the owner checks them against the paper.
