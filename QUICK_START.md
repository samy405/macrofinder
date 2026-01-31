# Quick Start Guide - Intent-based Macro Finder

## First-time setup

### 1. Install dependencies
```bash
npm install
```

### 2. Run locally
```bash
npx vercel dev
```
Open http://localhost:3000

No API keys or build steps are required. Matching runs fully offline.

### 3. Run tests
```bash
npm test
# or intent-specific:
npm run test:intent
```

---

## How matching works

- **Intent-based (offline)** – No OpenAI, no embeddings. The app infers patient intents (billing, labs, scheduling, shipping, address, refills, out-of-state travel, etc.) and ranks macros by intent fit.
- **Explainability** – Each result shows a confidence score (0–100) and a one-sentence “Why this macro” rationale.
- See **INTENT_MATCHING.md** for adding intents, tagging macros, and tuning rules.

---

## Example queries

- *"I got charged $499, what is this for?"* → Billing / charge alignment macros
- *"I'm in Hawaii until the 11th, can I do my follow-up?"* → Out-of-state / visit scheduling
- *"FedEx says you put the address in wrong, someone needs to call them"* → Address / shipping macros
- *"I was sick and missed labs, link doesn't work"* → Lab reschedule / scheduling
- *"Do I need labs before my follow up or just symptoms?"* → Follow-up visit / lab due date

---

## Troubleshooting

- **No or poor matches** – Check intent patterns in `api/intent/detect.ts` and macro intents in `api/intent/scoring.ts`. See INTENT_MATCHING.md.
- **Wrong macro on top** – Adjust contextual rules in `api/intent/detect.ts` or macro metadata.
