# CareerOps Quick Dashboard

Lightweight local web UI for reviewing scan results and taking actions without leaving the browser. Distinct from `dashboard/` (the Go terminal UI) and `web/` (the full Next.js app) — this is the minimal, no-build-step one.

## Start

From the repo root:

npm run serve:dashboard:quick

Then open:

http://localhost:4173

## What it supports

- Run a fresh scan from the UI
- View pending and processed pipeline entries
- Mark pending items as processed
- Mark pending items as Not a fit or Ignore (stored as `note: SKIP (dashboard)` / `note: IGNORE (dashboard)` in processed entries)
- View tracker rows and status counts (when applications tracker exists)
- Update tracker status via the canonical set-status command

## Notes

- This dashboard reads and updates files inside this repo only.
- If no tracker file exists yet, the tracker panel shows an empty state.
- The server runs locally and has no external auth layer; do not expose it publicly.
