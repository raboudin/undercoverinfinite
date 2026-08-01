# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is an early-stage project. Currently it contains only `frontend/`, a Nuxt 4 application scaffolded from the default `nuxt init` minimal starter — no custom routes, components, or business logic have been added yet. Expect the architecture section below to grow as the app is built out.

## Commands

All commands run from `frontend/`:

```bash
npm install       # install dependencies (also runs `nuxt prepare` via postinstall)
npm run dev        # start dev server at http://localhost:3000
npm run build      # production build
npm run preview    # locally preview the production build
npm run generate   # static site generation
```

There is no lint or test setup configured yet.

## Architecture

- `frontend/app/app.vue` — root Vue component (currently just the Nuxt welcome page).
- `frontend/nuxt.config.ts` — Nuxt config (minimal; devtools enabled).
- Uses Nuxt 4's `app/` directory convention (routes/pages, components, etc. should live under `frontend/app/`, not the repo root, per Nuxt 4 defaults).
- TypeScript config (`frontend/tsconfig.json`) references generated project configs under `.nuxt/` (created by `nuxt prepare`/`nuxt dev`) — run `npm install` or `npm run dev` at least once before expecting IDE type-checking to work.
