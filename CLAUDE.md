# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Bideo** — a YouTube-style video platform, built as a monorepo with three independent apps that share one backend API:

- `backend/` — Node.js + Express 5 + MongoDB (Mongoose) REST API. The single source of truth.
- `bideoApp/` — Expo React Native (TypeScript) mobile app. The end-user product.
- `adminDashboard/` — Vite + React (JavaScript) admin web panel for moderation/management.

`projectPlan.md` is the original master spec; `improvement.md` is the current backlog of fixes/enhancements. Read both when picking up feature work — they capture intent and theme decisions not derivable from code.

## Commands

Each app has its own `package.json`; `cd` into the app first. There is **no test suite** in any app — don't claim tests pass; verify by running the app.

```bash
# backend/  — runs on PORT (default 5000)
npm run dev          # nodemon server.js (development)
npm start            # node server.js

# bideoApp/  — Expo
npm start            # expo start (press s for Tunnel mode to share)
npm run android      # expo run:android
npx expo start --tunnel   # for sharing with external testers

# adminDashboard/  — Vite, runs on :5173
npm run dev
npm run build
npm run lint         # eslint, --max-warnings 0 (the only linter in the repo)
```

Mobile builds use EAS (see `build_app.txt`, `testing_guide.txt`):
```bash
eas build -p android --profile apk      # installable APK
eas build -p android --profile preview
```

## Architecture & conventions

**API contract.** Every backend handler returns JSON shaped as `{ success: boolean, ... }`, with list/detail payloads under a `data` key (e.g. `{ success: true, count, data }`). Clients depend on this: the mobile `services/api.ts` and dashboard fetch calls normalize via `response.data.data`. Keep this shape when adding endpoints. Errors flow through the central error middleware in `backend/app.js` (reads `err.statusCode`/`err.message`); controllers use `try/catch` + `next(err)`.

**Routing layout (backend).** `app.js` mounts each router under `/api/<resource>`. Pattern is strict three-layer: `routes/*` (wiring + validation) → `controllers/*` (logic) → `models/*` (Mongoose schemas). Validation rules live centrally in `backend/validators.js` (express-validator) and are applied as route middleware via `validate`.

**Auth.** JWT-based, accepted either as `Authorization: Bearer <token>` **or** a `token` cookie. Three middlewares in `backend/middlewares/auth.js`:
- `protect` — requires a valid token (401 otherwise).
- `softProtect` — loads `req.user` if a token is present but never blocks. Used on public-but-personalizable routes (feed, search, view). This backs the product's core UX rule: **the app opens straight to the Home feed; login is only required for actions** (like, comment, subscribe, upload).
- `authorize('admin', ...)` — role gate; the `User.role` enum is `user | admin`.

Users authenticate by **phone + password** (bcrypt) or **Google**. The admin dashboard logs in through `POST /api/admin/login`, which is just a normal user whose `role === 'admin'`. Password reset uses a **hardcoded dummy OTP `1234`** (`controllers/auth.js`) — not real SMS.

**Media.** All images/videos go to **Cloudinary**, not local disk. `middlewares/multer.js` uses empty `diskStorage` (temp files) with a 100MB limit and field-name-based MIME filtering (`video`, `thumbnail`, `image`, `avatar`, `coverImage`). `utils/cloudinary.js` handles deletion by parsing `public_id` out of stored URLs — call `deleteFromCloudinary(url, 'image'|'video')` whenever a record owning media is deleted/replaced.

**Mobile app (bideoApp).** Navigation is **Expo Router** (file-based, `app/` dir): `app/(tabs)/` are the bottom tabs (home `index`, shorts, upload, followings, library); other files/folders are stack screens (`video/[id]`, `channel/[id]`, `settings/`, etc.). Root `app/_layout.tsx` bootstraps auth from `AsyncStorage` behind the native splash screen before rendering. State is **Redux Toolkit** (`redux/store.ts`, slices: `auth`, `video`). All HTTP goes through `services/api.ts` (axios instance; base URL from `EXPO_PUBLIC_API_URL`; `setAuthToken` sets the Bearer header globally).

**adminDashboard (public site + admin panel).** One Vite + React app serving two things (`src/App.jsx`): the **public marketing landing page** at `/` (`src/pages/Landing.jsx` + `src/components/landing/*`) and the **admin panel** at `/admin/*` (gated by a `localStorage` `admin_token` `PrivateRoute`), with admin login at `/login`. Shared config lives in `src/config.js` (`API_URL`, `APP_DOWNLOAD_URL`). Theme tokens are in `tailwind.config.js` (`brand`, `ink`, `muted`, `line`, `surface` + `fade-up`/`float`/`gradient-pan` animations); landing scroll-reveal uses `src/hooks/useScrollReveal.js` (`.reveal` → `.is-visible`). Data access is raw `fetch` with `credentials: 'include'`. The dashboard authenticates via the `token` cookie that `protect` reads (Reports/Stats also send the `Authorization` header). Dashboard overview stats come from `GET /api/admin/stats`. Env: `VITE_API_URL` (API base, default `http://localhost:5000`) and `VITE_APP_DOWNLOAD_URL` (Android APK link for the landing "Download App" buttons; button is disabled when unset) — see `adminDashboard/.env.example`; `.env` is gitignored.

## Theme (enforced product requirement)

Orange + white, defined in `bideoApp/constants/Colors.ts`. Use these tokens, never raw hex, in app UI:
`primary #FF7A00`, `secondary #FFA447`, `background #F8F8F8`, `text #121212`, `textGray #6B7280`, `border #E5E7EB`. New UI should match this theme (including custom modals — the app avoids default OS alert styling).

## Environment & secrets

Config is `.env`-driven; never hardcode secrets. See `backend/.env.example` for the full list (Mongo, JWT, Google OAuth, Cloudinary, `ADMIN_EMAIL`/`ADMIN_PASSWORD`). `EXPO_PUBLIC_*` vars are intentionally client-exposed; `GOOGLE_CLIENT_SECRET` and Cloudinary secrets stay backend-only. Google OAuth setup steps live in `google_login.txt`.

**CORS is an allowlist** hardcoded in `backend/app.js` (`allowedOrigins` — localhost:5173, a LAN IP, an `exp://` origin). When the dev machine's LAN IP changes, update this list **and** `EXPO_PUBLIC_API_URL` / the api.ts fallback, or requests silently fail.

## Working norms (from improvement.md)

Don't break working systems while enhancing. The repo is mid-iteration: prefer additive, scalable changes; preserve the API contract and existing routes; build only current MVP features (live streaming, monetization, analytics are explicitly deferred — see `projectPlan.md`).
