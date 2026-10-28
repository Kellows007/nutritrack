# architecturedoc.md

> The brain of the project. Every AI coding session starts by reading this file.
> If a choice contradicts this doc, either the choice changes or this doc is updated on purpose — never silently.

**Founders:** Kelly Owusu Kwabeng Thompson & Nico Alcaide
**Course:** Launching AI-Native Ventures, Esade
**Last updated:** 28 October 2026 (Session 7)

---

## 1. Venture

**Name:** Nutritrack

**One sentence:** An AI meal planner that turns the food you already have and the budget you actually have into a simple weekly plan you can just follow, so you stop thinking about what to eat, stop overspending and stop throwing food away.

**First user:** university students and young adults on a tight food budget who want to eat well without tracking everything they eat.

---

## 2. Architectural principles

These are the rules the product and the code follow. When the AI suggests something that breaks one of them, the answer is no.

1. **Follow, don't count.** The user gets a plan to follow, not a calorie spreadsheet to manage. Calories and macros are calculated in the background and are never the main screen. Constant counting creates restriction and "food noise", which is the problem we are solving, not a feature.
2. **Input in under 30 seconds or it doesn't ship.** Our own research says the biggest risk is that people won't enter their groceries. Every way of adding food (receipt photo, quick list, "what's in my fridge" photo) must take less than 30 seconds. No feature may need daily manual logging.
3. **The pantry is the source of truth.** Meal plans, shopping lists, waste alerts and budget all come from one shared list of what the user has, how much, and when it expires. No feature keeps its own separate copy of the data.
4. **The AI suggests, the user decides.** The AI drafts plans, recipes and shopping lists. The user can swap any meal in one tap. The app never makes medical or diet claims, and never gives advice to someone with an eating disorder beyond pointing them to professional help.
5. **One app, three wins, one screen.** Health, money and waste are shown together in a short weekly summary ("you ate well, spent €X, wasted Y items"), not as three separate apps glued together.

---

## 3. Stack and why

| Layer | Choice | Why |
|---|---|---|
| App | Mobile-first web app (PWA) built with Next.js + React | One codebase, works on any phone, no App Store review, and AI coding tools handle it well. |
| Styling | Tailwind CSS | Fast to build and change screens with AI help. |
| Database + login | Supabase (Postgres + Auth), **later** | Free tier, real database for the pantry, login included. Until we add login, the pantry is saved in the browser (localStorage). |
| AI | One LLM API (Claude) for meal plans, recipe ideas, and reading receipt/fridge photos | One provider keeps prompts, costs and errors in one place. |
| Food data | Open Food Facts (free, open) for nutrition and product info | Free and good coverage for European supermarket products. |
| Hosting | Vercel | Free tier, deploys straight from GitHub. |

## Security rules (added Session 6)

- **The Claude API key lives only on the server** (environment variable on Vercel). Never in browser code, never committed to GitHub.
- **Supabase Row Level Security is ON for every table** once the database is added: each user can only read and write their own pantry.
- **Receipt photos are not stored.** They are sent to Claude, read, and discarded. Only the confirmed item list is kept.
- **No real user touches a feature until these three rules are checked.**

## Learning loop (added Session 7)

**Behaviour we learn from:** what users accept, edit or delete in the "Check your items" list, especially the expiry days (an AI guess).

| Step | What happens | Where in the code |
|---|---|---|
| Input | For every product we save if it was accepted, edited (which field, before and after) or deleted, plus store and seconds. | `lib/learning.js` `recordReview()` |
| Processing | If the user changed the expiry days of a product, we save that as their personal preference (never above the safety limit). | `recordReview()` |
| Output | Next receipt, that product shows the user's days in green ("learned from your past changes"). | `applyLearned()`, `app/page.js` |
| Learning | Corrections from all testers are grouped into suggested rules (skip a line, rename a product, use N days) when 2+ corrections agree. | `suggestRules()`, `/review` |
| Improvement | Approved rules go into Claude's prompt for everyone, so the next user needs fewer corrections. Measured as % of products accepted without changes. | `lib/approved-rules.js`, `route.js` |

**Human safety check:** a founder sits between "suggested rule" and "rule used for all users". Nothing learned from data changes the shared prompt until a person approves it on `/review` and commits it to `lib/approved-rules.js` (with name and date). Personal preferences apply automatically because they only affect that one user, who can see them, switch learning off or reset it.

