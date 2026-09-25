# Agent instructions

This is a static PWA with no build step. The app's UI and copy are in Ukrainian. User data is stored in the browser's IndexedDB, while Google Sheets backup settings are stored in `localStorage`. Automated tests use Node.js and Playwright.

## Where to make changes

- `index.html` contains the markup and script references; `src/styles.css` and `src/mobile-nav.css` contain the styles.
- `src/app.js` is the main ES module, handling forms, state, and calls to `src/db.js`.
- `src/db.js` defines the IndexedDB schema, export, and full data replacement on import. Schema changes require a migration and matching database versions in scripts that open the database independently.
- The other `src/*.js` files are classic scripts for history, dictionaries, and charts. Some are referenced in `index.html`; `src/mobile-nav.js` loads additional charts dynamically.
- `service-worker.js` lists offline assets and defines the PWA cache version.
- `apps-script.gs` is the server side of the optional manual Google Sheets backup; it is deployed separately.

## Workflow

1. Check `git status` and read the current code before making changes. Do not assume the local checkout matches the published site.
2. After changing JavaScript, check syntax with `node --check <file>` and run `pnpm test` (requires Google Chrome). For behavior changes beyond the covered tests, start a local static server (`python3 -m http.server 8080`) and test the relevant flow in a browser.
3. When app assets change and installed PWAs need the update, increment `CACHE_NAME` in `service-worker.js`. Add new assets needed offline to `ASSETS`. Documentation-only changes do not require a cache version change.
4. Publish the site only when the user requests it. Before committing and pushing, inspect `git diff`, the current branch, and the actual GitHub Pages settings. After publishing, verify the site and PWA update. Deploy `apps-script.gs` to Google Apps Script separately from the site.

Do not commit personal records, exported backups, Apps Script URLs, or backup keys.
