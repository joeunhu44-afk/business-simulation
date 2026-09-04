# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The real application is entirely inside **`community-app/`** — run every command below from that directory. The repo root also contains `backend/` (a single `requirements.txt`, never built into anything) and a `clone` file (just a `git clone` command) — both are vestigial leftovers from repo setup and are not part of the app.

`community-app` started from a generic "tRPC + Manus Auth" starter template. It has since been fully rewritten into a Korean high-school community board app (page title "커뮤니티") with its own JWT/OAuth auth, deployed standalone on Railway (no Manus platform dependency remains). `community-app/README.md` still documents the *original template's* generic conventions (some of it — the tRPC/Drizzle build loop, path aliases, shadcn/ui usage — still applies; the Manus OAuth/storage/env-var sections do not, see below).

## Commands

All run from `community-app/`:

```bash
pnpm dev              # start dev server (tsx watch + Vite middleware), http://localhost:3000
pnpm check            # tsc --noEmit
pnpm test             # vitest run (all tests)
pnpm test <pattern>    # run a single test file, e.g. pnpm test auth.updateName
pnpm build            # vite build (client) + esbuild bundle (server) -> dist/
pnpm start            # NODE_ENV=production node dist/index.js (run after build)
pnpm format           # prettier --write .
pnpm db:push          # drizzle-kit generate + migrate — apply schema.ts changes to the DB
```

Local dev needs a running MySQL/MariaDB matching `DATABASE_URL` in `.env` (copy from `.env.example`). `JWT_SECRET` and `DATABASE_URL` are the only two required for basic browsing; social login and file upload need their respective keys.

## Architecture

### tRPC-first data flow

Everything goes through one tRPC router (`server/routers.ts`, ~740 lines, keyed by feature: `auth`, `boards`, `posts`, `comments`, `likes`, `reports`, `announcements`, `news`, `inquiries`, `media`, `admin`, `users`, `chat`). Client calls it with `trpc.<router>.<procedure>.useQuery/useMutation()` (client binding in `client/src/lib/trpc.ts`). No REST endpoints, no fetch/axios wrappers for app data — the only non-tRPC HTTP routes are OAuth callbacks (`registerAuthRoutes`, see below) and static `/uploads` serving.

Query/mutation logic itself lives in `server/db.ts` (~60 exported functions, one per operation, returning raw Drizzle rows) — routers stay thin and call into `db.ts`.

### Auth

This is **not** the template's Manus OAuth — it's a self-built JWT session system:
- `server/_core/auth/session.ts`: signs/verifies a JWT (`jose`) carrying just `{ userId }`, stored in cookie `COOKIE_NAME` (`shared/const.ts`, `"app_session_id"`).
- Two login paths: email+password (bcrypt hash in `users.passwordHash`) and OAuth (`server/_core/auth/providers/{google,kakao,apple}.ts`, wired up via `registerAuthRoutes` in `server/_core/auth/routes.ts` — these are plain Express routes, *not* tRPC, because OAuth needs redirects).
- OAuth users with no local account yet get a short-lived "pending signup" JWT and are sent to `/signup/complete` to pick a name before a real account is created (`authIdentities` table links `provider + providerUserId` to `users.id`, one user can have several).
- `users.role` is `"user" | "admin" | "owner"`. **`owner` is not settable by anyone** — it's granted automatically, on every login, to whichever account's email matches `OWNER_EMAIL` (`server/db.ts`, compared in `touchLastSignedIn`/user-upsert paths). There is exactly one owner.
- `users.status` is `"active" | "blocked"` — `createContext` (`server/_core/context.ts`) treats a blocked user as logged-out (`ctx.user` stays `null`), it doesn't throw.

**Two `adminProcedure`s exist — use the one in `server/routers.ts`, not the one exported from `server/_core/trpc.ts`.** The `_core/trpc.ts` version only checks `role === 'admin'` (template leftover, would incorrectly reject the owner). The one actually used throughout `routers.ts` is defined locally near the top of that file and correctly allows both `admin` and `owner`.

### Database

MySQL via Drizzle (`drizzle/schema.ts`, `drizzle-kit` for migrations, config in `drizzle.config.ts`). Real tables: `users`, `authIdentities`, `boards`, `posts`, `comments`, `postLikes`, `commentLikes`, `reports`, `announcements`, `news`, `inquiries`, `conversations`, `messages` (1:1 DM/쪽지 feature). `pnpm db:push` regenerates + applies migrations from schema changes.

**Custom SQL migrations** (written by hand under `drizzle/*.sql` rather than generated from a schema diff, e.g. one-off data fixes) *must* separate multiple statements with the literal marker `--> statement-breakpoint` on its own line. Drizzle's `runMigrations()` (`server/db.ts`, invoked from `server/_core/index.ts` on every production boot, *and* via the `prestart` npm script) executes each migration file as a single statement unless that marker is present — omitting it between two statements causes a silent partial-apply or a raw SQL syntax error at boot, and testing the file with the plain `mysql` CLI won't catch it (the CLI splits on `;` by default; Drizzle's migrator does not). Always verify a new custom migration via the real boot path (`pnpm build && NODE_ENV=production node dist/index.js` against a scratch DB), not just `mysql ... < file.sql`.

### File storage

`server/storage.ts` uploads to S3-compatible storage (Cloudflare R2 recommended, configured via `S3_*` env vars) when configured, and falls back to local disk (`UPLOAD_DIR`, served at `/uploads` by Express in `server/_core/index.ts`) otherwise. This supersedes the template README's `/manus-storage/` + `manus-upload-file` CLI instructions, which no longer apply — don't use them.

### Client routing & structure

Routing is `wouter` (`client/src/App.tsx`), not the template's dashboard-shell example. Pages live flat in `client/src/pages/` (`Home`, `BoardPage`, `PostPage`, `WritePostPage`, `EditPostPage`, `SearchPage`, `ChatList`/`ChatRoom`, `LoginPage`, `CompleteSignupPage`, `AdminPanel`, `AdminContentPage`, `InquiryPage`). Global chrome (`TopLeftMenu`, `AnimatedBackground`, `ScrollEdgeFade`, toaster) is mounted once in `App.tsx` alongside the router, not per-page.

`client/src/components/DashboardLayout.tsx`, `DashboardLayoutSkeleton.tsx`, `AIChatBox.tsx`, and `Map.tsx` are unused template starter components (only referenced from `pages/ComponentShowcase.tsx`, which itself isn't registered as a route) — they're not part of the live app; don't assume they're wired up anywhere.

Path aliases (`vite.config.ts` / `tsconfig.json`): `@/*` → `client/src/*`, `@shared/*` → `shared/*`. The `@assets` alias in `vite.config.ts`/`vitest.config.ts` points at a nonexistent `attached_assets/` dir (template leftover) — real static assets (e.g. the home-page planet images) live under `client/src/assets/` and are imported directly, not via that alias.

### Testing

Tests live at `server/*.test.ts` (vitest, `environment: "node"`, see `vitest.config.ts`'s `include`). Convention: build a `TrpcContext` by hand (fake `user`/`req`/`res`), call `appRouter.createCaller(ctx)`, and invoke procedures directly — no HTTP server involved. Mock `server/db.ts` functions with `vi.spyOn(db, "fnName")`; don't hit a real database in tests.

## Deployment

Runs as a long-lived Express process (Railway is the documented target — see `community-app/DEPLOYMENT.md`), not a serverless function: `pnpm build` then `pnpm start`. Migrations run automatically both via the `prestart` script and again defensively inside `server/_core/index.ts` on production boot, in case a deploy platform's custom start command skips `prestart`.