**Red line (code, not a person):** the app never learns to say risky fresh food lasts longer than a safe limit (chicken and minced meat 2 days, other meat 3, fish and seafood 2). `lib/safety.js` caps every expiry number, from the AI, from a user or from a rule.

**What it does NOT learn:** anything about calories, weight, body or diet (principle 1 and 4). We only learn about receipts and food.

## Dependencies to avoid and why

- **Native iOS / Android builds (Swift, Kotlin, React Native):** too slow to build and test for a team of two in one term. A PWA is enough to test the idea.
- **Paid nutrition APIs (e.g. Nutritionix, Edamam paid plans):** costs before we have users. Open Food Facts + AI estimates are enough for now.
- **Supermarket ordering / delivery integrations:** complicated partnerships, not needed to prove the problem.
- **Building our own image recognition model:** the LLM can read receipts and photos already. Training our own model is not our job.
- **Several AI providers or agent frameworks:** more moving parts, harder to debug, no proven benefit yet. Re-discussed in Session 6 and closed for now: we stay with Claude only. Claude already read real Mercadona receipts correctly, so there is no reason to change for now.
- **Payments / subscriptions (Stripe):** we haven't proven anyone will pay. Add later.

---

## 4. Tradeoffs consciously accepted

What we do badly on purpose:

- **Nutrition numbers are estimates, not exact.** We prefer a plan people follow to a perfect number people give up on.
- **No precise daily food logging.** We assume the user mostly eats the plan. If they don't, the data will be less accurate.
- **Spain / Europe only at first.** Prices, supermarkets and products are European. No global coverage.
- **Students first.** Families, athletes and medical diets (diabetes, allergies beyond basic filters) are out of scope for now.
- **Expiry dates are often guessed** (e.g. "fresh chicken ≈ 2 days") when the receipt doesn't show them. The user can correct them.
- **Web app, not a "real" app.** Fewer phone features (weaker notifications, no home-screen widgets).

---

## 5. Open assumptions (guessed, not proven)

| # | What we are guessing | How we will test it |
|---|---|---|
| A1 | Students will add their groceries if it takes one receipt photo. | Ask 5 students to add one real shop with a receipt photo. Success = 4 of 5 finish in under 30 s and say they'd do it again. **Session 6: partly tested.** 4 people (not all students) used it and liked it, but it took a couple of minutes. |
| A2 | People want to be told what to eat, rather than choose themselves. | In interviews, ask what they cooked last week and how they decided. Show a sample plan and see if they follow it for 3 days. |
| A3 | Wasting food and money bothers students enough to change behaviour. | Interviews: ask how much food they threw away last week and how they felt, not if they "care" about waste. |
| A4 | One app for health + budget + waste beats the separate apps they use now. | Ask which apps they use today and why they stopped using any of them. |
| A5 | The AI can read Spanish supermarket receipts (Mercadona, Lidl, Carrefour, Dia) correctly. | Test 10 real receipts. Success = 90% of items read correctly. **Session 6: looks good for Mercadona.** All items were read correctly on the receipts we tried. Lidl, Carrefour and Dia not tested yet. |
| A6 | Someone will pay for it eventually. | Not tested yet. Parked until A1–A3 are proven. |
| A7 | Once Claude is connected directly to the app, the full receipt → pantry flow takes under 30 s on a phone. | Connect the API on the server and time 10 real receipts. Success = 9 of 10 under 30 s. |
| A8 | User corrections make the next list better (fewer changes needed). | Track % of products accepted without changes per receipt. Success = it goes up across a user's first 5 receipts and for new users after approved rules. |

Note: competitor names, market size (≈$414M meal-planning app market in 2025) and food waste figures (UNEP, 1.05 billion tonnes in 2022, 60% from households) came from AI research and have not been checked against the original sources yet.

---

## 6. Session log

### Session 7 — 28 October 2026 (Products that learn)

