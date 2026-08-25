import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: directory });

export default [
  { ignores: [".next/**", "node_modules/**", "coverage/**", "work/**", "public/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
