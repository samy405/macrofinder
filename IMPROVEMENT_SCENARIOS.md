# Macro Matching System – Improvement Scenarios & Gaps

This document catalogs **scenarios** the system is designed to handle, **improvements implemented**, and **remaining gaps** or edge cases that may need more work.

**Important:** Macros (titles and text in `extracted_macros.md`) are **never edited**. All improvements are in the **matcher only** (trigger phrases and scoring in `macro_matcher.ps1`).

---

## 1. Implemented Improvements (This Pass)

### 1.1 Scoring Algorithm

- **New intents:** `discount`, `replacement`.
- **Scenario flags:** `BillingCycleQuestion`, `BillingCycleConfusion`, `ReplacementScenario`, `DiscountQuestion`.
- **Scenario-based boosts:**
  - **Charge date / “charged again”:** When the message is about next charge date or confusion about being charged again, macros about charge alignment, charge date, and billing cycle get a +4.0 boost (e.g. **Billing: Charge Alignment for Orders**).
  - **Discounts:** When the message asks about discounts, promotion/no-discount and price-objection macros get +3.5.
  - **Lost medication / replacement:** When the message is about lost medication or replacement, **Orders: Processing Replacement** gets +4.0; if travel is also mentioned, **Extra medication for travel** gets +2.5.

### 1.2 Missing Macros Added to `extracted_macros.md`

| Macro # | Title | Use Case |
|--------|--------|----------|
| 198 | Promotion: No Discount | “Do you offer any discounts?” |
| 199 | Promotion: Price Objections or Requests for Discounts Due to Competitor's Lower Pricing | Price / competitor discount questions |
| 200 | Promotion: Promo Codes | Promo code questions |
| 201 | Promotion: Holiday Referral | HOLIDAY100 code |
| 202 | Promotion: No Valid Promo Code | Invalid promo code |
| 203 | Promotion: Veteran's Discount | Veteran discount |

### 1.3 Comprehensive Trigger Phrases (Matcher Only)

The matcher uses a **phrase list** (`$SCRIPT:Phrases` in `macro_matcher.ps1`) so many phrasings map to the same scenario. Macros are never edited; only detection patterns are expanded.

| Scenario | Example phrasings (partial list) |
|----------|----------------------------------|
| **Billing cycle / charge date** | charge date, next charge, next payment date, billing date, when is my next charge, when will I be charged, renewal date, next billing cycle, charge schedule |
| **Charged again / duplicate** | charged again, why am I being charged, charged twice, double charged, duplicate charge, just paid and charged, unexpected charge, second charge, why did I get charged, charged me again |
| **Replacement / lost meds** | lost my medication, lost my order, replacement, need a replacement, replace my order, never received, vial broke, spilled medication, damaged medication, process for replacement, order never arrived |
| **Discounts** | discount, discounts, offer any discount, promo code, veteran discount, military discount, cheaper, lower price, price match, competitor is cheaper, promotional code |
| **Cancellation** | cancel, cancel my subscription, stop my subscription, want to cancel, how do I cancel, discontinue, opt out, unsubscribe |
| **Labs** | lab results, see my results, blood work, test results, access my labs, view my labs, lab work, blood test |
| **Orders / shipping** | when will my order ship, shipping date, track my order, where is my order, order status, when will I receive, tracking, my package |
| **Video visit** | schedule appointment, book a visit, see a provider, see a doctor, video call, when can I see, next available, telehealth |
| **Medication** | medication, prescription, refill, when is my next refill, need a refill, running low |
| **Billing (generic)** | refund, charge, bill, invoice, payment, paid, receipt, get my money back |
| **Pricing** | how much, pricing, expensive, what is the cost, what do you charge |
| **Registration** | sign up, register, get started, new patient, ready to start |

**Targeted boosts** (when message contains): receipt → Billing: Receipt; itemized → Itemized Receipts; refund → refund macros; FSA/HSA → FSA/HSA cards.

### 1.4 Special Handling for Complex Billing

- **“When is my next charge date?”**  
  Detected via `BillingCycleQuestion`; **Billing: Charge Alignment for Orders** is heavily boosted.

- **“I just paid on X. Why am I being charged again today?”**  
  Detected via `BillingCycleConfusion` (e.g. “charged again”, “why charged”, “just paid” + “charged”); same Charge Alignment macro is boosted so staff can explain recurring billing vs. payment date.

- **“Do you offer any discounts?”**  
  Treated as `discount` intent; **Promotion: No Discount** and **Price Objections** are boosted.

- **“I lost my medication while traveling. What is the process for a replacement?”**  
  Treated as `replacement` + travel; **Orders: Processing Replacement** is top; **Extra medication for travel** is secondary when travel is mentioned.

---

