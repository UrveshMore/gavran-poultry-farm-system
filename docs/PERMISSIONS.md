# Permissions

Enforcement is deny-by-default on the server. Missing membership is **404**. A member without the permission is **403**. The system administrator platform role is not a farm membership and receives none of these permissions.

UI navigation inside a farm still shows Sheds, Batches, Eggs, People, and Activity. Those screens show the API error when the caller lacks permission. Hiding a link is not the security boundary.

## Phase 1 keys

| Key | Allows |
|---|---|
| `farm.read` | Read one farm profile. |
| `farm.update` | Update that farm profile. |
| `shed.read` | List sheds. |
| `shed.create` | Create a shed. |
| `shed.update` | Update a shed. |
| `user.read` | List members. |
| `user.manage` | Invite, change role, revoke, deactivate, reactivate. |
| `audit.read` | Read farm-scoped audit rows. |
| `batch.read` | List batches, bird types, and the movement timeline. |
| `batch.create` | Add a bird-type name and open a batch. |
| `movement.create` | Record a movement and close a batch at zero birds. |
| `egg.read` | List egg sorts and collections. |
| `egg.record` | Add an egg sort and record a collection. |
| `incubator.read` | List incubators, readings, and service changes. |
| `incubator.record` | Record a temperature, humidity, or power reading. |
| `incubator.manage` | Add an incubator and change whether it is in service. |

`GET /api/v1/farms` lists farms the caller belongs to, including farms where they have zero permissions. It does not include contact details.

## Provisional matrix

Pending owner confirmation. Seeded by the versioned migrations and mirrored in `shared/src/permissions.ts`.

| Role | Permissions |
|---|---|
| Owner | All keys in the catalog. |
| Manager | `farm.read`, `shed.read`, `shed.create`, `shed.update`, `user.read`, `audit.read`, `batch.read`, `batch.create`, `movement.create`, `egg.read`, `egg.record`, `incubator.read`, `incubator.record`, `incubator.manage`. |
| Worker | `farm.read`, `shed.read`, `batch.read`, `egg.read`, `egg.record`, `incubator.read`, `incubator.record`. |
| Vet / advisor | `farm.read`, `shed.read`, `batch.read`, `egg.read`, `incubator.read`. |
| Family helper | None from the role. Optional grants on that membership only. |
| System administrator | None. |

Only an owner may assign the owner role or grant `user.manage`. Grants are cleared when the role is no longer family helper. The last active owner cannot be revoked, demoted, or deactivated.
