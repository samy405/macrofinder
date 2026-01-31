# Macro Matching System - Quick Start Guide

## What This Does

Finds the top 3 most relevant macros to send in response to a patient message.

## How to Use

### Option 1: Run the Test Examples
```powershell
powershell -ExecutionPolicy Bypass -File "macro_matcher.ps1"
```

This will test 8 example patient messages and show you how the system works.

### Option 2: Match Your Own Message

1. Open PowerShell in the Macrofinder directory
2. Run these commands:

```powershell
# Load the matching system
. .\macro_matcher.ps1

# Load all macros (do this once)
$macros = Load-Macros -FilePath "extracted_macros.md"

# Match a patient message
$patientMessage = "I want to cancel my subscription"
$matches = Find-MacroMatches -PatientMessage $patientMessage -Macros $macros -TopN 3

# Display the results
foreach ($match in $matches) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "Macro #$($match.Macro.Number): $($match.Macro.Title)" -ForegroundColor Cyan
    Write-Host "Score: $([math]::Round($match.Score, 2))" -ForegroundColor Yellow
    Write-Host "`nText:" -ForegroundColor White
    Write-Host $match.Macro.Text
    Write-Host "`nReasons:" -ForegroundColor White
    $match.MatchReasons | ForEach-Object { Write-Host "  • $_" }
}
```

## Understanding the Output

### Match Score
- **10+**: Excellent match - very likely to be useful
- **5-10**: Good match - relevant to the question
- **1-5**: Partial match - may be somewhat helpful
- **<1**: Not relevant (filtered out automatically)

### Match Reasons
Shows why each macro was selected:
- **Intent match**: Recognized the type of request (billing, labs, orders, etc.)
- **Topic**: Found specific topics like "labcorp", "trt", "insurance"
- **Keywords**: Words from the patient message found in the macro
- **Direct phrase**: Exact 2-word phrases matched

### Number of Results
- The system returns **1-3 macros** depending on relevance
- If only 1 good match exists, only 1 is returned
- If no relevant macros found, returns empty list

## Example Output

```
Patient Message: "How can I see my lab results?"

RANK #1 - Match Score: 12.0
Macro #43: Labs: Can I use my lab results?
Text: Our medical team requests that all patients get a new set of labs...

Match Reasons:
  • Intent match: labs
  • Labs intent
  • Title keywords: lab, results
  • Direct phrase: 'lab results'
```

## Tips for Best Results

1. **Be specific**: "I need to cancel my TRT subscription" works better than "cancel"
2. **Use natural language**: Write like a patient would actually message
3. **Include context**: Mention specific topics (LabCorp, billing, orders, etc.)
4. **Check all results**: Sometimes the #2 or #3 match is better for the situation

## Common Questions

**Q: Why did it return fewer than 3 macros?**
A: The system only returns macros with a relevance score above 1.0. If fewer than 3 macros are relevant, it won't return irrelevant ones just to reach 3.

**Q: The top result isn't perfect. What do I do?**
A: Check results #2 and #3! The system ranks by usefulness, but you're the expert. Sometimes a slightly lower-scored macro is more appropriate for the specific situation.

**Q: Can I search for a specific macro by title?**
A: Yes! Just include words from the title in your message. Example: "labcorp bill" will find LabCorp billing macros.

**Q: What if no macros match?**
A: The system returns an empty list. This means no existing macro is relevant enough. You may need to craft a custom response.

## Integration Ideas

### For Customer Service Software
```powershell
# When a new patient message arrives:
$matches = Find-MacroMatches -PatientMessage $incomingMessage -Macros $macros -TopN 3

# Show suggestions to the agent
foreach ($match in $matches) {
    # Display as clickable buttons or suggestions
    Show-MacroSuggestion -Title $match.Macro.Title -Text $match.Macro.Text
}
```

### For Auto-Response System
```powershell
# For simple queries, auto-send if confidence is high
$matches = Find-MacroMatches -PatientMessage $message -Macros $macros -TopN 1

if ($matches.Count -gt 0 -and $matches[0].Score -gt 10) {
    # High confidence - send automatic response
    Send-PatientMessage -Text $matches[0].Macro.Text
} else {
    # Escalate to human agent
    Notify-Agent -Message $message
}
```

## Files You Need

- ✅ `extracted_macros.md` - The macro database (197 macros)
- ✅ `macro_matcher.ps1` - The matching system (PowerShell)
- ✅ `macro_matcher.py` - Alternative Python version
- ✅ This guide!

## Support

For questions or issues:
1. Check the test output to see how similar queries perform
2. Review the match reasons to understand the scoring
3. Adjust the minimum score threshold (currently 1.0) if needed

---

**Ready to match macros!** 🚀
