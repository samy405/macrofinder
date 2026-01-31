/**
 * Intent-based matching system tests
 * NO API - validates intent detection and macro ranking
 */

import { describe, it, expect } from "vitest";
import { intentMatch } from "../api/intent/index.js";
import { macros } from "../api/macrosData.js";

describe("Intent-based matching", () => {
  // ============================================================================
  // REQUIRED TEST CASES (from spec)
  // ============================================================================

  it('A) "I got charged $499, what is this for?" -> billing/renewal macro', async () => {
    const query = "I got charged $499, what is this for?";
    const result = intentMatch(query, macros, 3);

    expect(result.mode).toBe("intent");
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.primaryIntent).toMatch(/billing|labs_bill/);

    const topTitles = result.matches.slice(0, 3).map((m) => m.macro.title.toLowerCase());
    const hasBilling = topTitles.some((t) => /billing|charge|payment|subscription|renewal/.test(t));
    expect(hasBilling).toBe(true);

    const top = result.matches[0];
    expect(top.confidence).toBeGreaterThan(0);
    expect(top.rationale).toBeTruthy();
  });

  it('B) "I\'m in Hawaii until the 11th, can I do my follow-up?" -> out-of-state / reschedule macro', async () => {
    const query = "I'm in Hawaii until the 11th, can I do my follow-up?";
    const result = intentMatch(query, macros, 3);

    expect(result.mode).toBe("intent");
    expect(result.matches.length).toBeGreaterThan(0);

    const topTitles = result.matches.slice(0, 3).map((m) => m.macro.title.toLowerCase());
    const hasVisitOrTravel = topTitles.some((t) =>
      /visit|appointment|schedule|video|vv:|travel|out.*state|lc.*travel|can'?t register due to travel/.test(t)
    );
    expect(hasVisitOrTravel).toBe(true);

    expect(result.matches[0].confidence).toBeGreaterThan(0);
    expect(result.matches[0].rationale).toBeTruthy();
  });

  it('C) "FedEx says you all put the address in wrong someone needs to call them asap" -> address / replacement macro', async () => {
    const query = "FedEx says you all put the address in wrong someone needs to call them asap";
    const result = intentMatch(query, macros, 3);

    expect(result.mode).toBe("intent");
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.primaryIntent).toBe("shipping_address");

    const topTitles = result.matches.slice(0, 3).map((m) => m.macro.title.toLowerCase());
    const hasAddressOrShipping = topTitles.some((t) =>
      /address|shipping|order|replacement|wrong|zip|zip code/.test(t)
    );
    expect(hasAddressOrShipping).toBe(true);

    expect(result.matches[0].rationale).toBeTruthy();
  });

  it('D) "I was sick and missed labs, link doesn\'t work" -> lab reschedule + alternative scheduling macro', async () => {
    const query = "I was sick and missed labs, link doesn't work";
    const result = intentMatch(query, macros, 3);

    expect(result.mode).toBe("intent");
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.primaryIntent).toBe("labs_scheduling");

    const topTitles = result.matches.slice(0, 3).map((m) => m.macro.title.toLowerCase());
    const hasLabOrSchedule = topTitles.some((t) =>
      /lab|blood|schedule|reschedul|quest|labcorp|akute|lc:|tech/.test(t)
    );
    expect(hasLabOrSchedule).toBe(true);

    expect(result.matches[0].confidence).toBeGreaterThan(0);
  });

  it('E) "Do I need labs before my follow up or just symptoms?" -> follow-up + lab due date macro', async () => {
    const query = "Do I need labs before my follow up or just symptoms?";
    const result = intentMatch(query, macros, 3);

    expect(result.mode).toBe("intent");
    expect(result.matches.length).toBeGreaterThan(0);

    const topTitles = result.matches.slice(0, 3).map((m) => m.macro.title.toLowerCase());
    const hasVisitOrLab = topTitles.some((t) =>
      /visit|appointment|lab|follow|vv:|prepare|before/.test(t)
    );
    expect(hasVisitOrLab).toBe(true);

    expect(result.primaryIntent).toMatch(/lab_due_before_visit|follow_up_visit|labs/);
  });

  // ============================================================================
  // NEGATIVE TESTS
  // ============================================================================

  it('NEGATIVE: "lab" but about billing should NOT rank lab results above billing', () => {
    const query = "I got charged for my lab";
    const result = intentMatch(query, macros, 3);

    expect(result.matches.length).toBeGreaterThan(0);
    const top = result.matches[0].macro.title.toLowerCase();
    expect(top).toMatch(/billing|charge|payment|lab.*bill|bill/);
    expect(result.primaryIntent).not.toBe("labs_results");
  });

  it('NEGATIVE: "charged" but about appointment logistics should NOT rank billing above scheduling', () => {
    const query = "I need to reschedule my charged appointment for next week, what's the process?";
    const result = intentMatch(query, macros, 3);

    expect(result.matches.length).toBeGreaterThan(0);
    const topTitles = result.matches.slice(0, 3).map((m) => m.macro.title.toLowerCase());
    const topIsScheduling = topTitles.some((t) =>
      /schedule|appointment|visit|reschedul|vv:|video/.test(t)
    );
    expect(topIsScheduling).toBe(true);
    expect(result.primaryIntent).toBe("scheduling");
  });

  it("Handles typos and informal language", () => {
    const query = "cant find my labz rezults anywhere, hlp!";
    const result = intentMatch(query, macros, 3);

    expect(result.matches.length).toBeGreaterThan(0);
    const top = result.matches[0].macro.title.toLowerCase();
    expect(top).toMatch(/lab|results|akute|portal/);
  });

  it("Returns rationale and confidence for each match", () => {
    const query = "When is my next billing date?";
    const result = intentMatch(query, macros, 3);

    for (const match of result.matches) {
      expect(match.rationale).toBeTruthy();
      expect(match.rationale.length).toBeGreaterThan(10);
      expect(match.confidence).toBeGreaterThan(0);
      expect(match.confidence).toBeLessThanOrEqual(100);
    }
  });

  it('"Can I switch to a different subscription plan?" -> Switch plans #1, then plan/pricing macros', () => {
    const query = "Can I switch to a different subscription plan?";
    const result = intentMatch(query, macros, 3);

    expect(result.mode).toBe("intent");
    expect(result.primaryIntent).toBe("plan_change");
    expect(result.matches.length).toBeGreaterThan(0);

    // Direct-answer "Switch plans" must rank first (short body gets direct-answer boost)
    const topTitle = result.matches[0].macro.title.toLowerCase();
    expect(topTitle).toBe("switch plans");

    const topTitles = result.matches.slice(0, 3).map((m) => m.macro.title.toLowerCase());
    const hasPlanPricing = topTitles.some((t) =>
      /switch\s+plans|charge\s+alignment|subscription\s+fees|pricing\s+plans|pricing|plan/.test(t)
    );
    expect(hasPlanPricing).toBe(true);
    // Should NOT rank pharmacy order, pause, or TRT qualify as top
    const badTitles = ["if a patient had an order processed by another pharmacy", "pause confirmation", "do i qualify for trt"];
    for (const bad of badTitles) {
      expect(topTitles[0]).not.toContain(bad.replace(/\s+/g, " "));
    }
  });

  it('"I need an itemized receipt for FSA" -> receipt/itemized macro', () => {
    const query = "I need an itemized receipt for FSA";
    const result = intentMatch(query, macros, 3);
    expect(result.primaryIntent).toBe("receipt_itemized");
    expect(result.matches.length).toBeGreaterThan(0);
    const top = result.matches[0].macro.title.toLowerCase();
    expect(top).toMatch(/receipt|itemized|fsa|hsa|itemize/);
  });

  it('"I want to resume treatment later" -> resume treatment macro', () => {
    const query = "I want to resume treatment later";
    const result = intentMatch(query, macros, 3);
    expect(result.primaryIntent).toBe("resume_treatment");
    const topTitles = result.matches.slice(0, 3).map((m) => m.macro.title.toLowerCase());
    expect(topTitles.some((t) => /resume|later\s+date/.test(t))).toBe(true);
  });

  it('"I got a letter saying my prescription was filled by another pharmacy" -> pharmacy other macro', () => {
    const query = "I got a letter saying my prescription was filled by another pharmacy";
    const result = intentMatch(query, macros, 3);
    expect(result.primaryIntent).toBe("pharmacy_other");
    const top = result.matches[0].macro.title.toLowerCase();
    expect(top).toMatch(/another\s+pharmacy|order\s+processed/);
  });

  it('"Where are you located?" -> General CS: Where are you located?', () => {
    const query = "Where are you located?";
    const result = intentMatch(query, macros, 3);
    expect(result.mode).toBe("intent");
    expect(result.primaryIntent).toBe("company_location");
    expect(result.matches.length).toBeGreaterThan(0);
    const topTitle = result.matches[0].macro.title.toLowerCase();
    expect(topTitle).toContain("where are you located");
  });

  it('"Do you prescribe peptides?" -> prescribe peptides macro (not ED or HRT injections)', () => {
    const query = "Do you prescribe peptides?";
    const result = intentMatch(query, macros, 3);
    expect(result.primaryIntent).toBe("prescribe_question");
    const topTitle = result.matches[0].macro.title.toLowerCase();
    expect(topTitle).toMatch(/peptides/);
  });

  it("Completes quickly (no network)", () => {
    const query = "How do I cancel my subscription?";
    const start = Date.now();
    intentMatch(query, macros, 3);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });
});
