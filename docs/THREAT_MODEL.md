# Threat model notes

Dated 2026-10-13. These notes describe what this build does. They are not a completed security review, and they do not set a recovery target or a retention period.

## What the build relies on

- Access and refresh tokens are httpOnly cookies. JSON bodies do not return those tokens. CSRF is a separate cookie checked against `X-CSRF-Token` on writes.
- Passwords are stored as scrypt hashes. The parameters are in `docs/DECISIONS.md` and still need a review before production.
- Farm routes require a membership. A missing membership is 404. A member without the permission is 403.
- Queries use prepared statements. `LIMIT` and `OFFSET` are interpolated only after an integer check.
- Audit summaries pass through a redactor for password, token, secret, authorization, and cookie keys.
- Operational rows are not hard-deleted through the API. Expense corrections add a reversing row.
- Finance screens (prices, draft orders, expenses, reports) are owner and manager permissions. Workers do not receive those keys.
- Medicine and vaccine tasks stay blocked until a person writes a verification note and approves that training-PDF page.
- The restore drill refuses the application database name and uses `gavran_restore_drill`, then drops it.

## Open

- No backup schedule, no off-site copy, and no encryption story for backups. Decision 12 (hosting, RPO, RTO) is unanswered, so those fields stay null.
- Decision 15 (what to retain, export, or delete, and for how long) is unanswered. No retention period is stored.
- Login throttling is in memory for one process.
- The platform role `system_administrator` has no farm permissions and no UI. There is no reviewed production hosting layout.
- Hindi and Marathi copy is provisional.

## Incident shape, when one happens

Contain the account (deactivate, which revokes sessions), keep the audit rows, restore only into a database that is not the live one, check a known row, and write down what changed. Do not invent a notify-by-SMS step; no SMS provider is configured.
