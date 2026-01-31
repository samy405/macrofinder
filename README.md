# Macro Finder

**Semantic intent-based macro matching for patient support**

Macro Finder helps customer support teams quickly identify relevant response templates (macros) for patient messages. Unlike traditional keyword matchers, it uses **embeddings + LLM reranking** to understand intent, handling typos, slang, indirect phrasing, and multiple topics in a single message.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up OpenAI API Key
```bash
# Copy example env file
cp .env.example .env

# Add your OpenAI API key
# Edit .env and set: OPENAI_API_KEY=sk-...
```

### 3. Build Macro Embeddings
```bash
npm run build-embeddings
```
This generates `data/macro_embeddings.json` (~800KB) with semantic vectors for all 203 macros.

### 4. Run Locally
```bash
# Full-stack dev (frontend + API)
npx vercel dev

# Or frontend-only (no semantic matching)
npm run dev
```

---

## 🧠 How It Works

### Semantic Matching Pipeline
1. **Embed Query**: Patient message → 1536-dim vector (OpenAI `text-embedding-3-small`)
2. **Retrieve Top 15**: Cosine similarity search across all macro embeddings
3. **Rerank Top 3**: GPT-4o-mini analyzes intent and ranks by relevance
4. **Explain**: Each result includes confidence score + rationale

### Example
**Input**: `"I got charged $499, what is this for?"`

**Output**:
- 🥇 **Billing: Charge Alignment for Orders** (95% confidence)
  - *Rationale: Patient asking about unexpected charge; macro explains subscription billing cycle and payment timing*
- 🥈 **Subscription Fees Explanation** (78% confidence)
- 🥉 **Itemized Receipt** (65% confidence)

### Why Not Keywords?
Traditional systems fail on:
- ❌ Paraphrasing: "I got billed twice" vs "charged again"
- ❌ Typos: "cant find labz rezults"
- ❌ Indirect language: "FedEx says address is wrong" (intent: fix shipping address, not track package)
- ❌ Multi-topic: "I was sick and missed labs, link doesn't work" (primary: reschedule labs, secondary: portal access)

Semantic search handles all of these by understanding **meaning**, not just matching words.

---

## 📋 Testing

### Run All Tests
```bash
npm test
```

### Semantic-Specific Tests
```bash
npm run test:semantic
```

Tests validate:
- ✅ Returns relevant macros for paraphrased queries
- ✅ Handles typos and informal language
- ✅ Avoids keyword traps (e.g., "lab bill" → billing macro, NOT lab results)
- ✅ Provides confidence scores + rationales
- ✅ Completes within 2s

---

## 🔄 Updating Macros

### When macros change in `extracted_macros.md`:

1. **Regenerate embeddings** (required for semantic search):
   ```bash
   npm run build-embeddings
   ```

2. **Update data file** (for backward compatibility):
   ```bash
   npm run convert-macros
   ```

---

## 🏗️ Architecture

```
api/
  match.ts                # API endpoint (uses semantic matcher)
  matcher.ts              # Legacy matcher (now unused in prod)
  macrosData.ts           # Embedded macro data
  semantic/
    index.ts              # Main pipeline orchestrator
    embeddings.ts         # OpenAI embedding generation
    retrieval.ts          # Cosine similarity search
    reranker.ts           # LLM intent analysis
    fallback.ts           # Keyword fallback (when API unavailable)

data/
  macro_embeddings.json   # Pre-computed vectors (gitignored)

test/
  semantic.test.ts        # Comprehensive test suite

scripts/
  buildEmbeddings.js      # Generate embeddings script
```

---

## ⚙️ Configuration

### Environment Variables
```bash
OPENAI_API_KEY=sk-...    # Required for semantic matching
```

If not set, system falls back to keyword matching with **clear warning** in results.

### Performance Tuning
- **Embedding cache**: Query embeddings cached for 60s (see `retrieval.ts`)
- **Batch processing**: Embeddings built in batches of 10 to respect rate limits
- **Typical response time**: <1s (200ms embed + 10ms retrieve + 500ms rerank)

---

## 🚢 Deployment

### Vercel (Recommended)
```bash
vercel
```

Ensure `OPENAI_API_KEY` is set in Vercel environment variables.

### Other Platforms
1. Build embeddings locally: `npm run build-embeddings`
2. Include `data/macro_embeddings.json` in deployment
3. Set `OPENAI_API_KEY` in environment

---

## 📊 Monitoring

### Analytics Endpoint
```bash
GET /api/match?analytics=true
```

Returns:
- Total queries processed
- Semantic vs fallback usage rate
- Top queries

### Logs
Watch for `[FALLBACK MODE]` warnings — indicates API key issues or embedding failures.

---

## 🎨 UI Features

- **Confidence badges**: Color-coded (green/yellow/red) confidence scores
- **Rationales**: "Why this macro" explanations for each result
- **Fallback indicator**: `⚠️ Semantic search unavailable` when using keyword mode
- **Search tab**: Browse/filter all 203 macros by category
- **Copy history**: Recent clipboard items
- **Keyboard shortcuts**: Ctrl+Enter (submit), Escape (clear), Ctrl+Shift+C (copy response)
- **Light/Dark mode**: Persisted theme preference

---

## 📖 Further Reading

- [SEMANTIC_MATCHING.md](./SEMANTIC_MATCHING.md) - Detailed system architecture
- [SANITY_CHECK_TEST.md](./SANITY_CHECK_TEST.md) - Manual test cases

---

## 🐛 Troubleshooting

### "Embeddings not available"
Run `npm run build-embeddings` first.

### "OPENAI_API_KEY not configured"
Set the environment variable in `.env` or Vercel dashboard.

### Tests failing
Ensure `OPENAI_API_KEY` is set. Semantic tests require API access.

### Slow responses
- Check OpenAI API status
- Verify embeddings file exists (`data/macro_embeddings.json`)
- Monitor rate limits (embeddings API: 3,000 RPM)
