# Prisma workspace

The shared Prisma schema is kept at `/prisma/schema.prisma` so it can be reused by Corleon apps. The web package scripts pass this path explicitly:

- `pnpm --filter @corleon/web db:generate`
- `pnpm --filter @corleon/web db:migrate`

Keep `prisma` and `@prisma/client` declared at the workspace root and in the consuming app package so Prisma CLI auto-detection and app runtime resolution work under pnpm's strict workspace dependency isolation.
