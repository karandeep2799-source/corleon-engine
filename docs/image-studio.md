# Corleon Image Studio

Private image generation, editing, templates and asset history inside the Corleon Engine Next.js app.

## Components
- Next.js App Router / Node.js route handlers
- OpenAI Images API using GPT Image 2.5 Sunburst and Flare
- Prisma + PostgreSQL metadata and job records
- Private S3-compatible object storage (AWS S3, Cloudflare R2 or compatible endpoint)
- HttpOnly HMAC-signed administrator session cookie
- Prompt templates, private image history, search and deletion

## Required environment
DATABASE_URL, OPENAI_API_KEY, IMAGE_STUDIO_ADMIN_EMAIL, IMAGE_STUDIO_ADMIN_PASSWORD_HASH, IMAGE_STUDIO_SESSION_SECRET, IMAGE_STUDIO_S3_BUCKET, IMAGE_STUDIO_S3_ACCESS_KEY_ID, IMAGE_STUDIO_S3_SECRET_ACCESS_KEY. Optional: IMAGE_STUDIO_S3_ENDPOINT, IMAGE_STUDIO_S3_REGION (default auto), IMAGE_STUDIO_S3_SSE, IMAGE_STUDIO_ORG_SLUG, IMAGE_STUDIO_DAILY_LIMIT (default 20).

Generate a password hash with: node scripts/hash-image-studio-password.mjs '<long-password>' (minimum 14 characters). Generate a session secret with: openssl rand -base64 48. All credentials are server-only.

## Setup
1. Configure environment variables locally and in Vercel.
2. Run pnpm install.
3. Run pnpm prisma:generate.
4. Run pnpm prisma:deploy against the target PostgreSQL database.
5. Deploy from repository root with the existing Vercel monorepo build command.
6. Open /studio and sign in with the configured administrator account.

## API
- GET/POST/DELETE /api/studio/auth: session, sign-in and sign-out.
- GET /api/studio?view=templates: built-in presets.
- POST /api/studio: JSON generation or multipart edit (image + prompt).
- GET /api/studio: cursor-paginated asset history with q and limit.
- GET /api/studio?view=file&id=...: authenticated private image bytes.
- DELETE /api/studio?id=...: delete owned asset and stored object.

## Security and operations
- Keep the object bucket private; browser requests are proxied through authenticated routes.
- Uploads are signature-checked PNG/JPEG/WebP and limited to 4 MiB to stay within Vercel function request-body limits.
- API limits each user to 20 image tasks per rolling 24 hours by default. Configure WAF/edge rate limiting for auth and API routes.
- Generation/edit functions request a 300-second maximum and have a 270-second provider timeout. Actual duration is constrained by the Vercel plan. Move provider calls to a durable queue/worker for sustained volume or when plan function duration is insufficient.
- The initial login adapter is single-admin, not multi-user RBAC/SSO/MFA. Replace it with Corleon's shared identity provider before customer-facing multi-user use.
- Configure database backups, object lifecycle retention, spend alerts and incident monitoring before launch.
- Review generated images before commercial publication; exact text and fine details may still require human QA.
- GPT Image API access may require OpenAI organization verification.

Official docs: https://developers.openai.com/api/docs/guides/image-generation and https://developers.openai.com/api/docs/guides/image-prompting
