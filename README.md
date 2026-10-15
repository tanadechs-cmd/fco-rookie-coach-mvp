# FCO Rookie Coach MVP

## September local review

Run `npm run local` and open `http://localhost:4173/` or `/admin`. This review runs a loopback-only persistent SQLite backend. Local admin credentials are generated in `.local/admin-password.txt`. Production builds now use the explicitly approved [guest-only pilot](docs/GUEST-PILOT-2026-10-15.md): browser-local player history, disabled player login/central analytics, existing protected Supabase admin/config/report endpoints. The local account/access/analytics adapter is not deployed as a public service.

### Local AI connection (14 October 2026)

- Put `AI_INSEA_API_KEY` in the ignored `.env.local` file, then run `npm run local`. Never use a `VITE_` prefix. Restart after changing server credentials.
- The local `/api/chat` route reuses the production AI-INsea handler behind the existing localhost, origin and session checks. Both the web UI and API stay on `127.0.0.1:4173`.
- The default destination is chatflow `24426`, published v1.3: GPT-6 Luna, reasoning None, temperature 0.2, maximum 768 completion tokens and a four-message contextual memory window.
- Office-network API access was verified. This does not resolve Vercel's upstream 403; external hosting still needs an approved network/backend.
- AI replies follow the latest question's language. The local bilingual update below adds stored English FAQ/knowledge answers; proactive messages and original videos are still in their configured language.

### Bilingual knowledge (14 October 2026, local review)

- All 48 default Hub topics have English title, answer, keywords and existing device-specific steps. These are translations of the stored Thai summaries/answers, not new transcripts or newly verified game mechanics. Review the prototype copy before public release.
- Admin **FAQ & Content** supports English fields for both Hub and manual entries, plus English FAQ button labels. Thai and English share one content ID and video URL. Video cards identify Thai-language videos.
- Free-text routing uses saved TH/EN answer keywords, with ASCII word boundaries. Removing a keyword removes that route; the legacy generic `pass` keyword cannot send ball-passing questions to Welcome Pass. The separate money-intent rule routes Thai/English earning questions to Welcome Pass + Mission Hub; its short combined introduction remains a fixed business rule.
- Latest-question language controls stored replies independently of UI language; neutral labels such as `BP` keep the last clear conversation language. FAQ buttons follow the UI language. Matched answers need no model call; the existing AI-INsea fallback remains for unmatched questions.
- `en.sourceSignature` tracks the Thai title, answer and device steps. After a Thai change or English edit, confirm the translation in Admin, then **Save changes**. A stale/missing translation returns a short English availability notice rather than outdated text. Unconfirmed/stale English FAQ labels stay hidden in English mode. “Current” means source-aligned, not team content approval.
- Existing JSON configuration saves and version history preserve the new fields; no database migration is needed. Changes are visible to players after reloading. No cloud publication is included in this local update.

Web prototype for proactive first-week FC Online onboarding support.

## Answer routing

1. Match the 48-topic local knowledge base by title, keyword, or synonym.
2. Return the deterministic content answer and source card when matched.
3. Call the server-side `/api/chat` endpoint only for an unmatched question.
4. `/api/chat` proxies to AI-INsea chatflow `24426`; the bearer token never enters the browser bundle.
5. AI-INsea returns a concise answer plus zero to two trusted action IDs. The web app owns the approved destination URLs and renders them as buttons.
6. If AI-INsea is unavailable, show a connection-failure message, Discord escalation, and the report-to-team action; do not show unrelated learning cards.

## Input-specific coaching and short context

- Players choose `Keyboard`, `Xbox (XYAB)`, or `PlayStation (□ △ ○ ✕)` beside the main navigation. The preference is stored in the browser and changes deterministic button instructions across FAQ and journey replies.
- A final display guard normalizes legacy mixed labels such as `B / ○` into `B` for Xbox or `○` for PlayStation, including AI fallback answers.
- Admin can edit the lead reply plus separate keyboard/Xbox/PlayStation steps for every Education Hub topic in `FAQ & Content`.
- Admin can create manual content with a title, keywords, and a deterministic answer. Player questions match manual content before the Education Hub snapshot and AI fallback.
- Admin can add, edit, and remove FAQ chips, change their journey stage and keywords, and link one or two knowledge topics.
- The high-priority money intent (for example `หาเงินจากไหน`) always routes to both Welcome Pass and Mission Hub before AI fallback.
- AI fallback receives the six most recent user/assistant messages plus the selected input method. AI-INsea v1.3 contextual memory is enabled for four messages; persistent cross-session AI memory stays off.

The fallback prompt and response contract are documented in [`docs/AI-INSEA-FALLBACK-PROMPT.md`](docs/AI-INSEA-FALLBACK-PROMPT.md).

## Shared admin publishing

Supabase is the shared source of truth for the production deployment.

- `Proactive Messages` uses a linked `Welcome message → IF / ELSE IF / ELSE` flow. Every branch explicitly returns fixed text or opens another proactive question; `ELSE` can also use AI fallback. Messages never advance by list order.
- `Notifications` is a separate Admin surface for notification title, body, visible time label, journey-day metadata, attached Education Hub content, unread dot, and Active/Draft status. It shares the versioned `delivery_plans` payload with chat flows, so no additional Supabase migration is required.
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
