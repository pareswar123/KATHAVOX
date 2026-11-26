# Assumptions and known gaps

## Design decisions
- **Money** is stored as integer paise. Prices are always calculated on the server.
- **Refresh tokens** are random 32-byte values. Only their SHA-256 hash is stored. Each login creates a session, and rotation stays within that session. Reuse of a rotated token revokes the whole session.
- **Access tokens** (15 min) live in memory on the client. The refresh cookie is HttpOnly, SameSite=Strict, scoped to `/api/v1/auth`, and Secure when `COOKIE_SECURE=true`.
- **CSRF**: refresh and logout require the `X-Requested-With` header and an allowed `Origin`.
- **Roles** are read from `user_roles` on every request, not trusted from the JWT.
- **Email**: when `SMTP_HOST` is empty, emails (including one-time links) are written to the server log in non-production mode.
- **Seed scripts** live in `story-service/src/database/seed/` because they share the TypeORM entities. The `database/` folder holds documentation only.
- **Published content**: a `published_snapshot` JSON column on `stories` stores the approved version. Pending edits do not change what the public sees.

## Not in scope (by design)
- Author payouts, comments, chat, social features, AI features.
- Docker, CI/CD, production deployment.
- Automatic recurring billing. Subscriptions are one-time payments with manual renewal.

## Open items
- Razorpay test keys are needed only for the Phase 5 payment checks.
- Refund handling relies on the Razorpay webhook plus an admin action.
