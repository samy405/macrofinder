/**
 * Intent detection - phrase patterns, contextual rules, negation
 * NO API - fully offline
 */

import type { IntentResult, ExtractedEntities } from "./types.js";
import { normalize } from "./normalize.js";
import { messageContainsSignal } from "./fuzzy.js";

// --- Intent taxonomy (relevant to macros) ---
export const INTENT_IDS = [
  "billing",
  "billing_charge_date",
  "billing_refund",
  "labs",
  "labs_scheduling",
  "labs_results",
  "labs_bill",
  "scheduling",
  "scheduling_video_visit",
  "shipping",
  "shipping_address",
  "shipping_tracking",
  "address_change",
  "refills",
  "medication_not_received",
  "replacement",
  "out_of_state_travel",
  "cancellation_pause",
  "pricing_concerns",
  "side_effects_medical",
  "discount_promo",
  "insurance",
  "follow_up_visit",
  "lab_due_before_visit",
] as const;

// --- Phrase patterns (multi-word signals) ---
const PATTERNS: Record<string, RegExp[]> = {
  billing: [
    /charged\s+\$?\d+/i,
    /got\s+charged/i,
    /was\s+charged/i,
    /why\s+(am|was|did)\s+i\s+(being\s+)?charged/i,
    /what\s+is\s+this\s+(charge|for)/i,
    /billing|payment|invoice|subscription\s+fee/i,
    /charge\s+date|next\s+charge|when\s+(do|will)\s+i\s+get\s+charged/i,
  ],
  billing_charge_date: [
    /when\s+is\s+my\s+next\s+(charge|payment|bill)/i,
    /charge\s+date|billing\s+date|next\s+billing/i,
    /renewal\s+date/i,
  ],
  billing_refund: [/refund|money\s+back|reimburse/i],
  labs: [
    /lab\s+work|blood\s+work|bloodwork|lab\s+draw|labs?\s+done/i,
    /get\s+my\s+labs|do\s+my\s+labs|need\s+labs/i,
    /missed\s+labs?|didn'?t\s+get\s+labs/i,
  ],
  labs_scheduling: [
    /schedule\s+(my\s+)?labs?|book\s+lab|lab\s+appointment/i,
    /reschedul(e|ing)\s+labs?|missed\s+labs?/i,
    /link\s+doesn'?t\s+work|scheduling\s+link/i,
    /when\s+can\s+i\s+get\s+(my\s+)?labs/i,
  ],
  labs_results: [
    /lab\s+results?|see\s+my\s+results|view\s+results|access\s+(my\s+)?labs/i,
    /when\s+will\s+i\s+get\s+my\s+results/i,
    /results\s+(not\s+)?(in|available)/i,
  ],
  labs_bill: [
    /lab\s+bill|charged\s+for\s+(my\s+)?lab|lab\s+invoice/i,
    /separate\s+lab\s+bill|lab\s+\$\d+/i,
  ],
  scheduling: [
    /schedule|appointment|book\s+(a\s+)?visit|reschedule/i,
    /follow[- ]?up|follow\s+up\s+visit/i,
    /when\s+can\s+i\s+see|next\s+available/i,
  ],
  scheduling_video_visit: [
    /video\s+visit|vv\s*:|telehealth|video\s+call/i,
    /see\s+a\s+provider|see\s+a\s+doctor/i,
  ],
  shipping: [
    /shipping|ship|delivery|deliver|order\s+status/i,
    /when\s+will\s+(it|my\s+order)\s+ship/i,
    /track\s+my\s+order/i,
  ],
  shipping_address: [
    /address\s+(wrong|incorrect|in\s+wrong)/i,
    /put\s+the\s+address\s+in\s+wrong/i,
    /wrong\s+address|address\s+issue/i,
  ],
  shipping_tracking: [/track|tracking|where\s+is\s+my\s+order/i],
  address_change: [
    /address\s+(change|wrong|incorrect)/i,
    /change\s+my\s+address|update\s+address/i,
  ],
  refills: [
    /refill|next\s+refill|when\s+refill|refill\s+date/i,
    /running\s+low|out\s+of\s+medication/i,
  ],
  medication_not_received: [
    /didn'?t\s+receive|never\s+received|not\s+received/i,
    /didn'?t\s+get\s+my\s+order|order\s+never\s+arrived/i,
    /package\s+lost|medication\s+missing/i,
  ],
  replacement: [
    /replacement|replace\s+my\s+order|lost\s+(my\s+)?(medication|meds|order)/i,
    /need\s+a\s+replacement|never\s+received/i,
  ],
  out_of_state_travel: [
    /traveling|travelling|in\s+\w+\s+until/i,
    /out\s+of\s+state|another\s+state|hawaii|vacation/i,
    /can\s+i\s+do\s+my\s+follow[- ]?up/i,
    /until\s+the\s+\d+/i,
  ],
  cancellation_pause: [
    /cancel|cancellation|stop\s+my\s+subscription|pause/i,
    /discontinue|unsubscribe/i,
  ],
  pricing_concerns: [
    /how\s+much|pricing|price|cost|fee\s+for/i,
    /what\s+do\s+you\s+charge|expensive/i,
  ],
  side_effects_medical: [
    /side\s+effect|sick|not\s+feeling|medical\s+question/i,
    /escalat(e|ion)|speak\s+to\s+(a\s+)?provider/i,
  ],
  discount_promo: [
    /discount|promo|promotion|coupon|cheaper/i,
    /veteran\s+discount|referral\s+code/i,
  ],
  insurance: [/insurance|do\s+you\s+accept|covered\s+by/i],
  follow_up_visit: [
    /follow[- ]?up|follow\s+up\s+visit|before\s+my\s+follow\s*up/i,
    /need\s+labs\s+before|do\s+i\s+need\s+labs\s+before/i,
  ],
  lab_due_before_visit: [
    /labs?\s+before\s+(my\s+)?follow\s*up/i,
    /need\s+labs\s+before|just\s+symptoms/i,
    /or\s+just\s+symptoms/i,
  ],
};

