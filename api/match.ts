/**
 * Vercel Serverless Function: POST /api/match
 * Accepts { message: string } and returns matching macros + suggested response.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { findMacroMatches, getSuggestedResponse } from "./matcher.js";
import { macros } from "./macrosData.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body || {};

  if (message == null || typeof message !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'message' in body." });
  }

  try {
    const matches = findMacroMatches(message, macros, 3);
    const { suggestedResponse, macrosUsed } = getSuggestedResponse(message, matches);

    return res.status(200).json({
      matches,
      suggestedResponse,
      macrosUsed,
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
