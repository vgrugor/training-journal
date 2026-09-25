# Personal Day Journal

A minimal offline-first PWA for a personal daily journal, strength training, cycling workouts, and supplements.

## Run locally

Serve the project directory with any static file server. For example:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Tests

You need Node.js 20+, pnpm, and Google Chrome. Install dependencies and run the tests:

```bash
pnpm install
pnpm test
```

The tests cover creating, editing, and deleting workouts; exporting and importing IndexedDB data; starting the PWA offline; forecast and chart calculations; Google Sheets backup with a mocked endpoint; and Apps Script logic with a mock spreadsheet. Tests do not send data to a real Google Sheets spreadsheet.

GitHub Actions runs the same tests in Chrome for every pull request through `.github/workflows/tests.yml`.

## GitHub Pages

1. Create a GitHub repository, such as `training-journal`.
2. Upload all files from this directory to the repository.
3. Open `Settings` -> `Pages` in the repository.
4. Select `Deploy from a branch` as the source.
5. Choose the `master` branch and the `/root` directory.
6. Open the published URL on your phone.
7. Select `Add to Home Screen` in your browser.

The app stores data locally in IndexedDB on the device. GitHub Pages only serves the static files over HTTPS.

## Manual backup to Google Sheets

1. Create a Google Sheets spreadsheet.
2. Open `Extensions` -> `Apps Script`.
3. Paste the contents of `apps-script.gs`.
4. Replace `change-this-key` in `const BACKUP_KEY = "change-this-key";` with your own long key.
5. Select `Deploy` -> `New deployment`.
6. Set the deployment type to `Web app`.
7. Set `Execute as` to `Me`.
8. Set `Who has access` to `Anyone`.
9. Copy the web app URL.
10. Open the app's reference data tab and enter the web app URL and the same key.

The backup button writes a complete JSON snapshot of IndexedDB to the `backup` sheet. The restore button replaces local data with the latest saved snapshot.

## Data

The first release uses these IndexedDB object stores:

- `days`
- `strengthWorkouts`
- `cyclingWorkouts`
- `exercises`
- `bands`
- `supplements`
- `supplementIntakes`

Google Sheets backup is a manual full snapshot of the data. It does not synchronize individual records in both directions.