// --- Negation patterns ---
const NEGATION_PATTERNS = [
  /don'?t\s+want\s+to\s+(\w+)/gi,
  /do\s+not\s+want\s+to\s+(\w+)/gi,
  /did\s+not\s+(\w+)/gi,
  /didn'?t\s+(\w+)/gi,
  /no\s+(\w+)\s+(done|received|work)/gi,
  /not\s+received/gi,
  /never\s+received/gi,
  /not\s+get\s+my\s+(\w+)/gi,
  /no\s+lab\s+work\s+done/gi,
];

function extractNegatedTerms(message: string): string[] {
  const terms: string[] = [];
  for (const re of NEGATION_PATTERNS) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(message)) !== null) {
      if (m[1]) terms.push(m[1].toLowerCase());
    }
  }
  if (/\bnot\s+received\b/i.test(message)) terms.push("received");
  if (/\bno\s+lab\s+work\b/i.test(message)) terms.push("labs");
  return [...new Set(terms)];
}

function extractEntities(normalized: string): ExtractedEntities {
  const entities: ExtractedEntities = {};
  const months =
    /(january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d+\s*(st|nd|rd|th))/gi;
  let m: RegExpExecArray | null;
  const dates: string[] = [];
  while ((m = months.exec(normalized)) !== null) dates.push(m[0]);
  if (dates.length) entities.dates = [...new Set(dates)];

  if (/\b(fedex|ups|usps|dhl)\b/i.test(normalized)) {
    entities.carriers = [];
    if (/fedex/i.test(normalized)) entities.carriers.push("FedEx");
    if (/ups/i.test(normalized)) entities.carriers.push("UPS");
    if (/usps/i.test(normalized)) entities.carriers.push("USPS");
  }
  if (/\bquest\b/i.test(normalized)) entities.lab_partner = "quest";
  if (/\blabcorp|lab\s*corp\b/i.test(normalized)) entities.lab_partner = "labcorp";
  if (/\bgetlabs\b/i.test(normalized)) entities.lab_partner = "getlabs";
  if (
    /\b(out\s+of\s+state|another\s+state|traveling|hawaii|vacation|in\s+\w+\s+until)\b/i.test(
      normalized
    )
  ) {
    entities.out_of_state = true;
  }
  return entities;
}

