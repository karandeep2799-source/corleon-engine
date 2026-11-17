import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".eve/**",
    ".output/**",
    ".vercel/**",
    "coverage/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "LEARNING_API_GUIDE.js",
    "aiLearning.js",
    "learningRoutes.js",
    "multiModelLearner.js",
    "standaloneAI.js",
  ]),
]);
