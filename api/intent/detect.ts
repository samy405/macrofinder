/**
 * Intent detection - phrase patterns, contextual rules, negation
 * NO API - fully offline
 */

import type { IntentResult, ExtractedEntities } from "./types.js";
import { normalize } from "./normalize.js";
import { messageContainsSignal } from "./fuzzy.js";

// --- Intent taxonomy (from Fountain Workflows: billing, labs, scheduling, shipping, cancellation, refills, travel, plan change, receipt, referral, documents, resume, pharmacy other, assessment, etc.) ---
export const INTENT_IDS = [
  "billing",
  "billing_charge_date",
  "billing_refund",
  "receipt_itemized",
  "labs",
  "labs_scheduling",
  "labs_results",
  "labs_bill",
  "scheduling",
  "scheduling_video_visit",
  "visit_required_before_refill",
  "shipping",
  "shipping_address",
  "shipping_tracking",
  "expedite_order",
  "address_change",
  "refills",
  "medication_not_received",
  "replacement",
  "out_of_state_travel",
  "cancellation_pause",
  "resume_treatment",
  "plan_change",
  "pricing_concerns",
  "side_effects_medical",
  "discount_promo",
  "insurance",
  "follow_up_visit",
  "lab_due_before_visit",
  "referral",
  "documents",
  "update_phone",
  "provider_specific",
  "pharmacy_other",
  "assessment_registration",
  "intermingled_profiles",
  "prescription_local_pharmacy",
  "wrong_charge_not_us",
  "contract_policy",
  "qualify_treatment",
  "in_person_appointments",
  "scam_legit",
] as const;

