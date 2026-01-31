# Run macro matcher for one message: read JSON from stdin, output JSON to stdout.
# Usage: echo '{"message":"patient message here"}' | powershell -ExecutionPolicy Bypass -File run_matcher.ps1

$ErrorActionPreference = 'Stop'
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

. (Join-Path $scriptDir "macro_matcher.ps1")

$jsonLine = [System.Console]::In.ReadLine()
if ([string]::IsNullOrWhiteSpace($jsonLine)) {
    Write-Error "No input"
    exit 1
}
$obj = $jsonLine | ConvertFrom-Json
$message = $obj.message
if ([string]::IsNullOrWhiteSpace($message)) {
    $message = ""
}

$macrosPath = Join-Path $scriptDir "extracted_macros.md"
$macros = Load-Macros -FilePath $macrosPath
$matchList = Find-MacroMatches -PatientMessage $message -Macros $macros -TopN 3
$suggested = Get-SuggestedResponse -PatientMessage $message -MacroMatches $matchList

$matchesArray = @()
foreach ($m in $matchList) {
    $matchesArray += @{
        macro = @{
            number = $m.Macro.Number
            title = $m.Macro.Title
            text = $m.Macro.Text
        }
        score = $m.Score
        matchReasons = @($m.MatchReasons)
    }
}

$output = @{
    matches = $matchesArray
    suggestedResponse = $suggested.SuggestedResponse
    macrosUsed = @($suggested.MacrosUsed)
}

$output | ConvertTo-Json -Depth 6 -Compress
