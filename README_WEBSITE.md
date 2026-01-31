# Macro Finder Website

Single-page UI for Macro Finder, matching the CS Updates Hub visual language (layout, spacing, typography, light/dark mode).

## Run locally

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the API server** (runs the PowerShell matcher; required for Submit)
   ```bash
   npm run api
   ```
   This starts the Node server on port 5000. Leave it running.

3. **Start the frontend**
   ```bash
   npm run dev
   ```
   Open the URL shown (e.g. http://localhost:5173). Vite proxies `/api` to the API server.

4. **Use the app**
   - Paste a patient message in the text area (remove identifying details).
   - Click **Submit** to get top matching macros and a suggested response.
   - Use **Copy** on each macro or **Copy Suggested Response** to copy to clipboard.
   - **Clear / Reset** clears the input and results.
   - Use the header theme toggle (☀️/🌙) for light/dark mode.

## Build for production

```bash
npm run build
```

Static assets go to `dist/`. To serve them with the API in production, run the API server and point it at `dist/` for static files, or serve `dist/` with any static host and deploy the API separately (ensure `/api/match` is available).

## Design assets

- Logo: `public/brand/fountain-logo.png` (dark mode) and `public/brand/fountain-logo-light.png` (light mode), reused from the CS Updates Hub project.
- Layout and styles follow the "website design reference" screenshot in `designs/`.
