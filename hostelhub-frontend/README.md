# HostelHub — Frontend

Next.js 14 (App Router) + Tailwind + shadcn/ui. Talks to the Django + DRF backend under `../hostelhub/`.

## Getting started

```bash
bun install
cp .env.local.example .env.local
bun run dev
```

Open http://localhost:3000. The Django backend must be running at the URL in `NEXT_PUBLIC_API_URL` (default `http://localhost:8000/api/v1`). We use **bun** as the package manager and script runner — the lockfile is `bun.lock`. Do not commit `package-lock.json` or `yarn.lock`.

## Environment

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_NAME=HostelHub
```

Both are safe to expose — nothing secret lives on the frontend. The JWT access/refresh pair is minted by the backend after OTP verification.

## Auth flow

```
/student/login  ──phone──▶ POST /auth/otp/request/
                                      │
                                      ▼
                              OTP SMS via Arkesel (console adapter in dev)
                                      │
              ──6-digit code──▶ POST /auth/otp/verify/
                                  │   ├─ X-HMS-Registration-Role: STUDENT|HOSTEL_ADMIN
                                  │   └─ returns { tokens, user, is_new_user }
                                  ▼
                     first login? ── yes ──▶ /student/onboarding
                                  │                │
                                  no               ▼
                                  ▼         PATCH /auth/me/ + /me/student-profile/
                           /student/dashboard      │
                                                   ▼
                                          /student/dashboard
```

The same flow runs for admins at `/admin/login` → `/admin/dashboard` (no onboarding step in M1). Super admins use email + password at `/superadmin/login`.

## Token storage & guarding

- **Access + refresh tokens** live in `localStorage` (`hh_access`, `hh_refresh`) — read by `tokenStorage` in [lib/api.ts](lib/api.ts).
- **Auth cookie** `hh_auth=1` is also set (non-httpOnly, `samesite=lax`) so the Edge middleware in [middleware.ts](middleware.ts) can gate SSR navigation. Production should migrate to httpOnly cookies + server routes.
- **Auto-refresh** on 401: [lib/api.ts](lib/api.ts) transparently calls `/auth/refresh/` once, then retries the original request. On failure it fires a `hh:auth:expired` event that [lib/auth-context.tsx](lib/auth-context.tsx) listens for to sign the user out.
- **Client-side role guard:** every role-scoped layout wraps children in [`<AuthGuard requiredRole="..." />`](components/auth/auth-guard.tsx). It:
  - Redirects unauthenticated users to the correct login page with `?next=`
  - Redirects wrong-role users to their own dashboard
  - Bounces new students to `/student/onboarding` until `is_onboarding_complete` flips to `true`

## Project layout

```
app/
├── (auth)/                  ← login, onboarding — no AuthGuard (public entry)
│   ├── student/login
│   ├── student/onboarding
│   ├── admin/login
│   └── superadmin/login
├── (student)/               ← AuthGuard requiredRole="STUDENT"
│   ├── dashboard
│   └── settings             ← privacy toggles
├── (admin)/                 ← AuthGuard requiredRole="HOSTEL_ADMIN"
│   └── dashboard
├── (superadmin)/            ← AuthGuard requiredRole="SUPER_ADMIN"
│   └── dashboard
├── page.tsx                 ← public landing
└── layout.tsx               ← root: AuthProvider + Toaster
components/
├── auth/                    ← phone-input, otp-input, countdown-timer, auth-guard
└── ui/                      ← shadcn primitives
lib/
├── api.ts                   ← fetch wrapper, JWT interceptor, typed authApi
└── auth-context.tsx         ← AuthProvider, useAuth(), useRequireRole()
middleware.ts                ← cookie-based zone gate (edge runtime)
```

## Scripts

| Command              | What it does                     |
|----------------------|----------------------------------|
| `bun run dev`        | Next dev server with Turbopack   |
| `bun run build`      | Production build                 |
| `bun run start`      | Serve production build           |
| `bun run lint`       | ESLint                           |
| `bun run typecheck`  | `tsc --noEmit`                   |
| `bun run format`     | Prettier over all `ts`/`tsx`     |

## Adding shadcn components

```bash
bunx shadcn@latest add <component>
```

Lands in [components/ui/](components/ui/).
