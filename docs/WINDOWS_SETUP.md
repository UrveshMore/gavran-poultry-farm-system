# Run Gavran on Windows

These steps use Docker Desktop for MySQL and Node.js for the app. They are for a local copy on your own computer.

## 1. Install the tools

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) and start it. Wait until it says it is running.
2. Install [Node.js 22](https://nodejs.org/) or a newer 22.x release. The installer includes npm.
3. Install [Git for Windows](https://git-scm.com/download/win).

Open PowerShell and check the versions:

```powershell
docker --version
node --version
npm --version
```

`node --version` should start with `v22` or a higher major version.

## 2. Clone the repository

```powershell
git clone https://github.com/UrveshMore/gavran-poultry-farm-system.git
cd gavran-poultry-farm-system
```

## 3. Create the env file

From the repository folder:

```powershell
copy .env.example .env
```

Leave the values in `.env` as they are for this local copy. The app reads that file from the repository root.

| Name | Sample | What it is |
|---|---|---|
| `CLIENT_PORT` | `5317` | The program in the browser (Vite dev and preview). |
| `PORT` | `5318` | The API. The browser program sends `/api` to this port. |
| `MYSQL_PORT` | `3317` | The MySQL port Docker publishes on this computer. |
| `DB_PORT` | `3317` | The MySQL port the API connects to. Keep it the same as `MYSQL_PORT`. |
| `CORS_ORIGIN` | `http://127.0.0.1:5317` | The browser address the API accepts. |

These are not 4317, 4318, or 3307. Cursor on this Windows PC already forwards those ports. Automated tests still set `DB_PORT` to 3307; that does not change this `.env`.

`gavran_local` and `gavran_root_local` are development database passwords only. Replace `JWT_SECRET` before any shared deployment. It must be at least 32 characters.

## 4. Install Node packages

```powershell
npm ci
```

## 5. Start MySQL

Docker Desktop must already be running.

```powershell
docker compose up -d --wait
```

That starts MySQL 8.4 and publishes it on `MYSQL_PORT` (**3317** in the sample `.env`). The database name is `gavran`. The same command is `npm run db:up`.

The first start can take a minute. When the command returns, MySQL is accepting connections.

## 6. Run migrations

```powershell
npm run db:migrate
```

You should see a list of applied migration files. Running it again later prints that migrations are already up to date.

## 6b. Load the sample farm (optional)

This fills a local farm so you can click around. It will not run if `NODE_ENV` is `production`.

```powershell
npm run db:seed:demo
```

Running it again does not add a second copy. Every sample row starts with the word Sample. Flock D hatched two days ago, so today's medicine card shows the morning and evening lines from the chick-day paper. That paper is marked checked, and the note starts with Sample.

Sign in as the owner with **I am the owner**:

| Who | How to sign in |
|---|---|
| Sample Admin (owner) | `admin@gmail.com` / `admin@123` |
| Sample Meera (manager) | `meera.demo@gmail.com` / `manager-demo-1` |
| Sample Lata (worker) | mobile `9811100011`, PIN `2468` |
| Sample Raju (worker) | mobile `9811100022`, PIN `1357` |

`admin@123` is shorter than the 10 characters a new owner must choose. That short password exists only for this demo account. The sign-up page still asks for 10 characters.

## 7. Create the first owner account

Start the app first (the next step), then open:

http://127.0.0.1:5317/register

The page title is **Create the first owner**. It works only while the database has no users. Use your own email, your name, and a password of at least 10 characters. Nothing is emailed. The owner keeps signing in with that email and password. On the sign-in screen, choose **I am the owner**.

After that account exists, the register page closes. On People, add a worker with a name, a mobile number, and a PIN of four to six digits. Tell them the PIN yourself. Nothing is sent. They sign in with the mobile number and the PIN, on large buttons. You or a manager can set a new PIN. A mail address is still there when a manager uses one.

## 8. Start the backend and the frontend

Use two PowerShell windows. In both, `cd` to the repository folder.

Backend (API on `PORT`, sample 5318):

```powershell
npm run dev -w @gavran/server
```

Frontend (app on `CLIENT_PORT`, sample 5317):

```powershell
npm run dev -w @gavran/client
```

Leave both windows open. One window can start both with `npm run dev`.

## 9. Open the app

Open this address in a browser on the same computer:

http://127.0.0.1:5317

Sign in with the owner account from step 7, or with a worker's mobile number and PIN. The API is at http://127.0.0.1:5318. The browser talks to it through the frontend, so you do not open the API address to use the farm screens.

**Tell me on this phone** asks this browser to show today's list. On `http://127.0.0.1:5317` the page says what happened. It does not send a notice overnight. If the browser blocks notices, the page says so, and the coloured band on Home still lists the day.

## 9b. Open it on a phone in the house

A phone on `http://192.168.x.x:5317` cannot show a notice. Browsers only allow notices on a secure page, or on `127.0.0.1` on the computer itself. The coloured band on Home still works over plain http.

To let the phone ask for notices, and to allow install:

1. On the computer, find the address. In PowerShell: `ipconfig`. Use the IPv4 address on Wi-Fi, such as `192.168.31.7`.
2. In `.env`, add `HTTPS=1` and start the frontend again (`npm run dev -w @gavran/client`).
3. The window prints a Phone line. On the phone, join the same Wi-Fi and open `https://192.168.31.7:5317` (use your own address).
4. The first certificate is made on this computer and is not from a public authority. The phone shows a warning. Open the advanced choice and continue. Then sign in.
5. Tap **Tell me on this phone**. The page says whether notices are on, blocked, or not possible. Allow them if the phone asks.
6. Install uses the browser's own prompt once the page is the secure one. On an iPhone, use Share, then Add to Home Screen.

If you want the warning gone, install [mkcert](https://github.com/FiloSottile/mkcert), run `mkcert -install`, then:

```powershell
mkdir certs
mkcert -key-file certs/lan-key.pem -cert-file certs/lan.pem localhost 127.0.0.1 192.168.31.7
```

Use your own address in that command. In `.env`:

```
HTTPS=1
HTTPS_CERT=certs/lan.pem
HTTPS_KEY=certs/lan-key.pem
```

Start the frontend again. Install the same local authority on the phone if mkcert's docs say to, then open the https address. The `certs` folder stays on this computer.

Windows may ask to allow Node through the firewall the first time a phone connects. Allow private networks. Leave `COOKIE_SECURE=false` for this local run so sign-in still works.

## 10. Leave it running on this laptop

This is one program. It builds the screens, then serves them on `PORT` (sample **5318**). You do not also run the Vite window.

Before the first run, open `.env` and replace `JWT_SECRET` with your own text of at least 32 characters. The sample secret is refused when this mode starts. Leave `COOKIE_SECURE=false` so sign-in works on this computer and through the Tailscale address below. The program reads that flag from `.env`.

```powershell
npm run laptop
```

Open http://127.0.0.1:5318 on this computer. The same address is what a phone stores.

To start it each time you sign in to Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-startup-task.ps1
```

The task name is Gavran. Remove it with `schtasks /Delete /TN Gavran /F`.

**Little memory.** Install MySQL on the PC and do not start Docker. Point `DB_PORT` in `.env` at that MySQL (a native install is often `3306`). In MySQL's config, a small `innodb_buffer_pool_size`, such as `128M`, leaves RAM for Windows. That is a computer setting, not a farm rule. Do not run `npm run dev` at the same time. One Node process is enough.

## Use from anywhere with Tailscale (free)

Tailscale gives the laptop an https address that works when you are away from the house. The personal plan is free.

1. Install Tailscale from [tailscale.com](https://tailscale.com/) on the laptop and on the phone. Sign in with the same account.
2. Start Gavran with `npm run laptop`, or with the sign-in task above. Leave the laptop on.
3. In PowerShell, publish the API port. Use the `PORT` from `.env` if it is not 5318.

```powershell
tailscale serve --bg 5318
```

If that form is not accepted, use `tailscale serve --bg http://127.0.0.1:5318`.

4. Run `tailscale serve status`. It prints `https://<this-computer>.ts.net`.
5. On the phone, type that address, including `https://`.
6. A phone on the same Wi-Fi can use `http://` plus the house address and port, such as `http://192.168.1.10:5318`. When Windows asks, allow that port on private networks.

## Install the Android app

The app file is `gavran.apk`. It is the same screens. The first open asks where the computer is, and the phone remembers that address.

1. Copy `gavran.apk` onto the phone.
2. Open Settings and allow this source to install apps. That is often the Files app, or Chrome.
3. Open the file and install Gavran.
4. On the first screen, type the Tailscale address, or `http://` plus the house address and `:5318`.
5. The computer must be on. Open the app once while it is on. The phone can then remind you at 8:00 and at 17:00 about today's medicine, low feed, and eggs that are not written.

## Stop

In the repository folder:

```powershell
npm run db:down
```

That stops MySQL and keeps the data. Close the two PowerShell windows to stop the backend and the frontend.
