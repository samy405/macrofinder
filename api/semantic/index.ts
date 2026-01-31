/**
 * Semantic Matcher - Main Pipeline
 * Orchestrates: Embedding → Retrieval → Reranking
 */

import type { Macro } from "../matcher.js";
import { semanticRetrieve } from "./retrieval.js";
import { rerankByIntent, deterministicRerank } from "./reranker.js";
import type { RankedMacro } from "./reranker.js";
import { keywordFallback } from "./fallback.js";
import { hasEmbeddingsSupport } from "./embeddings.js";

export interface SemanticMatchResult {
  mode: "semantic" | "fallback";
  matches: RankedMacro[];
  primaryIntent?: string;
  secondaryIntent?: string;
  retrievalTimeMs: number;
  rerankTimeMs: number;
  totalTimeMs: number;
}

/**
 * Main semantic matching pipeline
 */
export async function semanticMatch(
  query: string,
  macros: Macro[],
  topN = 3
): Promise<SemanticMatchResult> {
  const startTime = Date.now();
  
  // Check if semantic search is available
  if (!hasEmbeddingsSupport()) {
    console.warn("[Semantic Matcher] OPENAI_API_KEY not configured - using fallback");
    const fallbackResults = keywordFallback(query, macros, topN);
    return {
      mode: "fallback",
      matches: fallbackResults,
      retrievalTimeMs: 0,
      rerankTimeMs: 0,
      totalTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Step 1: Semantic Retrieval (top 15 candidates)
    const retrievalStart = Date.now();
    const candidates = await semanticRetrieve(query, macros, 15);
    const retrievalTimeMs = Date.now() - retrievalStart;
    
    console.log(`[Semantic Matcher] Retrieved ${candidates.length} candidates in ${retrievalTimeMs}ms`);
    
    if (candidates.length === 0) {
      console.warn("[Semantic Matcher] No candidates found - using fallback");
      const fallbackResults = keywordFallback(query, macros, topN);
      return {
        mode: "fallback",
        matches: fallbackResults,
        retrievalTimeMs,
        rerankTimeMs: 0,
        totalTimeMs: Date.now() - startTime,
      };
    }
    
    // Step 2: Intent-based Reranking (top 3)
    const rerankStart = Date.now();
    let rankedMacros: RankedMacro[];
    
    try {
      rankedMacros = await rerankByIntent(query, candidates, topN);
    } catch (err) {
      console.error("[Semantic Matcher] LLM reranking failed, using deterministic fallback:", err);
      rankedMacros = deterministicRerank(query, candidates, topN);
    }
    
    const rerankTimeMs = Date.now() - rerankStart;
    
    console.log(`[Semantic Matcher] Reranked to ${rankedMacros.length} macros in ${rerankTimeMs}ms`);
    
    return {
      mode: "semantic",
      matches: rankedMacros,
      retrievalTimeMs,
      rerankTimeMs,
      totalTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    console.error("[Semantic Matcher] Pipeline failed:", err);
    
    // Final fallback
    const fallbackResults = keywordFallback(query, macros, topN);
    return {
      mode: "fallback",
      matches: fallbackResults,
      retrievalTimeMs: 0,
      rerankTimeMs: 0,
      totalTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Export for backward compatibility with existing API
 */
export interface LegacyMacroMatch {
  macro: Macro;
  score: number;
  matchReasons: string[];
  confidence?: number;
  category?: string;
  rationale?: string; // NEW: Semantic explanation
  isFallback?: boolean; // NEW: Indicates fallback mode
}

/**
 * Convert semantic results to legacy format for API compatibility
 */
export function convertToLegacyFormat(result: SemanticMatchResult): LegacyMacroMatch[] {
  return result.matches.map((m) => ({
    macro: m.macro,
    score: m.confidence / 10, // Scale 0-100 confidence to legacy 0-10 score
    matchReasons: [m.rationale],
    confidence: m.confidence,
    category: detectCategory(m.macro.title),
    rationale: m.rationale,
    isFallback: result.mode === "fallback",
  }));
}

/**
 * Detect category from macro title (for UI display)
 */
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
