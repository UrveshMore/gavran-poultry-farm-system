# Architecture

```
client (Vite, CLIENT_PORT, example 5317) -- /api proxy --> server (Express, PORT, example 5318) --> MySQL 8.4 (DB_PORT / MYSQL_PORT, example 3317)
shared (Zod schemas, permission catalog)
```

The browser talks only to the Vite origin in development, so session cookies are same-origin. CORS on the API still allows `CORS_ORIGIN` with credentials for a split deployment.

## Request path

1. Request id (incoming `X-Request-Id` or a new UUID) and a pino log line with method, path, status, and duration. Query strings and bodies are not logged.
2. Helmet, CORS, JSON limit 100kb, cookie parser.
3. CSRF on `/api/v1` except safe methods. Health is mounted before CSRF.
4. Access JWT in `gavran_access`, checked against a live session and an active user.
5. Farm routes load membership. Permissions are the union of `role_permissions` and, for family helpers, `membership_permission_grants`.
6. Services write audit rows in the same transaction as the change.
7. Errors: Zod 422, `AppError` as declared, duplicate key 409, bad JSON 400, anything else 500 without a stack.

## Sessions

Refresh reuse detection returns a denied result inside the transaction so the family revocation commits, then the handler responds 401. Login failures are counted in memory per process. Tests raise that limit. Unknown emails still run a dummy scrypt verify. `ACCOUNT_DEACTIVATED` is returned only after a correct password.

## What Phase 1 does not do

Offline queues, email or SMS, password-reset delivery, equipment, bird counts, eggs, dosages, prices, GST, invoice posting, and SOP thresholds. The service worker uses NetworkOnly for `/api` and the UI says changes are not queued while offline.
