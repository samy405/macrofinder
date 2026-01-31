/**
 * Vercel Serverless Function: POST /api/match
 * Accepts { message: string } and returns matching macros + suggested response.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { findMacroMatches, getSuggestedResponse, detectPlaceholders } from "./matcher.js";
import { macros } from "./macrosData.js";

// Simple analytics storage (in-memory for demo; use database in production)
const analytics = {
  totalQueries: 0,
  commonQueries: new Map<string, number>(),
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET /api/match?macros=true - Return all macros for search
  if (req.method === "GET") {
    const { macros: getMacros, analytics: getAnalytics } = req.query;
    
    if (getMacros === "true") {
      // Return all macros with categories for search/filtering
      const macrosWithCategories = macros.map((m) => ({
        ...m,
        category: detectCategory(m.title),
      }));
      return res.status(200).json({ macros: macrosWithCategories });
    }
    
    if (getAnalytics === "true") {
      return res.status(200).json({
        totalQueries: analytics.totalQueries,
        topQueries: Array.from(analytics.commonQueries.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
      });
    }
    
    return res.status(400).json({ error: "Invalid GET request" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, feedback } = req.body || {};

  // Handle feedback submission
  if (feedback !== undefined) {
    // In production, store this in a database
    console.log("Feedback received:", feedback);
    return res.status(200).json({ success: true });
  }

  if (message == null || typeof message !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'message' in body." });
  }

  try {
    // Track analytics
    analytics.totalQueries++;
    const queryKey = message.toLowerCase().substring(0, 50);
    analytics.commonQueries.set(queryKey, (analytics.commonQueries.get(queryKey) || 0) + 1);

    const matches = findMacroMatches(message, macros, 3);
    const { suggestedResponse, macrosUsed } = getSuggestedResponse(message, matches);

    // Calculate confidence scores (normalize to 0-100%)
    const maxPossibleScore = 15; // Rough max score for a perfect match
    const matchesWithConfidence = matches.map((m) => ({
      ...m,
      confidence: Math.min(100, Math.round((m.score / maxPossibleScore) * 100)),
      category: detectCategory(m.macro.title),
    }));

    // Detect placeholders in suggested response
    const placeholders = detectPlaceholders(suggestedResponse);

    return res.status(200).json({
      matches: matchesWithConfidence,
      suggestedResponse,
      macrosUsed,
      placeholders: placeholders.length > 0 ? placeholders : undefined,
      hasPlaceholders: placeholders.length > 0,
    });
  } catch (err) {
    console.error("Matcher error:", err);
    return res.status(500).json({
      error: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}

/**
 * Detect category from macro title
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