/** Contextual rules: e.g. "charged" + amount/question => billing, not labs */
function resolveContext(
  normalized: string,
  detected: Set<string>
): { primary: string; secondary: string[] } {
  // "charged" / "lab bill" / "charged for lab" => billing wins over labs_results
  const hasChargedOrBill =
    /\bcharged\b|\bbill\b|\binvoice\b|\bpayment\b|\b\$\d+/.test(normalized);
  const hasLabWord = /\blabs?\b|\blab\s+bill\b/.test(normalized);
  const askingWhatCharge = /what\s+is\s+this\s+for|what\s+for|why\s+charged/.test(normalized);

  if (hasChargedOrBill && (askingWhatCharge || /charged\s+\$|charged\s+for/.test(normalized))) {
    if (detected.has("labs_bill")) {
      return { primary: "labs_bill", secondary: ["billing"] };
    }
    if (detected.has("billing") || hasLabWord) {
      return { primary: "billing", secondary: detected.has("labs_bill") ? ["labs_bill"] : [] };
    }
  }

  // "lab" + "cost/charged/bill" => labs_bill or billing, not labs_results/scheduling
  if (hasLabWord && hasChargedOrBill) {
    if (detected.has("labs_bill")) {
      return { primary: "labs_bill", secondary: ["billing"] };
    }
    return { primary: "billing", secondary: [] };
  }

  // "charged" but about appointment (reschedule charged appointment) => scheduling
  if (
    /\breschedul(e|ing)\s+.*(charged|appointment)|appointment\s+.*reschedul/.test(normalized) ||
    /what'?s\s+the\s+process\s+for\s+reschedul/.test(normalized)
  ) {
    if (detected.has("scheduling") || detected.has("scheduling_video_visit")) {
      return { primary: "scheduling", secondary: [] };
    }
  }

  // Out-of-state / travel => out_of_state_travel, scheduling
  if (detected.has("out_of_state_travel")) {
    return {
      primary: "out_of_state_travel",
      secondary: [...detected].filter(
        (x) => x !== "out_of_state_travel" && ["scheduling", "labs_scheduling"].includes(x)
      ),
    };
  }

  // Address wrong / FedEx / call them => shipping_address, replacement
  if (
    /address\s+(wrong|incorrect|in\s+wrong)|put\s+.*address\s+wrong|someone\s+call\s+them/i.test(
      normalized
    )
  ) {
    return {
      primary: "shipping_address",
      secondary: [...detected].filter((x) =>
        ["replacement", "shipping", "address_change"].includes(x)
      ),
    };
  }

  // Sick + missed labs + link doesn't work => labs_scheduling
  if (
    /\bsick\b.*\bmissed\s+labs?|\bmissed\s+labs?.*\bsick\b/i.test(normalized) ||
    (/link\s+doesn'?t\s+work/.test(normalized) && detected.has("labs_scheduling"))
  ) {
    return {
      primary: "labs_scheduling",
      secondary: [...detected].filter((x) => x !== "labs_scheduling"),
    };
  }

  // "Do I need labs before my follow up or just symptoms?" => follow_up_visit, lab_due_before_visit
  if (
    /need\s+labs?\s+before\s+my\s+follow|follow\s*up\s+or\s+just\s+symptoms/i.test(normalized)
  ) {
    return {
      primary: "lab_due_before_visit",
      secondary: ["follow_up_visit", "labs"],
    };
  }

  // Default: pick first by priority order
  const order: string[] = [
    "billing",
    "billing_charge_date",
    "billing_refund",
    "labs_bill",
    "labs_scheduling",
    "labs_results",
    "labs",
    "shipping_address",
    "replacement",
    "medication_not_received",
    "out_of_state_travel",
    "scheduling",
    "scheduling_video_visit",
    "follow_up_visit",
    "lab_due_before_visit",
    "shipping",
    "cancellation_pause",
    "pricing_concerns",
    "discount_promo",
    "insurance",
    "refills",
    "side_effects_medical",
  ];
  for (const id of order) {
    if (detected.has(id)) {
      const secondary = [...detected].filter((x) => x !== id);
      return { primary: id, secondary };
    }
  }
  return { primary: "general", secondary: [] };
}

export function detectIntents(message: string): IntentResult {
  const normalized = normalize(message);
  const detected = new Set<string>();

  for (const [intentId, regs] of Object.entries(PATTERNS)) {
    for (const re of regs) {
      if (re.test(normalized)) {
        detected.add(intentId);
        break;
      }
    }
  }

  // Fuzzy single-word signals for common terms
  const words = normalized.split(/\s+/);
  if (words.some((w) => w === "charged" || w === "charge")) detected.add("billing");
  if (words.some((w) => w === "lab" || w === "labs")) detected.add("labs");
  if (words.some((w) => w === "refund")) detected.add("billing_refund");
  if (words.some((w) => w === "cancel" || w === "cancellation")) detected.add("cancellation_pause");
  if (words.some((w) => w === "ship" || w === "shipping" || w === "delivery" || w === "order"))
    detected.add("shipping");
  if (words.some((w) => w === "address")) detected.add("address_change");
  if (words.some((w) => w === "travel" || w === "traveling" || w === "travelling"))
    detected.add("out_of_state_travel");
  if (words.some((w) => w === "schedule" || w === "appointment" || w === "visit"))
    detected.add("scheduling");
  if (words.some((w) => w === "refill" || w === "refills")) detected.add("refills");
  if (words.some((w) => w === "replacement" || w === "replace")) detected.add("replacement");
  if (words.some((w) => w === "received" && /not\s+received|never\s+received|didn'?t\s+receive/.test(normalized)))
    detected.add("medication_not_received");

  const negated = extractNegatedTerms(message);
  for (const term of negated) {
    if (term === "labs" || term === "received") detected.delete("labs_results");
  }

  const { primary, secondary } = resolveContext(normalized, detected);
  const entities = extractEntities(normalized);

  return {
    primary_intent: primary,
    secondary_intents: secondary.slice(0, 5),
    entities: Object.keys(entities).length ? entities : undefined,
    negated_terms: negated.length ? negated : undefined,
  };
}
