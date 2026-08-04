# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

`undercoverinfinite` is **Undercover Infinite**, a Cold-War-espionage social deduction party game (local pass-and-play on mobile + a networked online lobby on web). It's a monorepo-by-convention (no workspace tooling) with two independent Node projects:

- `frontend/` — Nuxt 4 app with a ported design system (Tailwind theme tokens + Vue components) **and a playable local pass-and-play game** (v1).
- `api/` — NestJS backend with Prisma ORM. Three domain modules: `entitlements` (packs, modes, thèmes, crédits), `words` (le tirage des mots par LLM) et `auth` (comptes, JWT en cookies, OAuth Google/Facebook) — see below.

Game state stays client-side, but the frontend calls `api/` for **what a player is allowed to do** (`GET /entitlements`) and for **the words of each game** (`POST /words/draw`, which debits a credit). There is no local word list and no daily batch anymore: words are generated on demand. The networked online lobby is still to build.

**Le crédit est l'unité de facturation : 1 crédit = 1 partie**, quel que soit le nombre de mots qu'elle demande. 5 par jour sans pack (avec ou sans compte), 50 par jour avec un pack illimité, plus un solde acheté qui ne se réinitialise pas.

**Le compte est optionnel et le restera tant qu'il n'y a que du pass-and-play** : `/connexion` existe des deux côtés (API + front), mais aucune route ni aucun écran de jeu n'est protégé. Le dossier d'agent est la fondation du lobby en ligne à venir, pas un péage devant la partie.

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
npm run start:dev         # start Nest in watch mode at http://localhost:3001 (PORT in .env; frontend dev owns :3000)
npm run build              # tsc build to dist/
npm run test                # jest unit tests
npm run test:e2e            # jest e2e tests
npm run prisma:generate      # regenerate the Prisma client after schema changes
npm run prisma:migrate       # create/apply a dev migration
npm run prisma:studio        # open Prisma Studio
```

**Don't strip `--experimental-vm-modules` from the jest scripts.** Prisma 7's generated client loads its query compiler as WASM through a dynamic `import()`. Jest's default CJS VM refuses that with `TypeError: A dynamic import callback was invoked without --experimental-vm-modules`, so any suite that boots a module touching `PrismaService` fails. The flag is why the scripts invoke `node ./node_modules/jest/bin/jest.js` instead of plain `jest`.

Two related bits of jest config exist for the same reason and shouldn't be removed:
- `moduleNameMapper: {"^(\\.{1,2}/.*)\\.js$": "$1"}` — source imports the generated client as `'../generated/prisma/client.js'` (required by `nodenext`) while the file on disk is `.ts`; jest doesn't know that convention and reports "Cannot find module".
- `setupFiles: ["dotenv/config"]` — e2e boots `AppModule`, so `PrismaService` needs `DATABASE_URL`; in production `main.ts` loads it, but tests never go through `main.ts`.

ESLint ignores `src/generated/**` (`eslint.config.mjs`) — the Prisma client is generated code, regenerated on every `npm install`.

### CI

`.github/workflows/ci-cd.yml` fait deux choses très différentes selon le déclencheur. Chaque job refait son `npm ci` dans son sous-dossier — il n'y a pas de `package.json` racine.

- **Sur une pull request** : `build` (installe + construit les deux applis), `unit-tests` (matrice `frontend`/`api`, `npm test`), puis un scan Trivy du dépôt (`severity: CRITICAL`, `exit-code: 1` — une CVE critique **casse** la CI). Le job `e2e-tests` est **commenté** : `npm run test:e2e` ne tourne pas en CI, il faut le lancer à la main.
- **Sur un push vers `main`** : build et push des images `ghcr.io/<repo>/{app,api}` (tags `<sha>` et `latest`), **puis `deploy-staging`**. Aucun test ne tourne sur ce déclencheur — ils sont supposés avoir été verts sur la PR.
- **Sur un tag `vX.Y.Z`** : re-tag des images de ce SHA, puis `deploy-production`.

**`deploy.yml` n'est pas dormant — il est branché et il déploie vraiment.** Pousser sur `main` met à jour staging sur le VPS ; taguer met à jour la production. Il copie le compose ciblé et un `.env` généré par SSH, puis `docker compose pull && up -d`. Ce `.env` prend `LLM_MODEL` et `LLM_GATEWAY_URL` dans les **Variables** GitHub (`vars.`), tout le reste dans les **Secrets** — une variable vide retombe sur le défaut du compose, qui vise le gateway Vercel. Les domaines sont figés dans les compose (`undercoverinfinite.com`, `staging.` et `api[-staging].`), routés par Traefik sur le réseau externe `proxy` avec le certresolver `le`.

### Dev database

```bash
docker compose up -d postgres   # Postgres 18, from repo root
```

Copy `api/.env.example` to `api/.env` first — its `DATABASE_URL` default already matches the compose file's credentials (`undercoverinfinite`/`undercoverinfinite`/`undercoverinfinite` on `localhost:5432`).

## Architecture

### frontend/

- Uses Nuxt 4's `app/` directory convention — pages, components, assets, etc. live under `frontend/app/`, not the repo root.
- `frontend/app/app.vue` — the shell: sticky header (logo mark + `AccountButton` + shop link + music mute toggle) wrapping `<NuxtPage />` in a `max-w-lg` mobile-first column. Screens don't repeat that chrome.
  - **Le logo ramène au menu principal, même en pleine partie.** Sur `/` il n'y a aucune navigation à attendre : c'est `useMissionExit()` (un compteur en `useState`) que la page surveille pour refermer la mission. `useState` et non un `ref` de module — au rendu serveur, un `ref` de module est partagé par tous les visiteurs et la sortie de l'un renverrait l'autre au menu.
- Routes: `/` is the game (`app/pages/index.vue`), `/boutique` la vitrine des packs (`app/pages/boutique.vue`), `/connexion` l'écran de compte (`app/pages/connexion.vue`), `/design-system` is the component demo that used to live in `app.vue`.
- `frontend/nuxt.config.ts` — registers `@tailwindcss/vite`, the global CSS entry, the component auto-import dirs below, and `app.head` (title, favicon, **Google Fonts for Oswald / Inter / Courier Prime**). Those three families are declared as tokens in `main.css` but aren't self-hosted — drop the stylesheet link and every `font-display`/`font-mono` silently falls back to a system font.
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

#### Local game (pass-and-play v1)

All game state is client-side; the API supplies the player's rights (`useEntitlements`) and the words of each game (`useWords`). No rights reachable and no credits left both block launching a game — there is no offline word fallback by design.

- `app/composables/useGame.ts` — the whole rules engine as a `createGame({ rng })` **factory**, not a module singleton, so every test starts clean and can inject a deterministic PRNG. Phases: `setup → reveal → describe → (bets) → vote → elimination → (describe | victory)`. **Deux fins, et deux seulement** : plus aucun undercover en vie (les loyaux gagnent), ou des undercovers **strictement plus nombreux** que les loyaux (`aliveUndercovers > aliveCivils`). À égalité la partie continue — c'est ce qui laisse une dernière manche en tête-à-tête, et ce n'est pas un oubli. `configure()` plafonne malgré tout les undercovers à `Math.floor((n - 1) / 2)` : ce n'est plus une question de règle mais d'intérêt, une table qui démarre à égalité se joue sur une seule élimination.
  - Imports `ref`/`computed` explicitly from `vue`, not the `~` alias: Vitest doesn't resolve Nuxt aliases or auto-imports.
  - `app/pages/index.vue` destructures the returned refs so templates get auto-unwrapping — `game.phase` on a plain returned object stays a `Ref` in the template and won't compare against a string.
  - `configure()` and `replaySameTeam()` take a `GameSetup` (`{ pair, challenge? }`) as a parameter — the engine no longer picks words itself. The credit is debited **server-side by the draw**, so the page must call `words.draw()` first and only `configure()` on success. Replaying with the same team is a new game and costs a new draw.
  - Le mode vit dans le moteur (`mode`, `timerSeconds`, `challenge`). La phase `bets` ne s'insère qu'**une fois par partie**, après la première manche de description (`needsBets`) : miser avant, personne n'a d'indice ; miser à chaque manche, la table passerait son temps à saisir des chiffres.
- `app/composables/useBets.ts` — les comptes du mode pari risqué, en fonctions pures. Qui a désigné un undercover récupère sa mise et se partage celles des perdants au prorata ; sans gagnant (ou sans perdant) chacun reprend sa mise. Les calculs passent par des centimes entiers et le dernier gagnant absorbe l'arrondi, pour que la somme des soldes tombe **exactement** à zéro. **L'app tient le tableau, jamais la caisse** : aucun paiement, aucun moyen de paiement, aucune persistance des sommes hors de la partie en cours.
- `app/composables/useEntitlements.ts` — droits du joueur. **Aucune règle de pack n'est rejouée côté client** : le serveur envoie `modes`, `themes` et `credits`, ce composable les relaie. Dupliquer le barème garantirait qu'il dérive de l'API au premier changement de prix.
- `app/composables/useWords.ts` — `POST /words/draw` par partie. Distingue **402** (quota épuisé) de **403** (mode ou thème verrouillé) : l'écran propose la boutique dans un cas, l'attente jusqu'à minuit dans l'autre.
  - Les deux reçoivent leur `request` par injection — `~/plugins/entitlements.ts` leur passe l'`authFetch` de `useAuth` (`dependsOn: ['auth']`), qui sait rejouer une requête après rotation du token. Instance unique par plugin, pour la même raison que `$auth` : un `ref` de module fuirait d'un visiteur SSR à l'autre.
- `app/components/game/` — écrans de partie (`SetupScreen`, `ModeSelector`, `ThemeButton`, `ThemeCarousel`, `GameTable`, `ArtSlot`, `RevealScreen`, `DescribeScreen`, `BetScreen`, `VoteScreen`, `EliminationScreen`, `VictoryScreen`), auto-importés à plat comme les autres dossiers. Ils sont présentationnels : props en entrée, emits en sortie, aucun état de jeu à eux hors du strict nécessaire local (carte retournée, accusation en attente, parieur courant, décompte). Ils composent le design system, ils ne l'étendent pas.
  - **Un mode ou un thème verrouillé remonte un événement `locked`, il ne navigue pas** : c'est la page qui ouvre `/boutique`. Un `NuxtLink` dans ces composants obligerait chaque spec à le stubber.
  - `BetScreen` fait miser **un agent à la fois** (pass-and-play) : une grille listant tous les paris les rendrait publics avant le vote.
  - `DescribeScreen` redémarre son minuteur sur un `watch` de `speakerIndex`, pas sur `onMounted` — le composant reste monté d'un orateur à l'autre.

##### La table

Toute la partie se joue autour d'un même plateau : `GameTable` sert le tour de table du dressage, la distribution, la description, le vote et l'élimination. Ce qu'il ne faut pas défaire :

- **`app/utils/tableLayout.ts` porte la géométrie**, pas le composant. `seatLayout(count)` rend la taille des cartes et la position de chaque siège en pourcentage du plateau — jamais en pixels, jamais lus dans le DOM, donc identiques du téléphone à l'écran large. La règle qu'il garantit (« deux cartes ne se recouvrent jamais, de trois à douze agents ») se vérifie sur une fonction pure ; c'est tout l'intérêt de l'avoir sortie du rendu, et `tableLayout.spec.ts` la teste pour chaque effectif.
  - Les sièges sont **décalés d'un demi-pas** : sans ça une table de quatre pose une carte pile à midi et une pile à six heures, qui mordent toutes deux sur le tableau de bord central.
  - Les cartes passent du portrait (4:5) au **carré au-delà de cinq agents** : sur les flancs de l'ellipse, c'est leur hauteur qui les ferait se chevaucher.
  - Le nom perd son `tracking-caps` sur les petites cartes : l'interlettrage coupe « Marion » à deux lettres bien avant que la largeur ne pose problème.
- **Le mot n'est dans le DOM que si la carte est retournée** (`v-if="seat.faceUp"`). `backface-visibility` cache la face au regard, pas au document : sans ce garde, le mot serait lisible dans la page et lu à voix haute par un lecteur d'écran alors que la carte est face cachée.
- **L'atténuation d'un siège grillé se pose sur la scène, pas sur la carte.** Une `opacity` inférieure à 1 sur un élément `transform-style: preserve-3d` aplatit son contexte 3D : `backface-visibility` cesse d'opérer et la carte retournée s'affiche en miroir. Les utilitaires `.flip-*` et `.table-felt` vivent dans `main.css`, à côté de `.dossier-texture`.
- **Une carte ne dit jamais le camp.** `TableSeat` n'a même pas de quoi le porter : la carte d'un éliminé montre son mot, rien d'autre. Le camp, lui, s'annonce dans le débriefing d'`EliminationScreen`, *sous* la table — une partie à plusieurs manches a besoin de savoir sur quoi elle vient de voter. La séparation est testée : `EliminationScreen.spec.ts` compare les deux plateaux caractère pour caractère, un undercover grillé et un loyal grillé donnent la même table.
- **`revealing` n'est pas `faceUp`.** Le premier déclenche l'animation de retournement, le second dit simplement que la face est visible : sur la table de vote, les cartes des manches précédentes sont face visible sans qu'il faille rejouer leur animation à chaque rendu.

##### Menu principal et vitrine des thèmes

- `SetupScreen` tient **deux étapes** : le menu (modes + dossier thématique, rien d'autre) puis la table (noms, undercovers, chrono, crédits). Tout ce qui dépend des joueurs présents attend la table ; le menu ne pose que la question qu'on se pose avant de sortir le téléphone du sac.
- `ThemeCarousel` est en `Teleport(to="body")` — un thème par écran, glissement au doigt, flèches qui n'apparaissent qu'à l'approche d'un bord, flèches/Échap au clavier. **Le garde `typeof document === 'undefined'` autour des écouteurs clavier n'est pas décoratif** : le watcher est immédiat, il tourne donc aussi au rendu serveur, où il n'y a pas de document (sans lui, `/` répond 500).
- **Le mode hot n'a pas de bouton thématique** et part sur `general` : son pool est déjà un registre à part, lui proposer un dossier laisserait croire à un réglage sans prise.
- Les accroches des thèmes (`tagline`) viennent du catalogue serveur comme celles des modes — le front ne connaît pas la liste des thèmes, il ne peut pas inventer leur copie.
- **Les visuels sont découverts au build** (`app/utils/gameArt.ts`, `import.meta.glob` sur `app/assets/images/`), jamais devinés à partir d'un identifiant. Une URL construite à la main ferait un 404 par visuel manquant, à chaque rendu ; là, `themeHero()` rend `null` et `ArtSlot` affiche un cartouche texte. Déposer un fichier suffit à l'afficher — tailles et identifiants attendus dans `app/assets/images/README.md`.
- `app/components/store/` + `app/pages/boutique.vue` — la vitrine. Prix et contenus viennent de `GET /packs` ; ne pas les redéclarer côté front.
- Which side of a pair goes to the civils is drawn per game (in `deal`), so undercovers don't always inherit the same column of the batch.
- Music: `app/composables/useBackgroundMusic.ts` (module-level shared state) + `public/audio/music.mp3`. Playback **must** start from a real user gesture — it's kicked off by the "Lancer la mission" click, since browsers block autoplay. Mute state persists in `localStorage`.
- Big binaries (the mp3) live in `public/`, not `assets/`, so Vite serves them directly instead of bundling them. Les illustrations de modes et de thèmes, elles, sont dans `assets/` : c'est ce qui permet à `import.meta.glob` de savoir lesquelles existent (voir ci-dessus).
  - **`public/audio/*.mp3` is gitignored** — a fresh clone won't have `music.mp3`. The app still builds and runs; the `<audio>` fetch just 404s and the background music stays silent. Drop the file in by hand (it isn't fetched or generated by any script).

#### Compte agent (front)

Écran `/connexion` (`app/pages/connexion.vue`) + `app/components/auth/` (`AuthForm`, `AccountButton`, déclaré dans `components:` de `nuxt.config.ts` comme les autres dossiers). Ce qu'il ne faut pas défaire :

- **`credentials: 'include'` sur chaque requête** (`app/composables/useAuth.ts`) : les tokens sont dans des cookies httpOnly que le JS ne voit pas (`document.cookie` est vide, c'est vérifié). Sans cette option, le navigateur n'envoie rien et tout répond 401.
- **Une seule instance, fournie par `app/plugins/auth.ts` en `$auth`** — et non un état de module comme `useBackgroundMusic`. Un `ref` de module côté serveur serait partagé par tous les visiteurs SSR : la session de l'un fuirait chez l'autre. `createAuth()` reste une factory pure (aucun import Nuxt) pour rester testable en Vitest.
- **La session n'est résolue que côté client** (`if (import.meta.client)` dans le plugin) : le rendu serveur ne relaie pas l'en-tête `Cookie`. D'où `resolved` — les composants n'affichent rien plutôt que de faire clignoter un état anonyme avant l'hydratation.
- **Rejeu automatique après un 401** : `useAuth` tente un `POST /auth/refresh` puis rejoue la requête une fois. Sans ça, l'access token expirant à 5 h déconnecterait l'utilisateur chaque après-midi alors que son refresh token vit 30 jours. `authFetch()` expose ce comportement pour les écrans à venir (lobby).
- **Le bouton Google n'apparaît qu'après confirmation de l'API** (`GET /auth/providers`) : un serveur sans `GOOGLE_CLIENT_ID` répond 503 sur `/auth/google`, autant ne pas proposer le chemin. C'est aussi pourquoi le bouton est un vrai `<a href>` et jamais un `fetch` — le navigateur doit suivre les redirections jusqu'à Google et revenir chercher ses cookies.
- La page traduit les `?error=` posés par l'API sur l'URL de retour OAuth (`oauth_rejected`, `oauth_failed`).

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
- **`entitlements` module** (`api/src/entitlements/`) — packs, modes, thèmes et crédits. Routes : `GET /packs` (vitrine publique), `GET /entitlements` (droits du demandeur, **ouvert aux anonymes**), `POST /packs/:pack/unlock` (compte obligatoire). Points à ne pas défaire :
  - **`catalog.ts` est la source de vérité unique** du barème. `resolveAccess()` part d'un socle (anonyme : `classique` ; compte : `classique` + `chrono`) et ajoute l'union des packs — un pack n'enlève jamais rien, l'ordre de déblocage est donc sans importance. Le front ne rejoue aucune de ces règles.
  - **Le prompt d'un thème ne sort jamais de l'API** : `catalog()` expose `{id, label, tagline, generalist}`, pas `THEMES[id].prompt` (c'est testé en e2e). La `tagline` est de la copie de vitrine — le front affiche un thème par écran et n'a aucun moyen de l'inventer, puisqu'il ne connaît pas la liste des thèmes.
  - **1 crédit = 1 partie.** `FREE_DAILY_CREDITS = 5`, `UNLIMITED_DAILY_CREDITS = 50`. Le plafond des packs « illimités » n'est pas décoratif : sans lui, un seul compte déclencherait un nombre non borné d'appels LLM.
  - **Le quota du jour se dépense avant le solde acheté** — dépenser d'abord ce qui expire ce soir de toute façon, sinon une recharge fondrait en même temps que du gratuit.
  - **La consommation est un compare-and-swap**, pas un read-then-write : `updateMany({ where: { …, used: { lt: limit } }, data: { increment: 1 } })`. Deux parties lancées ensemble ne peuvent pas franchir le plafond à deux. Même schéma sur le portefeuille (`balance: { gt: 0 }`), donc jamais de solde négatif.
  - **Le quota anonyme s'accroche à un cookie `device_id`** (httpOnly, un an), pas à l'IP : un foyer ou un partage de connexion mettrait tout le monde dans le même seau. `subject` vaut `user:<id>` ou `device:<uuid>` — un seul identifiant pour les deux, ce qui évite de dupliquer toute la logique de quota. Se connecter fait changer de sujet : la consommation anonyme du jour ne suit pas, c'est assumé.
  - **`OptionalJwtAuthGuard`** (`auth/guards/`) reconnaît une session sans l'exiger. `JwtAuthGuard` répond 401 dès que le cookie manque : inutilisable sur les routes de jeu, qui doivent rester ouvertes aux anonymes tout en créditant les packs de ceux qui ont un compte.
  - **Un pack ne se débloque qu'une fois** (`@@unique([userId, pack])`). Tant que c'est gratuit, sans cette borne un pack de recharge se reprendrait en boucle et le plafond ne voudrait plus rien dire. Quand Stripe s'intercalera, c'est cette contrainte qui devra porter la référence de transaction plutôt que le seul couple (compte, pack) — `source` et `externalRef` sont déjà là pour ça.
  - **Le mode `teams` est vendu mais pas jouable** : `MODES.teams.available === false`, et `assertCanPlay` le refuse en 403. Les règles restent à écrire.
- **`words` module** (`api/src/words/`) — le tirage des mots. `POST /words/draw { mode, theme? }` : contrôle des droits, débit du crédit, puis tirage. Points à ne pas défaire :
  - **Plus de cron ni de lot quotidien.** Les paires vivent dans un pool par `(theme, spicy)` et ne sont générées que quand le demandeur n'a plus rien d'inédit — par lots de 8, pour amortir l'appel LLM sur plusieurs parties. `ScheduleModule` a disparu d'`AppModule`.
  - **`POST` et non `GET`** : l'appel débite un crédit et peut déclencher une génération. Il ne doit surtout pas se faire rejouer par un cache ou un préchargement.
  - **Le crédit est débité *avant* la génération** pour que le plafond reste atomique — et **tout échec en aval le rembourse** (`refundCredit`). Une panne du fournisseur LLM ne doit pas coûter une partie. C'est testé.
  - **Un échec de génération sort en 503, pas en 500** (`playerFacing`) : la dépendance est en cause, pas l'API, et le détail technique ne doit pas fuir dans la réponse.
  - `content_draws` mémorise ce qu'un sujet a déjà reçu, mais l'exclusion est **bornée à 300 tirages récents** : sans plafond, la liste d'un gros joueur pèserait plus lourd que le pool.
  - **Mode hot = `spicy: true`**, un pool séparé du même thème et un prompt distinct (osé mais borné : rien d'explicite, rien d'illégal, aucun mineur). Le mode défi tire en plus un défi dans son propre pool.
  - `LlmClient` (`llm.client.ts`) porte le transport ; le service garde les prompts et le parsing. Le LLM reste piloté par l'environnement : `LLM_API_KEY` (obligatoire), `LLM_MODEL` (défaut `google/gemini-3.5-flash-lite`), `LLM_GATEWAY_URL` (défaut le Vercel AI Gateway) — changer de modèle ou de fournisseur est une config, pas du code ; une valeur vide retombe sur le défaut.
  - **Les trois variables vont ensemble.** Les défauts visent le Vercel AI Gateway (clé `vck_…`, modèles préfixés `google/…`). Une clé Google AI Studio envoyée à cette URL répond **401** — il faut alors basculer les trois : `LLM_GATEWAY_URL="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"` et un modèle **sans préfixe** (`gemini-flash-lite-latest` ; les versions pinnées finissent fermées aux nouveaux comptes et répondent 404). Les deux recettes sont dans `.env.example`.
  - **`.env` n'est relu qu'au démarrage** (`import 'dotenv/config'` dans `main.ts`) et `nest --watch` ne surveille que les fichiers TS : modifier une variable LLM sans redémarrer l'API laisse le process sur l'ancienne valeur — symptôme trompeur, la correction semble sans effet.
  - La génération est dédupliquée **par pool** (`Map<string, Promise>`) : dix parties lancées ensemble sur un thème vide ne produisent qu'un appel LLM, et deux thèmes différents se remplissent en parallèle. `createMany({ skipDuplicates })` règle les courses entre instances.
  - Le « jour » (frontière de remise à zéro) est la date **Europe/Paris** partout — `entitlements/day.ts`, partagé par les crédits.
- **`auth` module** (`api/src/auth/`) — comptes et sessions. Login classique (`POST /auth/register|login|refresh|logout`, `GET /auth/me`) plus OAuth Google/Facebook (`GET /auth/{google,facebook}[/callback]`), les deux chemins terminant sur la même émission de tokens. `GET /auth/providers` (public) dit au front quels boutons sociaux ce serveur peut honorer. Points à ne pas défaire :
  - **Les tokens ne transitent qu'en cookies httpOnly**, jamais dans le corps JSON. `JwtStrategy` lit l'access token dans le cookie `access_token` et **pas** dans l'en-tête `Authorization` (un `Bearer` valide est donc rejeté — c'est testé). Ça implique `cookie-parser` : sans lui `req.cookies` est vide et toute route gardée répond 401.
  - **`configureApp()` (`api/src/app.setup.ts`) porte cookie-parser, le `ValidationPipe` global et le CORS**, et est appelé par `main.ts` *et* par les tests e2e. Ne pas recopier ces réglages dans `main.ts` : un e2e qui ne les partage pas valide un serveur qui n'existe pas.
  - **Le CORS n'est plus permissif.** `enableCors()` sans argument (`Access-Control-Allow-Origin: *`) est incompatible avec `credentials: true` et laisserait n'importe quel site lire les réponses authentifiées. Les origines viennent de `CORS_ORIGINS` (liste séparée par des virgules, défaut `http://localhost:3000`), **déjà renseignée dans les compose staging/prod** — la vider casse aussi le tirage des mots côté navigateur.
  - **Refresh token = valeur opaque de 256 bits, stockée en SHA-256** dans `refresh_tokens` (pas bcrypt : le hash doit rester déterministe pour la recherche par index unique, et il n'y a rien à forcer sur 256 bits d'aléa). La rotation révoque la ligne au lieu de la supprimer, via un `updateMany({ where: { id, revokedAt: null } })` qui sert de compare-and-swap : deux `/auth/refresh` concurrents ne peuvent pas réussir tous les deux. **Rejouer un token déjà consommé révoque toutes les sessions de l'utilisateur** (signal de vol de cookie).
  - **Les stratégies OAuth ne sont enregistrées que si leurs credentials existent** (`configuredOAuthStrategies()` dans `auth.module.ts`) : `new GoogleStrategy()` sans `clientID` lève à la construction et ferait tomber le démarrage de toute l'API, le tirage des mots compris. Sans credentials, les routes répondent 503 via `GoogleOAuthGuard`/`FacebookOAuthGuard`.
  - **`AUTH_JWT_SECRET` est obligatoire en production** (l'API refuse de démarrer sans) ; ailleurs un secret aléatoire est généré à chaque boot, avec un warning — d'où des sessions qui ne survivent pas à un redémarrage en dev, et des tests qui tournent sans configuration.
  - **Mots de passe : `bcryptjs`** (implémentation JS pure, coût 12), pas `bcrypt` ni `argon2` — ces deux-là sont des modules natifs dont les prebuilds musl manquent souvent, ce qui obligerait à installer une toolchain C dans l'image `node:24-alpine`.
  - **Liaison de compte OAuth : seulement sur un email vérifié.** Un profil Google dont `email_verified` est faux ne peut pas récupérer un compte existant de même email — c'est la voie classique du détournement de compte par OAuth.
  - Tous les modèles portent désormais un `@@map` snake_case (`users`, `refresh_tokens`, `entitlements`, `credit_wallets`, `daily_usage`, `word_pairs`, `challenges`, `content_draws`) : `DailyWordPair`, seule exception PascalCase, a disparu avec le lot quotidien.
  - `npm run test:e2e` monte le vrai `AppModule` : il lui faut `docker compose up -d postgres` et un `DATABASE_URL` valide. `test/auth.e2e-spec.ts` et `test/entitlements.e2e-spec.ts` créent puis suppriment leur propre utilisateur (email horodaté) dans la base de dev.
  - **Deux tests d'`auth.e2e-spec.ts` échouent si `GOOGLE_CLIENT_ID` est renseigné dans `api/.env`** : ils affirment le comportement *non configuré* (`/auth/providers` à `false`, `/auth/google` en 503). C'est attendu — la CI n'a pas de credentials. Les rejouer localement avec `GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= npm run test:e2e`.
- **Migrations en déploiement**: `docker-compose.{staging,prod}.yml` ont un service **`migrate`** éphémère (même image que l'API) qui lance `npx prisma migrate deploy` avant l'API, laquelle attend `service_completed_successfully` — sans lui, une nouvelle table arrive en staging/prod sans exister en base et chaque requête casse en `P2021 TableDoesNotExist`. Trois choses le rendent possible et ne doivent pas être défaites : le CLI `prisma` est une **dépendance de production** (`npm prune --omit=dev` dans le Dockerfile le conserverait sinon pas), et le stage runtime copie `prisma/` (schéma + historique des migrations) **et** `prisma.config.ts` (qui porte l'URL de connexion, absente du bloc datasource en Prisma 7). `migrate deploy` est idempotent : il ne rejoue que les migrations manquantes.
- **Postgres 18 docker gotcha**: the official image changed its data directory convention — mount the named volume at `/var/lib/postgresql` (the parent), not `/var/lib/postgresql/data` as with older Postgres images, or the container crash-loops on boot with a "data incompatible" error. Already handled in the root `docker-compose.yml`; don't "fix" it back to the old path.
- **Prisma Postgres (hosted) is a separate, unused option** — not what this repo runs on (we use local docker Postgres via a plain TCP driver adapter), but worth knowing about if a hosted/branch-per-PR database is ever wanted: `npx create-db@latest` spins up an instant temporary Postgres (auto-deletes in ~24h unless claimed); `npx @prisma/cli database create <name>` provisions a persistent one tied to a Prisma Console project; `prisma postgres link` wires an existing one into `.env`. None of this is configured here today.
