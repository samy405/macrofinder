# Macro Finder

**Intent-based macro matching for patient support (NO API – fully offline)**

Macro Finder helps customer support teams quickly identify relevant response templates (macros) for patient messages. It uses an **intent-based matcher** that runs entirely locally: no OpenAI, no embeddings, no external APIs. It handles typos, slang, indirect phrasing, and multi-topic messages by detecting patient intents and scoring macros by intent fit.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Run locally
```bash
# Full-stack (frontend + API)
npx vercel dev

# Or frontend only
npm run dev
```

No API keys or build steps are required. Matching runs fully offline.

---

## How it works

### Intent-based pipeline (offline)
1. **Normalize** – Clean and typo-correct the message.
2. **Detect intents** – Infer primary and secondary intents (billing, labs, scheduling, shipping, address, refills, out-of-state travel, etc.) using phrase patterns, contextual rules, negation handling, and optional fuzzy matching.
3. **Score macros** – Rank by intent match (primary > secondary). Keyword overlap is used only as a small tie-breaker (≤20%).
4. **Explain** – Each result includes a confidence score (0–100) and a one-sentence rationale based on intent.

### Example
**Input**: `"I got charged $499, what is this for?"`

**Output**:
- **Billing: Charge Alignment for Orders** (e.g. 85% confidence)  
  *Matched because patient is asking about a charge or billing and this macro explains charges or charge dates.*
- Plus up to 2 more macros with confidence and rationale.

### Intent taxonomy (examples)
- Billing (charge date, refund, lab bill)
- Labs (scheduling, results, lab bill)
- Scheduling / video visit
- Shipping (address, tracking)
- Replacement / medication not received
- Out-of-state travel
- Cancellation / pause
- Pricing / discount
- Follow-up visit / lab due before visit

See **INTENT_MATCHING.md** for how to add new intents, tag macros, and tune rules.

---

## Testing

```bash
npm test
```

Intent-specific tests:
```bash
npm run test:intent
```

Tests check that:
- Billing-style messages rank billing macros (e.g. “I got charged $499”).
- Out-of-state / travel messages rank visit/scheduling macros.
- Address/shipping issues rank address or replacement macros.
- Lab reschedule + broken link rank lab scheduling macros.
- “Lab” in a billing context does not rank lab-results macros above billing.
- “Charged” in an appointment context does not rank billing above scheduling.

---

## Project layout

- **`api/match.ts`** – Vercel serverless handler; calls intent matcher.
- **`api/intent/`** – Intent engine:
  - `normalize.ts` – Message normalization.
  - `detect.ts` – Intent detection (patterns, context, negation).
  - `scoring.ts` – Macro scoring by intent + optional macro metadata.
  - `index.ts` – Pipeline: `intentMatch(message, macros, topN)`.
- **`api/matcher.ts`** – Legacy keyword matcher (suggested response, placeholders); macro type.
- **`api/macrosData.ts`** – Macro list (number, title, text).
- **`api/macros.json`** – Same data as JSON; optional metadata (intents, tags) can be added here later.

---

## Deployment (e.g. Vercel)

- No `OPENAI_API_KEY` or other API keys needed.
- No `build-embeddings` step.
- Deploy as usual; the app works fully offline.

---

## Troubleshooting

- **No or poor matches** – Check that the message is being normalized and that intents in `api/intent/detect.ts` and macro intents in `api/intent/scoring.ts` (or `macros.json`) cover the case. See INTENT_MATCHING.md.
- **Wrong macro on top** – Adjust contextual rules in `detect.ts` or intent tags/priorities for macros.

