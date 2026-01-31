#!/usr/bin/env node
/**
 * Build Macro Embeddings
 * Generates embeddings for all macros and saves to data/macro_embeddings.json
 * 
 * Usage: node scripts/buildEmbeddings.js
 * Requires: OPENAI_API_KEY environment variable
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY environment variable not set");
  console.error("   Set it with: export OPENAI_API_KEY=sk-...");
  process.exit(1);
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate auto-summary for a macro
 */
function generateMacroSummary(title, text) {
  const concepts = [];
  const combined = title + " " + text;
  
  if (/billing|charge|payment|invoice|refund|receipt/i.test(combined)) {
    concepts.push("billing and payments");
  }
  if (/lab|blood.*work|results|quest|labcorp|akute/i.test(combined)) {
    concepts.push("laboratory tests and results");
  }
  if (/ship|delivery|order|tracking|fedex|usps/i.test(combined)) {
    concepts.push("medication shipping and delivery");
  }
  if (/visit|appointment|schedule|consultation|provider/i.test(combined)) {
    concepts.push("appointments and consultations");
  }
  if (/cancel|discontinue|stop.*subscription/i.test(combined)) {
    concepts.push("subscription cancellation");
  }
  if (/insurance|coverage|accept.*insurance/i.test(combined)) {
    concepts.push("insurance coverage");
  }
  if (/refill|prescription|medication.*order/i.test(combined)) {
    concepts.push("prescription refills");
  }
  if (/discount|promo|coupon|referral/i.test(combined)) {
    concepts.push("discounts and promotions");
  }
  if (/address|wrong.*address|update.*address/i.test(combined)) {
    concepts.push("address changes");
  }
  if (/replacement|lost|missing|damaged/i.test(combined)) {
    concepts.push("medication replacements");
  }
  
  return concepts.length > 0 
    ? `Addresses: ${concepts.join(", ")}` 
    : "General patient support information";
}

/**
 * Prepare macro text for embedding
 */
function prepareMacroText(title, text) {
  const summary = generateMacroSummary(title, text);
  const cleanText = text.trim() || "[Title only - no detailed text available]";
  return `${title} | ${cleanText} | ${summary}`;
}

/**
 * Main build function
 */
async function buildEmbeddings() {
  console.log("🚀 Building macro embeddings...\n");
  
  // Load macros from extracted_macros.md
  const macrosFilePath = path.join(__dirname, "..", "extracted_macros.md");
  const macrosContent = await fs.readFile(macrosFilePath, "utf-8");
  
  // Parse macros
  const macros = [];
  const macroRegex = /##\s*Macro\s*(\d+):\s*(.+?)\n\n([\s\S]*?)(?=\n##\s*Macro\s*\d+:|$)/g;
  let match;
  
  while ((match = macroRegex.exec(macrosContent)) !== null) {
    const number = parseInt(match[1], 10);
    const title = match[2].trim();
    const text = match[3].trim();
    
    macros.push({ number, title, text });
  }
  
  console.log(`📊 Found ${macros.length} macros to process\n`);
  
  // Generate embeddings with progress tracking
  const embeddings = [];
  const batchSize = 10; // Process in batches to avoid rate limits
  
  for (let i = 0; i < macros.length; i += batchSize) {
    const batch = macros.slice(i, i + batchSize);
    const batchPromises = batch.map(async (macro) => {
      const preparedText = prepareMacroText(macro.title, macro.text);
      const summary = generateMacroSummary(macro.title, macro.text);
      
      try {
        const embedding = await generateEmbedding(preparedText);
        console.log(`✅ [${macro.number}/${macros.length}] ${macro.title}`);
        
        return {
          macroNumber: macro.number,
          title: macro.title,
          text: macro.text,
          summary,
          embedding,
        };
      } catch (err) {
        console.error(`❌ [${macro.number}] Failed: ${err.message}`);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults.filter((e) => e !== null));
    
    // Brief delay between batches to respect rate limits
    if (i + batchSize < macros.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  
  // Save embeddings
  const outputDir = path.join(__dirname, "..", "data");
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, "macro_embeddings.json");
  const embeddingsStore = {
    version: "1.0.0",
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    generatedAt: new Date().toISOString(),
    macros: embeddings,
  };
  
  await fs.writeFile(outputPath, JSON.stringify(embeddingsStore, null, 2));
  
  console.log(`\n✅ Successfully generated ${embeddings.length} embeddings`);
  console.log(`📁 Saved to: ${outputPath}`);
  console.log(`📦 File size: ${(JSON.stringify(embeddingsStore).length / 1024).toFixed(0)} KB`);
}

// Run
buildEmbeddings().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
