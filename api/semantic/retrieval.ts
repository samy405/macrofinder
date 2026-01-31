/**
 * Semantic Retrieval Module
 * Handles embedding-based similarity search
 */

import type { Macro } from "../matcher.js";
import type { MacroEmbedding, EmbeddingsStore } from "./embeddings.js";
import { cosineSimilarity, generateEmbedding } from "./embeddings.js";

export interface RetrievalCandidate {
  macro: Macro;
  similarity: number;
  embedding: number[];
}

let cachedEmbeddings: EmbeddingsStore | null = null;

/**
 * Load macro embeddings from storage
 */
export async function loadEmbeddings(): Promise<EmbeddingsStore> {
  if (cachedEmbeddings) {
    return cachedEmbeddings;
  }

  try {
    // Try to load from file system (for local dev with Node.js)
    if (typeof require !== "undefined") {
      const fs = await import("fs/promises");
      const path = await import("path");
      const embeddingsPath = path.join(process.cwd(), "data", "macro_embeddings.json");
      const data = await fs.readFile(embeddingsPath, "utf-8");
      cachedEmbeddings = JSON.parse(data);
      console.log(`[Embeddings] Loaded ${cachedEmbeddings!.macros.length} macro embeddings from file`);
      return cachedEmbeddings!;
    }
  } catch (err) {
    console.warn("[Embeddings] Failed to load from file system:", err);
  }

  // For serverless/Vercel, embeddings must be bundled or fetched
  throw new Error("Embeddings not available - run 'npm run build-embeddings' first");
}

/**
 * Retrieve top N macros by semantic similarity
 */
export async function semanticRetrieve(
  query: string,
  macros: Macro[],
  topN = 15
): Promise<RetrievalCandidate[]> {
  // Load embeddings store
  const store = await loadEmbeddings();
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);
  
  // Compute similarities
  const candidates: RetrievalCandidate[] = [];
  
  for (const macroEmb of store.macros) {
    const macro = macros.find((m) => m.number === macroEmb.macroNumber);
    if (!macro) continue;
    
    const similarity = cosineSimilarity(queryEmbedding, macroEmb.embedding);
    candidates.push({
      macro,
      similarity,
      embedding: macroEmb.embedding,
    });
  }
  
  // Sort by similarity descending
  candidates.sort((a, b) => b.similarity - a.similarity);
  
  return candidates.slice(0, topN);
}

/**
 * Cache query embeddings for short periods (optional optimization)
 */
const queryCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export async function getQueryEmbeddingCached(query: string): Promise<number[]> {
  const cached = queryCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.embedding;
  }
  
  const embedding = await generateEmbedding(query);
  queryCache.set(query, { embedding, timestamp: Date.now() });
  
  // Cleanup old entries
  if (queryCache.size > 100) {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [key, value] of queryCache.entries()) {
      if (value.timestamp < cutoff) {
        queryCache.delete(key);
      }
    }
  }
  
  return embedding;
}
