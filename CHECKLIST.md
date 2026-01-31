# Intent-based Matching Checklist

## Core implementation

- [x] **Intent engine** (`api/intent/`)
  - [x] `normalize.ts` – Message normalization, typo map
  - [x] `detect.ts` – Intent taxonomy, phrase patterns, contextual rules, negation, entities
  - [x] `fuzzy.ts` – Optional Levenshtein/fuzzy word matching
  - [x] `scoring.ts` – Macro intents (from title or metadata), scoring, rationale
  - [x] `index.ts` – `intentMatch()`, `convertToLegacyFormat()`

- [x] **API** (`api/match.ts`)
  - [x] Uses `intentMatch()` only (no external API calls)
  - [x] Returns matches with confidence and rationale
  - [x] Analytics and performance timing

- [x] **Macro metadata**
  - [x] Intents derived from title when not in metadata
  - [x] Macros without intents treated as generic fallback

## Tests and docs

- [x] **Tests** (`test/intent.test.ts`)
  - [x] Required cases A–E (billing, out-of-state, address, labs reschedule, follow-up)
  - [x] Negative cases (lab+billing, charged+appointment)
  - [x] Typos, rationale, performance

- [x] **Docs**
  - [x] README – intent-based, no API
  - [x] INTENT_MATCHING.md – add intents, tag macros, tune rules
  - [x] QUICK_START.md – no API keys
  - [x] .env.example – no OPENAI_API_KEY

## Cleanup

- [x] Removed `build-embeddings` script from package.json
- [x] Removed OpenAI/semantic modules and buildEmbeddings script
- [x] No external API calls; app runs fully offline
