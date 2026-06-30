# AGENTS.md

## Cursor Cloud specific instructions

### What this is
Arint Screenshot is a **Firefox Manifest V3 browser extension** written in pure vanilla
JavaScript. There is **no build step, no `package.json`, no dependencies, and no automated
test suite**. The whole extension is the static files under `src/` plus `manifest.json` and
`icons/`. The README documents manual installation via `about:debugging`; the commands below
use Mozilla's official `web-ext` tooling, which is the development workflow used here.

### Tooling (already installed in the VM snapshot / refreshed by the update script)
- `web-ext` (Mozilla web extension dev tool) is installed globally via npm.
- `firefox` (from Mozilla's APT repo, not the snap) is installed at `/usr/bin/firefox`.
- A display server is available at `DISPLAY=:1` for running Firefox with a GUI.

### Lint / build / run
Run all commands from the repo root (`/workspace`).
- Lint: `web-ext lint --self-hosted` (validates `manifest.json` and source).
- Run in dev mode: `DISPLAY=:1 web-ext run --firefox=/usr/bin/firefox --start-url=https://example.com`
  This launches Firefox with a fresh profile and installs the extension as a temporary add-on.
- Build a distributable zip (optional): `web-ext build --overwrite-dest` (output in `web-ext-artifacts/`, gitignored).
- Tests: none exist. Verify behavior manually in Firefox.

### Gotchas (non-obvious)
- The extension has **no toolbar icon pinned by default**. To open its popup in Firefox, click
  the **Extensions (puzzle-piece) button** to the left of the hamburger menu, then click
  "Arint Screenshot". The popup has three actions: Visible Area, Full Page, Select Region.
  Clicking one captures the page and opens the built-in editor in a new tab.
- `manifest.json` sets `strict_min_version` 142.0, so use a recent Firefox (snapshot has 152+).
- The npm global prefix is pinned to the nvm node dir so `npm install -g` works without sudo.
  This makes nvm print a benign warning ("`.npmrc` ... has a `prefix` setting ... incompatible
  with nvm") on shell startup — it is harmless and `web-ext` works correctly.
