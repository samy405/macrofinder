/**
 * Score macros by intent match; keyword overlap <=20% tie-breaker
 */

import type { Macro } from "../matcher.js";
import type { IntentResult, MacroWithMeta } from "./types.js";
import type { RankedMacro } from "./types.js";

const INTENT_WEIGHT_PRIMARY = 0.65;
const INTENT_WEIGHT_SECONDARY = 0.2;
const KEYWORD_WEIGHT_MAX = 0.2;
/** Boost for direct-answer macros (short body) so they rank above long explanatory macros for the same intent */
const DIRECT_ANSWER_BOOST = 0.15;
const DIRECT_ANSWER_MAX_CHARS = 120;

/** Derive intents from macro title when not in metadata. Only tag when the macro is actually about that topic. */
export function getMacroIntents(macro: Macro): string[] {
  const t = macro.title.toLowerCase();
  const intents: string[] = [];

  // Billing: only when macro is about billing/payment (not just any "subscription")
  if (/billing|charge|payment|refund|invoice|subscription\s+fee|stripe/i.test(t)) intents.push("billing");
  // Charge date: only macros that explain when the patient gets charged (not "Next Refill Date")
  if (/charge\s+alignment|charge\s+date/i.test(t)) {
    intents.push("billing");
    intents.push("billing_charge_date");
  }
  // Refund: macro is about refunds
  if (/refund/i.test(t)) intents.push("billing_refund");

  // Cancellation/pause: only when macro is about cancelling or pausing (not e.g. "Set up Subscription")
  if (/cancel|pause|discontinue|stop\s+(my\s+)?(subscription|service|plan)|end\s+(my\s+)?(subscription|service|plan)|unsubscribe|no\s+longer\s+want/i.test(t) && !/side\s+effect/i.test(t))
    intents.push("cancellation_pause");
  if (/cancel\s+side\s+effect|side\s+effect/i.test(t)) intents.push("side_effects_medical");

  // Lab results: viewing/accessing results (not all lab macros)
  if (/lab\s+results|sharing\s+lab|akute.*lab/i.test(t)) intents.push("labs_results", "labs");
  // Lab bill: lab billing only
  if (/lab\s+bill|lc:.*bill|quest:.*bill/i.test(t)) intents.push("labs_bill", "billing");
  // Labs (general): lab/labcorp/quest/blood draw, but not lab bill
  if (/lab|labcorp|quest|blood\s+draw/i.test(t) && !/bill/i.test(t)) intents.push("labs");
  // Labs scheduling: only when macro is about scheduling/bookings (not e.g. "How long does blood draw take")
  if (/schedule|reschedul|booked\s+out|walk[- ]?in|tech\s+issue|link|appointment/i.test(t) && /lc:|quest|lab/i.test(t))
    intents.push("labs_scheduling");

  // Scheduling / video visit: appointments, visits, providers
  if (/vv:|video\s+visit|appointment|schedule.*visit|provider/i.test(t)) intents.push("scheduling", "scheduling_video_visit");
  // Follow-up / lab due before visit: only when macro is about that
  if (/follow[- ]?up|before\s+follow\s*up|lab\s+before/i.test(t)) intents.push("follow_up_visit", "lab_due_before_visit");

  // Shipping: delivery/shipping (not just any "order")
  if (/shipping|delivery|expedite|overnight/i.test(t)) intents.push("shipping");
  // Address change / wrong address: only when macro is about wrong/update/change address or zip (not e.g. "address too long" tech error)
  if (/wrong\s+address|address\s+(wrong|incorrect)|wrong\s+zip|zip\s+code|update\s+address|change\s+address/i.test(t))
    intents.push("shipping_address", "address_change");

  // Replacement / not received: macro is about replacement or missing order
  if (/replacement|replace\s+order|processing\s+replacement/i.test(t)) intents.push("replacement", "medication_not_received");
  // Out-of-state / travel: only travel intent; add labs_scheduling only when macro is about lab scheduling while traveling
  if (/travel|out\s+of\s+state|another\s+state|can'?t\s+register\s+due\s+to\s+travel/i.test(t)) {
    intents.push("out_of_state_travel");
    if (/lc:|quest|lab|schedule|register/i.test(t)) intents.push("labs_scheduling");
  }

  // Refills: macro is about refill dates/processing (not charge date)
  if (/refill|next\s+refill/i.test(t)) intents.push("refills");
  // Needles/syringes: supplies (tagged as refills for matching)
  if (/needle|syringe/i.test(t)) intents.push("refills");

  // Plan change / switch subscription: direct-answer ("Switch plans") or explanatory (pricing, charge alignment)
  if (/\bswitch\s+plans?\b/i.test(t) && !/cancel|pause|multiple\s+plans/.test(t)) intents.push("plan_change");
  if (/charge\s+alignment|subscription\s+fees\s+for|pricing\s+of\s+our\s+plans|pricing\s+plans|fountain\s+hrt\s+and\s+trt\s+pricing|trt\/hrt\s+pricing/i.test(t))
    intents.push("plan_change");

  // Receipt / itemized / FSA/HSA: macro is about receipts or FSA/HSA
  if (/receipt|itemized|itemize|fsa|hsa|ndc\s+codes/i.test(t)) intents.push("receipt_itemized");
  // Resume treatment: macro about resuming at a later date
  if (/resume\s+treatment|later\s+date|come\s+back/i.test(t)) intents.push("resume_treatment");
  // Referral: macro about referrals, $100 credit
  if (/referral|referred|refer\s+a\s+friend|\$100\s+credit/i.test(t)) intents.push("referral");
  // Documents: send docs, fax
  if (/sending\s+docs|faxing\s+docs|send\s+over|fax/i.test(t)) intents.push("documents");
  // Update phone: macro about updating phone number
  if (/update\s+phone\s+number|update\s+.*number/i.test(t)) intents.push("update_phone");
  // Provider specific: request for specific provider
  if (/request\s+for\s+a\s+specific\s+provider|specific\s+provider/i.test(t)) intents.push("provider_specific");
  // Pharmacy other: order processed by another pharmacy (PMP / compliance)
  if (/order\s+processed\s+by\s+another\s+pharmacy|another\s+pharmacy\s+recently/i.test(t)) intents.push("pharmacy_other");
  // Assessment / registration: assessment results, registration link, evaluation
  if (/assessment|registration\s+link|evaluation|see\s+my\s+assessment|already\s+on\s+trt|discounted\s+assessment/i.test(t))
    intents.push("assessment_registration");
  // Intermingled profiles: wrong profile, family member same email
  if (/intermingled\s+profiles|intermingled/i.test(t)) intents.push("intermingled_profiles");
  // Visit required before refill: VV required before refill, overdue for refill
  if (/visit\s+required\s+before\s+refill|overdue\s+for\s+refill/i.test(t)) intents.push("visit_required_before_refill");
  // Expedite order: delayed, expedite, overnight
  if (/delayed.*expedite|expedite\s+order|overnight\s+shipping/i.test(t)) intents.push("expedite_order");
  // Wrong charge not us: charge doesn't come up, not our charge
  if (/charge\s+doesn'?t\s+come\s+up|sender\s+thinks\s+we\s+charged|not\s+affiliated/i.test(t)) intents.push("wrong_charge_not_us");
  // Contract / policy: contract, cancellation policy, refund terms
  if (/is\s+there\s+a\s+contract|terms\s+for\s+longer\s+term|refunds:?\s+terms/i.test(t)) intents.push("contract_policy");
  // Prescription local pharmacy: send to local pharmacy, fill at local
  if (/prescription\s+sent\s+to\s+local|local\s+pharmacy|fill\s+at\s+local|pick\s+up\s+at/i.test(t)) intents.push("prescription_local_pharmacy");
  // Qualify treatment: do I qualify
  if (/do\s+i\s+qualify|qualify\s+for\s+trt/i.test(t)) intents.push("qualify_treatment");
  // In-person appointments: do you do in-person
  if (/in[- ]?person\s+appointment|do\s+you\s+do\s+in[- ]?person/i.test(t)) intents.push("in_person_appointments");
  // Scam / legit: is your program a scam
  if (/scam|legit|legitimate/i.test(t)) intents.push("scam_legit");

  // Pricing / discount: macro is about pricing or discounts
  if (/pricing|price\s+objection|discount|promo|no\s+discount|veteran/i.test(t)) intents.push("pricing_concerns", "discount_promo");
  if (/insurance/i.test(t)) intents.push("insurance");

  if (intents.length === 0) intents.push("general");
  return [...new Set(intents)];
}

function getMacroIntentsList(macro: Macro | MacroWithMeta): string[] {
  const meta = macro as MacroWithMeta;
  if (meta.intents && meta.intents.length > 0) return meta.intents;
  return getMacroIntents(macro);
}

function keywordOverlapScore(message: string, macro: Macro): number {
  const stop = new Set([
    "the", "and", "for", "you", "my", "can", "have", "this", "that", "with", "are", "was", "get", "need", "want", "all", "our",
  ]);
  const msgWords = message
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stop.has(w));
  const titleWords = macro.title.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  const textWords = (macro.text || "").toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  const macroWords = new Set([...titleWords, ...textWords]);
  let hits = 0;
  for (const w of msgWords) {
    if (macroWords.has(w)) hits++;
    else if ([...macroWords].some((mw) => mw.includes(w) || w.includes(mw))) hits += 0.5;
  }
  const maxPossible = msgWords.length || 1;
  return Math.min(1, hits / Math.max(3, maxPossible));
}

