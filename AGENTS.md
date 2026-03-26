# AGENTS.md

## Purpose

- Work like a maintainer, not a greenfield rewriter. Preserve existing route contracts, data shapes, and the current admin-style UI unless a task explicitly asks for broader redesign.

## Stack At A Glance

- Next.js 16 Pages Router app with React 18, TypeScript, Tailwind, and project-specific global CSS.
- Backend logic lives in Next API routes under `pages/api/`.
- SQLite is accessed through `sequelize-typescript` models in `database/models/`, backed by a custom `better-sqlite3` dialect shim in `database/sqlite-dialect.js`.
- A separate cron worker in `cron.js` calls the app's HTTP API using `APIKEY`.

## Repo Map

- `pages/`: page entry points and all API handlers.
- `components/`: feature UI and shared UI pieces.
- `services/`: client-side fetch + React Query hooks. Despite the name, these are browser-facing, not backend services.
- `utils/`: server and shared helpers for auth, scraping, Search Console, Adwords, parsing, and exports.
- `utils/logger.ts`, `utils/apiLogging.ts`, and `utils/refreshQueue.ts`: lightweight API request logging and in-process refresh coordination helpers.
- `scrapers/services/`: scraper adapters; registry lives in `scrapers/index.ts`.
- `database/models/` and `database/migrations/`: Sequelize models plus forward-only schema changes.
- `types.d.ts`: shared app-wide types; keep this aligned with API payloads and persisted JSON.
- `styles/`: Tailwind entry plus global CSS used throughout the app.
- `data/` (gitignored): runtime state such as `database.sqlite`, `settings.json`, and `failed_queue.json`.

## Local Workflow

- Use Node 22.11.0 and `npm ci`; `.nvmrc`, GitHub Actions, and the Docker image are kept aligned around that version.
- Run `npm run db:migrate` after pulling schema changes; shipped schema changes should land through migrations, not only model updates.
- Docker startup runs `db:migrate` from `entrypoint.sh` before the app and cron worker start, and bootstraps `data/failed_queue.json` for empty volumes; keep container startup failing fast if migrations fail.
- The production Docker image is based on Next standalone output, so avoid relying on `sequelize-cli` inside the runner image; use `database/runMigrations.js` + `umzug` for container-start migration work.
- `npm run dev`: start the Next app.
- `npm run cron`: run the worker by itself.
- `npm run start:all`: run the web app and cron worker together.
- `npm run lint`, `npm run test:ci`, `npm run build`: match CI; lint now runs the ESLint CLI over the main app sources instead of `next lint`.
- `npm test`: watch mode, not ideal for one-off verification.
- Tests load `.env.local`; start from `.env.example` when local env is missing. Jest runs in `@happy-dom/jest-environment` with shared DOM/fetch polyfills from `jest.setup.js`, and `better-sqlite3` is mapped to `__mocks__/better-sqlite3.js` for tests.

## Project-Specific Rules

- Prefer TypeScript/TSX for new code. `tsconfig.json` is strict even though `allowJs` is enabled.
- Comment code whose purpose is not immediately clear or that handles edge cases or other non-obvious behavior, and keep those comments limited to insights that are not obvious from reading the code itself.
- Keep API access patterns centralized in `services/*.tsx` instead of adding ad hoc component-level fetch code.
- API route tests should exercise the route contract, not just the happy path: unauthorized access, wrong method, bad input, not-found cases, success responses, and meaningful failure handling where applicable.
- In Jest files, mock dependencies before importing the subject under test, clear mocks in `beforeEach`, and restore any mutated environment variables after each test.
- Many model fields are JSON stored inside string columns, including `history`, `tags`, `lastResult`, and `search_console`. Parse on read, stringify on write.
- Convert Sequelize instances to plain objects with `.get({ plain: true })` before shaping API responses or passing records into shared parsers.
- Sensitive values in `data/settings.json` and domain Search Console payloads are encrypted with `Cryptr` using `SECRET`. New secrets need both encryption and decryption paths.
- Auth flows through `utils/verifyUser.ts`: the UI uses cookies, while cron and limited public endpoints use Bearer `APIKEY`. Preserve both paths when editing auth or routes.
- Targeted API routes may be wrapped with `utils/apiLogging.ts`; preserve response contracts even when adding request IDs or logging.
- UI styling is a mix of Tailwind utilities and `styles/globals.css`; favor existing patterns over introducing a new styling approach.

