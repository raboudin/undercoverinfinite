# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

`undercoverinfinite` is **Undercover Infinite**, a Cold-War-espionage social deduction party game (local pass-and-play on mobile + a networked online lobby on web). It's a monorepo-by-convention (no workspace tooling) with two independent Node projects:

- `frontend/` — Nuxt 4 app with a ported design system (Tailwind theme tokens + Vue components).
- `api/` — NestJS backend with Prisma ORM, no domain models/routes yet.

No game logic wires the two together yet — that's the next layer to build.

## Commands

### frontend/

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

### api/

```bash
npm install              # install deps (also runs `prisma generate` via postinstall)
npm run start:dev         # start Nest in watch mode at http://localhost:3000
npm run build              # tsc build to dist/
npm run test                # jest unit tests
npm run test:e2e            # jest e2e tests
npm run prisma:generate      # regenerate the Prisma client after schema changes
npm run prisma:migrate       # create/apply a dev migration
npm run prisma:studio        # open Prisma Studio
```

### Dev database

```bash
docker compose up -d postgres   # Postgres 18, from repo root
```

Copy `api/.env.example` to `api/.env` first — its `DATABASE_URL` default already matches the compose file's credentials (`undercoverinfinite`/`undercoverinfinite`/`undercoverinfinite` on `localhost:5432`).

## Architecture

### frontend/

- Uses Nuxt 4's `app/` directory convention — pages, components, assets, etc. live under `frontend/app/`, not the repo root.
- `frontend/app/app.vue` — currently doubles as a design-system demo page (not real app routing yet).
- `frontend/nuxt.config.ts` — registers `@tailwindcss/vite`, the global CSS entry, and the component auto-import dirs below.
- TypeScript config (`frontend/tsconfig.json`) references generated project configs under `.nuxt/` — run `npm install` or `npm run dev` at least once before IDE type-checking works.

#### Design system

Ported from a Claude Design project (`claude.ai/design/p/002cef45-c285-4293-862f-de5a33741147`, originally React/JSX) into Tailwind CSS v4 + Vue SFCs. If the design changes upstream, re-pull via the `DesignSync` MCP tool rather than hand-editing tokens out of sync with the source.

- `frontend/app/assets/css/main.css` — Tailwind v4 `@theme` block with every design token (colors, fonts, radii, shadows/glows, type scale). Semantic color aliases are named for their Tailwind utility, not the original CSS-var name (e.g. `--color-app` → `bg-app`, `--color-primary` → `text-primary`).
  - **Gotcha**: radius tokens are named `xs`/`sm`/`md`/`lg`/`pill`, not bare `s`/`m`/`l` — Tailwind reserves bare `s`/`l` as logical-direction suffixes on `rounded-*` (`rounded-s` = inline-start radius), which silently collides with a same-named custom token. Keep new token names off Tailwind's reserved single-letter direction suffixes (`t`/`r`/`b`/`l`/`s`/`e`).
- `frontend/app/components/{core,data-display,feedback}/` — design-system components, auto-imported flat (no path prefix — `Button.vue` → `<Button>`) via the `components:` config in `nuxt.config.ts`. Each `.vue` file has a colocated `*.spec.ts` unit test (Vitest + `@vue/test-utils` + `happy-dom`).
  - `core/`: `Button`, `IconButton`, `RoleTag`
  - `data-display/`: `Avatar`, `Card`, `PlayerRow` (composes `Avatar`)
  - `feedback/`: `Modal` (uses `Teleport(to="body")` — tests must clean up `document.body` between cases), `ProgressTimer`, `Toast`
- Icons: `@lucide/vue` (not `lucide-vue-next`, which is deprecated), imported explicitly per component (e.g. `import { Eye } from '@lucide/vue'`) — not auto-imported.
- Brand voice/content rules (French "tu", mission-briefing copy, no emoji, specific color/tone semantics) live in the source design project's `readme.md` / `SKILL.md`, not duplicated here — pull them via `DesignSync` if a future session needs the full guidelines while building real screens.

### api/

Standard `nest new` layout plus Prisma. Prisma is on **v7**, which changed enough from v6 that most tutorials/muscle memory are wrong — read this before touching `prisma/schema.prisma` or client instantiation:

- **No `url` in the datasource block.** `datasource db { provider = "postgresql" }` only — no `url = env(...)`. Putting it back throws a schema validation error (P1012). Connection strings now live in two separate places:
  - `prisma.config.ts` (root of `api/`) — used by the Prisma **CLI** (`migrate`, `studio`, `db push`), reads `DATABASE_URL` via `dotenv/config`.
  - The **runtime client** gets its connection via an explicit driver adapter, not the schema — see below.
- **Driver adapter is required for SQL providers.** `PrismaService` (`api/src/prisma/prisma.service.ts`) constructs `PrismaClient` with `new PrismaPg({ connectionString: process.env.DATABASE_URL })` from `@prisma/adapter-pg`. `process.env.DATABASE_URL` has to already be populated — `api/src/main.ts` does `import 'dotenv/config'` as its first line for exactly this reason.
- **Generated client lives in `api/src/generated/prisma`** (not `node_modules/@prisma/client`), via `output = "../src/generated/prisma"` in the generator block. It's gitignored; `npm install` regenerates it via the `postinstall` script. Import it with an explicit `.js` extension even though the source is `.ts` — `from '../generated/prisma/client.js'` — required by the `nodenext` module resolution in `tsconfig.json`.
  - **Gotcha (the one that actually breaks the build): `moduleFormat = "cjs"` is required in the generator block.** Prisma 7's client generator defaults to ESM output (uses `import.meta.url` internally). Nest's default build is CommonJS, and `require()`-ing that ESM file throws `ReferenceError: exports is not defined in ES module scope`. Don't remove `moduleFormat = "cjs"` from `prisma/schema.prisma` without also converting the whole `api/` project to ESM (`"type": "module"`, `module: "ESNext"`, etc.) — that's a bigger, deliberate migration, not a quick fix.
  - **Gotcha: keep the generated client under `src/`.** If the generator `output` points outside `src/` (e.g. sibling `api/generated/`), `nest build`'s inferred `rootDir` balloons to cover both directories and the compiled output lands at `dist/src/main.js` instead of `dist/main.js`, breaking `start:prod` (`node dist/main`) and other tooling that assumes the flat layout.
  - `prisma.config.ts` itself should stay excluded from the Nest build (`tsconfig.build.json`'s `exclude`) — it's CLI-only and isn't imported by app code.
- `PrismaModule` (`api/src/prisma/prisma.module.ts`) is `@Global()` and exports `PrismaService`; it's imported once in `AppModule`. Don't re-import it per-feature-module.
- **Postgres 18 docker gotcha**: the official image changed its data directory convention — mount the named volume at `/var/lib/postgresql` (the parent), not `/var/lib/postgresql/data` as with older Postgres images, or the container crash-loops on boot with a "data incompatible" error. Already handled in the root `docker-compose.yml`; don't "fix" it back to the old path.
- **Prisma Postgres (hosted) is a separate, unused option** — not what this repo runs on (we use local docker Postgres via a plain TCP driver adapter), but worth knowing about if a hosted/branch-per-PR database is ever wanted: `npx create-db@latest` spins up an instant temporary Postgres (auto-deletes in ~24h unless claimed); `npx @prisma/cli database create <name>` provisions a persistent one tied to a Prisma Console project; `prisma postgres link` wires an existing one into `.env`. None of this is configured here today.