## 2. Scenario Catalog (All Possible Scenarios)

These are the main scenario types the system is meant to support or is aware of. **Bold** = handling improved in this pass.

### 2.1 Billing & Payments

| Scenario | Example Message | Primary Macro(s) | Status |
|----------|------------------|-------------------|--------|
| **Next charge date** | “When is my next charge date?” | Billing: Charge Alignment for Orders | **Improved** |
| **Charged again / duplicate charge** | “I just paid Jan 5. Why charged again today?” | Billing: Charge Alignment for Orders | **Improved** |
| Cancel subscription | “I want to cancel my subscription” | Billing: Cancel Subscription, Cancel: Multiple Plans | OK |
| Refund (termed plan) | “I canceled, when do I get my refund?” | Billing: Cancelling a termed plan + processing a refund | OK |
| Payment plans | “Do you offer payment plans?” | Billing: Do you offer payment plans? | OK |
| Insurance | “Do you accept insurance?” | Billing: Insurance | OK |
| Receipt | “Can I get a receipt?” | Billing: Receipt | OK |
| Charge not recognized | “I was charged but don’t recognize it” | Billing: Charge does not come up in Stripe 2 | OK |
| FSA/HSA | “Can I use my FSA card?” | Billing: FSA/HSA cards | OK |
| Itemized receipt | “I need an itemized receipt” | Billing: Itemized Receipts | OK |

### 2.2 Discounts & Promotions

| Scenario | Example Message | Primary Macro(s) | Status |
|----------|------------------|-------------------|--------|
| **General discounts** | “Do you offer any discounts?” | Promotion: No Discount | **Improved** |
| **Competitor pricing** | “Competitor X is cheaper” | Promotion: Price Objections… | **Improved** |
| **Promo codes** | “Do you have a promo code?” | Promotion: Promo Codes | **Improved** |
| **Veteran discount** | “Do you offer a veteran’s discount?” | Promotion: Veteran's Discount | **Improved** |
| Referral credit | “I was referred by a friend” | Promotion: Referral by an existing patient | OK |
| Money-back guarantee | “Do you have a money-back guarantee?” | Promotion: Money-Back Guarantee | OK |

### 2.3 Orders, Shipping & Replacement

| Scenario | Example Message | Primary Macro(s) | Status |
|----------|------------------|-------------------|--------|
| **Lost medication / replacement** | “I lost my medication while traveling. Replacement process?” | Orders: Processing Replacement; General CS: Extra medication for travel | **Improved** |
| When will order ship | “When will my order ship?” | Orders: Overnight Shipping, Orders: Dose Adjustment Refill | OK |
| Overnight shipping | “Can I get overnight shipping?” | Orders: Overnight Shipping | OK |
| Replacement (vial/shipment lost) | “My vial broke” / “I never received my order” | Orders: Processing Replacement | OK |
| Extra meds for travel | “I’m traveling, need extra medication” | General CS: Extra medication for travel; Pharmacy: Extra Meds Travel 1 | OK |

### 2.4 Labs

| Scenario | Example Message | Primary Macro(s) | Status |
|----------|------------------|-------------------|--------|
| See lab results | “How can I see my lab results?” | Akute: Sharing Lab Results; Labs: Can I use my lab results? | OK |
| LabCorp / Quest bill | “I got a bill from LabCorp” | LC: Step 1 of Bill Process; LC: Bill Transfer | OK |
| Lab scheduling | “I need to reschedule my lab” | LC/Quest scheduling macros | OK |
| Use my own labs | “Can I use my own lab results?” | Labs: Can I use my lab results? | OK |

### 2.5 Video Visits & Providers

| Scenario | Example Message | Primary Macro(s) | Status |
|----------|------------------|-------------------|--------|
| Schedule visit | “I need to schedule a video visit” | VV: How soon can I see a provider? | OK |
| Specific provider | “I want to see Dr. X” | VV: Request for a specific provider | OK |
| Visit required before refill | (Outbound) | VV: Visit required before refill 1–5 | OK |
| Provider no longer with us | “My provider left” | VV: Provider no longer works with us - New VV is needed | OK |

### 2.6 Medication & Prescriptions

| Scenario | Example Message | Primary Macro(s) | Status |
|----------|------------------|-------------------|--------|
| Local pharmacy | “Can you send my prescription to a local pharmacy?” | Orders: Can the prescription be sent to a local pharmacy? | OK |
| Refill timing | “When is my next refill?” | Next Refill Date; Orders: Are refills processed automatically? | OK |
| Dose adjustment | “My dose changed” | Orders: Dose Adjustment Refill | OK |
| Pause shipments | “I have extra meds, can you pause?” | Pause Confirmation | OK |

### 2.7 Registration, Pricing & General

