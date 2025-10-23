# Security Architecture — API Mode

## Overview

Football Minutes operates in two persistence modes:

1. **Local** – legacy, browser-only storage for offline development.
2. **API** – Vercel-hosted Node/Edge functions backed by Postgres.

This document captures the controls required to maintain ASVS/OWASP coverage when API mode is enabled.

## Session & Identity

- **Session store** – browser `localStorage` retains `{ username, token, issuedAt }`. On login the client obtains a signed session token (PBKDF2 password check). Tokens must be rotated with configurable TTL (default 12h).
- **Actor identity** – all API requests include `x-ffm-actor` (session username) and `x-ffm-roles` (default `coach`). Backend must verify the actor exists and has the associated role before processing the route.
- **Team scoping** – `x-ffm-team` header (or `teamId` query) identifies the team context. Every service/query must check this ID to prevent cross-team data leakage.
- **Environment validation** – boot should fail when `VITE_USE_API=true` but `VITE_TEAM_ID` is missing. Server should reject requests without a team scope.

## Authentication & Authorisation

1. **Middleware** – add `verifySession` middleware that:
   - Validates the session token (HMAC signature) against a server-side secret.
   - Confirms the actor belongs to the supplied `teamId`.
   - Rejects or sanitises unknown/unauthorised roles.
2. **Route policies** – define per-route role requirements (e.g. `coach` for roster mutations, `analyst` read-only). Deny by default.
3. **Audit metadata** – enrich audit logs with `actor_id`, `team_id`, and request IP (where available).

## CSRF Protection

Because the app relies on cookie-based session continuity (`credentials: 'include'`), CSRF tokens are required for all state-changing routes.

- **Token issuance** – frontend requests `GET /api/session/csrf` after login; the server sets `Set-Cookie: ffm_csrf=<random>` (SameSite=Strict, Secure) and returns the token for headers.
- **Client usage** – include `x-ffm-csrf` header on every `POST/PUT/PATCH/DELETE` request.
- **Server check** – middleware compares the header and cookie, rotates on success, and rejects mismatches with 403. If the CSRF cookie is absent, require the client to re-authenticate.

## Input Validation & Encoding

- Use shared validation schemas (e.g. Zod) for every API request payload.
- Reject unsafe strings (HTML, script tags) or encode before rendering in UI.
- Limit array/list sizes (e.g. max roster additions per request).
- Enforce numeric ranges (minutes, goals, etc.).

## Transport & Secrets

- Require HTTPS end-to-end.
- Store secrets (DB URL, session/CSRF keys) in Vercel env vars; prevent them from leaking into the client bundle.
- Rotate credentials quarterly or on incident.

## Logging & Monitoring

- Log auth failures, CSRF rejections, and audit writes with request IDs.
- Integrate Vercel/DB logs into a central dashboard (Datadog/New Relic) with alerts on anomalies (excessive 403/401, sudden roster churn).

## Implementation Checklist

1. **Middleware**
   - [ ] Implement `verifySession` and `requireRole` in `api/_lib`.
   - [ ] Add `validateCsrfToken` for mutating routes.
2. **Routes**
   - [ ] Update `players`, `fixtures`, `rulesets`, `audit` endpoints to use middleware.
   - [ ] Ensure all services filter by `teamId`.
3. **Client**
   - [ ] Store CSRF token on login, attach via `apiRequest`.
   - [ ] Surface auth/CSRF errors in UI (session reset prompt).
4. **Config**
   - [ ] Add `FFM_SESSION_SECRET` and `FFM_CSRF_SECRET` to `.env.example` / Vercel.
   - [ ] Fail builds/tests when secrets missing in API mode.
5. **Tests**
   - [ ] Integration tests covering authorised/unauthorised access, CSRF rejection, and happy-path mutation.

## Open Questions

- How to support multi-team staff (e.g. club admins) – may need actor <-> team mapping table.
- Token rotation strategy – short-lived JWT vs. opaque session IDs stored in Redis/DB.
- Offline mode parity – confirm local testing paths remain workable without CSRF checks.
