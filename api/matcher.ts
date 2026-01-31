/**
 * Macro Finder - Matching System (TypeScript)
 * Ported from macro_matcher.ps1 for Vercel serverless deployment.
 */

export interface Macro {
  number: number;
  title: string;
  text: string;
}

export interface MacroMatch {
  macro: Macro;
  score: number;
  matchReasons: string[];
}

export interface Intent {
  type: string;
  topics: string[];
  billingCycleQuestion: boolean;
  billingCycleConfusion: boolean;
  replacementScenario: boolean;
  discountQuestion: boolean;
}

// Stop words for keyword extraction
const STOP_WORDS = new Set([
  "i", "me", "my", "we", "our", "you", "your", "he", "him", "his", "she", "her",
  "it", "its", "they", "them", "their", "what", "which", "who", "this", "that",
  "am", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do",
  "does", "did", "a", "an", "the", "and", "but", "or", "if", "because", "as",
  "of", "at", "by", "for", "with", "about", "to", "from", "in", "out", "on",
  "off", "over", "under", "can", "will", "just", "should", "now", "how", "when",
  "where", "why",
]);

// Trigger phrases for intent detection
const PHRASES = {
  BillingCycleQuestion: [
    "charge\\s*date", "next\\s*charge", "next\\s*payment\\s*date", "billing\\s*date", "next\\s*bill",
    "when\\s*(is|will|do)\\s*(my\\s*)?(next\\s*)?(charge|payment|bill)",
    "when\\s*(do\\s*i\\s*)?(get\\s*)?charged", "when\\s*will\\s*i\\s*be\\s*charged",
    "upcoming\\s*charge", "next\\s*billing\\s*cycle", "renewal\\s*date",
    "when\\s*does\\s*my\\s*subscription\\s*charge", "when\\s*is\\s*my\\s*next\\s*billing",
    "my\\s*next\\s*charge", "payment\\s*date", "billing\\s*cycle\\s*date",
    "next\\s*charge\\s*date", "when\\s*am\\s*i\\s*charged", "charge\\s*schedule",
  ].join("|"),

  BillingCycleConfusion: [
    "charged\\s*again", "why\\s*(am\\s*i|was\\s*i|did\\s*you)\\s*(being\\s*)?charged",
    "why\\s*(am\\s*i\\s*)?(being\\s*)?charged", "charged\\s*twice", "double\\s*charged",
    "duplicate\\s*charge", "just\\s*paid", "paid\\s*.*(and\\s*|then\\s*)?(being\\s*)?charged",
    "charged\\s*when\\s*i\\s*already\\s*paid", "unexpected\\s*charge", "extra\\s*charge",
    "second\\s*charge", "charged\\s*twice\\s*in", "why\\s*did\\s*i\\s*get\\s*charged",
    "i\\s*already\\s*paid", "charged\\s*again\\s*today", "another\\s*charge",
    "two\\s*charges", "got\\s*charged\\s*again", "been\\s*charged\\s*again",
    "charged\\s*me\\s*again", "why\\s*was\\s*i\\s*charged", "why\\s*did\\s*you\\s*charge",
    "charged\\s*2\\s*times", "double\\s*charge", "charged\\s*twice\\s*this\\s*month",
    "repeat\\s*charge", "charged\\s*again\\s*after\\s*paying", "paid\\s*recently\\s*.*charged",
  ].join("|"),

  ReplacementScenario: [
    "lost\\s*(my\\s*)?(medication|meds|medicine|order|shipment|package)",
    "replacement", "need\\s*a\\s*replacement", "replace\\s*(my\\s*)?(medication|meds|order)",
    "medication\\s*(was\\s*)?lost", "lost\\s*while\\s*traveling", "stolen\\s*(medication|meds|order)?",
    "missing\\s*medication", "never\\s*received", "didn.t\\s*get\\s*my\\s*order",
    "didnt\\s*get\\s*my\\s*order", "order\\s*lost", "package\\s*lost", "vial\\s*broke",
    "spilled\\s*(my\\s*)?(medication|meds)", "damaged\\s*medication", "process\\s*.*replacement",
    "how\\s*to\\s*get\\s*replacement", "get\\s*a\\s*replacement", "need\\s*replacement",
    "order\\s*never\\s*arrived", "package\\s*never\\s*came", "medication\\s*missing",
    "meds\\s*lost", "processing\\s*replacement", "replace\\s*my\\s*order",
    "lost\\s*my\\s*shipment", "shipment\\s*lost", "never\\s*got\\s*my\\s*order",
  ].join("|"),

  DiscountQuestion: [
    "discount", "discounts", "offer\\s*any\\s*discount", "any\\s*discounts",
    "do\\s*you\\s*have\\s*discounts", "promo", "promotion", "promo\\s*code",
    "coupon", "veteran\\s*discount", "military\\s*discount", "student\\s*discount",
    "cheaper", "lower\\s*price", "negotiate", "price\\s*match",
    "competitor\\s*(is\\s*)?cheaper", "less\\s*expensive", "reduce\\s*price",
    "any\\s*deals", "special\\s*offer", "offer\\s*code", "referral\\s*code",
    "do\\s*you\\s*offer\\s*discounts", "discount\\s*available", "price\\s*reduction",
    "can\\s*you\\s*discount", "any\\s*promotions", "promotional\\s*code",
  ].join("|"),

  Cancellation: [
    "cancel", "cancellation", "cancel\\s*my\\s*subscription", "cancel\\s*my\\s*plan",
    "stop\\s*my\\s*subscription", "end\\s*my\\s*subscription", "want\\s*to\\s*cancel",
    "need\\s*to\\s*cancel", "how\\s*do\\s*i\\s*cancel", "discontinue", "opt\\s*out",
    "unsubscribe", "stop\\s*treatment", "end\\s*my\\s*plan", "cancel\\s*subscription",
    "stop\\s*service", "end\\s*service", "no\\s*longer\\s*want", "quit\\s*subscription",
  ].join("|"),

  Labs: [
    "lab\\s*results", "see\\s*my\\s*results", "blood\\s*work", "bloodwork", "test\\s*results",
    "when\\s*will\\s*i\\s*get\\s*my\\s*results", "access\\s*my\\s*labs", "view\\s*my\\s*labs",
    "my\\s*lab\\s*results", "get\\s*my\\s*results", "lab\\s*work", "blood\\s*test",
    "lab\\s*test", "labs", "results", "see\\s*results", "lab\\s*draw",
  ].join("|"),

  Orders: [
    "when\\s*will\\s*(it|my\\s*order)\\s*ship", "shipping\\s*date", "track\\s*my\\s*order",
    "delivery", "where\\s*is\\s*my\\s*order", "order\\s*status", "when\\s*will\\s*i\\s*receive",
    "ship\\s*date", "when\\s*does\\s*it\\s*ship", "order\\s*shipped", "tracking",
    "my\\s*package", "my\\s*shipment", "order", "shipment", "shipping", "package",
    "delivery\\s*date", "when\\s*will\\s*my\\s*order\\s*arrive", "order\\s*delivery",
  ].join("|"),

  VideoVisit: [
    "schedule\\s*appointment", "book\\s*a\\s*visit", "see\\s*a\\s*provider", "see\\s*a\\s*doctor",
    "video\\s*call", "when\\s*can\\s*i\\s*see", "next\\s*available", "schedule\\s*a\\s*visit",
    "book\\s*appointment", "need\\s*an\\s*appointment", "when\\s*can\\s*i\\s*get\\s*an\\s*appointment",
    "speak\\s*to\\s*a\\s*provider", "talk\\s*to\\s*a\\s*doctor", "video\\s*visit", "telehealth",
    "appointment", "visit", "schedule", "provider", "doctor", "consultation",
    "need\\s*to\\s*schedule", "book\\s*visit", "see\\s*provider", "see\\s*doctor",
  ].join("|"),

  Medication: [
    "medication", "meds", "medicine", "prescription", "refill", "dose", "dosage",
    "when\\s*is\\s*my\\s*next\\s*refill", "refill\\s*date", "need\\s*a\\s*refill",
    "out\\s*of\\s*medication", "running\\s*low", "running\\s*out\\s*of", "rx\\s*refill",
  ].join("|"),

  Billing: [
    "refund", "charge", "bill", "invoice", "payment", "paid", "cost", "price",
    "get\\s*my\\s*money\\s*back", "reimburse", "receipt", "charged", "billing",
    "payment\\s*method", "card\\s*on\\s*file", "update\\s*payment",
  ].join("|"),

  Pricing: [
    "how\\s*much", "pricing", "expensive", "how\\s*much\\s*does\\s*it\\s*cost",
    "what\\s*is\\s*the\\s*cost", "what\\s*do\\s*you\\s*charge", "fee", "price\\s*for",
    "cost\\s*of", "how\\s*much\\s*is", "what\\s*does\\s*it\\s*cost",
  ].join("|"),

  Registration: [
    "sign\\s*up", "register", "start", "begin", "join", "enroll", "get\\s*started",
    "new\\s*patient", "signup", "registration", "sign\\s*up", "ready\\s*to\\s*start",
  ].join("|"),
};

