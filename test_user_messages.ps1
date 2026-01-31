# Load the matching system
. .\macro_matcher.ps1

# Load all macros
Write-Host "Loading macros..." -ForegroundColor Cyan
$macros = Load-Macros -FilePath "d:\Cursorprojs\Macrofinder\extracted_macros.md"
Write-Host "Loaded $($macros.Count) macros`n" -ForegroundColor Green

# Test messages
$testMessages = @(
    "When is my next charge date?",
    "Do you offer any discounts?",
    "I lost my medication while traveling. What is the process in getting a replacement?",
    "I just paid my subscription on January 5th. Why am I being charged again today?"
)

# Test each message
for ($i = 0; $i -lt $testMessages.Count; $i++) {
    $message = $testMessages[$i]
    $testNum = $i + 1
    
    Write-Host "`n$('#' * 80)" -ForegroundColor Yellow
    Write-Host "TEST $testNum`: Patient Message" -ForegroundColor Yellow
    Write-Host "$('#' * 80)" -ForegroundColor Yellow
    Write-Host "`n`"$message`"`n" -ForegroundColor White
    
    # Find top 3 matches
    $matches = Find-MacroMatches -PatientMessage $message -Macros $macros -TopN 3
    
    if ($matches) {
        # Generate suggested response
        $suggestedResult = Get-SuggestedResponse -PatientMessage $message -MacroMatches $matches
        
        # Output in requested format: Top 3 macros (title + full text), Suggested response, Macros used
        $formatted = Format-SuggestedResponseOutput -PatientMessage $message -Matches $matches -SuggestedResult $suggestedResult
        Write-Host $formatted -ForegroundColor White
    } else {
        Write-Host "No relevant macros found." -ForegroundColor Red
        Write-Host "`nSUGGESTED RESPONSE (one finalized draft)" -ForegroundColor Cyan
        Write-Host "We don't have a standard response for this. A team member will follow up shortly." -ForegroundColor White
        Write-Host "`nMACROS USED: (none)" -ForegroundColor Cyan
    }
    
    Write-Host "`n"
}

Write-Host "`n$('=' * 80)" -ForegroundColor Cyan
Write-Host "Testing complete!" -ForegroundColor Cyan
Write-Host "$('=' * 80)`n" -ForegroundColor Cyan
