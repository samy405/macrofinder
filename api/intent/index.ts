/**
 * Intent Engine - NO-API intent-based matcher
 * Pipeline: normalize(message) -> detect_intents(message) -> score_macros(intents, message) -> top 3 + reasons
 * Fully offline, no OpenAI/embeddings/LLM.
 */

import type { Macro } from "../matcher.js";
import type { IntentMatchResult, RankedMacro } from "./types.js";
import { normalize } from "./normalize.js";
import { detectIntents } from "./detect.js";
import { scoreMacros } from "./scoring.js";

export type { IntentResult, IntentMatchResult, RankedMacro, MacroWithMeta } from "./types.js";
export { detectIntents } from "./detect.js";
export { normalize } from "./normalize.js";
export { getMacroIntents, scoreMacros } from "./scoring.js";

/**
 * Main pipeline: normalize -> detect_intents -> score_macros -> return top N with confidence + rationale
 */
export function intentMatch(message: string, macros: Macro[], topN = 3): IntentMatchResult {
  const start = Date.now();

  normalize(message);
  const retrievalStart = Date.now();
  const intent = detectIntents(message);
  const retrievalTimeMs = Date.now() - retrievalStart;

  const rerankStart = Date.now();
  const matches = scoreMacros(message, macros, intent, topN);
  const rerankTimeMs = Date.now() - rerankStart;

  return {
    mode: "intent",
    matches,
    primaryIntent: intent.primary_intent,
    secondaryIntents: intent.secondary_intents || [],
    retrievalTimeMs,
    rerankTimeMs,
    totalTimeMs: Date.now() - start,
  };
}

/** Legacy format for API compatibility (macro, score, matchReasons, confidence, rationale) */
export interface LegacyMacroMatch {
  macro: Macro;
  score: number;
  matchReasons: string[];
  confidence?: number;
  category?: string;
  rationale?: string;
  isFallback?: boolean;
}

function detectCategory(title: string): string {
  const titleLower = title.toLowerCase();
  if (/billing|charge|payment|refund|invoice|receipt/i.test(titleLower)) return "Billing";
  if (/cancel|subscription/i.test(titleLower)) return "Cancellation";
  if (/lab|labcorp|quest|blood/i.test(titleLower)) return "Labs";
  if (/order|shipping|delivery|expedite/i.test(titleLower)) return "Orders";
  if (/vv:|video|visit|appointment|schedule|provider/i.test(titleLower)) return "Appointments";
  if (/insurance/i.test(titleLower)) return "Insurance";
  if (/discount|promo|promotion|referral/i.test(titleLower)) return "Promotions";
  if (/trt|testosterone/i.test(titleLower)) return "TRT";
  if (/hrt|hormone|estrogen|progesterone/i.test(titleLower)) return "HRT";
  if (/glp|weight|semaglutide|tirzepatide/i.test(titleLower)) return "GLP";
  if (/needle|syringe/i.test(titleLower)) return "Supplies";
  if (/akute|portal/i.test(titleLower)) return "Portal";
  if (/pharmacy|belmar|curexa|tph/i.test(titleLower)) return "Pharmacy";
  if (/tech:|error|2fa/i.test(titleLower)) return "Technical";
  return "General";
}

export function convertToLegacyFormat(result: IntentMatchResult): LegacyMacroMatch[] {
  return result.matches.map((m) => ({
    macro: m.macro,
    score: m.confidence / 10,
    matchReasons: [m.rationale],
    confidence: m.confidence,
    category: detectCategory(m.macro.title),
    rationale: m.rationale,
    isFallback: false,
  }));
}
