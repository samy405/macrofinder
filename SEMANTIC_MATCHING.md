# Semantic Macro Matching System

## Overview
This system uses **embeddings-based semantic search** + **LLM intent reranking** to match patient messages to macros based on meaning, not keywords.

## Architecture

### Pipeline
1. **Embed Query**: Convert full patient message to vector embedding
2. **Semantic Retrieval**: Find top 15 candidates using cosine similarity
3. **Intent Reranking**: LLM analyzes intent and reranks top 3
4. **Explain**: Generate "why this macro" rationale for each result

### Components
- `api/semantic/embeddings.ts`: OpenAI embedding generation & storage
- `api/semantic/retrieval.ts`: Cosine similarity search
- `api/semantic/reranker.ts`: LLM-based intent reranking
- `api/semantic/fallback.ts`: Keyword fallback when embeddings unavailable
- `data/macro_embeddings.json`: Pre-computed macro vectors (gitignored)

## Setup

### 1. Environment Variables
```bash
# Required for semantic search
OPENAI_API_KEY=sk-...

# Optional: fallback to keyword matching if not set
```

### 2. Generate Macro Embeddings
```bash
npm run build-embeddings
```

This creates `data/macro_embeddings.json` with vectors for all 203 macros.

### 3. Run App
```bash
npm run dev          # Local development
npx vercel dev       # With serverless functions
```

## How It Works

### Semantic Search (Primary)
- Uses OpenAI `text-embedding-3-small` (1536 dimensions)
- Each macro embedded as: `{title} | {text} | {auto-generated summary}`
- Query embedding uses full patient message (typos, slang, all included)
- Cosine similarity finds most semantically relevant macros

### Intent Reranking
- Top 15 candidates passed to GPT-4o-mini
- LLM analyzes: billing vs labs vs shipping vs appointments vs complaints
- Outputs top 3 with confidence scores (0-100%) and rationale
- Example rationale: "Patient asking about unexpected charge; macro explains subscription billing cycle"

### Fallback Mode
- If `OPENAI_API_KEY` missing or embeddings not built: falls back to keyword matching
- Clear warning shown in results: `⚠️ Semantic search unavailable - using keyword fallback`

## Testing

```bash
npm test                    # Run all tests
npm run test:semantic       # Semantic-specific tests
```

### Test Coverage
- Semantic retrieval returns relevant macros for paraphrased queries
- Keyword overlap does NOT dominate ranking
- Handles typos, slang, indirect language
- Multi-intent queries prioritize primary intent

## Performance
- **Macro embeddings**: Pre-computed, loaded once at startup (~800KB)
- **Query embedding**: ~200ms (OpenAI API call)
- **Retrieval**: <10ms (in-memory cosine similarity)
- **Reranking**: ~500ms (GPT-4o-mini API call)
- **Total**: <1s for most queries

## Maintenance

### Rebuild Embeddings
When macros change, regenerate embeddings:
```bash
npm run build-embeddings
```

### Monitor Fallback Rate
Check logs for `[FALLBACK MODE]` warnings - indicates API key issues or embedding failures.
