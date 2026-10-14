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

Leave the values in `.env` as they are for this local copy. `DB_PORT` is `3307`. The app reads that file from the repository root.

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

That starts MySQL 8.4 and publishes it on port **3307**. The database name is `gavran`. The same command is `npm run db:up`.

The first start can take a minute. When the command returns, MySQL is accepting connections.

## 6. Run migrations

```powershell
npm run db:migrate
```

You should see a list of applied migration files. Running it again later prints that migrations are already up to date.

## 7. Create the first owner account

Start the app first (the next step), then open:

http://127.0.0.1:4317/register

The page title is **Create the first owner**. It works only while the database has no users. Use your own email, your name, and a password of at least 10 characters. Nothing is emailed.

After that account exists, the register page closes. Add other people from the farm's People screen and share the temporary password yourself.

## 8. Start the backend and the frontend

Use two PowerShell windows. In both, `cd` to the repository folder.

Backend (API on port 4318):

```powershell
npm run dev -w @gavran/server
```

Frontend (app on port 4317):

```powershell
npm run dev -w @gavran/client
```

Leave both windows open. One window can start both with `npm run dev`.

## 9. Open the app

Open this address in a browser:

http://127.0.0.1:4317

Sign in with the owner account from step 7. The API is at http://127.0.0.1:4318. The browser talks to it through the frontend, so you do not open the API address to use the farm screens.

## Stop

In the repository folder:

```powershell
npm run db:down
```

That stops MySQL and keeps the data. Close the two PowerShell windows to stop the backend and the frontend.
