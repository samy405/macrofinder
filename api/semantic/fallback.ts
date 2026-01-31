/**
 * Keyword Fallback Matcher
 * Used ONLY when semantic search is unavailable
 */

import type { Macro } from "../matcher.js";

export interface KeywordMatch {
  macro: Macro;
  score: number;
  confidence: number;
  rationale: string;
  isPrimary: boolean;
  isFallback: true; // Always true for fallback mode
}

/**
 * Simple keyword-based fallback (NOT the primary matching strategy)
 */
export function keywordFallback(query: string, macros: Macro[], topN = 3): KeywordMatch[] {
  console.warn("[FALLBACK MODE] Using keyword matching - embeddings unavailable");
  
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
  
  const scored = macros.map((macro) => {
    const titleLower = macro.title.toLowerCase();
    const textLower = macro.text.toLowerCase();
    
    let score = 0;
    
    // Title keyword matches
    for (const word of queryWords) {
      if (titleLower.includes(word)) {
        score += 2;
      }
    }
    
    // Text keyword matches
    for (const word of queryWords) {
      if (textLower.includes(word)) {
        score += 0.5;
      }
    }
    
    // Simple intent boost
    if (/charged|billing|payment/i.test(query) && /billing|charge/i.test(titleLower)) {
      score += 5;
    }
    if (/lab|results/i.test(query) && /lab|results/i.test(titleLower)) {
      score += 5;
    }
    if (/shipping|delivery/i.test(query) && /shipping|order/i.test(titleLower)) {
      score += 5;
    }
    
    return {
      macro,
      score,
      confidence: Math.min(70, Math.round((score / 10) * 100)), // Lower confidence for fallback
      rationale: `[FALLBACK] Keyword match - semantic search unavailable`,
      isPrimary: true,
      isFallback: true as const,
    };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, topN);
}
