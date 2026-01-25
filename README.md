# Turmoil TBS

A Turn-Based Strategy game inspired by "AUTS", played on a tactical scale with fleets of 1000+ ships.
Built with Phaser 3, Rapier.js (WASM), and Vite.

## Instructions

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Initialize Capacitor (if needed):
   ```bash
   npx cap init
   npx cap add android
   ```

### Running

- **Development:** `npm run dev`
- **Tests:** `npm test`
- **Build:** `npm run build`

## Agentic Instructions

**For AI Agents working on this repo:**

1. **Always add tests**: Every new feature or logic module must have accompanying unit tests in `src/__tests__` or alongside the file.
2. **Run test suite to verify**: Before declaring a task complete, run `npm test` & `npm run lint` to ensure no regressions.
3. **Test UI output**: Use Vitest + JSDOM to test that the UI overlays (DOM elements) are rendering correctly.