| Scenario | Example Message | Primary Macro(s) | Status |
|----------|------------------|-------------------|--------|
| TRT/HRT pricing | “How much does TRT cost?” | Billing: TRT/HRT pricing plans | OK |
| Start treatment | “I’m ready to start” | Set up Subscription | OK |
| Discounted assessment | “$5 TRT assessment?” | General CS: TRT Discounted Assessment Link | OK |
| Contract / cancel anytime | “Is there a contract?” | General CS: Is there a contract? | OK |

---

## 3. Edge Cases & Remaining Gaps

These are scenarios where the system may still underperform or where no macro exists.

### 3.1 Wording Variations

- **Charge date:** Phrases like “when do I get charged next”, “next billing date”, “when is my next payment” should still map to Charge Alignment; the current patterns aim to cover “next charge”, “charge date”, “when … charge”. If new phrasings appear in production, add them to `BillingCycleQuestion` in `Get-Intent`.
- **Duplicate charge:** “I was charged twice”, “double charged”, “two charges this month” are intended to be covered by `BillingCycleConfusion`; add more phrases if needed.

### 3.2 Missing or Incomplete Macros (Document)

- **Subscription Plan Update & Credit Adjustment Confirmation** – Referenced in workflows for plan/credit changes; patient-facing text not in extraction. If added later, give it a title and use “[Title only]” until text is available.
- **“Why can’t you ship more quickly?”** – Referenced as “Orders: Why can’t you ship more quickly?”; confirm it exists in `extracted_macros.md` and that “ship” + “quick”/“faster” boost it.

### 3.3 Ambiguous or Multi-Part Messages

- **Multiple questions in one message** (e.g. “When is my next charge and can I cancel?”): The matcher picks one dominant intent. For two unrelated questions, consider returning top 3–5 macros so both topics are covered, or run matching twice (e.g. by sentence).
- **Very short messages** (“charges?”, “refund?”): Keyword and intent coverage is limited; may need to relax minimum score or add short-query rules.

### 3.4 Negative / Complaint Tone

- “I’m upset I was charged again” – Same as billing cycle confusion; Charge Alignment should still rank high. No separate “complaint” intent yet; could add later if needed for routing.

### 3.5 Program-Specific (TRT vs HRT vs GLP)

- Topic tags (TRT, HRT, GLP) already boost program-specific macros. If a message mentions multiple programs, the top matches may mix programs; that’s acceptable for “best available options.”

### 3.6 Future Data-Driven Improvements

- **Feedback loop:** Log which macro the agent actually sends after seeing suggestions; use to adjust weights or add phrases.
- **Synonyms / phrasing list:** Maintain a small list of phrases per scenario (e.g. “next charge date” ↔ “next billing date”) and normalize before intent detection.
- **A/B testing:** Compare current scoring vs. a simpler keyword-only baseline to measure lift from scenario logic.

---

## 4. Maintenance Checklist

When adding or changing macros or messages:

1. **New macro** – Add to `extracted_macros.md`; if it fits a known scenario, ensure `Get-Intent` and the scenario boosts in `Get-RelevanceScore` reference it (by title pattern or keyword).
2. **New scenario** – Add to this doc (Section 2), then add intent/flags and a scenario boost in the matcher.
3. **New phrasing for existing scenario** – Add to the regex/list in `Get-Intent` (e.g. more variants for `BillingCycleQuestion` or `BillingCycleConfusion`).
4. **Macro renamed in source** – Update title in `extracted_macros.md` and any title-based rules in the matcher.

---

## 5. Quick Reference: Scenario → Intent / Flags

| User intent | Intent.Type | Flags | Key macros to boost |
|-------------|-------------|--------|----------------------|
| Next charge date | billing | BillingCycleQuestion | Billing: Charge Alignment for Orders |
| Why charged again / duplicate | billing | BillingCycleConfusion | Billing: Charge Alignment for Orders |
| Discounts? | discount | DiscountQuestion | Promotion: No Discount, Price Objections, Promo Codes, Veteran |
| Lost meds / replacement | replacement | ReplacementScenario | Orders: Processing Replacement; if travel: Extra medication for travel |
| Cancel | cancellation | - | Billing: Cancel Subscription, Cancel: Multiple Plans |
| Labs / results | labs | - | Akute: Sharing Lab Results, Labs: … |
| Order / ship | orders | - | Orders: Overnight Shipping, … |
| Video visit | video_visit | - | VV: How soon can I see a provider?, … |
| Insurance | billing | Topics: insurance | Billing: Insurance |
| Local pharmacy | orders | - | Orders: Can the prescription be sent to a local pharmacy? |

This file should be updated whenever new scenarios are added or logic is changed in the matcher.
