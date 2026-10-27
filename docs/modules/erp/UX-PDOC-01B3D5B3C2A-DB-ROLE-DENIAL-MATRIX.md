# UX-PDOC-01B3d5b3c2a — Actual non-owner PostgreSQL login-denial matrix

**State: CI-only negative security gate; no runtime role activation.** Stacked on B3d5b3c1 / PR #165.

## Why this checkpoint is necessary

A valid Ed25519 signature is checked in application code, while its relational audit marker
is stored in PostgreSQL. PostgreSQL does **not** verify the Ed25519 signature itself.
A process with the table-owner connection can directly insert an audit row that merely
satisfies relational constraints. No promotion to R2 or `AVAILABLE` may ever rely on
a row inserted with owner privileges or on `CONSUMED` alone.

The existing issuer and consumer SQL routines are `SECURITY INVOKER`.
Granting their non-owner callers broad `INSERT`/`UPDATE` rights on underlying tables
would permit them to bypass the functions with direct DML. It is **not safe** to solve
this by simply granting those roles the necessary table writes.

## Implemented in B3d5b3c2a

GitHub Actions' **disposable PostgreSQL 16** lab creates five separate, randomly named
PostgreSQL `LOGIN NOINHERIT` identities with ephemeral random passwords:

- `api`
- `issuer`
- `scanner`
- `verifier`
- `promoter`

The opt-in test runs only when `RUN_SUPPLIER_SCAN_ROLE_DENIAL_PG=1`,
`CI=true`, `GITHUB_ACTIONS=true`, and the server is exactly
`ci@localhost:5432/zaping_test` (or loopback `127.0.0.1`).
Each role authenticates its **own actual SQL connection**. It is not a
`SET ROLE` session pretending to be a separate login. It verifies:

1. The effective and session PostgreSQL usernames equal the newly created login.
2. The account is neither superuser nor CREATEROLE/CREATEDB/REPLICATION/BYPASSRLS;
   inheritance is disabled.
3. The account lacks SELECT/INSERT/UPDATE/DELETE on the challenge, scan attempt,
   signed receipt, verified audit and attachment tables.
4. The account cannot execute the guarded SQL issuer or consumer function.
5. Real negative SQL insert/update/function calls are rejected by PostgreSQL
   with `permission denied`, not merely assumed from metadata.

After tests, connections are disconnected and CI-only roles are deleted.
No production roles, secrets, SQL grants, users, migrations, R2 actions,
NestJS providers, API endpoints or object access are changed.

## Security limitations (deliberate)

This matrix proves **denial**, not positive production authorization. It does not yet
let the issuer issue a challenge or the verifier persist an authenticated scan.
The existing B3d5b3c1 successful E2E still runs through the disposable
database **owner**; that test proves atomic logic and crypto but not runtime
least privilege. We must NOT combine that owner's credentials with API/worker runtime.

## Next B3d5b3c2b — narrowly authorized service interfaces

- Design non-owner issuer and verifier grants that cannot be bypassed by direct
  INSERT/UPDATE, preferably through reviewed narrow functions owned by an
  isolated `NOLOGIN` object-owning role with locked-down `search_path`.
- Treat RLS/tenant-scoped authorization independently: a granted function accepting
  a client-supplied `companyId` does not itself authenticate company membership.
- Prove both successful authorized work and failed direct DML under **real**
  issuer/verifier LOGIN sessions; confirm cross-company and replay denial.
- Keep API, scanner and promoter unable to update attestation/audit tables or
  change `PENDING_SCAN`; promoter cannot become active before safe private R2
  byte-for-byte promotion and audit protocol (B3d5c).
- Plan the role deploy and revocation sequence separately from Prisma migrations;
  migration-owner credentials must never be shared with ordinary service processes.

**Release hold remains:** all stacked PRs Draft, no `main` merge or deployment,
no customer uploads/downloads. A successful negative-role test is not proof
that the complete scanner-to-private-R2 pipeline is production ready.