function buildRationale(
  intent: IntentResult,
  macro: Macro,
  primaryMatch: boolean,
  secondaryMatch: boolean,
  keywordScore: number
): string {
  const intents = getMacroIntentsList(macro);
  if (primaryMatch && intent.primary_intent !== "general") {
    if (intent.primary_intent === "billing" || intent.primary_intent === "billing_charge_date")
      return "Matched because patient is asking about a charge or billing and this macro explains charges or charge dates.";
    if (intent.primary_intent === "labs_bill")
      return "Matched because patient is asking about a lab bill or lab charge; this macro addresses lab billing.";
    if (intent.primary_intent === "out_of_state_travel")
      return "Matched because patient is traveling or out of state and needs follow-up or lab scheduling guidance.";
    if (intent.primary_intent === "shipping_address")
      return "Matched because patient is reporting a wrong address or carrier issue requiring address/carrier follow-up.";
    if (intent.primary_intent === "labs_scheduling")
      return "Matched because patient needs to reschedule or book labs (e.g. missed labs, link not working).";
    if (intent.primary_intent === "lab_due_before_visit" || intent.primary_intent === "follow_up_visit")
      return "Matched because patient is asking about labs before a follow-up or visit requirements.";
    if (intent.primary_intent === "replacement" || intent.primary_intent === "medication_not_received")
      return "Matched because patient did not receive medication or needs a replacement.";
    if (intent.primary_intent === "scheduling" || intent.primary_intent === "scheduling_video_visit")
      return "Matched because patient is asking about scheduling, appointments, or video visits.";
    if (intent.primary_intent === "plan_change") {
      const isDirectAnswer = /\bswitch\s+plans?\b/i.test(macro.title);
      return isDirectAnswer
        ? "Matched because patient is asking whether they can switch plans; this macro directly answers yes and when they can switch."
        : "Matched because patient is asking about switching or changing their subscription plan; this macro explains plan options and pricing.";
    }
    if (intent.primary_intent === "receipt_itemized")
      return "Matched because patient is asking for a receipt, itemized breakdown, or FSA/HSA documentation.";
    if (intent.primary_intent === "resume_treatment")
      return "Matched because patient wants to resume or restart treatment at a later date.";
    if (intent.primary_intent === "referral")
      return "Matched because patient is asking about referrals, referral links, or referral credits.";
    if (intent.primary_intent === "documents")
      return "Matched because patient wants to send or fax documents to you.";
    if (intent.primary_intent === "update_phone")
      return "Matched because patient needs to update or change their phone number.";
    if (intent.primary_intent === "provider_specific")
      return "Matched because patient wants to see a specific provider or the same doctor.";
    if (intent.primary_intent === "pharmacy_other")
      return "Matched because patient had an order filled by another pharmacy; this macro addresses PMP/compliance confirmation.";
    if (intent.primary_intent === "assessment_registration")
      return "Matched because patient is asking about assessment, registration, or getting started.";
    if (intent.primary_intent === "intermingled_profiles")
      return "Matched because patient has intermingled or mixed profile information (e.g. same email as family member).";
    if (intent.primary_intent === "visit_required_before_refill")
      return "Matched because patient is due for a refill and needs to schedule a video visit first.";
    if (intent.primary_intent === "expedite_order")
      return "Matched because patient wants to expedite, rush, or get overnight shipping for their order.";
    if (intent.primary_intent === "wrong_charge_not_us")
      return "Matched because patient thinks we charged them but the charge is not from Fountain.";
    if (intent.primary_intent === "contract_policy")
      return "Matched because patient is asking about contract or cancellation/refund policy.";
    if (intent.primary_intent === "prescription_local_pharmacy")
      return "Matched because patient wants their prescription sent to a local pharmacy.";
    if (intent.primary_intent === "qualify_treatment")
      return "Matched because patient is asking whether they qualify for treatment.";
    if (intent.primary_intent === "in_person_appointments")
      return "Matched because patient is asking about in-person appointments.";
    if (intent.primary_intent === "scam_legit")
      return "Matched because patient is asking if the program is legitimate or a scam.";
    return `Matched because patient intent (${intent.primary_intent}) aligns with this macro.`;
  }
  if (secondaryMatch)
    return `Matched for secondary intent (${intent.secondary_intents?.join(", ") || "general"}).`;
  if (keywordScore > 0.2)
    return "Matched by relevance to message content.";
  return "Suggested macro based on message context.";
}

