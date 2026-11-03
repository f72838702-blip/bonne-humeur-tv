import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ESLint 9 (flat config) — règles Next.js officielles.
 * Installation : eslint, eslint-config-next, @eslint/eslintrc
 * (dépendances ajoutées au package.json).
 */
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  {
    ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "out/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals"),
];

export default config;