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

Running it again does not add a second copy. Every sample row starts with the word Sample.

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

Open this address in a browser:

http://127.0.0.1:5317

Sign in with the owner account from step 7, or with a worker's mobile number and PIN. The API is at http://127.0.0.1:5318. The browser talks to it through the frontend, so you do not open the API address to use the farm screens.

## Stop

In the repository folder:

```powershell
npm run db:down
```

That stops MySQL and keeps the data. Close the two PowerShell windows to stop the backend and the frontend.
