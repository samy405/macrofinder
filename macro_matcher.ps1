# Macro Finder - Matching System (PowerShell)
# Matches patient messages to the most relevant macros

class Macro {
    [int]$Number
    [string]$Title
    [string]$Text
    
    Macro([int]$number, [string]$title, [string]$text) {
        $this.Number = $number
        $this.Title = $title
        $this.Text = $text
    }
    
    [bool] IsTitleOnly() {
        return $this.Text.Trim() -in @("", "[Title only]")
    }
}

class MacroMatch {
    [Macro]$Macro
    [double]$Score
    [string[]]$MatchReasons
    
    MacroMatch([Macro]$macro, [double]$score, [string[]]$reasons) {
        $this.Macro = $macro
        $this.Score = $score
        $this.MatchReasons = $reasons
    }
}

function Load-Macros {
    param([string]$FilePath)
    
    $content = Get-Content $FilePath -Raw -Encoding UTF8
    $macros = @()
    
    # Parse macros using regex
    $pattern = '## MACRO (\d+)\s*\*\*Title:\*\* ([^\n]+)\s*\*\*Text:\*\* ([^\n]+(?:\n(?!## MACRO)[^\n]+)*)'
    $matches = [regex]::Matches($content, $pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
    
    foreach ($match in $matches) {
        $number = [int]$match.Groups[1].Value
        $title = $match.Groups[2].Value.Trim()
        $text = $match.Groups[3].Value.Trim()
        
        $macros += [Macro]::new($number, $title, $text)
    }
    
    return $macros
}

function Get-Keywords {
    param([string]$Text)
    
    $stopWords = @(
        'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
        'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who', 'this', 'that',
        'am', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do',
        'does', 'did', 'a', 'an', 'the', 'and', 'but', 'or', 'if', 'because', 'as',
        'of', 'at', 'by', 'for', 'with', 'about', 'to', 'from', 'in', 'out', 'on',
        'off', 'over', 'under', 'can', 'will', 'just', 'should', 'now', 'how', 'when',
        'where', 'why'
    )
    
    $words = [regex]::Matches($Text.ToLower(), '\b[a-z]{3,}\b') | ForEach-Object { $_.Value }
    $keywords = $words | Where-Object { $_ -notin $stopWords }
    
    return $keywords
}

# =============================================================================
# TRIGGER PHRASES - Comprehensive detection (matcher only; macros are never edited)
# =============================================================================
# These patterns match patient wording to surface the right macro. Expand as needed.

$SCRIPT:Phrases = @{
    # When is my next charge? / charge date / billing date
    BillingCycleQuestion = @(
        'charge\s*date', 'next\s*charge', 'next\s*payment\s*date', 'billing\s*date', 'next\s*bill',
        'when\s*(is|will|do)\s*(my\s*)?(next\s*)?(charge|payment|bill)',
        'when\s*(do\s*i\s*)?(get\s*)?charged', 'when\s*will\s*i\s*be\s*charged',
        'upcoming\s*charge', 'next\s*billing\s*cycle', 'renewal\s*date',
        'when\s*does\s*my\s*subscription\s*charge', 'when\s*is\s*my\s*next\s*billing',
        'my\s*next\s*charge', 'payment\s*date', 'billing\s*cycle\s*date',
        'next\s*charge\s*date', 'when\s*am\s*i\s*charged', 'charge\s*schedule'
    ) -join '|'

    # Why am I being charged again? / duplicate / just paid and charged
    BillingCycleConfusion = @(
        'charged\s*again', 'why\s*(am\s*i|was\s*i|did\s*you)\s*(being\s*)?charged',
        'why\s*(am\s*i\s*)?(being\s*)?charged', 'charged\s*twice', 'double\s*charged',
        'duplicate\s*charge', 'just\s*paid', 'paid\s*.*(and\s*|then\s*)?(being\s*)?charged',
        'charged\s*when\s*i\s*already\s*paid', 'unexpected\s*charge', 'extra\s*charge',
        'second\s*charge', 'charged\s*twice\s*in', 'why\s*did\s*i\s*get\s*charged',
        'i\s*already\s*paid', 'charged\s*again\s*today', 'another\s*charge',
        'two\s*charges', 'got\s*charged\s*again', 'been\s*charged\s*again',
        'charged\s*me\s*again', 'why\s*was\s*i\s*charged', 'why\s*did\s*you\s*charge',
        'charged\s*2\s*times', 'double\s*charge', 'charged\s*twice\s*this\s*month',
        'repeat\s*charge', 'charged\s*again\s*after\s*paying', 'paid\s*recently\s*.*charged'
    ) -join '|'

    # Lost medication / replacement / never received / vial broke
    ReplacementScenario = @(
        'lost\s*(my\s*)?(medication|meds|medicine|order|shipment|package)',
        'replacement', 'need\s*a\s*replacement', 'replace\s*(my\s*)?(medication|meds|order)',
        'medication\s*(was\s*)?lost', 'lost\s*while\s*traveling', 'stolen\s*(medication|meds|order)?',
        'missing\s*medication', 'never\s*received', 'didn.t\s*get\s*my\s*order',
        'didnt\s*get\s*my\s*order', 'order\s*lost', 'package\s*lost', 'vial\s*broke',
        'spilled\s*(my\s*)?(medication|meds)', 'damaged\s*medication', 'process\s*.*replacement',
        'how\s*to\s*get\s*replacement', 'get\s*a\s*replacement', 'need\s*replacement',
        'order\s*never\s*arrived', 'package\s*never\s*came', 'medication\s*missing',
        'meds\s*lost', 'processing\s*replacement', 'replace\s*my\s*order',
        'lost\s*my\s*shipment', 'shipment\s*lost', 'never\s*got\s*my\s*order'
    ) -join '|'

    # Discounts / promo codes / veteran / cheaper
    DiscountQuestion = @(
        'discount', 'discounts', 'offer\s*any\s*discount', 'any\s*discounts',
        'do\s*you\s*have\s*discounts', 'promo', 'promotion', 'promo\s*code',
        'coupon', 'veteran\s*discount', 'military\s*discount', 'student\s*discount',
        'cheaper', 'lower\s*price', 'negotiate', 'price\s*match',
        'competitor\s*(is\s*)?cheaper', 'less\s*expensive', 'reduce\s*price',
        'any\s*deals', 'special\s*offer', 'offer\s*code', 'referral\s*code',
        'do\s*you\s*offer\s*discounts', 'discount\s*available', 'price\s*reduction',
        'can\s*you\s*discount', 'any\s*promotions', 'promotional\s*code'
    ) -join '|'

    # Cancellation
    Cancellation = @(
        'cancel', 'cancellation', 'cancel\s*my\s*subscription', 'cancel\s*my\s*plan',
        'stop\s*my\s*subscription', 'end\s*my\s*subscription', 'want\s*to\s*cancel',
        'need\s*to\s*cancel', 'how\s*do\s*i\s*cancel', 'discontinue', 'opt\s*out',
        'unsubscribe', 'stop\s*treatment', 'end\s*my\s*plan', 'cancel\s*subscription',
        'stop\s*service', 'end\s*service', 'no\s*longer\s*want', 'quit\s*subscription'
    ) -join '|'

    # Labs / results
    Labs = @(
        'lab\s*results', 'see\s*my\s*results', 'blood\s*work', 'bloodwork', 'test\s*results',
        'when\s*will\s*i\s*get\s*my\s*results', 'access\s*my\s*labs', 'view\s*my\s*labs',
        'my\s*lab\s*results', 'get\s*my\s*results', 'lab\s*work', 'blood\s*test',
        'lab\s*test', 'labs', 'results', 'see\s*results', 'lab\s*draw'
    ) -join '|'

    # Orders / shipping / delivery
    Orders = @(
        'when\s*will\s*(it|my\s*order)\s*ship', 'shipping\s*date', 'track\s*my\s*order',
        'delivery', 'where\s*is\s*my\s*order', 'order\s*status', 'when\s*will\s*i\s*receive',
        'ship\s*date', 'when\s*does\s*it\s*ship', 'order\s*shipped', 'tracking',
        'my\s*package', 'my\s*shipment', 'order', 'shipment', 'shipping', 'package',
        'delivery\s*date', 'when\s*will\s*my\s*order\s*arrive', 'order\s*delivery'
    ) -join '|'

    # Video visit / appointment / provider
    VideoVisit = @(
        'schedule\s*appointment', 'book\s*a\s*visit', 'see\s*a\s*provider', 'see\s*a\s*doctor',
        'video\s*call', 'when\s*can\s*i\s*see', 'next\s*available', 'schedule\s*a\s*visit',
        'book\s*appointment', 'need\s*an\s*appointment', 'when\s*can\s*i\s*get\s*an\s*appointment',
        'speak\s*to\s*a\s*provider', 'talk\s*to\s*a\s*doctor', 'video\s*visit', 'telehealth',
        'appointment', 'visit', 'schedule', 'provider', 'doctor', 'consultation',
        'need\s*to\s*schedule', 'book\s*visit', 'see\s*provider', 'see\s*doctor'
    ) -join '|'

    # Medication / prescription / refill
    Medication = @(
        'medication', 'meds', 'medicine', 'prescription', 'refill', 'dose', 'dosage',
        'when\s*is\s*my\s*next\s*refill', 'refill\s*date', 'need\s*a\s*refill',
        'out\s*of\s*medication', 'running\s*low', 'running\s*out\s*of', 'rx\s*refill'
    ) -join '|'

    # Billing / payment / refund (generic)
    Billing = @(
        'refund', 'charge', 'bill', 'invoice', 'payment', 'paid', 'cost', 'price',
        'get\s*my\s*money\s*back', 'reimburse', 'receipt', 'charged', 'billing',
        'payment\s*method', 'card\s*on\s*file', 'update\s*payment'
    ) -join '|'

    # Pricing (how much / cost)
    Pricing = @(
        'how\s*much', 'pricing', 'expensive', 'how\s*much\s*does\s*it\s*cost',
        'what\s*is\s*the\s*cost', 'what\s*do\s*you\s*charge', 'fee', 'price\s*for',
        'cost\s*of', 'how\s*much\s*is', 'what\s*does\s*it\s*cost'
    ) -join '|'

    # Registration / get started
    Registration = @(
        'sign\s*up', 'register', 'start', 'begin', 'join', 'enroll', 'get\s*started',
        'new\s*patient', 'signup', 'registration', 'sign\s*up', 'ready\s*to\s*start'
    ) -join '|'
}

function Get-Intent {
    param([string]$Message)
    
    $msgLower = $Message.ToLower() -replace '\s+', ' '
    $intent = @{
        Type = 'general'
        Topics = @()
        Action = $null
        BillingCycleQuestion = $false
        BillingCycleConfusion = $false
        ReplacementScenario = $false
        DiscountQuestion = $false
    }
    
    # --- Scenario detection (checked first; uses comprehensive phrase list) ---
    if ($msgLower -match $SCRIPT:Phrases.BillingCycleQuestion) {
        $intent.BillingCycleQuestion = $true
    }
    if ($msgLower -match $SCRIPT:Phrases.BillingCycleConfusion) {
        $intent.BillingCycleConfusion = $true
    }
    if ($msgLower -match $SCRIPT:Phrases.ReplacementScenario) {
        $intent.ReplacementScenario = $true
    }
    if ($msgLower -match $SCRIPT:Phrases.DiscountQuestion) {
        $intent.DiscountQuestion = $true
    }
    
    # --- Intent type (order matters: specific before general) ---
    if ($msgLower -match $SCRIPT:Phrases.Cancellation) {
        $intent.Type = 'cancellation'
    }
    elseif ($intent.DiscountQuestion) {
        $intent.Type = 'discount'
    }
    elseif ($intent.ReplacementScenario -and $msgLower -match $SCRIPT:Phrases.Medication) {
        $intent.Type = 'replacement'
    }
    elseif ($intent.ReplacementScenario) {
        $intent.Type = 'replacement'
    }
    elseif ($msgLower -match $SCRIPT:Phrases.Billing) {
        $intent.Type = 'billing'
    }
    elseif ($msgLower -match $SCRIPT:Phrases.Labs) {
        $intent.Type = 'labs'
    }
    elseif ($msgLower -match $SCRIPT:Phrases.Orders) {
        $intent.Type = 'orders'
    }
    elseif ($msgLower -match $SCRIPT:Phrases.VideoVisit) {
        $intent.Type = 'video_visit'
    }
    elseif ($msgLower -match $SCRIPT:Phrases.Medication) {
        $intent.Type = 'medication'
    }
    elseif ($msgLower -match $SCRIPT:Phrases.Registration) {
        $intent.Type = 'registration'
    }
    elseif ($msgLower -match $SCRIPT:Phrases.Pricing) {
        $intent.Type = 'pricing'
    }
    
    # --- Billing scenario reinforcement (charge/paid + confusion wording) ---
    if ($msgLower -match 'charge|paid|subscription|billing|payment') {
        if ($msgLower -match 'again|why|duplicate|twice|just\s*paid|double|second\s*charge|unexpected\s*charge') {
            $intent.BillingCycleConfusion = $true
        }
        if ($msgLower -match 'next\s*charge|charge\s*date|when\s*.*charge|next\s*payment|billing\s*date|renewal') {
            $intent.BillingCycleQuestion = $true
        }
    }
    
    # --- Topics ---
    if ($msgLower -match 'labcorp|lab\s*corp') { $intent.Topics += 'labcorp' }
    if ($msgLower -match 'quest') { $intent.Topics += 'quest' }
    if ($msgLower -match 'trt|testosterone') { $intent.Topics += 'trt' }
    if ($msgLower -match 'hrt|hormone') { $intent.Topics += 'hrt' }
    if ($msgLower -match 'glp|weight\s*loss|semaglutide|tirzepatide') { $intent.Topics += 'glp' }
    if ($msgLower -match 'insurance') { $intent.Topics += 'insurance' }
    if ($msgLower -match 'needle|syringe') { $intent.Topics += 'needles' }
    if ($msgLower -match 'travel|traveling|travelling') { $intent.Topics += 'travel' }
    
    return $intent
}

function Get-RelevanceScore {
    param(
        [string]$PatientMessage,
        [Macro]$Macro
    )
    
    $score = 0.0
    $reasons = @()
    
    $msgClean = $PatientMessage.ToLower() -replace '\s+', ' '
    $titleClean = $Macro.Title.ToLower()
    $textClean = if (!$Macro.IsTitleOnly()) { $Macro.Text.ToLower() } else { "" }
    
    # Get intent and keywords
    $intent = Get-Intent $msgClean
    $msgKeywords = Get-Keywords $msgClean
    $titleKeywords = Get-Keywords $titleClean
    $textKeywords = if ($textClean) { Get-Keywords $textClean } else { @() }
    
    # 1. Intent matching (highest weight)
    $intentType = $intent.Type
    if ($intentType -ne 'general') {
        if ($titleClean -match $intentType -or $textClean -match $intentType) {
            $score += 3.0
            $reasons += "Intent match: $intentType"
        }
        
        # Specific intent mappings
        switch ($intentType) {
            'cancellation' {
                if ($titleClean -match 'cancel|subscription') {
                    $score += 2.0
                    $reasons += "Cancellation intent"
                }
            }
            'billing' {
                if ($titleClean -match 'billing|payment|charge|refund') {
                    $score += 2.0
                    $reasons += "Billing intent"
                }
            }
            'labs' {
                if ($titleClean -match 'lab|labcorp|quest|blood') {
                    $score += 2.0
                    $reasons += "Labs intent"
                }
            }
            'orders' {
                if ($titleClean -match 'order|shipping|delivery') {
                    $score += 2.0
                    $reasons += "Orders intent"
                }
            }
            'video_visit' {
                if ($titleClean -match 'vv|visit|appointment|provider') {
                    $score += 2.0
                    $reasons += "Video visit intent"
                }
            }
            'medication' {
                if ($titleClean -match 'medication|prescription|refill|dose') {
                    $score += 2.0
                    $reasons += "Medication intent"
                }
            }
            'pricing' {
                if ($titleClean -match 'pricing|price|cost') {
                    $score += 2.0
                    $reasons += "Pricing intent"
                }
            }
            'discount' {
                if ($titleClean -match 'discount|promotion|price\s?objection|promo\s?code|veteran') {
                    $score += 2.0
                    $reasons += "Discount/promotion intent"
                }
            }
            'replacement' {
                if ($titleClean -match 'replacement|processing\s?replacement|order') {
                    $score += 2.0
                    $reasons += "Replacement intent"
                }
            }
        }
    }
    
    # 1b. Scenario-based boosts (complex billing, replacement, discount)
    if ($intent.BillingCycleQuestion -or $intent.BillingCycleConfusion) {
        if ($titleClean -match 'charge\s?alignment|charge\s?date|next\s?refill\s?date' -or $textClean -match 'charge\s?date|next\s?refill|recurring|billing\s?cycle|timing\s?of\s?your\s?payments') {
            $score += 4.0
            $reasons += "Billing cycle / charge date scenario"
        }
        if ($titleClean -match 'billing' -and ($textClean -match 'charge|payment|recur' -or $titleClean -match 'charge')) {
            $score += 1.5
            $reasons += "Billing macro for charge question"
        }
    }
    if ($intent.DiscountQuestion) {
        if ($titleClean -match 'no\s?discount|price\s?objection|discount|promo\s?code|veteran') {
            $score += 3.5
            $reasons += "Discount/promotion scenario"
        }
        if ($titleClean -match 'payment\s?plan' -and $msgClean -match 'discount') {
            $score += 1.0
            $reasons += "Payment/discount related"
        }
    }
    if ($intent.ReplacementScenario) {
        if ($titleClean -match 'processing\s?replacement|replacement') {
            $score += 4.0
            $reasons += "Replacement scenario (lost order/medication)"
        }
        if ($titleClean -match 'extra\s?medication|travel' -and $msgClean -match 'travel') {
            $score += 2.5
            $reasons += "Travel + medication scenario"
        }
    }
    
    # 1c. Targeted phrase boosts (receipt, refund, itemized, FSA/HSA) - matcher logic only
    if ($msgClean -match 'receipt' -and $msgClean -notmatch 'itemized') {
        if ($titleClean -match 'receipt') {
            $score += 2.0
            $reasons += "Receipt request"
        }
    }
    if ($msgClean -match 'itemized') {
        if ($titleClean -match 'itemized') {
            $score += 3.0
            $reasons += "Itemized receipt request"
        }
    }
    if ($msgClean -match 'refund') {
        if ($titleClean -match 'refund') {
            $score += 2.0
            $reasons += "Refund request"
        }
    }
    if ($msgClean -match 'fsa|hsa') {
        if ($titleClean -match 'fsa|hsa') {
            $score += 2.5
            $reasons += "FSA/HSA request"
        }
    }
    
    # 2. Topic matching
    foreach ($topic in $intent.Topics) {
        if ($titleClean -match $topic -or $textClean -match $topic) {
            $score += 1.5
            $reasons += "Topic: $topic"
        }
    }
    
    # 3. Keyword overlap in title
    $titleOverlap = $msgKeywords | Where-Object { $_ -in $titleKeywords }
    if ($titleOverlap) {
        $overlapScore = ($titleOverlap | Measure-Object).Count * 1.0
        $score += $overlapScore
        $topKeywords = $titleOverlap | Select-Object -First 3
        $reasons += "Title keywords: $($topKeywords -join ', ')"
    }
    
    # 4. Keyword overlap in text
    if (!$Macro.IsTitleOnly()) {
        $textOverlap = $msgKeywords | Where-Object { $_ -in $textKeywords }
        if ($textOverlap) {
            $overlapScore = ($textOverlap | Measure-Object).Count * 0.5
            $score += $overlapScore
            $topKeywords = $textOverlap | Select-Object -First 3
            $reasons += "Text keywords: $($topKeywords -join ', ')"
        }
    }
    
    # 5. Direct phrase matching
    $msgWords = $msgClean -split '\s+'
    for ($i = 0; $i -lt ($msgWords.Count - 1); $i++) {
        $phrase = "$($msgWords[$i]) $($msgWords[$i+1])"
        if ($phrase.Length -gt 5) {
            if ($titleClean -match [regex]::Escape($phrase)) {
                $score += 2.5
                $reasons += "Direct phrase: '$phrase'"
            }
            if (!$Macro.IsTitleOnly() -and $textClean -match [regex]::Escape($phrase)) {
                $score += 1.5
                $reasons += "Direct phrase in text: '$phrase'"
            }
        }
    }
    
    # 6. Penalty for title-only macros
    if ($Macro.IsTitleOnly()) {
        $score *= 0.7
        $reasons += "Title-only macro (reduced score)"
    }
    
    return @{
        Score = $score
        Reasons = $reasons
    }
}

function Find-MacroMatches {
    param(
        [string]$PatientMessage,
        [Macro[]]$Macros,
        [int]$TopN = 3
    )
    
    if ([string]::IsNullOrWhiteSpace($PatientMessage)) {
        return @()
    }
    
    $matches = @()
    
    foreach ($macro in $Macros) {
        $result = Get-RelevanceScore -PatientMessage $PatientMessage -Macro $macro
        
        if ($result.Score -gt 0) {
            $matches += [MacroMatch]::new($macro, $result.Score, $result.Reasons)
        }
    }
    
    # Sort by score descending
    $matches = $matches | Sort-Object -Property Score -Descending
    
    # Filter by minimum threshold
    $minScore = 1.0
    $relevantMatches = $matches | Where-Object { $_.Score -ge $minScore }
    
    # Return top N
    return $relevantMatches | Select-Object -First $TopN
}

function Format-MatchResult {
    param(
        [MacroMatch]$Match,
        [int]$Rank
    )
    
    $output = "`n" + ("=" * 80)
    $output += "`nRANK #$Rank - Match Score: $([math]::Round($Match.Score, 2))"
    $output += "`n" + ("=" * 80)
    $output += "`n`nMACRO #$($Match.Macro.Number)"
    $output += "`nTitle: $($Match.Macro.Title)"
    $output += "`n`nMacro Text:"
    $output += "`n" + ("-" * 80)
    
    if ($Match.Macro.IsTitleOnly()) {
        $output += "`n[Title only - no text available]"
    } else {
        $output += "`n$($Match.Macro.Text)"
    }
    
    $output += "`n" + ("-" * 80)
    
    if ($Match.MatchReasons) {
        $output += "`n`nMatch Reasons:"
        foreach ($reason in $Match.MatchReasons) {
            $output += "`n  • $reason"
        }
    }
    
    return $output
}

# =============================================================================
# SUGGESTED RESPONSE GENERATOR
# Produces a single natural draft from top macros (matcher only; macros not edited)
# =============================================================================

# Helper: Clean encoding artifacts from text for professional output
function Clean-EncodingArtifacts {
    param([string]$Text)
    
    if ([string]::IsNullOrWhiteSpace($Text)) { return $Text }
    
    $cleaned = $Text
    
    # IMPORTANT: Do multi-byte artifact replacements FIRST before single-char replacements
    # Otherwise single-char replacements will break the multi-char patterns
    
    # Remove multi-byte encoding artifact sequences from Word documents
    # â€‹ = zero-width space artifact (appears as 3 chars: â + € + ‹)
    $cleaned = $cleaned.Replace(([char]0x00E2 + [char]0x20AC + [char]0x2039), '')
    # â€" = em dash artifact (appears as 3 chars: â + € + ")
    $cleaned = $cleaned.Replace(([char]0x00E2 + [char]0x20AC + [char]0x201D), '-')
    # â€" = en dash artifact (appears as 3 chars: â + € + ")  
    $cleaned = $cleaned.Replace(([char]0x00E2 + [char]0x20AC + [char]0x201C), '-')
    
    # Now replace single UTF-8 encoding artifacts (character-to-character or character-to-string)
    $cleaned = $cleaned.Replace([char]0x2019, "'")  # Right single quotation mark
    $cleaned = $cleaned.Replace([char]0x2018, "'")  # Left single quotation mark
    $cleaned = $cleaned.Replace([char]0x201C, '"')  # Left double quotation mark
    $cleaned = $cleaned.Replace([char]0x201D, '"')  # Right double quotation mark
    $cleaned = $cleaned.Replace([char]0x2013, '-')  # En dash
    $cleaned = $cleaned.Replace([char]0x2014, '-')  # Em dash
    $cleaned = $cleaned.Replace([string][char]0x200B, '')   # Zero-width space (cast to string for empty replacement)
    $cleaned = $cleaned.Replace([string][char]0xFFFD, '')   # Replacement character (cast to string for empty replacement)
    
    # Clean up any remaining unusual whitespace or control characters
    $cleaned = $cleaned -replace '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', ''
    
    return $cleaned
}

function Get-SuggestedResponse {
    param(
        [string]$PatientMessage,
        [MacroMatch[]]$MacroMatches
    )
    
    $macrosUsed = @()
    $suggestedResponse = ""
    
    if (-not $MacroMatches -or $MacroMatches.Count -eq 0) {
        $suggestedResponse = "We don't have a standard response for this. A team member will follow up shortly."
        return @{ SuggestedResponse = $suggestedResponse; MacrosUsed = @() }
    }
    
    $primary = $MacroMatches[0]
    $secondary = if ($MacroMatches.Count -gt 1) { $MacroMatches[1] } else { $null }
    $tertiary = if ($MacroMatches.Count -gt 2) { $MacroMatches[2] } else { $null }
    
    $scoreGap = if ($secondary) { $primary.Score - $secondary.Score } else { 999 }
    
    # Helper: get usable macro text (or placeholder for title-only)
    $getText = {
        param([Macro]$m)
        if ($m.IsTitleOnly()) { return $null }
        $t = $m.Text.Trim() -replace '\s+', ' '
        if ([string]::IsNullOrWhiteSpace($t)) { return $null }
        return $t
    }
    
    $primaryText = & $getText $primary.Macro
    $secondaryText = if ($secondary) { & $getText $secondary.Macro } else { $null }
    
    # --- One macro: use as-is with light edits ---
    if ($MacroMatches.Count -eq 1) {
        if (-not $primaryText) {
            $suggestedResponse = "We have a standard response for this - a team member will send you the details shortly."
        } else {
            $suggestedResponse = $primaryText
            # Light flow edits: fix Charge Alignment placeholder line (staff fills dates from sidebar)
            if ($primary.Macro.Title -match 'Charge Alignment') {
                $suggestedResponse = "Your charge date and next refill date can be confirmed from your account (or we can look them up for you). " + ($suggestedResponse -replace '(?s)^Your charge date is:.*?Please note', 'Please note')
            }
            $suggestedResponse = (($suggestedResponse -replace '\s+', ' ').Trim())
            $suggestedResponse = Clean-EncodingArtifacts $suggestedResponse
        }
        $macrosUsed = @("Macro #$($primary.Macro.Number): $($primary.Macro.Title)")
        return @{ SuggestedResponse = $suggestedResponse; MacrosUsed = $macrosUsed }
    }
    
    # --- Two or three macros: use primary; add secondary/tertiary only when they add distinct value ---
    if (-not $primaryText) {
        $suggestedResponse = "We have a standard response for this - a team member will send you the details shortly."
        $macrosUsed = @("Macro #$($primary.Macro.Number): $($primary.Macro.Title)")
        return @{ SuggestedResponse = $suggestedResponse; MacrosUsed = $macrosUsed }
    }
    
    $combined = $primaryText
    $macrosUsed = @("Macro #$($primary.Macro.Number): $($primary.Macro.Title)")
    
    # Add secondary only if it adds distinct value (different topic or complementary info)
    $primaryTitleLower = $primary.Macro.Title.ToLower()
    $secondaryTitleLower = if ($secondary) { $secondary.Macro.Title.ToLower() } else { "" }
    
    # Transition phrases for variety (rotate through these instead of always "Additionally")
    $transitions = @(
        "Additionally, ",
        "Also, ",
        "On top of that, ",
        "Please note that ",
        ""  # empty = new sentence without connector
    )
    $transitionIndex = (Get-Random -Minimum 0 -Maximum $transitions.Count)
    $transition = $transitions[$transitionIndex]
    
    $addSecondary = $false
    if ($secondary -and $secondaryText -and $scoreGap -lt 5) {
        # Replacement + travel: combine
        if ($primaryTitleLower -match 'replacement' -and $secondaryTitleLower -match 'travel|extra\s*medication') {
            $addSecondary = $true
        }
        # Billing + refund: combine
        elseif ($primaryTitleLower -match 'billing|charge' -and $secondaryTitleLower -match 'refund') {
            $addSecondary = $true
        }
        # Labs + processing time: combine
        elseif ($primaryTitleLower -match 'lab|results' -and $secondaryTitleLower -match 'processing|time') {
            $addSecondary = $true
        }
        # Discount + price objection: primary usually enough; only add if very close scores
        elseif ($primaryTitleLower -match 'discount' -and $secondaryTitleLower -match 'price|objection' -and $scoreGap -lt 2) {
            $addSecondary = $true
        }
    }
    
    if ($addSecondary -and $secondaryText) {
        $trimmedSecondary = $secondaryText.Trim()
        $combined = $primaryText.TrimEnd()
        if (-not $combined.EndsWith('.') -and -not $combined.EndsWith('!')) { $combined += '.' }
        
        if ($trimmedSecondary -match '^([^.]*\.)') {
            $firstSentence = $matches[1].Trim()
            # If using empty transition (new sentence), capitalize first word
            if ($transition -eq "") {
                $combined += " " + $firstSentence.Substring(0,1).ToUpper() + $firstSentence.Substring(1)
            } else {
                $combined += " " + $transition + $firstSentence
            }
        } elseif ($trimmedSecondary.Length -gt 0) {
            # If using empty transition (new sentence), capitalize first word
            if ($transition -eq "") {
                $combined += " " + $trimmedSecondary.Substring(0,1).ToUpper() + $trimmedSecondary.Substring(1)
            } else {
                $combined += " " + $transition + $trimmedSecondary
            }
        }
        $macrosUsed += "Macro #$($secondary.Macro.Number): $($secondary.Macro.Title)"
    }
    
    # Final light edit for charge alignment placeholder (2-3 macro case)
    if ($combined -match 'Your charge date is:') {
        $combined = "Your charge date and next refill date can be confirmed from your account (or we can look them up for you). " + ($combined -replace '(?s)^Your charge date is:.*?Please note', 'Please note')
    }
    
    $suggestedResponse = (($combined -replace '\s+', ' ').Trim())
    $suggestedResponse = Clean-EncodingArtifacts $suggestedResponse
    
    return @{ SuggestedResponse = $suggestedResponse; MacrosUsed = $macrosUsed }
}

function Format-SuggestedResponseOutput {
    param(
        [string]$PatientMessage,
        [MacroMatch[]]$Matches,
        [hashtable]$SuggestedResult
    )
    
    $out = @()
    $out += ""
    $out += "TOP 3 MATCHING MACROS (title + full text)"
    $out += ("=" * 80)
    
    for ($i = 0; $i -lt $Matches.Count; $i++) {
        $m = $Matches[$i]
        $out += ""
        $out += "--- Macro #$($i+1) ---"
        $out += "Title: $($m.Macro.Title)"
        $out += "Full text:"
        if ($m.Macro.IsTitleOnly()) {
            $out += "[Title only - no text available]"
        } else {
            $out += $m.Macro.Text
        }
        $out += ""
    }
    
    $out += ("=" * 80)
    $out += "SUGGESTED RESPONSE (one finalized draft)"
    $out += ("=" * 80)
    $out += ""
    $out += $SuggestedResult.SuggestedResponse
    $out += ""
    $out += ("=" * 80)
    $out += "MACROS USED (list which macros you relied on most)"
    $out += ("=" * 80)
    foreach ($mu in $SuggestedResult.MacrosUsed) {
        $out += "  • $mu"
    }
    $out += ""
    
    return $out -join "`n"
}

# Main execution (only when script is run directly, not when dot-sourced)
if ($MyInvocation.InvocationName -ne '.') {
Write-Host "Loading macros from extracted_macros.md..." -ForegroundColor Cyan
$macros = Load-Macros -FilePath "d:\Cursorprojs\Macrofinder\extracted_macros.md"
Write-Host "Loaded $($macros.Count) macros`n" -ForegroundColor Green

# Example patient messages
$exampleMessages = @(
    "Hello! How can I see my lab results?",
    "I want to cancel my subscription",
    "When will my order ship?",
    "How much does your TRT program cost?",
    "I need to schedule a video visit with my provider",
    "Can you send my prescription to a local pharmacy?",
    "I received a bill from LabCorp, what should I do?",
    "Do you accept insurance?"
)

# Test each example
for ($i = 0; $i -lt $exampleMessages.Count; $i++) {
    $message = $exampleMessages[$i]
    $testNum = $i + 1
    
    Write-Host "`n$('#' * 80)" -ForegroundColor Yellow
    Write-Host "TEST $testNum`: Patient Message" -ForegroundColor Yellow
    Write-Host "$('#' * 80)" -ForegroundColor Yellow
    Write-Host "`n`"$message`"`n" -ForegroundColor White
    
    # Find matches
    $matches = Find-MacroMatches -PatientMessage $message -Macros $macros -TopN 3
    
    if ($matches) {
        Write-Host "Found $($matches.Count) relevant macro(s):" -ForegroundColor Green
        for ($rank = 0; $rank -lt $matches.Count; $rank++) {
            $output = Format-MatchResult -Match $matches[$rank] -Rank ($rank + 1)
            Write-Host $output
        }
    } else {
        Write-Host "No relevant macros found." -ForegroundColor Red
    }
    
    Write-Host "`n"
}

Write-Host "`n$('=' * 80)" -ForegroundColor Cyan
Write-Host "Testing complete!" -ForegroundColor Cyan
Write-Host "$('=' * 80)`n" -ForegroundColor Cyan
}
