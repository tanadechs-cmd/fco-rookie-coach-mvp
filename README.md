# FCO Rookie Coach MVP

Web prototype for proactive first-week FC Online onboarding support.

## Answer routing

1. Match the 48-topic local knowledge base by title, keyword, or synonym.
2. Return the deterministic content answer and source card when matched.
3. Call the server-side `/api/chat` endpoint only for an unmatched question.
4. `/api/chat` proxies to AI-INsea chatflow `24426`; the bearer token never enters the browser bundle.
5. AI-INsea returns a concise answer plus zero to two trusted action IDs. The web app owns the approved destination URLs and renders them as buttons.
6. If AI-INsea is unavailable, show related content, Discord escalation, and the report-to-team action.

## Input-specific coaching and short context

- Players choose `Keyboard`, `Xbox (XYAB)`, or `PlayStation (□ △ ○ ✕)` beside the main navigation. The preference is stored in the browser and changes deterministic button instructions across FAQ and journey replies.
- A final display guard normalizes legacy mixed labels such as `B / ○` into `B` for Xbox or `○` for PlayStation, including AI fallback answers.
- Admin can edit the lead reply plus separate keyboard/Xbox/PlayStation steps for every knowledge topic in `FAQ & Content`.
- Admin can add, edit, and remove FAQ chips, change their journey stage and keywords, and link one or two knowledge topics.
- The high-priority money intent (for example `หาเงินจากไหน`) always routes to both Welcome Pass and Mission Hub before AI fallback.
- AI fallback receives the six most recent user/assistant messages plus the selected input method. AI-INsea contextual memory remains enabled for eight messages; persistent cross-session AI memory stays off.

The fallback prompt and response contract are documented in [`docs/AI-INSEA-FALLBACK-PROMPT.md`](docs/AI-INSEA-FALLBACK-PROMPT.md).

## Shared admin publishing

Supabase is the shared source of truth for the production deployment.

- `FAQ & Content`, `Proactive Messages`, and `Unanswered Questions` each use an explicit **Save changes** action. Edits are drafts until that button is pressed.
- Players receive the published FAQ/content and proactive configuration after their next page load. Responses are not CDN-cached, so a fresh load shows the current published version.
- Every published FAQ/content or proactive change writes a full configuration snapshot. Admins can inspect **Version History** and restore an earlier configuration; a rollback itself is saved as a new version.
- Player-reported unanswered questions are deduplicated and stored server-side. The Admin can link one to an existing topic, change its status, then save it.
- While running only `vite`, the UI intentionally falls back to local preview data because Vite does not run server endpoints. It never claims a shared save succeeded in that mode.

Run [`supabase/migrations/20260831_fco_app_config.sql`](supabase/migrations/20260831_fco_app_config.sql) once in the project SQL editor before enabling these endpoints.

## Local verification

```sh
npm install
npm run build
npm run dev
```

The Vite development server does not emulate Vercel functions. Use `vercel dev` when testing live API routes and shared Admin saves locally.

## Vercel environment variables

- `AI_INSEA_API_KEY` — required for live AI fallback.
- `AI_INSEA_CHATFLOW_URL` — optional; defaults to `https://ai.insea.io/api/chatflows/24426/run`.
- `ADMIN_PASSWORD` — required to sign in to `/admin`.
- `ADMIN_SESSION_SECRET` — a long random server-only secret for the signed Admin cookie.
- `SUPABASE_URL` — the project URL, server-only.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only key used by Vercel API routes. Do not expose it in client code.

Never prefix any secret with `VITE_`; that would expose it to the browser.
