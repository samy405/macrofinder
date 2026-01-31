# Intent-based Matching Implementation Summary

## Overview

The matcher uses an **intent-based pipeline** that runs **fully offline** (no OpenAI, no embeddings, no external APIs).

### Pipeline
1. **Normalize** – Message normalization and typo correction (`api/intent/normalize.ts`)
2. **Detect intents** – Phrase patterns, contextual rules, negation, optional fuzzy matching (`api/intent/detect.ts`)
3. **Score macros** – Intent match (primary > secondary), keyword tie-breaker ≤20% (`api/intent/scoring.ts`)
4. **Return** – Top 3 macros with confidence (0–100) and one-sentence rationale

### Key files
- **`api/intent/`** – Intent engine (normalize, detect, scoring, index)
- **`api/match.ts`** – Calls `intentMatch()` and returns matches + suggested response
- **`api/matcher.ts`** – Legacy: `getSuggestedResponse()`, `detectPlaceholders()` (still used)
- **`test/intent.test.ts`** – Intent-based test suite

### Macro metadata
- Intents can be **derived from macro title** in `getMacroIntents()` (scoring.ts), or
- Optional **metadata** (intents[], tags[], priority, contraindications) can be added per macro; see INTENT_MATCHING.md.

No API keys or build steps are required. See **INTENT_MATCHING.md** for adding intents, tagging macros, and tuning rules.