## When Changing Specific Areas

- Scraping: update `utils/scraper.ts`, scraper adapters, and related settings together. Domain-level scrape strategy can override global settings, so check both layers.
- Settings: keep defaults synchronized between `components/settings/Settings.tsx` and `pages/api/settings.ts`. Bootstrap behavior should still work if `data/settings.json` does not exist yet.
- Google Ads auth: Step 1 starts from `POST /api/adwords/auth`, which persists the client ID/secret, clears any stale refresh token, stores a short-lived OAuth state cookie, and returns a consent-forcing OAuth URL before Google redirects back to `GET /api/adwords`; preserve that start-and-callback pairing when editing the flow.
- Database: update the Sequelize model and add a migration in `database/migrations/`. Do not rely on `db.sync()` alone for shipped schema changes.
- SQLite driver changes must keep `database/database.ts`, `database/config.js`, and `database/sqlite-dialect.js` aligned so the app runtime and Sequelize CLI migrations use the same dialect behavior.
- Migrations: keep the timestamped Umzug file pattern, implement both `up` and `down`, wrap schema changes in a transaction, and guard table or column access before altering older databases.
- API routes: keep route contracts stable because both the UI hooks and cron worker call them directly. If a route should work with API-key auth, add it to `allowedApiRoutes` in `utils/verifyUser.ts`.
- Scraper integrations: add the adapter under `scrapers/services/`, then register it in `scrapers/index.ts` with accurate metadata like `id`, `name`, `allowsCity`, and `nativePagination`.
- Domain-level scraper overrides are stored in `domain.scraper_settings` as encrypted JSON; mask API keys in responses and decrypt them only when building effective runtime settings.

## Useful Gotchas

- `services/` modules often use `window.location.origin`, so they are client-only.
- `NEXT_PUBLIC_APP_URL` must point at the running app or cron-triggered requests will fail.
- Reverse-proxy deployments should forward `X-Forwarded-Proto` and `X-Forwarded-Host`; Google Ads redirects use those headers for the public callback URL, and secure cookies only trust actual TLS or forwarded HTTPS.
- `data/` is writable application state; never commit local runtime contents or build logic that assumes those files already exist.
- Scrape failures now persist through a lock-protected, atomically written `data/failed_queue.json`; keep that file as a JSON array of positive keyword IDs if you touch retry handling.
- Manual keyword refreshes are now coordinated by `utils/refreshQueue.ts`; avoid introducing overlapping same-domain refresh execution when touching `pages/api/refresh.ts` or cron-triggered refresh flows.
- `ideas/v-serpbear/` is a nested workspace/reference copy, not part of the root app's lint, Jest, or TypeScript scope.
- Google SERP HTML can arrive in multiple layouts through ScrapingRobot; when touching `utils/scraper.ts`, prefer actual web-result cards and avoid counting video/image/AI modules as organic results.
- Release automation uses `release-please`; commit types `feat`, `fix`, `perf`, and `deps` feed the changelog. Keep `include-component-in-tag` disabled so GitHub tags stay in the existing plain `vX.Y.Z` format.
- Release PR merges to `main` do not run `.github/workflows/ci.yml`; that workflow ignores the standard release-please file set and also skips push jobs whose merge commit message includes `chore(release):`, while `.github/workflows/release.yml` performs the post-merge lint/test/build validation before publishing Docker images.
- `.github/workflows/release.yml` now builds `linux/amd64` and `linux/arm64` Docker images in parallel as separate digest pushes, using a native GitHub-hosted ARM runner for the `arm64` leg before publishing the combined multi-arch manifest.

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
