# Session authentication risk acceptance

**Owner:** QS Assets engineering  
**Date:** 2026-07-18  
**Related gap:** P0 #7 (HttpOnly Secure cookie auth)

## Decision

QS Assets issues short-lived JWTs (default `JWT_EXPIRATION=15m`) with refresh-token rotation. The web client continues to keep a dual-compat session:

1. **Preferred:** HttpOnly Secure cookies (`qs_access_token`, `qs_refresh_token`) set by the API on login / refresh / OAuth exchange.
2. **Fallback:** `localStorage` bearer tokens for older clients and Electron/agent pairing flows that cannot use cookie credentials.

Passport JWT extraction accepts either the `Authorization: Bearer` header or the HttpOnly access cookie.

## Residual risk (localStorage fallback)

XSS in the web origin can still read bearer tokens from `localStorage`. Mitigations in place:

- One-time OAuth/SSO code exchange (tokens no longer appear in redirect URLs)
- Web Content-Security-Policy headers (Next.js)
- API Helmet CSP + HSTS
- Refresh-token hashing + revoke-on-password-change
- Short access-token lifetime

## Acceptance criteria to retire localStorage

- Dashboard, portal, and auth callback all use `credentials: 'include'` only
- Agents continue to use bearer enrollment tokens (not browser cookies)
- Cross-site cookie `SameSite=None; Secure` validated on Railway ↔ Vercel

Until that cutover completes, the dual path above is an accepted transitional control, not a permanent design.
