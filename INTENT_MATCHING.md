# Intent-based matching (offline)

The matcher uses a **NO-API** intent engine: `normalize(message) → detect_intents(message) → score_macros(intents, message) → top 3 + confidence + rationale`.

---

## How to add new intents

1. **Define the intent id** in `api/intent/detect.ts`:
   - Add a new key to the `INTENT_IDS` array (e.g. `"new_intent_id"`).
   - Add a corresponding entry in the `PATTERNS` object: an array of `RegExp` patterns that signal this intent (multi-word phrases are better than single words).

2. **Contextual rules** (optional):
   - In `resolveContext()` in `detect.ts`, add logic so that when certain other signals appear, your new intent is chosen as primary or secondary (e.g. “X + Y” → primary = your intent).

3. **Scoring**:
   - In `api/intent/scoring.ts`, extend `getMacroIntents(macro)` so macros whose title/text correspond to this intent get the new intent id in their list.
   - Optionally add a sentence in `buildRationale()` for this intent so the “Why this macro” text is clear.

4. **Run tests**:
   - Add or adjust cases in `test/intent.test.ts` for messages that should match the new intent.

---

## How to tag macros (metadata)

Macros can have optional metadata: `intents[]`, `tags[]`, `priority`, `contraindications`.

- **Without metadata** (current setup): intents are **derived from the macro title** in `getMacroIntents()` in `api/intent/scoring.ts`. Any macro whose title matches the keyword rules gets the corresponding intents.

- **With metadata** (optional): you can add a wrapper or mapping that includes `intents`, `tags`, etc. For example:
  - In `api/macros.json` (if you load from JSON), add per-macro fields: `"intents": ["billing", "billing_charge_date"]`, `"tags": ["renewal"]`, `"priority": 1`, `"contraindications": []`.
  - In code, use a type that extends `Macro` with `intents?`, `tags?`, etc. (e.g. `MacroWithMeta` in `api/intent/types.ts`). The scorer already uses `macro.intents` when present; otherwise it falls back to `getMacroIntents(macro)`.

Macros with no intents (or empty `intents`) are treated as **generic fallback**: they can still be scored by keyword overlap and secondary intent, but they won’t get a strong primary-intent boost.

---

## How to tune rules

- **Phrase patterns** (`api/intent/detect.ts`):
  - Add or refine regexes in `PATTERNS` for the intent. Prefer multi-word signals (e.g. `when is my next charge`) over single words to reduce false positives.

- **Contextual rules** (`resolveContext()` in `detect.ts`):
  - Use when the same words can mean different intents. Examples already in code:
    - “charged” + amount/question → billing (not lab results).
    - “lab” + “bill/charged” → labs_bill or billing (not lab scheduling).
    - “charged” + “reschedule appointment” → scheduling (not billing).
  - Add new `if (…) return { primary: '…', secondary: […] }` branches for your cases.

- **Negation** (`detect.ts`):
  - Negation patterns and `extractNegatedTerms()` strip or downweight intents when the user says “did NOT get labs”, “no lab work done”, “not received”, etc. Add new negation patterns if you see false positives.

- **Scoring weights** (`api/intent/scoring.ts`):
  - `INTENT_WEIGHT_PRIMARY`, `INTENT_WEIGHT_SECONDARY`, `KEYWORD_WEIGHT_MAX` control how much primary intent, secondary intent, and keyword overlap contribute. Keyword is capped at 20% as a tie-breaker.

- **Penalties**:
  - In `scoreMacros()`, wrong-category penalties (e.g. billing macro when primary intent is labs_scheduling) reduce score. Adjust or add penalties there if the wrong macro type still wins.

---

## File reference

| File | Purpose |
|------|--------|
| `api/intent/normalize.ts` | Message normalization, typo map |
| `api/intent/detect.ts` | Intent taxonomy, patterns, context, negation, entities |
| `api/intent/fuzzy.ts` | Optional Levenshtein/fuzzy word match |
| `api/intent/scoring.ts` | Macro intents (from title or metadata), scoring, rationale |
| `api/intent/index.ts` | `intentMatch()`, `convertToLegacyFormat()` |
| `api/intent/types.ts` | IntentResult, MacroWithMeta, RankedMacro |

No external APIs are called; the app runs fully offline.
