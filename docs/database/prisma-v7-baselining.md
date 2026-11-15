# Prisma ORM 7 Baseline and Migration Runbook

**Status:** Prepared on `feat/prisma-v7-baselining`; not yet executable against a live database.  
**Scope:** PostgreSQL, Prisma ORM 7, Corleon Engine.  
**Safety:** Documentation only. No database connection, schema mutation, migration application, deployment, or merge is performed by this runbook.

## 1. Verified repository baseline (2026-11-15)

The inspected `main` branch currently has:

- Prisma CLI and `@prisma/client` declared as `^6.16.0`; the lockfile resolves both to 6.19.3.
- One existing PostgreSQL schema at `prisma/schema.prisma` (approximately 693 lines).
- The legacy `prisma-client-js` generator and datasource-level `url = env("DATABASE_URL")`.
- No `prisma/migrations/` directory and no Prisma CLI config file.
- Runtime Prisma usage in `src/cashflow/prisma.js` and `src/cashflow/payout-service.js`.
- Financial models and workflows using PostgreSQL Decimal values, idempotency keys, ledger entries, payouts, refunds, billing events, and transactions.
- A Vercel project named `corleon-engine`. The inspected project environment-variable listing did not contain `DATABASE_URL`; the repository's `.env.example` contains only a placeholder. This does **not** establish whether another database exists outside the inspected Vercel project.

Do not infer that a production database is empty, new, or safe to reset. Its identity, contents, migration history, owner, and backup state remain unverified.

## 2. Prisma 7 version and configuration policy

Prisma ORM 8 is currently distributed as a release candidate under the npm `latest` tag. This project explicitly targets Prisma ORM 7, so do not use an unqualified `pnpm add prisma`, `npx prisma`, or floating `latest` command in upgrade automation.

Use a reviewed, exact Prisma 7 version (the inspected Prisma release-status documentation identifies `@prisma/client` 7.10.1). Pin the CLI and client to the same approved 7.x release and commit the regenerated pnpm lockfile.

Prisma 7 requires:
- The `prisma-client` generator with an explicit output directory.
- A PostgreSQL driver adapter (normally `@prisma/adapter-pg`) for direct Node.js connections.
- A Prisma CLI config for datasource and migration settings.
- Explicit environment loading for CLI commands (for example, `dotenv/config`).
- Application imports from the generated client output rather than the old implicit `@prisma/client` generated location.

For Prisma ORM 7.10+, use `prisma7.config.ts` for the Prisma 7 CLI. Prisma introduced this filename to distinguish Prisma 7 configuration from the Prisma 8 `prisma.config.ts` format. The Prisma 7 CLI discovers `prisma7.config.ts`; do not create competing config files without a deliberate migration plan.

Illustrative target schema header (the complete existing models/enums must remain unchanged unless a separately reviewed schema change is approved):

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

Illustrative Prisma 7 CLI config:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

The app's generated-client imports and adapter initialization must be migrated together. In particular, preserve the `Prisma.Decimal` usage in payout calculations and the existing Prisma transaction boundaries. Do not perform a partial dependency-only upgrade.

## 3. Baseline decision gate

Before generating or marking a baseline, the database owner must identify the exact target database and classify it:

| Target state | Correct treatment |
|---|---|
| Existing database with important data and no Prisma migration history | Generate the initial migration from the reviewed schema; verify the live schema matches; then mark the baseline as applied. |
| Empty/new development database | Keep the initial migration unapplied and use `prisma migrate dev` to create the database from migration history. |
| Existing database with a non-empty or unknown `_prisma_migrations` history | Stop. Reconcile the existing history; do not delete or replace it. |
| Database whose live schema differs from `schema.prisma` | Stop. Introspect and reconcile differences before baselining. |
| MongoDB | This PostgreSQL runbook does not apply. |

A baseline is not a database backup, a schema repair, or proof of equivalence. `migrate resolve --applied` writes migration-history metadata; it does not create the represented tables or validate that they exist.

## 4. Generate the initial migration (after the Prisma 7 upgrade)

First inspect and archive any existing migration directory. Never delete migration history merely to make this procedure work.

For a repository confirmed to have no existing migration history:

```bash
mkdir -p prisma/migrations/0_init

pnpm exec prisma migrate diff \
  --from-empty \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
```

Review the complete SQL before committing it. Check table names, primary and foreign keys, unique constraints, indexes, enum types, defaults, referential actions, and all monetary Decimal precisions. Add reviewed PostgreSQL-only objects (such as triggers or functions) explicitly if the application requires them and they are not represented in the Prisma schema.

Create and commit `prisma/migrations/migration_lock.toml` with:

```toml
provider = "postgresql"
```

## 5. Verify before resolving

For the exact existing target database, first establish a verified backup and a controlled maintenance/change window. Use a read-only comparison from the configured database to the Prisma schema and inspect the complete SQL diff:

```bash
pnpm exec prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script
```

If the command produces SQL that would alter the database, the schemas do not match. Do not mark the baseline applied. Investigate and reconcile the difference first. A zero-diff result is necessary but must be paired with a review of the target database identity and existing migration-history table.

Only after the database owner has verified all of the following may the baseline be resolved:

- The connection points to the intended database and schema.
- A recent, restorable backup exists.
- The live schema matches the reviewed baseline.
- The existing `_prisma_migrations` table is absent or its contents have been reconciled and approved.
- The baseline SQL has been reviewed and committed.
- The operation is explicitly approved for that target environment.

Then, and only then:

```bash
pnpm exec prisma migrate resolve --applied 0_init
```

This command is an intentional write to the target database's migration metadata. Never run it in CI by default or against production as an unattended setup step.

## 6. Normal migration lifecycle

Development database:

```bash
pnpm exec prisma migrate dev --name descriptive_change
pnpm exec prisma generate
```

Production/staging deployment after review and approval:

```bash
pnpm exec prisma migrate deploy
```

Production migrations must be a separately approved release operation. Do not run `migrate dev`, `db push`, `migrate reset`, or `migrate resolve` in the production deployment build.

## 7. Required CI and release safeguards

Before this work is considered complete, CI must validate:

1. The exact Prisma 7 CLI/client versions and frozen pnpm lockfile.
2. Schema formatting and validation.
3. Generated Prisma Client output.
4. Migration directory ordering and presence of `migration_lock.toml`.
5. A disposable PostgreSQL database can be created from the full migration history.
6. Financial regression tests for Decimal precision, ledger idempotency, payout transitions, webhook idempotency, and transaction behavior.
7. Production migration execution is not part of build, preview, or ordinary CI.

Do not make a CI job automatically resolve the baseline. Do not expose database URLs or credentials in logs.

## 8. Current blockers / next approval

This runbook is intentionally not accompanied by a generated `0_init/migration.sql` yet. The current repository is still on Prisma 6.19.3, the Prisma 7 runtime/client migration has not been applied, and the target database and its live schema/history have not been identified or verified. Generating a baseline from the Prisma schema alone would not prove that any existing database matches it.

Before the executable upgrade/baseline can be completed, the owner must provide or identify the intended non-production PostgreSQL database (or confirm that only an empty development database exists), and confirm which existing database—if any—must be preserved. Never paste database passwords or connection secrets into chat; use a secure environment/secret manager.

## References

- [Prisma ORM 7 baselining](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining)
- [Prisma ORM 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
- [Prisma ORM release status](https://www.prisma.io/docs/orm/release-status)