function isTitleOnly(macro: Macro): boolean {
  const t = macro.text.trim();
  return t === "" || t === "[Title only]";
}

function getKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  return words.filter((w) => !STOP_WORDS.has(w));
}

function testRegex(pattern: string, text: string): boolean {
  try {
    return new RegExp(pattern, "i").test(text);
  } catch {
    return false;
  }
}

function getIntent(message: string): Intent {
  const msgLower = message.toLowerCase().replace(/\s+/g, " ");
  const intent: Intent = {
    type: "general",
    topics: [],
    billingCycleQuestion: false,
    billingCycleConfusion: false,
    replacementScenario: false,
    discountQuestion: false,
  };

  // Scenario detection
  if (testRegex(PHRASES.BillingCycleQuestion, msgLower)) intent.billingCycleQuestion = true;
  if (testRegex(PHRASES.BillingCycleConfusion, msgLower)) intent.billingCycleConfusion = true;
  if (testRegex(PHRASES.ReplacementScenario, msgLower)) intent.replacementScenario = true;
  if (testRegex(PHRASES.DiscountQuestion, msgLower)) intent.discountQuestion = true;

  // Intent type (specific before general)
  if (testRegex(PHRASES.Cancellation, msgLower)) {
    intent.type = "cancellation";
  } else if (intent.discountQuestion) {
    intent.type = "discount";
  } else if (intent.replacementScenario && testRegex(PHRASES.Medication, msgLower)) {
    intent.type = "replacement";
  } else if (intent.replacementScenario) {
    intent.type = "replacement";
  } else if (testRegex(PHRASES.Billing, msgLower)) {
    intent.type = "billing";
  } else if (testRegex(PHRASES.Labs, msgLower)) {
    intent.type = "labs";
  } else if (testRegex(PHRASES.Orders, msgLower)) {
    intent.type = "orders";
  } else if (testRegex(PHRASES.VideoVisit, msgLower)) {
    intent.type = "video_visit";
  } else if (testRegex(PHRASES.Medication, msgLower)) {
    intent.type = "medication";
  } else if (testRegex(PHRASES.Registration, msgLower)) {
    intent.type = "registration";
  } else if (testRegex(PHRASES.Pricing, msgLower)) {
    intent.type = "pricing";
  }

  // Billing scenario reinforcement
  if (/charge|paid|subscription|billing|payment/i.test(msgLower)) {
    if (/again|why|duplicate|twice|just\s*paid|double|second\s*charge|unexpected\s*charge/i.test(msgLower)) {
      intent.billingCycleConfusion = true;
    }
    if (/next\s*charge|charge\s*date|when\s*.*charge|next\s*payment|billing\s*date|renewal/i.test(msgLower)) {
      intent.billingCycleQuestion = true;
    }
  }

  // Topics
  if (/labcorp|lab\s*corp/i.test(msgLower)) intent.topics.push("labcorp");
  if (/quest/i.test(msgLower)) intent.topics.push("quest");
  if (/trt|testosterone/i.test(msgLower)) intent.topics.push("trt");
  if (/hrt|hormone/i.test(msgLower)) intent.topics.push("hrt");
  if (/glp|weight\s*loss|semaglutide|tirzepatide/i.test(msgLower)) intent.topics.push("glp");
  if (/insurance/i.test(msgLower)) intent.topics.push("insurance");
  if (/needle|syringe/i.test(msgLower)) intent.topics.push("needles");
  if (/travel|traveling|travelling/i.test(msgLower)) intent.topics.push("travel");

  return intent;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRelevanceScore(patientMessage: string, macro: Macro): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const msgClean = patientMessage.toLowerCase().replace(/\s+/g, " ");
  const titleClean = macro.title.toLowerCase();
  const textClean = !isTitleOnly(macro) ? macro.text.toLowerCase() : "";

  const intent = getIntent(msgClean);
  const msgKeywords = getKeywords(msgClean);
  const titleKeywords = getKeywords(titleClean);
  const textKeywords = textClean ? getKeywords(textClean) : [];

  // 1. Intent matching
  const intentType = intent.type;
  if (intentType !== "general") {
    if (titleClean.includes(intentType) || textClean.includes(intentType)) {
      score += 3.0;
      reasons.push(`Intent match: ${intentType}`);
    }

    // Specific intent mappings
    switch (intentType) {
      case "cancellation":
        if (/cancel|subscription/i.test(titleClean)) {
          score += 2.0;
          reasons.push("Cancellation intent");
        }
        break;
      case "billing":
        if (/billing|payment|charge|refund/i.test(titleClean)) {
          score += 2.0;
          reasons.push("Billing intent");
        }
        break;
      case "labs":
        if (/lab|labcorp|quest|blood/i.test(titleClean)) {
          score += 2.0;
          reasons.push("Labs intent");
        }
        break;
      case "orders":
        if (/order|shipping|delivery/i.test(titleClean)) {
          score += 2.0;
          reasons.push("Orders intent");
        }
        break;
      case "video_visit":
        if (/vv|visit|appointment|provider/i.test(titleClean)) {
          score += 2.0;
          reasons.push("Video visit intent");
        }
        break;
      case "medication":
        if (/medication|prescription|refill|dose/i.test(titleClean)) {
          score += 2.0;
          reasons.push("Medication intent");
        }
        break;
      case "pricing":
        if (/pricing|price|cost/i.test(titleClean)) {
          score += 2.0;
          reasons.push("Pricing intent");
        }
        break;
      case "discount":
        if (/discount|promotion|price\s?objection|promo\s?code|veteran/i.test(titleClean)) {
          score += 2.0;
          reasons.push("Discount/promotion intent");
        }
        break;
      case "replacement":
        if (/replacement|processing\s?replacement|order/i.test(titleClean)) {
          score += 2.0;
          reasons.push("Replacement intent");
        }
        break;
    }
  }

  // 1b. Scenario-based boosts
  if (intent.billingCycleQuestion || intent.billingCycleConfusion) {
    if (/charge\s?alignment|charge\s?date|next\s?refill\s?date/i.test(titleClean) ||
        /charge\s?date|next\s?refill|recurring|billing\s?cycle|timing\s?of\s?your\s?payments/i.test(textClean)) {
      score += 4.0;
      reasons.push("Billing cycle / charge date scenario");
    }
    if (/billing/i.test(titleClean) && (/charge|payment|recur/i.test(textClean) || /charge/i.test(titleClean))) {
      score += 1.5;
      reasons.push("Billing macro for charge question");
    }
  }
  if (intent.discountQuestion) {
    if (/no\s?discount|price\s?objection|discount|promo\s?code|veteran/i.test(titleClean)) {
      score += 3.5;
      reasons.push("Discount/promotion scenario");
    }
    if (/payment\s?plan/i.test(titleClean) && /discount/i.test(msgClean)) {
      score += 1.0;
      reasons.push("Payment/discount related");
    }
  }
  if (intent.replacementScenario) {
    if (/processing\s?replacement|replacement/i.test(titleClean)) {
      score += 4.0;
      reasons.push("Replacement scenario (lost order/medication)");
    }
    if (/extra\s?medication|travel/i.test(titleClean) && /travel/i.test(msgClean)) {
      score += 2.5;
      reasons.push("Travel + medication scenario");
    }
  }

  // 1c. Targeted phrase boosts
  if (/receipt/i.test(msgClean) && !/itemized/i.test(msgClean)) {
    if (/receipt/i.test(titleClean)) {
      score += 2.0;
      reasons.push("Receipt request");
    }
  }
  if (/itemized/i.test(msgClean)) {
    if (/itemized/i.test(titleClean)) {
      score += 3.0;
      reasons.push("Itemized receipt request");
    }
  }
  if (/refund/i.test(msgClean)) {
    if (/refund/i.test(titleClean)) {
      score += 2.0;
      reasons.push("Refund request");
    }
  }
  if (/fsa|hsa/i.test(msgClean)) {
    if (/fsa|hsa/i.test(titleClean)) {
      score += 2.5;
      reasons.push("FSA/HSA request");
    }
  }

  // 2. Topic matching
  for (const topic of intent.topics) {
    if (titleClean.includes(topic) || textClean.includes(topic)) {
      score += 1.5;
      reasons.push(`Topic: ${topic}`);
    }
  }

  // 3. Keyword overlap in title
  const titleOverlap = msgKeywords.filter((k) => titleKeywords.includes(k));
  if (titleOverlap.length > 0) {
    score += titleOverlap.length * 1.0;
    reasons.push(`Title keywords: ${titleOverlap.slice(0, 3).join(", ")}`);
  }

  // 4. Keyword overlap in text
  if (!isTitleOnly(macro)) {
    const textOverlap = msgKeywords.filter((k) => textKeywords.includes(k));
    if (textOverlap.length > 0) {
      score += textOverlap.length * 0.5;
      reasons.push(`Text keywords: ${textOverlap.slice(0, 3).join(", ")}`);
    }
  }

  // 5. Direct phrase matching
  const msgWords = msgClean.split(/\s+/);
  for (let i = 0; i < msgWords.length - 1; i++) {
    const phrase = `${msgWords[i]} ${msgWords[i + 1]}`;
    if (phrase.length > 5) {
      const escaped = escapeRegex(phrase);
      if (new RegExp(escaped, "i").test(titleClean)) {
        score += 2.5;
        reasons.push(`Direct phrase: '${phrase}'`);
      }
      if (!isTitleOnly(macro) && new RegExp(escaped, "i").test(textClean)) {
        score += 1.5;
        reasons.push(`Direct phrase in text: '${phrase}'`);
      }
    }
  }

  // 6. Penalty for title-only macros
  if (isTitleOnly(macro)) {
    score *= 0.7;
    reasons.push("Title-only macro (reduced score)");
  }

  return { score, reasons };
}

