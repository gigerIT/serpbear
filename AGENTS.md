# AGENTS.md

## Purpose

- Work like a maintainer, not a greenfield rewriter. Preserve existing route contracts, data shapes, and the current admin-style UI unless a task explicitly asks for broader redesign.

## Stack At A Glance

- Next.js 12 Pages Router app with React 18, TypeScript, Tailwind, and project-specific global CSS.
- Backend logic lives in Next API routes under `pages/api/`.
- SQLite is accessed through `sequelize-typescript` models in `database/models/`.
- A separate cron worker in `cron.js` calls the app's HTTP API using `APIKEY`.

## Repo Map

- `pages/`: page entry points and all API handlers.
- `components/`: feature UI and shared UI pieces.
- `services/`: client-side fetch + React Query hooks. Despite the name, these are browser-facing, not backend services.
- `utils/`: server and shared helpers for auth, scraping, Search Console, Adwords, parsing, and exports.
- `scrapers/services/`: scraper adapters; registry lives in `scrapers/index.ts`.
- `database/models/` and `database/migrations/`: Sequelize models plus forward-only schema changes.
- `types.d.ts`: shared app-wide types; keep this aligned with API payloads and persisted JSON.
- `styles/`: Tailwind entry plus global CSS used throughout the app.
- `data/` (gitignored): runtime state such as `database.sqlite`, `settings.json`, and `failed_queue.json`.

## Local Workflow

- Use Node 22.11.0 and `npm ci`; `.nvmrc`, GitHub Actions, and the Docker image are kept aligned because Next.js 12's bundled `jsonwebtoken` breaks on Node 25.8.x.
- `npm run dev`: start the Next app.
- `npm run cron`: run the worker by itself.
- `npm run lint`, `npm run test:ci`, `npm run build`: match CI.
- `npm test`: watch mode, not ideal for one-off verification.
- Tests load `.env.local`; start from `.env.example` when local env is missing.

## Project-Specific Rules

- Prefer TypeScript/TSX for new code. `tsconfig.json` is strict even though `allowJs` is enabled.
- Comment code whose purpose is not immediately clear or that handles edge cases or other non-obvious behavior, and keep those comments limited to insights that are not obvious from reading the code itself.
- Keep API access patterns centralized in `services/*.tsx` instead of adding ad hoc component-level fetch code.
- Many model fields are JSON stored inside string columns, including `history`, `tags`, `lastResult`, and `search_console`. Parse on read, stringify on write.
- Sensitive values in `data/settings.json` and domain Search Console payloads are encrypted with `Cryptr` using `SECRET`. New secrets need both encryption and decryption paths.
- Auth flows through `utils/verifyUser.ts`: the UI uses cookies, while cron and limited public endpoints use Bearer `APIKEY`. Preserve both paths when editing auth or routes.
- UI styling is a mix of Tailwind utilities and `styles/globals.css`; favor existing patterns over introducing a new styling approach.

## When Changing Specific Areas

- Scraping: update `utils/scraper.ts`, scraper adapters, and related settings together. Domain-level scrape strategy can override global settings, so check both layers.
- Settings: keep defaults synchronized between `components/settings/Settings.tsx` and `pages/api/settings.ts`. Bootstrap behavior should still work if `data/settings.json` does not exist yet.
- Google Ads auth: Step 1 starts from `POST /api/adwords/auth`, which persists the client ID/secret, clears any stale refresh token, stores a short-lived OAuth state cookie, and returns a consent-forcing OAuth URL before Google redirects back to `GET /api/adwords`; preserve that start-and-callback pairing when editing the flow.
- Database: update the Sequelize model and add a migration in `database/migrations/`. Do not rely on `db.sync()` alone for shipped schema changes.
- API routes: keep route contracts stable because both the UI hooks and cron worker call them directly. If a route should work with API-key auth, add it to `allowedApiRoutes` in `utils/verifyUser.ts`.
- Scraper integrations: add the adapter under `scrapers/services/`, then register it in `scrapers/index.ts` with accurate metadata like `id`, `name`, `allowsCity`, and `nativePagination`.

## Useful Gotchas

- `services/` modules often use `window.location.origin`, so they are client-only.
- `NEXT_PUBLIC_APP_URL` must point at the running app or cron-triggered requests will fail.
- `data/` is writable application state; never commit local runtime contents or build logic that assumes those files already exist.
- Google SERP HTML can arrive in multiple layouts through ScrapingRobot; when touching `utils/scraper.ts`, prefer actual web-result cards and avoid counting video/image/AI modules as organic results.
- Release automation uses `release-please`; commit types `feat`, `fix`, `perf`, and `deps` feed the changelog. Keep `include-component-in-tag` disabled so GitHub tags stay in the existing plain `vX.Y.Z` format.
- Release PR merges to `main` do not run `.github/workflows/ci.yml`; that workflow ignores the standard release-please file set and also skips push jobs whose merge commit message includes `chore(release):`, while `.github/workflows/release.yml` performs the post-merge lint/test/build validation.

## AGENTS.md Maintenance

- Update `AGENTS.md` immediately whenever codebase or project-context changes affect documented components, workflows, architecture, behavior, or any other guidance captured here.
- If you discover missing, unclear, or undocumented context that would have been useful upfront, add it to `AGENTS.md` during the same task so the guide keeps improving for future agents.
- Base `AGENTS.md` updates only on verified changes or context from the current task; do not guess or add unverified guidance.
- Keep the file optimized for signal over volume: summarize, deduplicate, and prune stale or obvious guidance so it stays focused on real project caveats and does not waste tokens over time.
- Apply required documentation updates as part of the same task whenever those conditions are met.
- Treat the task as incomplete until the needed `AGENTS.md` updates are made, or you have verified that no `AGENTS.md` update is needed.
- Before finalizing, verify that any `AGENTS.md` changes are consistent with the completed codebase or project-context changes.

## Before Finishing

- For meaningful changes, run `npm run lint`, `npm run test:ci`, and `npm run build`.
- If you touched scraping, auth, or persisted settings, verify the related API route and the cron path as a pair.
