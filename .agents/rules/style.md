---
description: 'Code Formatting and Style Standards'
globs: '*.ts, *.tsx, *.js, *.jsx, *.css'
---

# Code Style and Standards

## Linting & Formatting

- **Linter:** ESLint is configured with `airbnb` config, `@typescript-eslint`, and React plugins. Warnings are set to fail (`--max-warnings 0`).
- **Formatter:** Prettier is used for code formatting. It includes plugins for sorting imports (`@ianvs/prettier-plugin-sort-imports`), ordering CSS (`prettier-plugin-css-order`), and sorting Tailwind classes (`prettier-plugin-tailwindcss`).
- **Spell Checking:** `cspell` is configured to run on all text and code files to ensure correct spelling.

## Git Hooks & Commits

- **Husky:** Used to run pre-commit and commit-msg hooks.
- **Commit Messages:** Must follow the **Conventional Commits** standard, enforced by `@commitlint/cli`.
- **Pre-commit:** `lint-staged` automatically runs ESLint (`--fix`) and Prettier (`--write`) on all staged files before committing.

## Package Management

- **pnpm:** This project strictly uses `pnpm` (enforced via `npx only-allow pnpm`). Do not use `npm` or `yarn`.
- **Node Version:** Requires Node `>=20.x`.
