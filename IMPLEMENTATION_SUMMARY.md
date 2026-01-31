# Semantic Matching Implementation - Summary

## What Changed

### Before (Keyword-Based)
- ❌ Regex pattern matching for scenarios
- ❌ Bag-of-words keyword counting
- ❌ Substring phrase matching
- ❌ Hard-coded synonym lists
- ❌ No understanding of intent
- ❌ Failed on paraphrasing, typos, indirect language

### After (Semantic Search)
- ✅ OpenAI embeddings (1536-dim vectors)
- ✅ Cosine similarity retrieval (top 15 candidates)
- ✅ GPT-4o-mini intent reranking (top 3)
- ✅ Confidence scores + rationales
- ✅ Handles typos, slang, indirect phrasing
- ✅ Multi-intent detection
- ✅ Fallback mode when API unavailable

---

## Implementation Details

### New Files Created

#### `api/semantic/`
- **`embeddings.ts`**: OpenAI embedding generation, cosine similarity
- **`retrieval.ts`**: Semantic search, embedding cache
- **`reranker.ts`**: LLM intent analysis, deterministic fallback
- **`fallback.ts`**: Keyword matcher (used ONLY when API unavailable)
- **`index.ts`**: Pipeline orchestrator

#### `scripts/`
- **`buildEmbeddings.js`**: Generates `data/macro_embeddings.json`

#### `test/`
- **`semantic.test.ts`**: Comprehensive test suite

#### Documentation
- **`SEMANTIC_MATCHING.md`**: Architecture details
- **`README.md`**: Updated with semantic search info
- **`.env.example`**: Environment variable template

### Modified Files

#### `api/match.ts`
- **Before**: Called `findMacroMatches()` (keyword-based)
- **After**: Calls `semanticMatch()` (embeddings + reranking)
- Added semantic metadata to response:
  - `matchingMode`: "semantic" | "fallback"
  - `primaryIntent`: detected intent category
  - `performanceMs`: timing breakdown

#### `src/App.tsx`
- Added `rationale` display for each macro ("Why this macro")
- Added fallback mode warning banner
- Added performance info display
- Updated type definitions for semantic fields

#### `src/App.css`
- Added styles for rationale, fallback warning, performance info

#### `package.json`
- Added `build-embeddings` script
- Added `vitest` for testing
- Added `test:semantic` script

#### `.gitignore`
- Added `data/macro_embeddings.json` (large file, regenerate locally)

---

## Test Results

### Required Test Cases (from spec)
All 5 required tests **PASS**:

| Query | Expected | Status |
|-------|----------|--------|
| A) "I got charged $499, what is this for?" | Billing/renewal explanation | ✅ Pass |
| B) "I'm in Hawaii until the 11th, can I do my follow-up?" | Out-of-state/reschedule visit | ✅ Pass |
| C) "FedEx says address is wrong, someone call them asap" | Address change limitation | ✅ Pass |
| D) "I was sick and missed labs, link doesn't work" | Labs rescheduling + link | ✅ Pass |
| E) "Do I need labs before my follow up or just symptoms?" | Follow-up visit + lab guidance | ✅ Pass |

### Negative Tests (Anti-Keyword Matching)
Both negative tests **PASS**:

| Query | Should NOT Return | Status |
|-------|-------------------|--------|
| "I got a separate lab bill for $200" | Lab results/scheduling macros | ✅ Pass (returns billing) |
| "I need to reschedule my charged appointment" | General billing/charge macros | ✅ Pass (returns scheduling) |

### Robustness Tests
All robustness tests **PASS**:

| Feature | Test | Status |
|---------|------|--------|
| Typos | "cant find my labz rezults" | ✅ Pass |
| Indirect phrasing | "My meds never showed up" | ✅ Pass |
| Rationales | All matches include explanations | ✅ Pass |
| Performance | <2s response time | ✅ Pass |

---

## Usage Instructions

### For Developers

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set OpenAI API key**:
   ```bash
   cp .env.example .env
   # Edit .env and add: OPENAI_API_KEY=sk-...
   ```

3. **Build embeddings** (required once, or when macros change):
   ```bash
   npm run build-embeddings
   ```
   
   This generates `data/macro_embeddings.json` (~800KB) with vectors for all 203 macros.

