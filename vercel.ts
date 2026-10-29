import { withEve } from "eve/vercel";

/**
 * Compose the existing Next.js app and the eve agent as peer Vercel services.
 * The helper adds the eve service and its /eve/v1/* route while preserving
 * the app route and cron configuration below.
 */
export default await withEve({
  services: {
    web: {
      framework: "nextjs",
      root: "apps/web",
      buildCommand: "pnpm exec next build",
    },
  },
  routes: [
    {
      src: "^(.*)$",
      destination: { type: "service", service: "web" },
    },
  ],
  crons: [
    {
      path: "/api/cron/release-commissions",
      schedule: "0 0 * * *",
    },
  ],
});