- Chose the behaviour for the learning loop: **corrections in the review list** (accept / edit / delete), mainly expiry days. Implicit data: users show us where the AI was wrong without telling us.
- **Built the first version** (code in the repo): correction log, personal expiry preferences shown in green, founder review page `/review` with suggested rules, `lib/approved-rules.js` for human-approved shared rules, and `lib/safety.js` with safe limits for meat and fish.
- **Human check:** placed between suggested rules and the shared prompt, because that is the step that changes the app for everyone. Cost: about 10–15 minutes a week for one founder at our size.
- **User control:** switch "Learn from my changes" on/off, "Reset learning", "Download my data". The app explains how it learns on the pantry screen.
- **Decision:** no model training. The loop changes a stored preference and the prompt (Huyen: reasons not to finetune).
- **Growth metrics:** % of products accepted without changes, and median seconds per receipt.
- Competitor map done: NoWaste (direct, already scans receipts), Samsung Food (big company, meal planning), substitutes (nothing / memory / notes), ChatGPT (general AI). Strongest: ChatGPT. Our bet: data cycle on Spanish receipts + switching costs (pantry and learned preferences).
- **Honest status:** the loop works in the app, tested with the sample receipt and test data. We have no real corrections yet (no new users since 13 Oct), so the metric has no real values yet. Data is stored per browser, there is no shared database yet, so testers must send their file.
- Added assumption **A8**.
- **Next:** add the API key and deploy, test with 5 students, collect their correction files, first review session.

### Update — 25 October 2026 (after teacher feedback)

- Teacher feedback on the hackathon: Shipped 2/5, Focus 4/5, Honesty 5/5. Next step agreed: connect Claude inside the app, time it again, test with students on a budget.
- **Built:** Claude is now called from inside the app through a server route (`app/api/read-receipt/route.js`). The API key is read from an environment variable on the server and never sent to the browser (Security rules).
- **Speed:** the photo is made smaller in the browser before it is sent (max 1600 px, JPG), and the app has a built-in timer from choosing the photo to "Add to pantry", so every test is timed automatically against the 30 s goal (A7).
- **Pantry:** saved in the browser (localStorage), so it stays after a refresh. Still no login or Supabase.
- **Safety:** the server only accepts JPG/PNG/WEBP up to 5 MB and does not store the photo.
- **Sample receipt button** to show the flow without an API key. It is always labelled "sample" in the app, so it is never confused with a real AI reading.
- **Not done yet:** we have not run it live with our API key, so we do not have a new time yet. A1 and A7 are still open.
- **Next:** add the API key, deploy on Vercel, time 10 real receipts from different supermarkets (A5, A7), then test with 5 students on a budget (A1).


### Session 6 — 13 October 2026 (Hackathon)

- Named the venture **Nutritrack**. Team: Kelly Owusu Kwabeng Thompson & Nico Alcaide.
- Hackathon goal: test A1 by building **one** feature: receipt photo → item list → pantry. Everything else was cut.
- **Built:** the full screen flow (upload receipt → check the items → add to pantry), from zero, using Claude for all the coding. Most of the work was done outside class.
- **First test (A1/A5):** 4 people (Kelly's girlfriend, Nico's parents and a friend) used real Mercadona receipts. Claude read all the items correctly, but each time it took a couple of minutes instead of under 30 s. They said it was a great way to add food, but most of them are not students on a budget, so A1 is not proven yet. Accuracy works, speed does not (principle 2).
- **Not finished:** the direct connection between the app and the Claude API. The receipt is read by Claude, but not automatically inside the app yet. We think this is the main reason it is slow.
- **Cut on purpose:** login and Supabase (postponed: not needed to test if receipt reading is fast and correct), fridge photo, meal plans, shopping list, expiry alerts, weekly summary, Open Food Facts.
- **Decision:** for now the pantry is only shown while the app is open and is not saved. It will be saved in Supabase when we add login.
- **Decision:** the user always reviews the item list before it is added (principle 4), and expiry dates are AI guesses the user can edit.
- **Distraction and fix:** we spent time discussing whether to use another AI instead of Claude. We stopped by going back to this doc, which says to use only one AI.
- Added the **Security rules** section and assumption **A7**.
- **Next:** 1) connect Claude directly to the app on the server (API key in an environment variable) so reading is automatic and faster; 2) time 10 real receipts from different supermarkets (A5, A7); 3) test with 5 real students on a budget (A1).

### Session 4 — 6 October 2026

- Created this architecture doc as the single source of truth for the project.
- Defined the venture in one sentence around **following a plan**, not tracking.
- Chose "follow, don't count" as principle #1, based on my Session 1 notes about food noise, restriction and bingeing.
- Chose "input in under 30 seconds" as principle #2, because the strongest argument against the idea (Session 2, Section 3) was that users won't enter their groceries manually.
- Chose a PWA (Next.js + Supabase + one LLM) instead of a native app, to move fast as a small team.
- Decided to leave out payments, supermarket integrations and paid nutrition APIs for now.
- Listed six open assumptions; A1 (receipt photo) is the first one to test because the whole product depends on it.
- **Still to do:** pick a venture name, fill in the five interviews and update the assumptions table with what real people said.
