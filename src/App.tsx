import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";

const INTRO_TEXT =
  "Macro Finder helps you quickly identify the best macro(s) to respond to a patient message. Paste the patient's message below (remove any identifying details), then submit to get the top matching macros and a suggested draft response you can edit and send.";

export type MacroMatchResult = {
  macro: { number: number; title: string; text: string };
  score: number;
  matchReasons: string[];
  confidence?: number;
  category?: string;
  rationale?: string; // NEW: Semantic explanation
  isFallback?: boolean; // NEW: Indicates fallback mode
};

export type ApiResult = {
  matches: MacroMatchResult[];
  suggestedResponse: string;
  macrosUsed: string[];
  placeholders?: string[];
  hasPlaceholders?: boolean;
  matchingMode?: "semantic" | "fallback"; // NEW
  primaryIntent?: string; // NEW
  secondaryIntent?: string; // NEW
  performanceMs?: { // NEW
    retrieval: number;
    rerank: number;
    total: number;
  };
};

type MacroData = {
  number: number;
  title: string;
  text: string;
  category: string;
};

type CopyHistoryItem = {
  text: string;
  label: string;
  timestamp: number;
};

function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<"helpful" | "not-helpful" | null>(null);
  
  // Search macros state
  const [activeTab, setActiveTab] = useState<"finder" | "search">("finder");
  const [allMacros, setAllMacros] = useState<MacroData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [macrosLoading, setMacrosLoading] = useState(false);
  
  // Copy history
  const [copyHistory, setCopyHistory] = useState<CopyHistoryItem[]>(() => {
    const saved = localStorage.getItem("copyHistory");
    return saved ? JSON.parse(saved) : [];
  });
  const [showCopyHistory, setShowCopyHistory] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Save copy history to localStorage
  useEffect(() => {
    localStorage.setItem("copyHistory", JSON.stringify(copyHistory.slice(0, 10)));
  }, [copyHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter to submit (when textarea is focused and Ctrl/Cmd is pressed)
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && message.trim() && !loading) {
        e.preventDefault();
        handleSubmit();
      }
      // Escape to clear
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        handleClear();
      }
      // Ctrl+Shift+C to copy suggested response
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C" && result) {
        e.preventDefault();
        copyToClipboard(result.suggestedResponse, "suggested", "Suggested Response");
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [message, loading, result]);

  // Load all macros for search
  useEffect(() => {
    if (activeTab === "search" && allMacros.length === 0) {
      setMacrosLoading(true);
      fetch("/api/match?macros=true")
        .then((res) => res.json())
        .then((data) => {
          setAllMacros(data.macros || []);
        })
        .catch(() => {
          setError("Failed to load macros for search.");
        })
        .finally(() => setMacrosLoading(false));
    }
  }, [activeTab, allMacros.length]);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  const handleSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFeedbackGiven(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Request failed: ${res.status}`);
      }
      const data: ApiResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  const handleClear = useCallback(() => {
    setMessage("");
    setResult(null);
    setError(null);
    setFeedbackGiven(null);
    textareaRef.current?.focus();
  }, []);

  const copyToClipboard = useCallback(async (text: string, id: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      
      // Add to copy history
      if (label) {
        setCopyHistory((prev) => [
          { text, label, timestamp: Date.now() },
          ...prev.filter((h) => h.text !== text).slice(0, 9),
        ]);
      }
    } catch {
      setError("Copy failed.");
    }
  }, []);

  const handleFeedback = useCallback(async (helpful: boolean) => {
    setFeedbackGiven(helpful ? "helpful" : "not-helpful");
    try {
      await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: { helpful, query: message, matches: result?.matches.map(m => m.macro.title) } }),
      });
    } catch {
      // Silent fail for feedback
    }
  }, [message, result]);

  // Get unique categories for filter
  const categories = ["All", ...new Set(allMacros.map((m) => m.category))].sort();

  // Filter macros for search
  const filteredMacros = allMacros.filter((m) => {
    const matchesSearch = searchQuery === "" || 
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "confidence-high";
    if (confidence >= 50) return "confidence-medium";
    return "confidence-low";
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header-content">
          <div className="logo-link" aria-hidden="true">
            <img
              src={theme === "light" ? "/brand/fountain-logo-light.png?v=1" : "/brand/fountain-logo-dark.png?v=1"}
              alt="Fountain"
              className="fountain-logo"
            />
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => setShowCopyHistory(!showCopyHistory)}
              title="Copy history"
            >
              📋 History
            </button>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="macro-finder-page">
          {/* Copy History Panel */}
          {showCopyHistory && (
            <div className="copy-history-panel">
              <div className="copy-history-header">
                <h4>Copy History</h4>
                <button className="btn btn-small" onClick={() => setCopyHistory([])}>Clear</button>
              </div>
              {copyHistory.length === 0 ? (
                <p className="copy-history-empty">No items copied yet.</p>
              ) : (
                <ul className="copy-history-list">
                  {copyHistory.map((item, i) => (
                    <li key={i} className="copy-history-item">
                      <span className="copy-history-label">{item.label}</span>
                      <span className="copy-history-preview">{item.text.substring(0, 50)}...</span>
                      <button
                        className="btn btn-small"
                        onClick={() => copyToClipboard(item.text, `history-${i}`)}
                      >
                        {copiedId === `history-${i}` ? "✓" : "Copy"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="welcome-message">
            <h2>Macro Finder</h2>
            <p>{INTRO_TEXT}</p>
          </div>

          {/* Tab navigation */}
          <div className="tab-nav">
            <button
              className={`tab-btn ${activeTab === "finder" ? "active" : ""}`}
              onClick={() => setActiveTab("finder")}
            >
              Find Macros
            </button>
            <button
              className={`tab-btn ${activeTab === "search" ? "active" : ""}`}
              onClick={() => setActiveTab("search")}
            >
              Search All Macros
            </button>
          </div>

          {/* Finder Tab */}
          {activeTab === "finder" && (
            <>
              <div className="input-section">
                <label htmlFor="patient-message" className="input-label">
                  Patient message
                  <span className="keyboard-hint">Ctrl+Enter to submit · Escape to clear</span>
                </label>
                <textarea
                  ref={textareaRef}
                  id="patient-message"
                  className="message-textarea"
                  placeholder="Paste the patient's message here (remove any identifying details)…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  aria-label="Patient message"
                  disabled={loading}
                />
                <div className="input-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={loading || !message.trim()}
                  >
                    {loading ? "Finding macros…" : "Submit"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleClear} disabled={loading}>
                    Clear / Reset
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-banner" role="alert">
                  {error}
                </div>
              )}

              {result && (
                <section className="results-section" aria-label="Results">
                  {/* Fallback mode warning */}
                  {result.matchingMode === "fallback" && (
                    <div className="fallback-warning">
                      ⚠️ <strong>Keyword fallback mode</strong> - Semantic search unavailable (API key not configured)
                    </div>
                  )}
                  
                  {/* Performance metrics (debug) */}
                  {result.performanceMs && result.matchingMode === "semantic" && (
                    <div className="performance-info">
                      ✓ Semantic search: {result.performanceMs.total}ms
                      {result.primaryIntent && ` · Primary intent: ${result.primaryIntent}`}
                    </div>
                  )}
                  
                  <h3 className="results-heading">Top Matching Macros</h3>
                  
                  {result.matches.length === 0 ? (
                    <div className="no-matches">
                      <p>No matching macros found for this message.</p>
                      <p className="no-matches-hint">Try rephrasing or check the "Search All Macros" tab.</p>
                    </div>
                  ) : (
                    <div className="macros-list">
                      {result.matches.map((m, i) => (
                        <div key={i} className="macro-card">
                          <div className="macro-card-header">
                            <span className="macro-rank">#{i + 1}</span>
                            {m.confidence !== undefined && (
                              <span className={`confidence-badge ${getConfidenceColor(m.confidence)}`}>
                                {m.confidence}% match
                              </span>
                            )}
                            {m.category && (
                              <span className="category-badge">{m.category}</span>
                            )}
                            <h4 className="macro-title">{m.macro.title}</h4>
                            <button
                              type="button"
                              className="btn btn-copy"
                              onClick={() =>
                                copyToClipboard(
                                  m.macro.text || "[Title only - no text available]",
                                  `macro-${i}`,
                                  m.macro.title
                                )
                              }
                              aria-label={`Copy macro ${i + 1}`}
                            >
                              {copiedId === `macro-${i}` ? "Copied" : "Copy"}
                            </button>
                          </div>
                          {m.rationale && (
                            <div className="macro-rationale">
                              <strong>Why this macro:</strong> {m.rationale}
                            </div>
                          )}
                          <div className="macro-text">
                            {m.macro.text?.trim() ? m.macro.text : "[Title only - no text available]"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <h3 className="results-heading suggested-heading">Suggested Response</h3>
                  <div className="suggested-response-card">
                    {result.hasPlaceholders && (
                      <div className="placeholder-warning">
                        ⚠️ This response contains placeholders that need to be filled in before sending.
                      </div>
                    )}
                    <div className="suggested-response-text">{result.suggestedResponse}</div>
                    <div className="suggested-response-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-copy-suggested"
                        onClick={() => copyToClipboard(result.suggestedResponse, "suggested", "Suggested Response")}
                        aria-label="Copy suggested response"
                      >
                        {copiedId === "suggested" ? "Copied" : "Copy Suggested Response"}
                      </button>
                      <span className="keyboard-hint-inline">Ctrl+Shift+C</span>
                    </div>
                  </div>

                  {result.macrosUsed.length > 0 && (
                    <p className="macros-used">
                      <strong>Macros used:</strong> {result.macrosUsed.join(" · ")}
                    </p>
                  )}

                  {/* Feedback section */}
                  <div className="feedback-section">
                    <span className="feedback-label">Was this helpful?</span>
                    {feedbackGiven ? (
                      <span className="feedback-thanks">Thanks for your feedback!</span>
                    ) : (
                      <>
                        <button
                          className="btn btn-small btn-feedback"
                          onClick={() => handleFeedback(true)}
                        >
                          👍 Yes
                        </button>
                        <button
                          className="btn btn-small btn-feedback"
                          onClick={() => handleFeedback(false)}
                        >
                          👎 No
                        </button>
                      </>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {/* Search Tab */}
          {activeTab === "search" && (
            <div className="search-section">
              <div className="search-controls">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search macros by title or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {macrosLoading ? (
                <div className="loading-macros">Loading macros...</div>
              ) : (
                <>
                  <p className="search-results-count">
                    Showing {filteredMacros.length} of {allMacros.length} macros
                  </p>
                  <div className="macros-list search-results">
                    {filteredMacros.map((m, i) => (
                      <div key={i} className="macro-card macro-card-compact">
                        <div className="macro-card-header">
                          <span className="category-badge">{m.category}</span>
                          <h4 className="macro-title">{m.title}</h4>
                          <button
                            type="button"
                            className="btn btn-copy"
                            onClick={() => copyToClipboard(m.text || "[Title only]", `search-${i}`, m.title)}
                          >
                            {copiedId === `search-${i}` ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <div className="macro-text macro-text-collapsed">
                          {m.text?.trim() ? m.text : "[Title only - no text available]"}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export default App;
