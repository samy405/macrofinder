# Intent-based matching (offline)

The matcher uses a **NO-API** intent engine: `normalize(message) → detect_intents(message) → score_macros(intents, message) → top 3 + confidence + rationale`.

Intent categories are aligned with **Fountain Workflows** (billing, labs, scheduling, shipping, cancellation, refills, travel, plan change, receipt, referral, documents, resume, pharmacy other, assessment, etc.) so that patient messages return the correct macro even when phrased differently.

---

## Intent taxonomy (major patient question types)

| Intent | Typical patient phrasing | Example macros |
|--------|--------------------------|----------------|
| **billing** | Charged, payment, invoice, what is this charge | Billing: Charge Alignment, Billing: Cancel Subscription |
| **billing_charge_date** | When is my next charge, charge date | Billing: Charge Alignment for Orders |
| **billing_refund** | Refund, money back | Billing: Cancelling a termed plan + processing a refund |
| **receipt_itemized** | Receipt, itemized, FSA, HSA | Billing: Itemized Receipts, Billing: FSA/HSA cards |
| **labs** | Lab work, blood work, need labs | Labs: …, LC: …, Quest: … |
| **labs_scheduling** | Schedule labs, reschedule, link doesn’t work, Labcorp/Quest | LC: Visits are Booked Out, Lab Scheduling: I thought I booked |
| **labs_results** | See my results, view results, portal | Akute: Sharing Lab Results |
| **labs_bill** | Lab bill, charged for lab | LC: Bill Transfer, Quest: Bill Transfer |
| **scheduling** | Schedule, appointment, book visit, reschedule | VV: …, Video Visit Scheduling |
| **visit_required_before_refill** | Need visit to get refill, overdue for refill | VV: Visit required before refill 1–5 |
| **shipping** | When will order ship, track order, delivery | Orders: Overnight Shipping, Curexa: Delayed |
| **shipping_address** | Wrong address, address in wrong | LC: Wrong Zip Code, address-change macros |
| **expedite_order** | Expedite, rush, overnight, delayed | Curexa: Delayed need to expedite, Orders: Overnight Shipping |
| **replacement** | Replacement, lost order, never received | Orders: Processing Replacement |
| **out_of_state_travel** | Traveling, out of state, Hawaii, extra meds for travel | LC - Traveling, General CS: Extra medication for travel |
| **cancellation_pause** | Cancel, pause, stop subscription | Billing: Cancel Subscription, Pause Confirmation |
| **resume_treatment** | Resume later, come back, restart | Cancel Subscription: Resume Treatment at a Later Date |
| **plan_change** | Switch plan, change subscription plan, different plan | Switch plans, Billing: Charge Alignment, Subscription fees for TRT/HRT |
| **pharmacy_other** | Order filled by another pharmacy, other pharmacy | If a patient had an order processed by another pharmacy recently |
| **referral** | Referral link, referred by friend, $100 credit | Promotion: TRT/HRT Patient Referral |
| **documents** | Send docs, fax, upload documents | Sending docs, Faxing Docs |
| **update_phone** | Update phone number | General CS: Update Phone Number |
| **provider_specific** | See specific provider, same doctor | VV: Request for a specific provider |
| **assessment_registration** | Assessment, sign up, see results, registration | Unregistered Patient: …, General CS: TRT Registration Link |
| **intermingled_profiles** | Wrong profile, family member same email | Intermingled Profiles |
| **prescription_local_pharmacy** | Send script to local pharmacy, fill at CVS | Orders: Can the prescription be sent to a local pharmacy? |
| **wrong_charge_not_us** | Charge doesn’t come up, not our charge | Unknown SMS: Sender thinks we charged them |
| **contract_policy** | Contract, cancellation policy, refund policy | General CS: Is there a contract?, Refunds: Terms for Longer Term Plans |
| **qualify_treatment** | Do I qualify, eligible | General CS: Do I qualify for TRT treatment? |
| **in_person_appointments** | In-person appointment, do you do in-person | Unknown SMS: Do you do in-person appointments? |
| **scam_legit** | Scam, legit, legitimate | General CS: Is your program a scam? |

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

**Direct-answer boost:** Short macros (body ≤ 120 characters) that match the primary intent get a scoring boost so they rank above long explanatory macros. For example, "Switch plans" (direct yes/no answer) ranks first for "Can I switch to a different subscription plan?" above Billing: Charge Alignment and TRT/HRT pricing. This applies to all categories: any short, direct-answer macro will outrank longer ones for the same intent.

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
