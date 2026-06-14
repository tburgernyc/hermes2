// Root ESLint flat config (ESLint 9). Shared by the non-Next workspace
// packages (packages/db, packages/ai, packages/core, packages/emails).
//
// apps/web has its own apps/web/eslint.config.mjs that layers Next.js's
// native flat config on top of these shared rules — eslint-config-next 15.4
// ships first-class flat configs (eslint-config-next/core-web-vitals and
// eslint-config-next/typescript), so FlatCompat is NOT required here.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier/flat";

export default tseslint.config(
  // Never lint build artifacts, deps, or generated declaration output.
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.turbo/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Keep ESLint out of Prettier's lane: turn off all formatting-related rules.
  // Must come last so it can disable conflicting rules from configs above.
  prettier,
);
