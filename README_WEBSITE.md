# Macro Finder Website

Single-page UI for Macro Finder, matching the CS Updates Hub visual language (layout, spacing, typography, light/dark mode).

**Deployment**: Vercel-compatible. The API is implemented as a serverless function (`api/match.ts`) — no PowerShell or long-running servers required in production.

## Run locally

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the dev server** (uses Vercel CLI to run both frontend and serverless API)
   ```bash
   npm run dev
   ```
   Open the URL shown (e.g. http://localhost:3000). The Vercel dev server handles both the Vite frontend and the `/api/match` endpoint.

3. **Use the app**
   - Paste a patient message in the text area (remove identifying details).
   - Click **Submit** to get top matching macros and a suggested response.
   - Use **Copy** on each macro or **Copy Suggested Response** to copy to clipboard.
   - **Clear / Reset** clears the input and results.
   - Use the header theme toggle (☀️/🌙) for light/dark mode.

## Deploy to Vercel

```bash
vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

## Update macros

If `extracted_macros.md` changes, regenerate the JSON:

```bash
npm run convert-macros
```

This updates `api/macros.json` with the latest macro data.

## Project structure

```
api/
  match.ts         # Vercel serverless function (POST /api/match)
  matcher.ts       # Matching logic (ported from PowerShell)
  macros.json      # Macro data (generated from extracted_macros.md)
src/
  App.tsx          # React UI
  App.css          # Styles
public/
  brand/           # Fountain logos
```

## Design assets

- Logo: `public/brand/fountain-logo-dark.png` (dark mode) and `public/brand/fountain-logo-light.png` (light mode)
- Layout and styles follow the "website design reference" screenshot in `designs/`