export function findMacroMatches(patientMessage: string, macros: Macro[], topN = 3): MacroMatch[] {
  if (!patientMessage?.trim()) return [];

  const matches: MacroMatch[] = [];

  for (const macro of macros) {
    const { score, reasons } = getRelevanceScore(patientMessage, macro);
    if (score > 0) {
      matches.push({ macro, score, matchReasons: reasons });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  // Filter by minimum threshold and return top N
  const minScore = 1.0;
  return matches.filter((m) => m.score >= minScore).slice(0, topN);
}

// Clean encoding artifacts
function cleanEncodingArtifacts(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // Multi-byte artifact sequences (UTF-8 double-encoding from Word)
  cleaned = cleaned.replace(/\u00E2\u20AC\u2039/g, ""); // zero-width space artifact
  cleaned = cleaned.replace(/\u00E2\u20AC\u201D/g, "-"); // em dash artifact
  cleaned = cleaned.replace(/\u00E2\u20AC\u201C/g, "-"); // en dash artifact

  // Single char replacements
  cleaned = cleaned.replace(/\u2019/g, "'");
  cleaned = cleaned.replace(/\u2018/g, "'");
  cleaned = cleaned.replace(/\u201C/g, '"');
  cleaned = cleaned.replace(/\u201D/g, '"');
  cleaned = cleaned.replace(/\u2013/g, "-");
  cleaned = cleaned.replace(/\u2014/g, "-");
  cleaned = cleaned.replace(/\u200B/g, "");
  cleaned = cleaned.replace(/\uFFFD/g, "");

  // Control characters
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return cleaned;
}

const TRANSITIONS = ["Additionally, ", "Also, ", "On top of that, ", "Please note that ", ""];

export function getSuggestedResponse(
  patientMessage: string,
  macroMatches: MacroMatch[]
): { suggestedResponse: string; macrosUsed: string[] } {
  const macrosUsed: string[] = [];

  if (!macroMatches || macroMatches.length === 0) {
    return {
      suggestedResponse: "We don't have a standard response for this. A team member will follow up shortly.",
      macrosUsed: [],
    };
  }

  const primary = macroMatches[0];
  const secondary = macroMatches.length > 1 ? macroMatches[1] : null;
  const scoreGap = secondary ? primary.score - secondary.score : 999;

  const getText = (m: Macro): string | null => {
    if (isTitleOnly(m)) return null;
    const t = m.text.trim().replace(/\s+/g, " ");
    return t || null;
  };

  const primaryText = getText(primary.macro);
  const secondaryText = secondary ? getText(secondary.macro) : null;

  // One macro
  if (macroMatches.length === 1) {
    if (!primaryText) {
      return {
        suggestedResponse: "We have a standard response for this - a team member will send you the details shortly.",
        macrosUsed: [`Macro #${primary.macro.number}: ${primary.macro.title}`],
      };
    }
    let response = primaryText;
    if (/Charge Alignment/i.test(primary.macro.title)) {
      response = "Your charge date and next refill date can be confirmed from your account (or we can look them up for you). " +
        response.replace(/^Your charge date is:.*?Please note/is, "Please note");
    }
    response = cleanEncodingArtifacts(response.replace(/\s+/g, " ").trim());
    return {
      suggestedResponse: response,
      macrosUsed: [`Macro #${primary.macro.number}: ${primary.macro.title}`],
    };
  }

  // Two or three macros
  if (!primaryText) {
    return {
      suggestedResponse: "We have a standard response for this - a team member will send you the details shortly.",
      macrosUsed: [`Macro #${primary.macro.number}: ${primary.macro.title}`],
    };
  }

  let combined = primaryText;
  macrosUsed.push(`Macro #${primary.macro.number}: ${primary.macro.title}`);

  const primaryTitleLower = primary.macro.title.toLowerCase();
  const secondaryTitleLower = secondary ? secondary.macro.title.toLowerCase() : "";

  const transition = TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)];

  let addSecondary = false;
  if (secondary && secondaryText && scoreGap < 5) {
    if (/replacement/i.test(primaryTitleLower) && /travel|extra\s*medication/i.test(secondaryTitleLower)) {
      addSecondary = true;
    } else if (/billing|charge/i.test(primaryTitleLower) && /refund/i.test(secondaryTitleLower)) {
      addSecondary = true;
    } else if (/lab|results/i.test(primaryTitleLower) && /processing|time/i.test(secondaryTitleLower)) {
      addSecondary = true;
    } else if (/discount/i.test(primaryTitleLower) && /price|objection/i.test(secondaryTitleLower) && scoreGap < 2) {
      addSecondary = true;
    }
  }

  if (addSecondary && secondaryText) {
    const trimmed = secondaryText.trim();
    combined = combined.trimEnd();
    if (!combined.endsWith(".") && !combined.endsWith("!")) combined += ".";

    const firstSentenceMatch = trimmed.match(/^([^.]*\.)/);
    if (firstSentenceMatch) {
      const firstSentence = firstSentenceMatch[1].trim();
      if (transition === "") {
        combined += " " + firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);
      } else {
        combined += " " + transition + firstSentence;
      }
    } else if (trimmed.length > 0) {
      if (transition === "") {
        combined += " " + trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      } else {
        combined += " " + transition + trimmed;
      }
    }
    macrosUsed.push(`Macro #${secondary!.macro.number}: ${secondary!.macro.title}`);
  }

  // Final light edit for charge alignment
  if (/Your charge date is:/i.test(combined)) {
    combined = "Your charge date and next refill date can be confirmed from your account (or we can look them up for you). " +
      combined.replace(/^Your charge date is:.*?Please note/is, "Please note");
  }

  const suggestedResponse = cleanEncodingArtifacts(combined.replace(/\s+/g, " ").trim());

  return { suggestedResponse, macrosUsed };
}