// --- Phrase patterns (multi-word signals; paraphrases from Fountain Workflows) ---
const PATTERNS: Record<string, RegExp[]> = {
  billing: [
    /charged\s+\$?\d+/i,
    /got\s+charged|was\s+charged|why\s+(am|was|did)\s+i\s+(being\s+)?charged/i,
    /what\s+is\s+this\s+(charge|for)|what\s+was\s+this\s+charge|explain\s+this\s+charge/i,
    /billing|payment|invoice|subscription\s+fee|when\s+(do|will)\s+i\s+get\s+charged/i,
    /charge\s+date|next\s+charge|next\s+billing/i,
  ],
  billing_charge_date: [
    /when\s+is\s+my\s+next\s+(charge|payment|bill)/i,
    /charge\s+date|billing\s+date|next\s+billing|renewal\s+date/i,
  ],
  billing_refund: [/refund|money\s+back|reimburse|get\s+my\s+money\s+back/i],
  receipt_itemized: [
    /receipt|itemized|itemize|breakdown\s+of\s+charges/i,
    /fsa|hsa|reimbursement\s+form|for\s+my\s+insurance/i,
    /proof\s+of\s+payment|need\s+a\s+receipt/i,
  ],
  labs: [
    /lab\s+work|blood\s+work|bloodwork|lab\s+draw|labs?\s+done|get\s+my\s+labs|do\s+my\s+labs|need\s+labs/i,
    /missed\s+labs?|didn'?t\s+get\s+labs|no\s+lab\s+work/i,
  ],
  labs_scheduling: [
    /schedule\s+(my\s+)?labs?|book\s+lab|lab\s+appointment|reschedul(e|ing)\s+labs?|missed\s+labs?/i,
    /link\s+doesn'?t\s+work|scheduling\s+link|when\s+can\s+i\s+get\s+(my\s+)?labs/i,
    /labcorp|quest\s+appointment|blood\s+draw\s+appointment/i,
    /thought\s+i\s+booked|booked\s+my\s+appointment\s+for/i,
  ],
  labs_results: [
    /lab\s+results?|see\s+my\s+results|view\s+results|access\s+(my\s+)?labs|share\s+my\s+results/i,
    /when\s+will\s+i\s+get\s+my\s+results|results\s+(not\s+)?(in|available)/i,
    /portal|akute|can'?t\s+see\s+my\s+results/i,
  ],
  labs_bill: [
    /lab\s+bill|charged\s+for\s+(my\s+)?lab|lab\s+invoice|separate\s+lab\s+bill|lab\s+\$\d+/i,
  ],
  scheduling: [
    /schedule|appointment|book\s+(a\s+)?visit|reschedule|next\s+available/i,
    /follow[- ]?up|follow\s+up\s+visit|when\s+can\s+i\s+see/i,
    /how\s+soon\s+can\s+i\s+see|next\s+visit\s+available/i,
  ],
  scheduling_video_visit: [
    /video\s+visit|vv\s*:|telehealth|video\s+call|see\s+a\s+provider|see\s+a\s+doctor/i,
  ],
  visit_required_before_refill: [
    /visit\s+(required|need)\s+before\s+refill|need\s+visit\s+to\s+get\s+refill/i,
    /overdue\s+for\s+refill|due\s+for\s+refill.*schedule\s+visit/i,
    /can'?t\s+get\s+refill\s+until\s+i\s+see|refill.*video\s+visit/i,
  ],
  shipping: [
    /shipping|ship|delivery|deliver|order\s+status|when\s+will\s+(it|my\s+order)\s+ship/i,
    /track\s+my\s+order|where\s+is\s+my\s+(order|package)/i,
  ],
  shipping_address: [
    /address\s+(wrong|incorrect|in\s+wrong)|put\s+the\s+address\s+in\s+wrong|wrong\s+address|address\s+issue/i,
  ],
  shipping_tracking: [/track|tracking|where\s+is\s+my\s+order|order\s+status/i],
  expedite_order: [
    /expedite|rush\s+order|speed\s+up|delayed\s+order|need\s+it\s+faster/i,
    /overnight|priority\s+shipping|asap|as\s+soon\s+as\s+possible/i,
  ],
  address_change: [
    /address\s+(change|wrong|incorrect)|change\s+my\s+address|update\s+(my\s+)?address/i,
  ],
  refills: [
    /refill|next\s+refill|when\s+refill|refill\s+date|running\s+low|out\s+of\s+medication/i,
    /refills\s+processed\s+automatically|when\s+do\s+i\s+get\s+my\s+next\s+refill/i,
  ],
  medication_not_received: [
    /didn'?t\s+receive|never\s+received|not\s+received|didn'?t\s+get\s+my\s+order/i,
    /order\s+never\s+arrived|package\s+lost|medication\s+missing/i,
  ],
  replacement: [
    /replacement|replace\s+my\s+order|lost\s+(my\s+)?(medication|meds|order)|need\s+a\s+replacement/i,
    /vial\s+broke|spilled|damaged\s+medication/i,
  ],
  out_of_state_travel: [
    /traveling|travelling|in\s+\w+\s+until|out\s+of\s+state|another\s+state|hawaii|vacation/i,
    /can\s+i\s+do\s+my\s+follow[- ]?up|until\s+the\s+\d+|extra\s+meds\s+for\s+travel/i,
  ],
  cancellation_pause: [
    /cancel|cancellation|stop\s+my\s+subscription|pause|discontinue|unsubscribe|no\s+longer\s+want/i,
  ],
  resume_treatment: [
    /resume\s+treatment|come\s+back|restart|start\s+again|rejoin|later\s+date/i,
    /want\s+to\s+come\s+back|treatment\s+at\s+a\s+later\s+date/i,
  ],
  plan_change: [
    /switch\s+to\s+(a\s+)?different\s+(subscription\s+)?plan|change\s+(my\s+)?(subscription\s+)?plan/i,
    /different\s+subscription\s+plan|can\s+i\s+switch\s+(my\s+)?plan/i,
    /upgrade\s+(my\s+)?plan|downgrade\s+(my\s+)?plan|change\s+to\s+(4|12|48)[-\s]?week/i,
    /switch\s+subscription|different\s+plan|change\s+plan\s+length/i,
  ],
  pricing_concerns: [
    /how\s+much|pricing|price|cost|fee\s+for|what\s+do\s+you\s+charge|expensive/i,
  ],
  side_effects_medical: [
    /side\s+effect|sick|not\s+feeling|medical\s+question|escalat(e|ion)|speak\s+to\s+(a\s+)?provider/i,
  ],
  discount_promo: [
    /discount|promo|promotion|coupon|cheaper|veteran\s+discount|referral\s+code/i,
  ],
  insurance: [/insurance|do\s+you\s+accept|covered\s+by|take\s+insurance/i],
  follow_up_visit: [
    /follow[- ]?up|follow\s+up\s+visit|before\s+my\s+follow\s*up|need\s+labs\s+before\s+follow/i,
  ],
  lab_due_before_visit: [
    /labs?\s+before\s+(my\s+)?follow\s*up|need\s+labs\s+before|just\s+symptoms|or\s+just\s+symptoms/i,
  ],
  referral: [
    /referral|referred\s+by|refer\s+a\s+friend|\$100\s+credit|referral\s+link/i,
  ],
  documents: [
    /send\s+(you\s+)?(docs|documents|paperwork)|fax|upload\s+documents|send\s+over\s+documents/i,
  ],
  update_phone: [
    /update\s+(my\s+)?phone\s+number|change\s+phone\s+number|wrong\s+phone\s+number/i,
  ],
  provider_specific: [
    /specific\s+provider|same\s+doctor|see\s+same\s+provider|request\s+(a\s+)?provider/i,
  ],
  pharmacy_other: [
    /order\s+processed\s+by\s+another\s+pharmacy|filled\s+(at|by)\s+another|other\s+pharmacy/i,
    /prescription\s+filled\s+elsewhere|another\s+provider\s+prescribed|pmp/i,
  ],
  assessment_registration: [
    /assessment|sign\s+up|register|see\s+my\s+assessment\s+results|registration\s+link/i,
    /get\s+started|already\s+on\s+trt|evaluation\s+link/i,
  ],
  intermingled_profiles: [
    /wrong\s+profile|partner.*same\s+email|family\s+member.*same\s+email|mixed\s+up\s+profiles/i,
  ],
  prescription_local_pharmacy: [
    /send\s+(prescription|script|rx)\s+to\s+local\s+pharmacy|fill\s+at\s+(cvs|walgreens|local)/i,
    /pick\s+up\s+at\s+pharmacy|local\s+pharmacy/i,
  ],
  wrong_charge_not_us: [
    /charge\s+doesn'?t\s+come\s+up|not\s+our\s+charge|wasn'?t\s+you\s+who\s+charged|not\s+fountain/i,
  ],
  contract_policy: [
    /contract|cancellation\s+policy|refund\s+policy|terms\s+for\s+longer\s+term/i,
  ],
  qualify_treatment: [
    /do\s+i\s+qualify|qualify\s+for\s+treatment|am\s+i\s+eligible/i,
  ],
  in_person_appointments: [
    /in[- ]?person\s+appointment|do\s+you\s+do\s+in[- ]?person|see\s+someone\s+in\s+person/i,
  ],
  scam_legit: [/scam|legit|legitimate|real\s+company|trustworthy/i],
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

  // "Can I switch to a different subscription plan?" => plan_change (NOT pharmacy_other)
  if (detected.has("pharmacy_other") && /another\s+pharmacy|filled\s+elsewhere|order\s+processed\s+by\s+another/i.test(normalized))
    return { primary: "pharmacy_other", secondary: [...detected].filter((x) => x !== "pharmacy_other") };
  if (detected.has("plan_change"))
    return { primary: "plan_change", secondary: [...detected].filter((x) => x !== "plan_change") };

  // Receipt / itemized / FSA => receipt_itemized (not generic billing)
  if (detected.has("receipt_itemized"))
    return { primary: "receipt_itemized", secondary: [...detected].filter((x) => x !== "receipt_itemized") };

  // Resume treatment => resume_treatment (not cancellation)
  if (detected.has("resume_treatment"))
    return { primary: "resume_treatment", secondary: [...detected].filter((x) => x !== "resume_treatment") };

  // Visit required before refill => visit_required_before_refill
  if (detected.has("visit_required_before_refill"))
    return { primary: "visit_required_before_refill", secondary: [...detected].filter((x) => x !== "visit_required_before_refill") };

  // Wrong charge / not our charge => wrong_charge_not_us
  if (detected.has("wrong_charge_not_us"))
    return { primary: "wrong_charge_not_us", secondary: [...detected].filter((x) => x !== "wrong_charge_not_us") };

  // Default: pick first by priority order
  const order: string[] = [
    "billing",
    "billing_charge_date",
    "billing_refund",
    "receipt_itemized",
    "labs_bill",
    "labs_scheduling",
    "labs_results",
    "labs",
    "shipping_address",
    "replacement",
    "medication_not_received",
    "expedite_order",
    "out_of_state_travel",
    "pharmacy_other",
    "scheduling",
    "scheduling_video_visit",
    "visit_required_before_refill",
    "follow_up_visit",
    "lab_due_before_visit",
    "shipping",
    "cancellation_pause",
    "resume_treatment",
    "plan_change",
    "pricing_concerns",
    "discount_promo",
    "insurance",
    "refills",
    "side_effects_medical",
    "referral",
    "documents",
    "update_phone",
    "provider_specific",
    "assessment_registration",
    "intermingled_profiles",
    "prescription_local_pharmacy",
    "wrong_charge_not_us",
    "contract_policy",
    "qualify_treatment",
    "in_person_appointments",
    "scam_legit",
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
  if (words.some((w) => w === "switch" || w === "change") && /plan|subscription/.test(normalized))
    detected.add("plan_change");
  if (words.some((w) => w === "receipt" || w === "itemized" || w === "fsa" || w === "hsa"))
    detected.add("receipt_itemized");
  if (words.some((w) => w === "referral" || w === "referred" || w === "refer"))
    detected.add("referral");
  if (words.some((w) => w === "resume" || w === "restart") || (words.some((w) => w === "come") && /back/.test(normalized)))
    detected.add("resume_treatment");
  if (words.some((w) => w === "documents" || w === "docs" || w === "fax") && /send|upload|submit/.test(normalized))
    detected.add("documents");
  if (words.some((w) => w === "phone" || w === "number") && /update|change|wrong/.test(normalized))
    detected.add("update_phone");
  if (words.some((w) => w === "provider" || w === "doctor") && /specific|same|request/.test(normalized))
    detected.add("provider_specific");
  if (/another\s+pharmacy|filled\s+elsewhere|other\s+pharmacy|other\s+provider/.test(normalized))
    detected.add("pharmacy_other");
  if (words.some((w) => w === "assessment" || w === "register" || w === "signup" || w === "evaluation"))
    detected.add("assessment_registration");
  if (/wrong\s+profile|same\s+email|family\s+member|partner.*profile/.test(normalized))
    detected.add("intermingled_profiles");
  if (words.some((w) => w === "expedite" || w === "rush" || w === "overnight") && /order|ship/.test(normalized))
    detected.add("expedite_order");
  if (/contract|cancellation\s+policy|refund\s+policy/.test(normalized))
    detected.add("contract_policy");
  if (words.some((w) => w === "qualify" || w === "eligible"))
    detected.add("qualify_treatment");
  if (/in[- ]?person|in\s+person\s+appointment/.test(normalized))
    detected.add("in_person_appointments");
  if (words.some((w) => w === "scam" || w === "legit" || w === "legitimate" || w === "real"))
    detected.add("scam_legit");
  if (words.some((w) => w === "local") && /pharmacy|prescription|script/.test(normalized))
    detected.add("prescription_local_pharmacy");

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
