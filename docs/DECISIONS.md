# Decisions

Dated 2026-10-13. Technical choices below are provisional engineering defaults for Phase 1. They are not farm policy. Section 18 of `docs/blueprint.md` is still unanswered; do not treat a schema choice as the owner's answer.

## Answered for Phase 1 (technical)

| Id | Decision | Why |
|---|---|---|
| T1 | Monorepo npm workspaces: `@gavran/shared`, `@gavran/server`, `@gavran/client`. | One schema package for API and UI validation. |
| T2 | MySQL 8.4 in Docker, host port 3307, app user `gavran`. Local passwords live in `docker-compose.yml` and `.env.example` and are not production secrets. | Avoids clashing with a host MySQL on 3306. |
| T3 | Browser auth uses httpOnly cookies `gavran_access` (JWT, 15 minutes) and `gavran_refresh` (14 days, rotated). CSRF is a non-httpOnly `gavran_csrf` cookie matched to `X-CSRF-Token`. Tokens are not returned as access or refresh fields in JSON. Locale may be stored in `localStorage` under `gavran.locale`. | Blueprint authentication note: do not store long-lived credentials in localStorage. |
| T4 | Passwords use Node `scrypt` with N=16384, r=8, p=1, keyLen=64. Format `scrypt$N$r$p$salt$hash`. This is the Node interactive default and still needs a security review before production. | No extra password library. |
| T5 | A user with zero memberships, or an existing owner, may create a farm and becomes its owner. Invited workers cannot create a farm. | Stops shadow farms without blocking the first owner. |
| T6 | Family helpers receive no role permissions. Extra access is an explicit per-membership grant. System administrator is `users.platform_role`, not a farm role, and has no business permissions. There is no UI to grant that platform role. | Deny by default. |
| T7 | Phase 1 permission keys are only `farm.read`, `farm.update`, `shed.read`, `shed.create`, `shed.update`, `user.read`, `user.manage`, `audit.read`. | No settings or finance API exists yet. |
| T8 | Provisional role matrix is in `docs/PERMISSIONS.md` and `shared/src/permissions.ts`. Manager may create and update sheds. Owner confirmation is still required. | Blueprint WF-01 says the owner creates sheds; the manager row says managers work with sheds. |
| T9 | Shed type allowlist: brooder, grower, layer, breeder, quarantine, storage, other. Capacity unit is the literal `birds`, integer 0 through 1,000,000. Default timezone `Asia/Kolkata`. Weight `kg` or `g`. Volume `L` or `mL`. | Structural lists only. They do not set stocking, temperature, medicine, price, or tax rules. |
| T10 | Invitation attaches the person immediately. No email or SMS is sent. Linking an existing email does not change that password. | No delivery provider in Phase 1. |
| T11 | Deactivate sets user status, revokes sessions, and keeps memberships. The last active owner cannot be removed or deactivated. | Reactivation restores the previous role. History stays. |
| T12 | Audit summaries pass through a redactor for keys matching password, token, secret, authorization, or cookie. Login success and failure are account-scoped (`farm_id` null) and do not appear on the farm activity page. | Blueprint audit requirements. |
| T13 | `Idempotency-Key` (8–80 printable ASCII) is optional on farm create, shed create, and member invite. | Retries can replay the stored response. |
| T14 | DDL is not wrapped in a transaction. A failed migration file can leave partial tables. Down scripts exist. | MySQL implicit commit on DDL. |
| T15 | `LIMIT` and `OFFSET` are interpolated only after they are validated integers, because mysql2 prepared statements reject those placeholders. | Documented in the audit repository. |
| T16 | The dev client is `http://127.0.0.1:4317` and proxies `/api` to `127.0.0.1:4318` so cookies stay same-origin. | Uncommon ports, away from 3000, 5173, and 8080. |
| T17 | Canonical Git history remote is https://github.com/UrveshMore/gavran-poultry-farm-system on `main`. | Owner request, 2026-10-13. |
| T18 | Bird types are names the farm types. Batch status is only `open` or `closed`. Movement types are opening, transfer, sale, mortality, culling, and other exit. A sale has no price field. | Decision 3 is still open, so no species catalog was seeded. |
| T19 | Egg sorts are names the farm types. Fertile and table are optional labels the screen can create; they are not required rows. A collection may omit batch and shed. Counts are whole eggs. There is no price column. | Owner answer on 2026-10-13, decision 2. |
| T20 | Incubator temperature and humidity have no default and no set-point. A reading may omit both. A number requires the unit the farm types. Service status is `in_service` or `out_of_service`. | Decision 5 leaves incubation SOPs unanswered. |
| T21 | An incubation sitting is `incubator` or `broody_hen`. No expected hatch date is stored or calculated. Candling has no schedule. Outcome labels are typed on the record. | Decision 4 and decision 5 are still open. |

## Still open (blueprint section 18)

Do not implement policy for these until the owner answers. Date the answer in this file.

1. Single farm or multiple farms? The schema allows multiple farms. That is not a business confirmation.
2. Egg categories and inventory units actually used on the farm. On 2026-10-13 the owner said eggs are sorted into fertile eggs and table eggs. Those names are optional starter labels the owner can rename or skip. Any other sort exists only after the owner adds it. Counts are eggs, not weight. No price is stored on a collection.
3. Bird types, species, strains, and batch statuses. On 2026-10-13 the owner said the flock is Desi/Gavran: indigenous, free-range or backyard. That does not seed a strain list. Strain, rooster count, and hen count stay owner-entered (see the roadmap section after P0). Batch status remains only open or closed until a further answer.
4. Official hatch-rate, mortality-rate, and FCR formulas.
5. Authoritative source documents for vaccines, medicine, feed, water, and incubation SOPs. On 2026-10-13 the owner supplied three Patil Poultry House Training PDFs, stored under `docs/sources/`, as the only extraction source for the Disease & Treatment Knowledge Base (see Phase 9 in `docs/ROADMAP.md`). That does not approve any dose. Each entry stays unverified until the owner sets its approval flag. Feed, water, and incubation SOPs are still unanswered.
6. Who can approve and publish SOP changes.
7. Stock issue and valuation methods by category.
8. When a sale or invoice is posted: order confirmation, dispatch, or delivery.
9. Accounting basis and batch-cost allocation.
10. Which workflows must work offline, and which need an online approval.
11. Devices, internet quality, language defaults, and shared phones.
12. Hosting budget, storage, AI budget, uptime, RPO, and RTO.
13. Whether external AI may process farm images.
14. Which alerts are urgent, and who receives them.
15. What must be retained, exported, anonymized, or deleted, and for how long.

`farm_settings` exists and must stay empty of invented SOP, dosage, price, or tax values. Password reset tokens are stored with no delivery endpoint.
