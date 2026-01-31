/**
 * Semantic Embeddings Module
 * Handles OpenAI embedding generation and storage
 */

export interface MacroEmbedding {
  macroNumber: number;
  title: string;
  text: string;
  summary: string;
  embedding: number[]; // 1536-dim vector
}

export interface EmbeddingsStore {
  version: string;
  model: string;
  macros: MacroEmbedding[];
  generatedAt: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate embedding for text using OpenAI API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

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
 * Generate auto-summary for a macro (for embedding enrichment)
 */
export function generateMacroSummary(title: string, text: string): string {
  // Extract key concepts without full LLM call (cost optimization)
  const concepts: string[] = [];
  
  // Billing indicators
  if (/billing|charge|payment|invoice|refund|receipt/i.test(title + text)) {
    concepts.push("billing and payments");
  }
  // Labs indicators
  if (/lab|blood.*work|results|quest|labcorp|akute/i.test(title + text)) {
    concepts.push("laboratory tests and results");
  }
  // Shipping indicators
  if (/ship|delivery|order|tracking|fedex|usps/i.test(title + text)) {
    concepts.push("medication shipping and delivery");
  }
  // Appointments/visits
  if (/visit|appointment|schedule|consultation|provider/i.test(title + text)) {
    concepts.push("appointments and consultations");
  }
  // Cancellation
  if (/cancel|discontinue|stop.*subscription/i.test(title + text)) {
    concepts.push("subscription cancellation");
  }
  // Insurance
  if (/insurance|coverage|accept.*insurance/i.test(title + text)) {
    concepts.push("insurance coverage");
  }
  // Refills/prescriptions
  if (/refill|prescription|medication.*order/i.test(title + text)) {
    concepts.push("prescription refills");
  }
  // Discounts/promotions
  if (/discount|promo|coupon|referral/i.test(title + text)) {
    concepts.push("discounts and promotions");
  }
  // Address/shipping issues
  if (/address|wrong.*address|update.*address/i.test(title + text)) {
    concepts.push("address changes");
  }
  // Replacements/lost medication
  if (/replacement|lost|missing|damaged/i.test(title + text)) {
    concepts.push("medication replacements");
  }
  
  const summary = concepts.length > 0 
    ? `Addresses: ${concepts.join(", ")}` 
    : "General patient support information";
  
  return summary;
}

/**
 * Prepare text for embedding (title + text + summary)
 */
export function prepareMacroText(title: string, text: string): string {
  const summary = generateMacroSummary(title, text);
  const cleanText = text.trim() || "[Title only - no detailed text available]";
  return `${title} | ${cleanText} | ${summary}`;
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Check if embeddings are available
 */
export function hasEmbeddingsSupport(): boolean {
  return OPENAI_API_KEY.length > 0;
}
