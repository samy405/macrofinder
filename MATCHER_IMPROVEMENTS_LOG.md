# Matcher Improvements - Sanity Check Round

## Issues Identified
User reported:
- Some billing/insurance/lab queries return wrong top match
- Correct answer sometimes appears as #2 or #3
- Some responses don't fit patient questions at all

## Fixes Applied

### 1. Dynamic Score Threshold
**Problem**: Fixed 3.0 threshold was too strict, causing no results for some queries
**Fix**: Dynamic threshold based on top score (3.0 for strong matches, 1.5 for weak)
**Impact**: Ensures at least 1 result always returned

### 2. Increased Keyword Weights
**Problem**: Keyword overlap weights too low (0.4 title, 0.2 text)
**Fix**: Doubled weights (0.8 title, 0.4 text)
**Impact**: Better baseline matching for queries without specific scenario triggers

### 3. Double Charge Detection
**Problem**: "Why was I charged twice?" didn't match Charge Alignment
**Fix**: Added `asksAboutDoubleCharge` scenario with +12 boost
**Impact**: Correctly explains payment vs shipment timing confusion

### 4. Lab Results Access Specificity
**Problem**: "How do I see my results?" matched wrong lab macros
**Fix**: Added `asksAboutLabResults` scenario, -12 penalty for blood draw time
**Impact**: Strongly prioritizes Akute/portal access macros

### 5. Shipping Detection Enhancement
**Problem**: Already fixed but reinforced penalties
**Fix**: -10 penalty for lab macros when asking about shipping
**Impact**: "How long does shipping take?" won't match blood draw macro

## Files Changed
- `api/matcher.ts`: All matching logic improvements
- `SANITY_CHECK_TEST.md`: Test suite for verification

## Next Steps
1. Deploy to Vercel
2. Run test queries from SANITY_CHECK_TEST.md
3. Report any remaining issues with specific examples
