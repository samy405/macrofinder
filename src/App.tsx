import { useState, useEffect, useCallback } from "react";
import "./App.css";

const INTRO_TEXT =
  "Macro Finder helps you quickly identify the best macro(s) to respond to a patient message. Paste the patient's message below (remove any identifying details), then submit to get the top matching macros and a suggested draft response you can edit and send.";

export type MacroMatchResult = {
  macro: { number: number; title: string; text: string };
  score: number;
  matchReasons: string[];
};

export type ApiResult = {
  matches: MacroMatchResult[];
  suggestedResponse: string;
  macrosUsed: string[];
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

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  const handleSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResult(null);
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
  }, []);

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Copy failed.");
    }
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="app-header-content">
          <div className="logo-link" aria-hidden="true">
            <img
              src={theme === "light" ? "/brand/fountain-logo-light.png?v=1" : "/brand/fountain-logo.png?v=3"}
              alt="Fountain"
              className="fountain-logo"
            />
          </div>
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
      </header>

      <main className="main-content">
        <div className="macro-finder-page">
          <div className="welcome-message">
            <h2>Macro Finder</h2>
            <p>{INTRO_TEXT}</p>
          </div>

          <div className="input-section">
            <label htmlFor="patient-message" className="input-label">
              Patient message
            </label>
            <textarea
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
              <h3 className="results-heading">Top Matching Macros</h3>
              <div className="macros-list">
                {result.matches.map((m, i) => (
                  <div key={i} className="macro-card">
                    <div className="macro-card-header">
                      <span className="macro-rank">#{i + 1}</span>
                      <h4 className="macro-title">{m.macro.title}</h4>
                      <button
                        type="button"
                        className="btn btn-copy"
                        onClick={() =>
                          copyToClipboard(
                            `Title: ${m.macro.title}\n\n${m.macro.text || "[Title only - no text available]"}`,
                            `macro-${i}`
                          )
                        }
                        aria-label={`Copy macro ${i + 1}`}
                      >
                        {copiedId === `macro-${i}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="macro-text">
                      {m.macro.text?.trim() ? m.macro.text : "[Title only - no text available]"}
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="results-heading suggested-heading">Suggested Response</h3>
              <div className="suggested-response-card">
                <div className="suggested-response-text">{result.suggestedResponse}</div>
                <button
                  type="button"
                  className="btn btn-primary btn-copy-suggested"
                  onClick={() => copyToClipboard(result.suggestedResponse, "suggested")}
                  aria-label="Copy suggested response"
                >
                  {copiedId === "suggested" ? "Copied" : "Copy Suggested Response"}
                </button>
              </div>

              {result.macrosUsed.length > 0 && (
                <p className="macros-used">
                  <strong>Macros used:</strong> {result.macrosUsed.join(" · ")}
                </p>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}

export default App;
