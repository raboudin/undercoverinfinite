# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

`undercoverinfinite` is **Undercover Infinite**, a Cold-War-espionage social deduction party game (local pass-and-play on mobile + a networked online lobby on web). The repo currently contains only `frontend/`, a Nuxt 4 app. It has a ported design system (Tailwind theme tokens + Vue components) but no game logic, routing, or backend yet — that's the next layer to build.

## Commands

All commands run from `frontend/`:

```bash
npm install         # install dependencies (also runs `nuxt prepare` via postinstall)
npm run dev          # start dev server at http://localhost:3000
npm run build        # production build
npm run preview      # locally preview the production build
npm run generate     # static site generation
npm run test          # run the Vitest suite once
npm run test:watch    # run Vitest in watch mode
```

Run a single test file with `npx vitest run app/components/core/Button.spec.ts`. There is no lint setup configured yet.

## Architecture

- Uses Nuxt 4's `app/` directory convention — pages, components, assets, etc. live under `frontend/app/`, not the repo root.
- `frontend/app/app.vue` — currently doubles as a design-system demo page (not real app routing yet).
- `frontend/nuxt.config.ts` — registers `@tailwindcss/vite`, the global CSS entry, and the component auto-import dirs below.
- TypeScript config (`frontend/tsconfig.json`) references generated project configs under `.nuxt/` — run `npm install` or `npm run dev` at least once before IDE type-checking works.

### Design system

Ported from a Claude Design project (`claude.ai/design/p/002cef45-c285-4293-862f-de5a33741147`, originally React/JSX) into Tailwind CSS v4 + Vue SFCs. If the design changes upstream, re-pull via the `DesignSync` MCP tool rather than hand-editing tokens out of sync with the source.

- `frontend/app/assets/css/main.css` — Tailwind v4 `@theme` block with every design token (colors, fonts, radii, shadows/glows, type scale). Semantic color aliases are named for their Tailwind utility, not the original CSS-var name (e.g. `--color-app` → `bg-app`, `--color-primary` → `text-primary`).
  - **Gotcha**: radius tokens are named `xs`/`sm`/`md`/`lg`/`pill`, not bare `s`/`m`/`l` — Tailwind reserves bare `s`/`l` as logical-direction suffixes on `rounded-*` (`rounded-s` = inline-start radius), which silently collides with a same-named custom token. Keep new token names off Tailwind's reserved single-letter direction suffixes (`t`/`r`/`b`/`l`/`s`/`e`).
- `frontend/app/components/{core,data-display,feedback}/` — design-system components, auto-imported flat (no path prefix — `Button.vue` → `<Button>`) via the `components:` config in `nuxt.config.ts`. Each `.vue` file has a colocated `*.spec.ts` unit test (Vitest + `@vue/test-utils` + `happy-dom`).
  - `core/`: `Button`, `IconButton`, `RoleTag`
  - `data-display/`: `Avatar`, `Card`, `PlayerRow` (composes `Avatar`)
  - `feedback/`: `Modal` (uses `Teleport(to="body")` — tests must clean up `document.body` between cases), `ProgressTimer`, `Toast`
- Icons: `@lucide/vue` (not `lucide-vue-next`, which is deprecated), imported explicitly per component (e.g. `import { Eye } from '@lucide/vue'`) — not auto-imported.
- Brand voice/content rules (French "tu", mission-briefing copy, no emoji, specific color/tone semantics) live in the source design project's `readme.md` / `SKILL.md`, not duplicated here — pull them via `DesignSync` if a future session needs the full guidelines while building real screens.
