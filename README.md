# RecruiterGTM CV Builder

Standalone web app. A recruiter pastes a candidate's public profile text, the app
reverse-searches the real person on the open web, structures a clean CV, and generates
a polished two-column **RecruiterGTM-branded** PDF.

Built by RecruiterGTM. No database, stateless: paste in, PDF out.

## Flow

1. **Password gate** (shared team password).
2. **Paste** the candidate's CV / profile text.
3. **Identify** — OpenAI extracts a fingerprint, Exa reverse-searches the person, OpenAI
   picks the best match and scores confidence.
4. **Confirm** — a compact match card (name, headline, company, LinkedIn, confidence
   badge). One click: "Yes, build CV" or "Not them".
5. **Build** — OpenAI structures the final CV (merges paste + public profile; never invents).
6. **Preview + Download PDF** — polished two-column branded CV.

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind.
- `@react-pdf/renderer` for server-side vector PDFs.
- OpenAI (parse + structure) and Exa (people search) — called only from serverless
  API routes, so keys never reach the browser.

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (and in
`.env.local` for local dev — copy `.env.local.example`). Never commit real keys.

| Var | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Parses pasted text + structures the CV |
| `EXA_API_KEY` | Reverse-searches the real person |
| `APP_PASSWORD` | Shared team password for the gate |
| `OPENAI_MODEL` | (optional) defaults to `gpt-4o-mini` |

> Prospeo email enrichment is intentionally **not** wired in v1. The CV uses LinkedIn as
> the contact channel; email is omitted rather than guessed. Add Prospeo later as a 4th step.

## Local dev

```bash
cp .env.local.example .env.local   # then fill in the keys
npm install
npm run dev                        # http://localhost:3000
```

## Deploy to Vercel

1. Push this folder to a git repo (or import the folder in the Vercel dashboard).
2. **New Project** → point it at `projects/cv-builder-app` as the root.
3. Add the four env vars above (Production + Preview).
4. Deploy. Framework preset auto-detects Next.js; no extra config needed.

## Routes

| Route | Does |
| --- | --- |
| `POST /api/login` | Validates the shared password |
| `POST /api/identify` | text → fingerprint → Exa search → match card |
| `POST /api/build` | text + confirmed match → structured CV JSON |
| `POST /api/pdf` | CV JSON → branded PDF (streamed download) |

All routes require the `x-app-password` header.

## Guardrails (built in)

- Keys are server-only; the gate fails closed if `APP_PASSWORD` is unset.
- The structuring prompt is instructed never to invent experience, dates, employers,
  skills, or contact details — unknown fields are omitted.
- Low/no-confidence matches are flagged in the UI before a CV is built.
