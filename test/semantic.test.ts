/**
 * Semantic Matching System Tests
 * Validates that system uses semantic intent, NOT keyword matching
 */

import { describe, it, expect, beforeAll } from "vitest";
import { semanticMatch } from "../api/semantic/index";
import { macros } from "../api/macrosData";

// Skip tests if OPENAI_API_KEY not available
const hasApiKey = !!process.env.OPENAI_API_KEY;
const describeIfSemanticAvailable = hasApiKey ? describe : describe.skip;

describeIfSemanticAvailable("Semantic Matching System", () => {
  beforeAll(() => {
    if (!hasApiKey) {
      console.warn("⚠️  OPENAI_API_KEY not set - skipping semantic tests");
    }
  });

  // ============================================================================
  // REQUIRED TEST CASES (from spec)
  // ============================================================================

  it('A) "I got charged $499, what is this for?" -> billing/renewal explanation macro', async () => {
    const query = "I got charged $499, what is this for?";
    const result = await semanticMatch(query, macros, 3);
    
    expect(result.mode).toBe("semantic");
    expect(result.matches.length).toBeGreaterThan(0);
    
    const topMatch = result.matches[0];
    expect(topMatch.macro.title.toLowerCase()).toMatch(/billing|charge|payment|subscription|renewal/);
    expect(topMatch.confidence).toBeGreaterThan(50);
    expect(topMatch.rationale).toBeTruthy();
    
    console.log(`✓ Top match: ${topMatch.macro.title} (${topMatch.confidence}%)`);
    console.log(`  Rationale: ${topMatch.rationale}`);
  }, 30000);

  it('B) "I\'m in Hawaii until the 11th, can I do my follow-up?" -> out-of-state / reschedule visit guidance macro', async () => {
    const query = "I'm in Hawaii until the 11th, can I do my follow-up?";
    const result = await semanticMatch(query, macros, 3);
    
    expect(result.mode).toBe("semantic");
    expect(result.matches.length).toBeGreaterThan(0);
    
    const topMatch = result.matches[0];
    // Should match appointment/visit/scheduling macros, possibly out-of-state
    expect(topMatch.macro.title.toLowerCase()).toMatch(/visit|appointment|schedule|video|vv:|travel|out.*state/);
    expect(topMatch.confidence).toBeGreaterThan(40);
    
    console.log(`✓ Top match: ${topMatch.macro.title} (${topMatch.confidence}%)`);
    console.log(`  Rationale: ${topMatch.rationale}`);
  }, 30000);

  it('C) "FedEx says address is wrong, someone call them asap" -> shipping address change limitation / replacement fee macro', async () => {
    const query = "FedEx says address is wrong, someone call them asap";
    const result = await semanticMatch(query, macros, 3);
    
    expect(result.mode).toBe("semantic");
    expect(result.matches.length).toBeGreaterThan(0);
    
    const topMatch = result.matches[0];
    // Should prioritize address/shipping issues, NOT general shipping time
    expect(topMatch.macro.title.toLowerCase()).toMatch(/address|shipping|order|replacement|wrong|incorrect/);
    expect(topMatch.confidence).toBeGreaterThan(40);
    
    // Should NOT return "how long does shipping take" type macros
    expect(topMatch.macro.title.toLowerCase()).not.toMatch(/how long.*ship|shipping.*time/);
    
    console.log(`✓ Top match: ${topMatch.macro.title} (${topMatch.confidence}%)`);
    console.log(`  Rationale: ${topMatch.rationale}`);
  }, 30000);

  it('D) "I was sick and missed labs, link doesn\'t work" -> labs rescheduling + alternative scheduling link macro', async () => {
    const query = "I was sick and missed labs, link doesn't work";
    const result = await semanticMatch(query, macros, 3);
    
    expect(result.mode).toBe("semantic");
    expect(result.matches.length).toBeGreaterThan(0);
    
    const topMatch = result.matches[0];
    // Should prioritize lab rescheduling/access, NOT billing
    expect(topMatch.macro.title.toLowerCase()).toMatch(/lab|blood.*work|schedule|reschedul|quest|labcorp|akute/);
    expect(topMatch.confidence).toBeGreaterThan(40);
    
    console.log(`✓ Top match: ${topMatch.macro.title} (${topMatch.confidence}%)`);
    console.log(`  Rationale: ${topMatch.rationale}`);
  }, 30000);

  it('E) "Do I need labs before my follow up or just symptoms?" -> follow-up visit purpose + lab due date guidance macro', async () => {
    const query = "Do I need labs before my follow up or just symptoms?";
    const result = await semanticMatch(query, macros, 3);
    
    expect(result.mode).toBe("semantic");
    expect(result.matches.length).toBeGreaterThan(0);
    
    const topMatch = result.matches[0];
    // Should match visit/lab preparation macros
    expect(topMatch.macro.title.toLowerCase()).toMatch(/visit|appointment|lab|follow.*up|vv:|prepare/);
    expect(topMatch.confidence).toBeGreaterThan(30);
    
    console.log(`✓ Top match: ${topMatch.macro.title} (${topMatch.confidence}%)`);
    console.log(`  Rationale: ${topMatch.rationale}`);
  }, 30000);

  // ============================================================================
  // NEGATIVE TESTS (anti-keyword matching)
  // ============================================================================

  it('NEGATIVE: Message with "lab" but about billing should NOT rank lab macros above billing', async () => {
    const query = "I got a separate lab bill for $200, why wasn't this included in my subscription?";
    const result = await semanticMatch(query, macros, 3);
    
    expect(result.mode).toBe("semantic");
    expect(result.matches.length).toBeGreaterThan(0);
    
    const topMatch = result.matches[0];
    // Despite "lab" keyword, should prioritize billing macros
    expect(topMatch.macro.title.toLowerCase()).toMatch(/billing|lab.*bill|charge|payment/);
    
    // Lab results/scheduling macros should NOT be top match
    const isLabResultsOrScheduling = /lab.*results|schedule.*lab|quest.*order|labcorp.*order|akute.*share/i.test(topMatch.macro.title);
    expect(isLabResultsOrScheduling).toBe(false);
    
    console.log(`✓ Top match correctly prioritizes billing: ${topMatch.macro.title}`);
    console.log(`  Rationale: ${topMatch.rationale}`);
  }, 30000);

  it('NEGATIVE: Message with "charged" but about appointment scheduling should NOT return billing macros as top result', async () => {
    const query = "I need to reschedule my charged appointment for next week, what's the process?";
    const result = await semanticMatch(query, macros, 3);
    
    expect(result.mode).toBe("semantic");
    expect(result.matches.length).toBeGreaterThan(0);
    
    const topMatch = result.matches[0];
    // Despite "charged" keyword, should prioritize scheduling macros
    expect(topMatch.macro.title.toLowerCase()).toMatch(/schedule|appointment|visit|reschedul|vv:|video/);
    
    // General billing/charge macros should NOT be top match
    const isGeneralBilling = /billing.*charge|payment|invoice|subscription.*fee/i.test(topMatch.macro.title);
    expect(isGeneralBilling).toBe(false);
    
    console.log(`✓ Top match correctly prioritizes scheduling: ${topMatch.macro.title}`);
    console.log(`  Rationale: ${topMatch.rationale}`);
  }, 30000);

  // ============================================================================
  // ROBUSTNESS TESTS
  // ============================================================================

  it("Handles typos and informal language", async () => {
    const query = "cant find my labz rezults anywhere, hlp!";
    const result = await semanticMatch(query, macros, 3);
    
    expect(result.mode).toBe("semantic");
    expect(result.matches.length).toBeGreaterThan(0);
    
    const topMatch = result.matches[0];
    expect(topMatch.macro.title.toLowerCase()).toMatch(/lab|results|akute|portal/);
    
    console.log(`✓ Handled typos: ${topMatch.macro.title}`);
  }, 30000);

  it("Handles indirect/paraphrased questions", async () => {
    const query = "My meds never showed up, what should I do?";
    const result = await semanticMatch(query, macros, 3);
    
    expect(result.mode).toBe("semantic");
    expect(result.matches.length).toBeGreaterThan(0);
    
    const topMatch = result.matches[0];
    // Should match shipping/tracking/order issues
    expect(topMatch.macro.title.toLowerCase()).toMatch(/shipping|delivery|track|order|missing|lost/);
    
    console.log(`✓ Understood indirect phrasing: ${topMatch.macro.title}`);
  }, 30000);

  it("Returns rationale for each match", async () => {
    const query = "When is my next billing date?";
    const result = await semanticMatch(query, macros, 3);
    
    expect(result.mode).toBe("semantic");
    
    for (const match of result.matches) {
      expect(match.rationale).toBeTruthy();
      expect(match.rationale.length).toBeGreaterThan(10);
      expect(match.confidence).toBeGreaterThan(0);
      expect(match.confidence).toBeLessThanOrEqual(100);
    }
    
    console.log("✓ All matches have rationales:");
    result.matches.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.macro.title} (${m.confidence}%)`);
      console.log(`     ${m.rationale}`);
    });
  }, 30000);

  it("Performance: completes within 2 seconds", async () => {
    const query = "How do I cancel my subscription?";
    const start = Date.now();
    
    const result = await semanticMatch(query, macros, 3);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
    
    console.log(`✓ Completed in ${duration}ms`);
    console.log(`  Retrieval: ${result.retrievalTimeMs}ms`);
    console.log(`  Reranking: ${result.rerankTimeMs}ms`);
  }, 30000);
});

// ============================================================================
// FALLBACK MODE TESTS
// ============================================================================

describe("Fallback Mode (when semantic unavailable)", () => {
  it("Returns results with isFallback flag when OPENAI_API_KEY missing", async () => {
    // Temporarily remove API key
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    try {
      const query = "When is my next charge?";
      const result = await semanticMatch(query, macros, 3);
      
      expect(result.mode).toBe("fallback");
      expect(result.matches.length).toBeGreaterThan(0);
      
      for (const match of result.matches) {
        expect((match as any).isFallback).toBe(true);
        expect(match.rationale).toContain("FALLBACK");
      }
      
      console.log("✓ Fallback mode works correctly");
    } finally {
      // Restore API key
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      }
    }
  });
});
