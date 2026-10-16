import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: fileURLToPath(new URL(".", import.meta.url)),
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Keep existing loosely typed integrations visible without blocking deploys.
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
  // Override default ignores of eslint-config-next.
  { ignores: [
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ] },
];

export default eslintConfig;
