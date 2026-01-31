# Macro Finder - Sanity Check Test Suite

## Instructions
Test each query below on the deployed website and record results.

---

## Test Queries

### Billing Questions
1. **"When is my next charge date?"**
   - ✅ EXPECTED: "Billing: Charge Alignment for Orders" as #1
   - ❌ WRONG IF: Shows "Next Refill Date" or insurance macros

2. **"Why was I charged twice?"**
   - ✅ EXPECTED: "Billing: Charge Alignment for Orders" as #1
   - 📝 NOTE: This explains payment vs shipment timing

3. **"Can I get a refund?"**
   - ✅ EXPECTED: Refund-related macro as #1
   - ❌ WRONG IF: Shows insurance, discount, or cancel macros

4. **"Can I get an itemized receipt?"**
   - ✅ EXPECTED: Receipt/itemized macro as #1
   - ❌ WRONG IF: Shows insurance or general billing

---

### Insurance Questions
5. **"Do you accept insurance?"**
   - ✅ EXPECTED: "Billing: Insurance" as #1
   - ❌ WRONG IF: Shows charge date, refund, or cancel macros

---

### Lab Questions
6. **"How do I see my lab results?"**
   - ✅ EXPECTED: "Akute: Sharing Lab Results" or similar as #1
   - ❌ WRONG IF: Shows "How long does blood draw take"

7. **"When will my lab results be ready?"**
   - ✅ EXPECTED: Lab processing/timing macro
   - ❌ WRONG IF: Shows blood draw duration

8. **"How much do labs cost?"**
   - ✅ EXPECTED: Lab billing/cost macro
   - ❌ WRONG IF: Shows results access or blood draw

---

### Shipping Questions
9. **"How long does shipping take?"**
   - ✅ EXPECTED: Shipping/delivery time macro
   - ❌ WRONG IF: Shows "How long does blood draw take" (THIS WAS THE BUG)

10. **"Where is my order?"**
    - ✅ EXPECTED: Order tracking or shipping status
    - ❌ WRONG IF: Shows labs or unrelated

11. **"Can I expedite my order?"**
    - ✅ EXPECTED: Expedited/overnight shipping
    - ❌ WRONG IF: Shows labs or cancel

---

### Discount Questions
12. **"Do you offer any discounts?"**
    - ✅ EXPECTED: Discount/promotion macro
    - ❌ WRONG IF: Shows insurance, charge date, or refund

13. **"Is there a referral program?"**
    - ✅ EXPECTED: Referral/promotion macro
    - ❌ WRONG IF: Shows general billing or cancel

---

### Cancellation Questions
14. **"How do I cancel my subscription?"**
    - ✅ EXPECTED: Cancellation macro as #1
    - ❌ WRONG IF: Shows insurance, refund, or billing

15. **"I want to cancel"**
    - ✅ EXPECTED: Cancellation macro as #1
    - ❌ WRONG IF: Shows unrelated macros

---

### Other Scenarios
16. **"Can I schedule a video visit?"**
    - ✅ EXPECTED: Video visit/scheduling macro
    - ❌ WRONG IF: Shows billing or labs

17. **"I lost my medication while traveling"**
    - ✅ EXPECTED: Replacement + travel macros
    - ❌ WRONG IF: Shows refund or cancel

18. **"I ran out of needles"**
    - ✅ EXPECTED: Needles/supplies macro as #1
    - ❌ WRONG IF: Shows unrelated macros

---

## What We Fixed

1. **Dynamic score threshold** - Now returns at least 1 match even if scores are low
2. **Keyword weights increased** - Better matching for general queries (0.4→0.8 title, 0.2→0.4 text)
3. **Double charge detection** - "Why was I charged twice?" now correctly matches Charge Alignment
4. **Lab results specificity** - "How do I see my results?" strongly prioritizes Akute/portal macros
5. **Shipping vs labs penalty** - Blood draw macros get -12 penalty when asking about shipping
6. **Better fallback** - If no good matches, returns top 1 instead of empty results

---

## How to Test

1. Open deployed Macro Finder website
2. Enter each query exactly as written
3. Check the top 3 results
4. Mark ✅ if #1 is correct, ⚠️ if correct answer is #2 or #3, ❌ if wrong

## Report Back

If any queries still fail, note:
- Query number
- What macro appeared as #1
- What you expected
- Confidence score shown