4. **Run tests**:
   ```bash
   npm run test:semantic
   ```

5. **Run locally**:
   ```bash
   npx vercel dev
   ```

### For Deployment (Vercel)

1. **Set environment variable** in Vercel dashboard:
   ```
   OPENAI_API_KEY=sk-...
   ```

2. **Build embeddings locally**:
   ```bash
   npm run build-embeddings
   ```
   
3. **Commit embeddings file** (or regenerate in CI):
   ```bash
   git add data/macro_embeddings.json
   git commit -m "Add macro embeddings"
   git push
   ```
   
   Note: This is a ~800KB file. Alternatively, generate in CI/build step.

4. **Deploy**:
   ```bash
   vercel
   ```

---

## Performance

### Typical Response Times
- **Query embedding**: ~200ms (OpenAI API)
- **Similarity search**: <10ms (in-memory)
- **LLM reranking**: ~500ms (GPT-4o-mini)
- **Total**: <1s for most queries

### Optimizations Implemented
- Pre-computed macro embeddings (not regenerated per query)
- Query embedding cache (60s TTL)
- Batch processing for embedding generation
- Deterministic fallback when LLM unavailable

---

## Fallback Behavior

### When Fallback Triggers
- `OPENAI_API_KEY` not set
- Embeddings file missing
- OpenAI API error (rate limit, network issue)

### Fallback Mode
- Uses simple keyword matching (NOT recommended for production)
- Returns results with `isFallback: true` flag
- Shows prominent warning in UI: "⚠️ Keyword fallback mode"
- Lower confidence scores (capped at 70%)

---

## Cost Estimate

### OpenAI API Usage

**Embedding Generation** (one-time):
- 203 macros × ~500 tokens each = ~100,000 tokens
- Cost: ~$0.002 (one-time)

**Query Embeddings** (per query):
- ~50 tokens average
- Cost: ~$0.000001 per query

**Reranking** (per query):
- ~1,500 tokens (15 candidates + prompt)
- Cost: ~$0.0002 per query

**Total per query**: ~$0.0002 (0.02¢)

For 10,000 queries/month: **~$2.00/month**

---

## Maintenance

### When Macros Change

1. Update `extracted_macros.md`
2. Regenerate embeddings:
   ```bash
   npm run build-embeddings
   ```
3. Commit and deploy:
   ```bash
   git add data/macro_embeddings.json
   git commit -m "Update macro embeddings"
   git push
   ```

### Monitoring

Check analytics endpoint:
```bash
GET /api/match?analytics=true
```

Returns:
```json
{
  "totalQueries": 1234,
  "semanticQueries": 1200,
  "fallbackQueries": 34,
  "fallbackRate": "2.8%"
}
```

**Alert if fallback rate > 5%** (indicates API key or embedding issues)

---

## Known Limitations

1. **Requires OpenAI API key** - No offline mode (by design)
2. **Embedding file size** - 800KB (acceptable for most deployments)
3. **Cold start latency** - First query loads embeddings (~100ms overhead)
4. **Rate limits** - OpenAI API has usage limits (monitor in production)

---

## Success Metrics

✅ **All test cases pass** (5 required + 2 negative + robustness tests)  
✅ **No keyword matching** in production code path  
✅ **Confidence scores** provided for all results  
✅ **Rationales** explain each match  
✅ **Performance** <2s per query  
✅ **Fallback mode** works when API unavailable  
✅ **Documentation** complete (README, SEMANTIC_MATCHING.md)  
✅ **Tests** automated with Vitest  

---

## Next Steps (Optional Enhancements)

1. **Fine-tuned embedding model** - Train custom model on medical/support domain
2. **Caching layer** - Redis for query embedding cache
3. **Analytics dashboard** - Track popular queries, fallback rate, confidence distribution
4. **Hybrid scoring** - Combine semantic similarity with macro popularity/recency
5. **Multi-language support** - Translate queries before embedding
6. **Feedback loop** - Use 👍/👎 feedback to improve reranking

---

## Contact

For questions about the semantic matching system:
- See `SEMANTIC_MATCHING.md` for technical details
- See `test/semantic.test.ts` for usage examples
- Run `npm run test:semantic` to validate setup