export function scoreMacros(
  message: string,
  macros: Macro[],
  intent: IntentResult,
  topN: number
): RankedMacro[] {
  const normalized = message.toLowerCase().replace(/\s+/g, " ");
  const primary = intent.primary_intent;
  const secondarySet = new Set(intent.secondary_intents || []);

  const scored = macros.map((macro) => {
    const macroIntents = getMacroIntentsList(macro);
    const primaryMatch = macroIntents.includes(primary);
    const secondaryMatch = intent.secondary_intents?.some((s) => macroIntents.includes(s)) ?? false;

    let intentScore = 0;
    if (primaryMatch) intentScore += INTENT_WEIGHT_PRIMARY;
    if (secondaryMatch) intentScore += INTENT_WEIGHT_SECONDARY * 0.8;

    let keywordScore = keywordOverlapScore(normalized, macro);
    const keywordContribution = Math.min(KEYWORD_WEIGHT_MAX, keywordScore * KEYWORD_WEIGHT_MAX);
    intentScore += keywordContribution;

    // Direct-answer boost: short macros that directly answer the question rank above long explanatory ones (all categories)
    const bodyLen = (macro.text ?? "").length;
    if (primaryMatch && bodyLen > 0 && bodyLen <= DIRECT_ANSWER_MAX_CHARS) intentScore += DIRECT_ANSWER_BOOST;

    // Penalty: wrong category when primary is clear
    if (primary !== "general" && !primaryMatch) {
      const wrongCategoryPenalty = 0.25;
      if (primary.startsWith("billing") && macroIntents.some((i) => i.startsWith("labs") && !i.includes("bill")))
        intentScore -= wrongCategoryPenalty;
      if (primary.startsWith("labs") && !primary.includes("bill") && macroIntents.some((i) => i === "billing" || i === "billing_charge_date"))
        intentScore -= wrongCategoryPenalty;
      if (primary === "scheduling" && macroIntents.some((i) => i === "billing" || i === "billing_refund"))
        intentScore -= wrongCategoryPenalty;
      if (primary === "plan_change" && !macroIntents.includes("plan_change"))
        intentScore -= wrongCategoryPenalty;
      if (primary === "pharmacy_other" && macroIntents.includes("plan_change") && !macroIntents.includes("pharmacy_other"))
        intentScore -= wrongCategoryPenalty;
    }

    intentScore = Math.max(0, Math.min(1, intentScore));
    const confidence = Math.round(intentScore * 100);

    const rationale = buildRationale(intent, macro, primaryMatch, secondaryMatch, keywordScore);

    return {
      macro,
      confidence,
      rationale,
      isPrimary: primaryMatch,
    } as RankedMacro;
  });

  scored.sort((a, b) => b.confidence - a.confidence);
  return scored.slice(0, topN);
}
