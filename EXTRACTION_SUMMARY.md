# Macro Extraction Summary

**Date:** 2026-01-31
**Source Document:** Fountain Workflows.docx
**Output File:** extracted_macros.md

## Extraction Statistics

- **Total Macros Extracted:** 197
- **No Duplicates:** All titles are unique
- **Format:** Markdown with structured Title/Text fields

## Quality Checks Performed

1. ✓ All 4 missing macros found and added
2. ✓ All duplicates identified and removed
3. ✓ Sequential numbering verified (MACRO 1 through MACRO 197)
4. ✓ No duplicate titles (verified programmatically)
5. ✓ Patient-facing text only (no staff instructions, dates, or workflow notes)
6. ✓ Multi-paragraph macros captured in full
7. ✓ All macro text extracted verbatim (not summarized or rewritten)
8. ✓ Checked for title-only macros (none found in source document)

## Macro Categories Included

- Akute Portal (lab results, invitations)
- Billing & Payments (subscriptions, cancellations, refunds, insurance)
- Lab Orders (LabCorp, Quest, scheduling, billing)
- Video Visits (scheduling, provider selection, refill requirements)
- Medications & Prescriptions (TRT, HRT, GLP, add-ons)
- Shipping & Orders (tracking, delays, replacements, needles)
- Customer Service (general inquiries, registration, technical issues)
- Promotions & Referrals (credits, affiliate program)
- Medical Information (test types, timing, medications)

## Next Steps

The macro list is now ready for building the matching system. The system should:

1. **Match patient messages to relevant macros** based on semantic meaning
2. **Prioritize by usefulness** (direct answer > actionable guidance > informational > partial fit)
3. **Rank results** by practical value to the patient's inquiry
4. **Support flexible matching** (not just exact keyword matches)

## File Locations

- **Extracted Macros:** `d:\Cursorprojs\Macrofinder\extracted_macros.md`
- **Source Text:** `d:\Cursorprojs\Macrofinder\fountain_workflows.txt`
- **Source Document:** `d:\Cursorprojs\Macrofinder\Fountain Workflows.docx`
- **Project Rules:** `d:\Cursorprojs\Macrofinder\Macro Finder – Project Rules.txt`
