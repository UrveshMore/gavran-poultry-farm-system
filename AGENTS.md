# Agent notes

Canonical Git repository: https://github.com/UrveshMore/gavran-poultry-farm-system

After each completed phase, push the full git history to that repository's `main` branch. Keep the Cursor `origin` remote if the agent workspace uses it. Add a `github` remote rather than replacing `origin`. Do not open a pull request unless the user asks. If the push fails, say so in the final report and include the error.

Read `docs/blueprint.md`, `docs/ROADMAP.md`, and `docs/DECISIONS.md` before changing behavior. Continue from the first roadmap phase that is not done. Do not invent dosages, prices, tax rules, hatch days, or SOP thresholds.

Stack is fixed: React + TypeScript + Vite, Node.js + Express + TypeScript, MySQL 8 via `mysql2/promise` and versioned SQL. Do not add Prisma.

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before calling a phase done. Do not claim a test passed unless it was run.
