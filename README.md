# FCO Rookie Coach MVP

Web prototype for proactive first-week FC Online onboarding support.

## Answer routing

1. Match the 48-topic local knowledge base by title, keyword, or synonym.
2. Return the deterministic content answer and source card when matched.
3. Call the server-side `/api/chat` endpoint only for an unmatched question.
4. `/api/chat` proxies to AI-INsea chatflow `24426`; the bearer token never enters the browser bundle.
5. AI-INsea returns a concise answer plus zero to two trusted action IDs. The web app owns the approved destination URLs and renders them as buttons.
6. If AI-INsea is unavailable, show related content, Discord escalation, and the report-to-team action.

The fallback prompt and response contract are documented in [`docs/AI-INSEA-FALLBACK-PROMPT.md`](docs/AI-INSEA-FALLBACK-PROMPT.md).

## Local verification

```sh
npm install
npm run build
npm run dev
```

The Vite development server does not emulate Vercel functions. Use `vercel dev` when testing the live `/api/chat` route locally.

## Vercel environment variables

- `AI_INSEA_API_KEY` — required for live AI fallback.
- `AI_INSEA_CHATFLOW_URL` — optional; defaults to `https://ai.insea.io/api/chatflows/24426/run`.

Never prefix the API key with `VITE_`; that would expose it to the browser.
