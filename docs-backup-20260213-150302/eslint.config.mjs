import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  // Ignores
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      ".vercel/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
      "scripts/**",
    ]
  },
  // TypeScript files
  ...tseslint.configs.recommended,
  // React
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "@next/next": nextPlugin,
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-empty-object-type": "off",

      // React hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Next.js rules
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "error",
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  // Test files - relaxed rules
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-explicit-any": "off",
    }
  },
  // Lib files with complex types - relaxed any rules
  {
    files: [
      "lib/ai/**/*.ts",
      "lib/analysis/**/*.ts",
      "lib/reports/**/*.ts",
      "lib/xero/**/*.ts",
      "lib/recommendations/**/*.ts",
      "lib/monitoring/**/*.ts",
      "lib/scraping/**/*.ts",
      "lib/search/**/*.ts",
      "lib/tax-data/**/*.ts"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    }
  }
];
