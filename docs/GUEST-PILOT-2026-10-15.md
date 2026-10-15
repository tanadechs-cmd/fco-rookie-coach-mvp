# Guest-only hosted pilot — 15 October 2026

User-approved release scope: anonymous testing; sign-in disabled, no transfer of local tester records.

- Production builds use a browser-local guest ID, first-seen date, segment and conversation state. Browser data deletion or another device starts a separate history. Blocked browser storage falls back to session memory.
- The local `prototype` mode retains its SQLite account/access flow. It is not exposed as a public server.
- Login is greyed out. Admin still requires the existing server-authenticated admin session.
- FAQ/content, proactive flows, notifications, config history and reported questions retain the existing Supabase endpoints. No database schema or production content overwrite is included.
- Central analytics, ratings, NPS and whitelist administration are unavailable in this hosted pilot and explicitly labelled/hidden, not filled with mock numbers.
- AI-INsea remains server-side. No API key is bundled in the browser. Production requests reject cross-site browser origins. A warm-instance limiter allows up to 10 AI requests/IP/minute and 60 AI requests/instance/minute. This is best-effort: cold starts and multiple instances mean it is NOT a durable global spending limit. Larger rollout requires distributed limits or approved edge rate limiting.
- Three synthetic production AI checks on 15 October returned HTTP 200 with answers. Earlier 403 was consistent with the company's outbound-network restriction; the reason access now works has not been confirmed. Monitor before larger rollout and obtain AI-INsea/Security confirmation of the permitted external-use route.
- Local tester data, credentials, environment files and screenshots are not part of this release.

Rollback: restore the previous Vercel production deployment or revert this release commit. No schema migration is required.
