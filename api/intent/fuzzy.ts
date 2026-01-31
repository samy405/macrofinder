/**
 * Small fuzzy/Levenshtein helper for typo-tolerant matching
 * Used only for short words/signals - no external deps
 */

export function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/** Return true if word is close enough to signal (max 1 edit for len 3-4, 2 for 5+) */
export function fuzzyMatchWord(word: string, signal: string): boolean {
  if (word === signal) return true;
  const len = Math.max(word.length, signal.length);
  if (len < 3) return word === signal;
  const maxEdits = len <= 4 ? 1 : 2;
  return levenshtein(word, signal) <= maxEdits;
}

/** Check if normalized message contains a signal (exact or fuzzy for single words) */
export function messageContainsSignal(normalized: string, signal: string): boolean {
  if (normalized.includes(signal)) return true;
  const words = normalized.split(/\s+/);
  const signalWords = signal.split(/\s+/);
  if (signalWords.length === 1) {
    return words.some((w) => fuzzyMatchWord(w, signal));
  }
  // Multi-word: require all words present in order (fuzzy for each word)
  let i = 0;
  for (const sw of signalWords) {
    let found = false;
    while (i < words.length) {
      if (fuzzyMatchWord(words[i], sw) || words[i].includes(sw) || sw.includes(words[i])) {
        found = true;
        i++;
        break;
      }
      i++;
    }
    if (!found) return false;
  }
  return true;
}
