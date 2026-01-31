/**
 * Macro Finder - Matching System (TypeScript)
 * Ported from macro_matcher.ps1 for Vercel serverless deployment.
 */

export interface Macro {
  number: number;
  title: string;
  text: string;
}

// ===========================================================================
// SYNONYM EXPANSION - Map common variations to canonical terms
// ===========================================================================
const SYNONYMS: Record<string, string[]> = {
  "medication": ["meds", "medicine", "rx", "prescription", "drug", "drugs"],
  "cancel": ["cancle", "cancell", "canel", "stop", "end", "discontinue", "unsubscribe"],
  "refund": ["refnd", "money back", "reimburse", "reimbursement"],
  "discount": ["discounts", "disount", "diccount", "promo", "promotion", "coupon", "deal"],
  "insurance": ["insurence", "insurnace", "insuranse"],
  "shipping": ["shiping", "shippng", "delivery", "deliver"],
  "appointment": ["apointment", "appointmnt", "visit", "consultation"],
  "prescription": ["perscription", "presciption", "rx", "script"],
  "testosterone": ["testosteron", "testerone", "test", "trt"],
  "subscription": ["subcription", "subscribtion", "membership", "plan"],
  "receipt": ["reciept", "recipt", "invoice"],
  "refill": ["refil", "reffill", "reorder"],
  "charge": ["chrge", "chrage", "payment", "bill"],
  "schedule": ["schedual", "scedule", "book", "set up"],
  "results": ["resutls", "resluts", "report"],
  "doctor": ["doc", "provider", "physician", "dr"],
  "syringe": ["syringes", "needles", "needle"],
};

// ===========================================================================
// COMMON TYPOS - Direct typo corrections
// ===========================================================================
const TYPO_CORRECTIONS: Record<string, string> = {
  "cancle": "cancel",
  "cancell": "cancel",
  "canel": "cancel",
  "discout": "discount",
  "diccount": "discount",
  "disount": "discount",
  "insurence": "insurance",
  "insurnace": "insurance",
  "insuranse": "insurance",
  "shiping": "shipping",
  "shippng": "shipping",
  "delivary": "delivery",
  "apointment": "appointment",
  "appointmnt": "appointment",
  "perscription": "prescription",
  "presciption": "prescription",
  "testosteron": "testosterone",
  "testerone": "testosterone",
  "subcription": "subscription",
  "subscribtion": "subscription",
  "reciept": "receipt",
  "recipt": "receipt",
  "refil": "refill",
  "reffill": "refill",
  "chrge": "charge",
  "chrage": "charge",
  "schedual": "schedule",
  "scedule": "schedule",
  "resutls": "results",
  "resluts": "results",
  "labratory": "laboratory",
  "labrotory": "laboratory",
  "medicaton": "medication",
  "medicatin": "medication",
};

/**
 * Expand message with synonyms and fix typos
 */
function expandMessage(message: string): string {
  let expanded = message.toLowerCase();
  
  // Fix typos
  for (const [typo, correction] of Object.entries(TYPO_CORRECTIONS)) {
    expanded = expanded.replace(new RegExp(`\\b${typo}\\b`, "gi"), correction);
  }
  
  return expanded;
}

/**
 * Detect negation in message
 */
function detectNegation(message: string): { hasNegation: boolean; negatedTerms: string[] } {
  const negatedTerms: string[] = [];
  const negationPatterns = [
    /don'?t\s+(?:want\s+to\s+)?(\w+)/gi,
    /do\s+not\s+(?:want\s+to\s+)?(\w+)/gi,
    /not\s+(?:trying\s+to\s+|looking\s+to\s+|wanting\s+to\s+)?(\w+)/gi,
    /no\s+(\w+)/gi,
    /without\s+(\w+)/gi,
    /never\s+(\w+)/gi,
  ];
  
  for (const pattern of negationPatterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      negatedTerms.push(match[1].toLowerCase());
    }
  }
  
  return {
    hasNegation: negatedTerms.length > 0,
    negatedTerms,
  };
}

/**
 * Detect multiple intents in a single message
 */
