/**
 * Intent Engine Types
 * NO-API intent-based matching - fully offline
 */

import type { Macro } from "../matcher.js";

export interface IntentResult {
  primary_intent: string;
  secondary_intents: string[];
  entities?: ExtractedEntities;
  negated_terms?: string[];
}

export interface ExtractedEntities {
  dates?: string[];
  locations?: string[];
  carriers?: string[];
  lab_partner?: "quest" | "labcorp" | "getlabs";
  out_of_state?: boolean;
}

export interface MacroWithMeta extends Macro {
  intents?: string[];
  tags?: string[];
  priority?: number;
  contraindications?: string[];
}

export interface RankedMacro {
  macro: Macro;
  confidence: number; // 0-100
  rationale: string;
  isPrimary: boolean;
}

export interface IntentMatchResult {
  mode: "intent";
  matches: RankedMacro[];
  primaryIntent: string;
  secondaryIntents: string[];
  retrievalTimeMs: number;
  rerankTimeMs: number;
  totalTimeMs: number;
}
