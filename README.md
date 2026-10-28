# Nutritrack

Add your groceries with one photo of the supermarket receipt.

Nutritrack is an AI meal planner for university students on a tight budget. Everything in the app (meal plans, budget, food waste) depends on one thing: knowing what food you have. This repo contains the first feature, the one that tests our riskiest guess:

> We believe that adding groceries with one photo of the supermarket receipt will make students actually record what they buy. We will know we are right when 4 out of 5 students add a real receipt in less than 30 seconds, with at least 90% of the items correct, and say they would use it again.

**Founder:** Kelly Owusu Kwabeng Thompson (with Nico Alcaide until Session 6). Launching AI-Native Ventures, Esade.

## What it does

1. **Add food:** take or upload a photo of a receipt (Mercadona, Lidl, Carrefour, Dia).
2. **Check your items:** Claude reads the receipt and returns name, quantity, price and an estimated expiry date. You can correct or delete any line.
3. **Pantry:** the items are added to your pantry with days until they expire. A timer shows how long the whole thing took, measured against our 30-second goal.

There is also a **Try with a sample receipt** button to show the flow without an API key. Sample data is always labelled as sample in the app.

## How it learns (Session 7)

When you change the expiry days of a product, Nutritrack remembers it for you and shows it in green next time. Corrections from testers become *suggested* rules on `/review`; a founder approves them before they are added to Claude's prompt (`lib/approved-rules.js`). Risky fresh food never goes above a safe limit (`lib/safety.js`). Users can switch learning off, reset it or download their data from the pantry screen.

## How it is built

| Part | File |
|---|---|
| Screens (upload, review, pantry) | `app/page.js` |
| Claude call (server only, key never in the browser) | `app/api/read-receipt/route.js` |
| Photo resize before upload (faster) | `lib/image.js` |
| Pantry storage (browser, for now) | `lib/pantry.js` |
| Learning loop (corrections, preferences, suggestions) | `lib/learning.js` |
| Safety limits for expiry days | `lib/safety.js` |
| Founder review page (human check) | `app/review/page.js` |
| Human-approved shared rules | `lib/approved-rules.js` |
| Decisions, principles and log | `architecturedoc.md` |

Stack: Next.js 14 (React), one LLM (Claude), hosted on Vercel. See `architecturedoc.md` for why.

## Run it

```bash
npm install
cp .env.example .env.local   # then put your Anthropic API key in .env.local
npm run dev                  # open http://localhost:3000
```

On Vercel, add `ANTHROPIC_API_KEY` in Project Settings → Environment Variables. **Never commit `.env.local`** (it is in `.gitignore`).

## Status (28 October 2026)

- Works: upload, Claude call from the server, review and edit, pantry saved in the browser, timer, learning loop with human review.
- Not yet: login and database (Supabase), meal plans, alerts. Not yet timed live with a real API key.
- First user test (Session 6, before the server connection): 4 people used real Mercadona receipts; all items read correctly, but it took a couple of minutes. See `architecturedoc.md`.
