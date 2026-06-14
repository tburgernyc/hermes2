// ESLint flat config for the Next.js 15 app.
//
// GOTCHA: eslint-config-next@15.4.10 still ships LEGACY (.eslintrc-style)
// shareable configs — `module.exports = { extends: [...] }` — and exposes no
// flat-config subpath exports. (Native flat configs like
// `eslint-config-next/core-web-vitals` only exist in eslint-config-next@16+.)
// So under the locked Next 15.4.10 we bridge the legacy configs into ESLint 9
// flat config with FlatCompat from @eslint/eslintrc. This is the working
// approach for this version; revisit when upgrading to Next 16.
//
// We run the ESLint CLI directly (`eslint .` in this package's lint script)
// rather than `next lint` (which is removed in Next 16).
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier/flat";

const baseDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

const config = [
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Turn off ESLint formatting rules that conflict with Prettier (keep last).
  prettier,
];

export default config;