function detectMultipleIntents(message: string): string[] {
  const intents: string[] = [];
  const msgLower = message.toLowerCase();
  
  // Check for multiple questions
  if (/charge|billing|payment/i.test(msgLower) && !/cancel|insurance|discount/i.test(msgLower)) {
    intents.push("billing");
  }
  if (/cancel/i.test(msgLower)) {
    intents.push("cancellation");
  }
  if (/discount|promo|cheaper/i.test(msgLower)) {
    intents.push("discount");
  }
  if (/insurance/i.test(msgLower)) {
    intents.push("insurance");
  }
  if (/refund/i.test(msgLower)) {
    intents.push("refund");
  }
  if (/ship|deliver/i.test(msgLower)) {
    intents.push("shipping");
  }
  if (/lab|results|blood/i.test(msgLower)) {
    intents.push("labs");
  }
  if (/schedule|appointment|visit/i.test(msgLower)) {
    intents.push("scheduling");
  }
  if (/refill/i.test(msgLower)) {
    intents.push("refill");
  }
  
  return intents;
}

/**
 * Detect placeholders in text that need to be filled
 */
export function detectPlaceholders(text: string): string[] {
  const placeholders: string[] = [];
  
  // Common placeholder patterns
  const patterns = [
    /\[insert[^\]]*\]/gi,
    /\[your[^\]]*\]/gi,
    /\[patient[^\]]*\]/gi,
    /:\s*$/gm,  // Lines ending with colon (unfilled field)
    /_+/g,  // Underscores as blanks
    /\{[^}]+\}/g,  // {placeholder}
    /\$\d+/g,  // $50 amounts that might need updating
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      placeholders.push(...matches);
    }
  }
  
  return [...new Set(placeholders)];
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

  // Expand message with typo corrections and synonyms
  const msgClean = expandMessage(patientMessage.toLowerCase().replace(/\s+/g, " "));
  const titleClean = macro.title.toLowerCase();
  const textClean = !isTitleOnly(macro) ? macro.text.toLowerCase() : "";
  const fullContent = titleClean + " " + textClean;

  // Detect negation
  const { hasNegation, negatedTerms } = detectNegation(patientMessage);
  
  const intent = getIntent(msgClean);
  const msgKeywords = getKeywords(msgClean);
  const titleKeywords = getKeywords(titleClean);
  const textKeywords = textClean ? getKeywords(textClean) : [];

  // ===========================================================================
  // SCENARIO DETECTION (what is the user asking about?)
  // ===========================================================================
  const asksAboutCharge = /charge\s*date|next\s*charge|when\s*.*charge|billing\s*date|when\s*am\s*i\s*charged/i.test(msgClean);
  const asksAboutRefill = /refill\s*date|next\s*refill|when\s*.*refill/i.test(msgClean);
  const asksAboutInsurance = /insurance|do\s*you\s*accept|covered\s*by/i.test(msgClean);
  const asksAboutCancel = /cancel|cancellation|stop\s*my|end\s*my/i.test(msgClean);
  const asksAboutDiscount = intent.discountQuestion;
  const asksAboutReplacement = intent.replacementScenario;
  const asksAboutLabs = /lab|blood\s*work|results|bloodwork/i.test(msgClean);
  const asksAboutLabBill = asksAboutLabs && /bill|charged|invoice/i.test(msgClean);
  const asksAboutTracking = /track|where\s*is|shipping\s*status|order\s*status/i.test(msgClean);
  const asksAboutShipping = /shipping|ship|delivery|deliver|how\s*long.*ship|when.*ship|when.*arrive|when.*deliver/i.test(msgClean);
  const asksAboutShippingDuration = /how\s*long.*ship|shipping\s*time|delivery\s*time|when.*arrive|when.*get.*order/i.test(msgClean);
  const asksAboutNeedles = /needle|syringe|ran\s*out\s*of\s*needles/i.test(msgClean);
  const asksAboutPricing = /how\s*much|pricing|price|cost|fee/i.test(msgClean);
  const asksAboutRefund = /refund|money\s*back|reimburse/i.test(msgClean);
  const asksAboutReceipt = /receipt|itemized/i.test(msgClean);
  const asksAboutFSA = /fsa|hsa/i.test(msgClean);
  const asksAboutSchedule = /schedule|appointment|book|video\s*visit/i.test(msgClean);
  const asksAboutPrescription = /prescribe|prescription|can\s*you\s*prescribe|do\s*you\s*prescribe/i.test(msgClean);
  const mentionsTRT = /trt|testosterone/i.test(msgClean);
  const mentionsHRT = /hrt|hormone\s*replacement|menopause|estrogen|progesterone/i.test(msgClean);
  const mentionsGLP = /glp|weight\s*loss|semaglutide|tirzepatide|ozempic/i.test(msgClean);
  const asksAboutTravel = /travel|traveling|trip/i.test(msgClean);

  // ===========================================================================
  // PRECISE SCENARIO BOOSTS (high weight for exact matches)
  // ===========================================================================

  // --- CHARGE DATE QUESTIONS ---
  if (asksAboutCharge && !asksAboutRefill) {
    if (/charge\s*alignment/i.test(titleClean)) {
      score += 10.0;
      reasons.push("Charge Alignment macro (exact match for charge date)");
    }
    // Penalize everything unrelated
    if (/insurance/i.test(titleClean)) { score -= 8.0; reasons.push("Insurance irrelevant to charge date"); }
    if (/refill\s*date|next\s*refill/i.test(titleClean) && !/charge/i.test(titleClean)) { score -= 6.0; reasons.push("Refill != charge date"); }
    if (/cancel/i.test(titleClean)) { score -= 5.0; reasons.push("Cancel irrelevant to charge date"); }
    if (/refund/i.test(titleClean)) { score -= 4.0; reasons.push("Refund irrelevant to charge date"); }
    if (/receipt|itemized/i.test(titleClean)) { score -= 4.0; reasons.push("Receipt irrelevant to charge date"); }
  }

  // --- INSURANCE QUESTIONS ---
  if (asksAboutInsurance) {
    if (/insurance/i.test(titleClean)) {
      score += 10.0;
      reasons.push("Insurance macro (exact match)");
    }
    // Penalize unrelated billing macros
    if (/charge\s*alignment|charge\s*date/i.test(titleClean)) { score -= 5.0; reasons.push("Charge date irrelevant to insurance"); }
    if (/cancel/i.test(titleClean)) { score -= 4.0; reasons.push("Cancel irrelevant to insurance"); }
  }

  // --- CANCELLATION QUESTIONS ---
  if (asksAboutCancel) {
    if (/cancel/i.test(titleClean)) {
      score += 8.0;
      reasons.push("Cancel macro (exact match)");
    }
    // Penalize unrelated
    if (/insurance/i.test(titleClean)) { score -= 6.0; reasons.push("Insurance irrelevant to cancel"); }
    if (/charge\s*alignment/i.test(titleClean)) { score -= 5.0; reasons.push("Charge alignment irrelevant to cancel"); }
  }

  // --- DISCOUNT QUESTIONS ---
  if (asksAboutDiscount) {
    if (/no\s*discount|promotion.*no|veteran.*discount/i.test(titleClean)) {
      score += 10.0;
      reasons.push("No discount macro (exact match)");
    } else if (/discount|promo|promotion|price\s*objection/i.test(titleClean)) {
      score += 8.0;
      reasons.push("Discount/promo macro");
    }
    // Penalize unrelated
    if (/insurance/i.test(titleClean)) { score -= 6.0; reasons.push("Insurance irrelevant to discount"); }
    if (/cancel/i.test(titleClean)) { score -= 5.0; reasons.push("Cancel irrelevant to discount"); }
    if (/charge\s*alignment/i.test(titleClean)) { score -= 4.0; reasons.push("Charge alignment irrelevant to discount"); }
    if (/refill\s*date/i.test(titleClean)) { score -= 4.0; reasons.push("Refill date irrelevant to discount"); }
  }

  // --- REPLACEMENT / LOST MEDICATION ---
  if (asksAboutReplacement) {
    if (/processing\s*replacement/i.test(titleClean)) {
      score += 10.0;
      reasons.push("Processing Replacement macro (exact match)");
    } else if (/replacement/i.test(titleClean)) {
      score += 7.0;
      reasons.push("Replacement macro");
    }
    if (asksAboutTravel && /travel|extra\s*med/i.test(titleClean)) {
      score += 6.0;
      reasons.push("Travel + replacement scenario");
    }
    // Penalize unrelated
    if (/insurance/i.test(titleClean)) { score -= 6.0; reasons.push("Insurance irrelevant to replacement"); }
    if (/cancel/i.test(titleClean)) { score -= 5.0; reasons.push("Cancel irrelevant to replacement"); }
    if (/discount/i.test(titleClean)) { score -= 4.0; reasons.push("Discount irrelevant to replacement"); }
  }

  // --- LAB RESULTS QUESTIONS ---
  if (asksAboutLabs && !asksAboutLabBill) {
    if (/lab\s*results|sharing\s*lab/i.test(titleClean)) {
      score += 8.0;
      reasons.push("Lab results macro");
    } else if (/akute/i.test(titleClean) && /lab|results|portal/i.test(fullContent)) {
      score += 7.0;
      reasons.push("Akute portal (for lab results)");
    } else if (/labs?:/i.test(titleClean)) {
      score += 4.0;
      reasons.push("Labs macro");
    }
    // Penalize unrelated
    if (/insurance/i.test(titleClean)) { score -= 5.0; reasons.push("Insurance irrelevant to labs"); }
    if (/cancel/i.test(titleClean)) { score -= 5.0; reasons.push("Cancel irrelevant to labs"); }
    if (/discount/i.test(titleClean)) { score -= 4.0; reasons.push("Discount irrelevant to labs"); }
  }

  // --- LAB BILL QUESTIONS ---
  if (asksAboutLabBill) {
    if (/lc:.*bill|quest:.*bill|lab.*bill/i.test(titleClean)) {
      score += 10.0;
      reasons.push("Lab bill macro (exact match)");
    }
  }

  // --- REFUND QUESTIONS ---
  if (asksAboutRefund && !asksAboutDiscount) {
    if (/refund/i.test(titleClean)) {
      score += 10.0;
      reasons.push("Refund macro (exact match)");
    }
    // Penalize unrelated
    if (/insurance/i.test(titleClean)) { score -= 5.0; reasons.push("Insurance irrelevant to refund"); }
    if (/charge\s*alignment/i.test(titleClean)) { score -= 5.0; reasons.push("Charge alignment irrelevant to refund"); }
    if (/discount/i.test(titleClean)) { score -= 4.0; reasons.push("Discount irrelevant to refund"); }
  }

  // --- RECEIPT QUESTIONS ---
  if (asksAboutReceipt) {
    if (/itemized/i.test(msgClean) && /itemized/i.test(titleClean)) {
      score += 10.0;
      reasons.push("Itemized receipt macro (exact match)");
    } else if (/receipt/i.test(titleClean)) {
      score += 8.0;
      reasons.push("Receipt macro");
    }
    // Penalize unrelated
    if (/insurance/i.test(titleClean)) { score -= 5.0; reasons.push("Insurance irrelevant to receipt"); }
    if (/cancel/i.test(titleClean)) { score -= 5.0; reasons.push("Cancel irrelevant to receipt"); }
  }

  // --- FSA/HSA QUESTIONS ---
  if (asksAboutFSA) {
    if (/fsa|hsa/i.test(titleClean)) {
      score += 10.0;
      reasons.push("FSA/HSA macro (exact match)");
    }
  }

  // --- SHIPPING / DELIVERY QUESTIONS ---
  if (asksAboutShipping && !asksAboutReplacement) {
    if (/shipping|overnight\s*shipping/i.test(titleClean)) {
      score += 9.0;
      reasons.push("Shipping macro (exact match)");
    } else if (/orders?:/i.test(titleClean) && /ship|deliver/i.test(fullContent)) {
      score += 7.0;
      reasons.push("Orders macro with shipping content");
    } else if (/expedite|delayed/i.test(titleClean)) {
      score += 6.0;
      reasons.push("Expedite/delay macro");
    }
    // Strong penalty for lab macros when asking about shipping
    if (/labs?:/i.test(titleClean) || /blood\s*draw|lab\s*results/i.test(titleClean)) {
      score -= 10.0;
      reasons.push("Lab macro penalized (user asks about shipping)");
    }
    // Penalize unrelated
    if (/insurance/i.test(titleClean)) { score -= 6.0; reasons.push("Insurance irrelevant to shipping"); }
    if (/cancel/i.test(titleClean)) { score -= 5.0; reasons.push("Cancel irrelevant to shipping"); }
    if (/discount/i.test(titleClean)) { score -= 4.0; reasons.push("Discount irrelevant to shipping"); }
  }

  // --- NEEDLES/SYRINGES QUESTIONS ---
  if (asksAboutNeedles) {
    if (/needle|syringe/i.test(titleClean)) {
      score += 10.0;
      reasons.push("Needles/syringes macro (exact match)");
    }
    // Penalize unrelated
    if (/insurance/i.test(titleClean)) { score -= 6.0; reasons.push("Insurance irrelevant to needles"); }
    if (/cancel/i.test(titleClean)) { score -= 5.0; reasons.push("Cancel irrelevant to needles"); }
  }

  // --- PRICING QUESTIONS ---
  if (asksAboutPricing && !asksAboutDiscount && !asksAboutCharge) {
    if (/pricing/i.test(titleClean)) {
      score += 8.0;
      reasons.push("Pricing macro");
    }
    if (mentionsTRT && /trt.*pricing|trt.*price/i.test(fullContent)) {
      score += 6.0;
      reasons.push("TRT pricing");
    }
    if (mentionsHRT && /hrt.*pricing|hrt.*price/i.test(fullContent)) {
      score += 6.0;
      reasons.push("HRT pricing");
    }
    if (mentionsGLP && /glp.*pricing|glp.*price/i.test(fullContent)) {
      score += 6.0;
      reasons.push("GLP pricing");
    }
  }

  // --- VIDEO VISIT / SCHEDULING ---
  if (asksAboutSchedule) {
    if (/vv:|video\s*visit|schedule.*visit|appointment/i.test(titleClean)) {
      score += 7.0;
      reasons.push("Video visit/scheduling macro");
    }
    // Penalize unrelated
    if (/insurance/i.test(titleClean)) { score -= 5.0; reasons.push("Insurance irrelevant to scheduling"); }
    if (/billing/i.test(titleClean) && !/visit/i.test(titleClean)) { score -= 4.0; reasons.push("Billing irrelevant to scheduling"); }
  }

  // --- PRESCRIPTION QUESTIONS ---
  if (asksAboutPrescription) {
    if (/prescribe/i.test(titleClean)) {
      score += 8.0;
      reasons.push("Prescription macro");
    }
    // TRT-specific prescriptions
    if (mentionsTRT && /trt|testosterone/i.test(fullContent)) {
      score += 3.0;
      reasons.push("TRT prescription context");
    }
    // HRT-specific
    if (mentionsHRT && /hrt|hormone|estradiol|progesterone/i.test(fullContent)) {
      score += 3.0;
      reasons.push("HRT prescription context");
    }
  }

  // --- ORDER TRACKING ---
  if (asksAboutTracking && !asksAboutReplacement) {
    if (/track|shipping|order\s*status|where.*order/i.test(titleClean)) {
      score += 8.0;
      reasons.push("Order tracking macro");
    }
    // Penalize unrelated
    if (/insurance/i.test(titleClean)) { score -= 5.0; reasons.push("Insurance irrelevant to tracking"); }
    if (/cancel/i.test(titleClean)) { score -= 5.0; reasons.push("Cancel irrelevant to tracking"); }
  }

  // ===========================================================================
  // PROGRAM-SPECIFIC MATCHING (TRT vs HRT vs GLP)
  // ===========================================================================
  if (mentionsTRT && !mentionsHRT && !mentionsGLP) {
    if (/hrt/i.test(titleClean) && !/trt/i.test(titleClean)) {
      score -= 3.0;
      reasons.push("HRT macro penalized (user asks about TRT)");
    }
    if (/glp/i.test(titleClean)) {
      score -= 3.0;
      reasons.push("GLP macro penalized (user asks about TRT)");
    }
  }
  if (mentionsHRT && !mentionsTRT && !mentionsGLP) {
    if (/trt/i.test(titleClean) && !/hrt/i.test(titleClean)) {
      score -= 3.0;
      reasons.push("TRT macro penalized (user asks about HRT)");
    }
    if (/glp/i.test(titleClean)) {
      score -= 3.0;
      reasons.push("GLP macro penalized (user asks about HRT)");
    }
  }
  if (mentionsGLP && !mentionsTRT && !mentionsHRT) {
    if (/trt/i.test(titleClean) && !/glp|weight/i.test(titleClean)) {
      score -= 3.0;
      reasons.push("TRT macro penalized (user asks about GLP)");
    }
    if (/hrt/i.test(titleClean) && !/glp|weight/i.test(titleClean)) {
      score -= 3.0;
      reasons.push("HRT macro penalized (user asks about GLP)");
    }
  }

  // ===========================================================================
  // TOPIC MATCHING (for detected topics like labcorp, quest, etc.)
  // ===========================================================================
  for (const topic of intent.topics) {
    if (titleClean.includes(topic) || textClean.includes(topic)) {
      score += 2.0;
      reasons.push(`Topic match: ${topic}`);
    }
  }

  // ===========================================================================
  // KEYWORD OVERLAP (very low weight to prevent false positives)
  // ===========================================================================
  const titleOverlap = msgKeywords.filter((k) => titleKeywords.includes(k));
  if (titleOverlap.length > 0) {
    score += titleOverlap.length * 0.4;
    reasons.push(`Title keywords: ${titleOverlap.slice(0, 3).join(", ")}`);
  }

  if (!isTitleOnly(macro)) {
    const textOverlap = msgKeywords.filter((k) => textKeywords.includes(k));
    if (textOverlap.length > 0) {
      score += textOverlap.length * 0.2;
      reasons.push(`Text keywords: ${textOverlap.slice(0, 3).join(", ")}`);
    }
  }

  // ===========================================================================
  // DIRECT PHRASE MATCHING (reduced weight)
  // ===========================================================================
  const msgWords = msgClean.split(/\s+/);
  for (let i = 0; i < msgWords.length - 1; i++) {
    const phrase = `${msgWords[i]} ${msgWords[i + 1]}`;
    if (phrase.length > 6) {
      const escaped = escapeRegex(phrase);
      if (new RegExp(escaped, "i").test(titleClean)) {
        score += 1.5;
        reasons.push(`Direct phrase: '${phrase}'`);
      }
    }
  }

  // ===========================================================================
  // NEGATION HANDLING - Penalize macros matching negated terms
  // ===========================================================================
  if (hasNegation) {
    for (const negatedTerm of negatedTerms) {
      // If user says "don't want to cancel" and macro is about cancellation
      if (negatedTerm === "cancel" && /cancel/i.test(titleClean)) {
        score -= 10.0;
        reasons.push("Negated: user doesn't want to cancel");
      }
      // If user says "don't need refund" and macro is about refunds
      if (negatedTerm === "refund" && /refund/i.test(titleClean)) {
        score -= 10.0;
        reasons.push("Negated: user doesn't want refund");
      }
      // If user says "not about insurance" 
      if (negatedTerm === "insurance" && /insurance/i.test(titleClean)) {
        score -= 8.0;
        reasons.push("Negated: not about insurance");
      }
      // General negation penalty
      if (titleClean.includes(negatedTerm)) {
        score -= 5.0;
        reasons.push(`Negated term: ${negatedTerm}`);
      }
    }
  }

  // ===========================================================================
  // TITLE-ONLY PENALTY
  // ===========================================================================
  if (isTitleOnly(macro)) {
    score *= 0.6;
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
  // With the new precise scoring, exact matches get 8-10 points
  // Filter out anything below 3.0 to remove weak/spurious matches
  const minScore = 3.0;
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
      // Remove placeholder lines and add context (no patient portal exists)
      response = "We can look up your charge date and next refill date for you - just let us know if you'd like us to check. " +
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

  // Final light edit for charge alignment (no patient portal exists)
  if (/Your charge date is:/i.test(combined)) {
    combined = "We can look up your charge date and next refill date for you - just let us know if you'd like us to check. " +
      combined.replace(/^Your charge date is:.*?Please note/is, "Please note");
  }

  const suggestedResponse = cleanEncodingArtifacts(combined.replace(/\s+/g, " ").trim());

  return { suggestedResponse, macrosUsed };
}
