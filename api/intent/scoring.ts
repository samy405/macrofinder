/**
 * Score macros by intent match; keyword overlap <=20% tie-breaker
 */

import type { Macro } from "../matcher.js";
import type { IntentResult, MacroWithMeta } from "./types.js";
import type { RankedMacro } from "./types.js";

const INTENT_WEIGHT_PRIMARY = 0.65;
const INTENT_WEIGHT_SECONDARY = 0.2;
const KEYWORD_WEIGHT_MAX = 0.2;

/** Derive intents from macro title when not in metadata */
export function getMacroIntents(macro: Macro): string[] {
  const t = macro.title.toLowerCase();
  const intents: string[] = [];
  if (/billing|charge|payment|refund|invoice|subscription\s+fee|stripe/i.test(t)) intents.push("billing");
  if (/charge\s+alignment|charge\s+date|next\s+refill\s+date/i.test(t)) {
    intents.push("billing");
    intents.push("billing_charge_date");
  }
  if (/refund/i.test(t)) intents.push("billing_refund");
  if (/cancel|subscription/i.test(t) && !/side\s+effect/i.test(t)) intents.push("cancellation_pause");
  if (/cancel\s+side\s+effect|side\s+effect/i.test(t)) intents.push("side_effects_medical");
  if (/lab\s+results|sharing\s+lab|akute.*lab/i.test(t)) intents.push("labs_results", "labs");
  if (/lab\s+bill|lc:.*bill|quest:.*bill/i.test(t)) intents.push("labs_bill", "billing");
  if (/lab|labcorp|quest|blood\s+draw/i.test(t) && !/bill/i.test(t)) intents.push("labs", "labs_scheduling");
  if (/schedule|reschedul|booked\s+out|walk[- ]?in|tech\s+issue/i.test(t) && /lc:|quest|lab/i.test(t))
    intents.push("labs_scheduling");
  if (/vv:|video\s+visit|appointment|schedule.*visit|provider/i.test(t)) intents.push("scheduling", "scheduling_video_visit");
  if (/follow[- ]?up|before\s+follow\s*up|lab\s+before/i.test(t)) intents.push("follow_up_visit", "lab_due_before_visit");
  if (/shipping|delivery|expedite|overnight/i.test(t)) intents.push("shipping");
  if (/address|wrong\s+zip|zip\s+code/i.test(t)) intents.push("shipping_address", "address_change");
  if (/replacement|replace\s+order|processing\s+replacement/i.test(t)) intents.push("replacement", "medication_not_received");
  if (/travel|out\s+of\s+state|another\s+state|can'?t\s+register\s+due\s+to\s+travel/i.test(t))
    intents.push("out_of_state_travel", "labs_scheduling");
  if (/refill|next\s+refill/i.test(t)) intents.push("refills");
  if (/needle|syringe/i.test(t)) intents.push("refills");
  if (/pricing|price|discount|promo|no\s+discount|veteran/i.test(t)) intents.push("pricing_concerns", "discount_promo");
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

    // Penalty: wrong category when primary is clear
    if (primary !== "general" && !primaryMatch) {
      const wrongCategoryPenalty = 0.25;
      if (primary.startsWith("billing") && macroIntents.some((i) => i.startsWith("labs") && !i.includes("bill")))
        intentScore -= wrongCategoryPenalty;
      if (primary.startsWith("labs") && !primary.includes("bill") && macroIntents.some((i) => i === "billing" || i === "billing_charge_date"))
        intentScore -= wrongCategoryPenalty;
      if (primary === "scheduling" && macroIntents.some((i) => i === "billing" || i === "billing_refund"))
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
