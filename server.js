/**
 * Macro Finder API server.
 * POST /api/match with body { "message": "patient message" } runs the PowerShell
 * matcher and returns { matches, suggestedResponse, macrosUsed }.
 * Run from project root: node server.js
 * Vite dev server proxies /api to this server (port 5000).
 */

const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;
const PROJECT_ROOT = path.resolve(__dirname);
const RUN_MATCHER = path.join(PROJECT_ROOT, "run_matcher.ps1");

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.post("/api/match", (req, res) => {
  const message = req.body?.message;
  if (message == null || typeof message !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'message' in body." });
  }

  const input = JSON.stringify({ message }) + "\n";
  const ps = spawn(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-NoProfile", "-File", RUN_MATCHER],
    {
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    }
  );

  let stdout = "";
  let stderr = "";

  ps.stdout.setEncoding("utf8");
  ps.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  ps.stderr.setEncoding("utf8");
  ps.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  ps.on("error", (err) => {
    console.error("PowerShell spawn error:", err);
    res.status(500).json({
      error: "Failed to run matcher. Is PowerShell available?",
      detail: err.message,
    });
  });

  ps.on("close", (code) => {
    if (code !== 0) {
      console.error("PowerShell stderr:", stderr);
      return res.status(500).json({
        error: "Matcher script failed.",
        detail: stderr || stdout || `Exit code ${code}`,
      });
    }
    try {
      const data = JSON.parse(stdout.trim());
      return res.json(data);
    } catch (e) {
      console.error("Parse error. stdout:", stdout);
      return res.status(500).json({
        error: "Invalid JSON from matcher.",
        detail: e.message,
      });
    }
  });

  ps.stdin.write(input, "utf8", () => {
    ps.stdin.end();
  });
});

app.listen(PORT, () => {
  console.log(`Macro Finder API listening on http://localhost:${PORT}`);
});
