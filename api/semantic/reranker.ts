/**
 * LLM-based Intent Reranker
 * Analyzes semantic candidates and reranks by intent match
 */

import type { Macro } from "../matcher.js";
import type { RetrievalCandidate } from "./retrieval.js";

export interface RankedMacro {
  macro: Macro;
  confidence: number; // 0-100
  rationale: string; // Why this macro was selected
  isPrimary: boolean; // Is this the primary intent match?
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const RERANK_MODEL = "gpt-4o-mini";

/**
 * Rerank candidates using LLM intent analysis
 */
export async function rerankByIntent(
  query: string,
  candidates: RetrievalCandidate[],
  topN = 3
): Promise<RankedMacro[]> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured for reranking");
  }

  // Prepare candidates for LLM
  const candidateList = candidates.map((c, idx) => ({
    id: idx,
    macroNumber: c.macro.number,
    title: c.macro.title,
    text: c.macro.text.substring(0, 500), // Truncate for token efficiency
    similarity: c.similarity.toFixed(3),
  }));

  const systemPrompt = `You are an expert intent analyzer for a telemedicine patient support system.

Your task:
1. Read the patient's message carefully
2. Infer their PRIMARY intent (billing issue, lab question, shipping problem, appointment need, etc.)
3. Identify any SECONDARY intents if present
4. Rank the provided macro candidates by how well they address the patient's intent
5. Return EXACTLY the top ${topN} macros with confidence scores and rationale

Intent categories to consider:
- Billing: charges, payments, invoices, refunds, receipts, subscription fees
- Labs: blood work, results, accessing portal, rescheduling labs, lab costs
- Shipping: delivery time, tracking, address issues, expedited shipping, lost package
- Appointments: scheduling, rescheduling, video visits, follow-ups
- Cancellation: stopping subscription, pausing membership
- Insurance: coverage questions, insurance acceptance
- Refills/Prescriptions: medication reorders, dose changes
- Replacements: lost/damaged medication, travel needs
- Discounts: promotions, referrals, pricing objections
- Address: changing shipping address, incorrect address
- Side effects/complaints: medication issues, dissatisfaction

CRITICAL RULES:
- Ignore keyword overlap - focus on INTENT match
- If patient says "I got charged $499" → primary intent is billing explanation
- If patient mentions "lab" but asks about billing → prioritize billing macros
- If patient mentions travel dates → consider appointment rescheduling context
- If address is wrong → replacement/address change macros, NOT general shipping info
- Confidence should reflect how well the macro solves their SPECIFIC problem

Output JSON ONLY (no markdown, no explanations):
{
  "primaryIntent": "billing|labs|shipping|appointments|cancellation|insurance|refills|replacements|discounts|address|complaints|other",
  "secondaryIntent": "..." or null,
  "rankedMacros": [
    {
      "id": 0,
      "confidence": 95,
      "rationale": "One sentence explaining why this macro solves the patient's intent",
      "isPrimary": true
    }
  ]
}`;

  const userPrompt = `Patient message: "${query}"

Candidate macros:
${JSON.stringify(candidateList, null, 2)}

Analyze intent and return top ${topN} macros as JSON.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: RERANK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI rerank error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    // Map back to full macros
    const ranked: RankedMacro[] = [];
    for (const item of result.rankedMacros.slice(0, topN)) {
      const candidate = candidates[item.id];
      if (candidate) {
        ranked.push({
          macro: candidate.macro,
          confidence: item.confidence,
          rationale: item.rationale,
          isPrimary: item.isPrimary,
        });
      }
    }

    return ranked;
  } catch (err) {
    console.error("[Reranker] LLM call failed:", err);
    throw err;
  }
}

/**
 * Deterministic fallback reranker (when LLM fails)
 * Uses similarity scores + basic intent heuristics
 */
export function deterministicRerank(
  query: string,
  candidates: RetrievalCandidate[],
  topN = 3
): RankedMacro[] {
  const queryLower = query.toLowerCase();
  
  // Simple intent detection
  const detectIntent = (): string => {
    if (/charged|billing|payment|invoice|refund|receipt|\$\d+/i.test(query)) return "billing";
    if (/lab|blood.*work|results|portal|quest|labcorp/i.test(query)) return "labs";
    if (/ship|delivery|tracking|fedex|usps|address.*wrong/i.test(query)) return "shipping";
    if (/appointment|schedule|visit|follow.*up/i.test(query)) return "appointments";
    if (/cancel|stop.*subscription/i.test(query)) return "cancellation";
    if (/insurance|coverage/i.test(query)) return "insurance";
    if (/lost|missing|damaged|replacement/i.test(query)) return "replacements";
    return "general";
  };
  
  const primaryIntent = detectIntent();
  
  // Boost candidates matching intent
  const scored = candidates.map((c) => {
    let score = c.similarity;
    const titleLower = c.macro.title.toLowerCase();
    
    if (primaryIntent === "billing" && /billing|charge|payment|refund/i.test(titleLower)) {
      score += 0.15;
    } else if (primaryIntent === "labs" && /lab|results|quest|akute/i.test(titleLower)) {
      score += 0.15;
    } else if (primaryIntent === "shipping" && /shipping|delivery|order|address/i.test(titleLower)) {
      score += 0.15;
    }
    
    return {
      macro: c.macro,
      confidence: Math.min(95, Math.round(score * 100)),
      rationale: `High semantic similarity (${(c.similarity * 100).toFixed(1)}%) to ${primaryIntent} query`,
      isPrimary: true,
      adjustedScore: score,
    };
  });
  
  scored.sort((a, b) => b.adjustedScore - a.adjustedScore);
  
  return scored.slice(0, topN);
}
