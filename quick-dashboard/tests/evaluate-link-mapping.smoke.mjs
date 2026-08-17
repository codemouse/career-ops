#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.DASHBOARD_URL || 'http://localhost:4173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#pendingTable tbody', { timeout: 30000 });

    // Broaden the pool as far as the UI allows: the default view only shows
    // pending, not-previously-applied rows, and on any given day every row in
    // that narrower set may already carry a report (no Evaluate button left
    // to check). Neither toggle existing is not a failure -- just check what
    // the page has.
    const showHidden = page.locator('#showHiddenToggle');
    if (await showHidden.count()) await showHidden.check();
    const showPriorApplied = page.locator('#showPriorAppliedToggle');
    if (await showPriorApplied.count()) await showPriorApplied.check();

    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('#pendingTable tbody tr');
      if (!rows.length) return false;
      const hasEvaluate = document.querySelectorAll('#pendingTable tbody .action-evaluate').length > 0;
      const hasEmptyState = Array.from(rows).some((r) => /No pending roles match/i.test(r.textContent || ''));
      return hasEvaluate || hasEmptyState;
    }, { timeout: 60000 });

    // The Evaluate control's cell has moved before (item-actions -> score-cell)
    // and may move again, so match it anywhere in the row rather than pinning
    // to a specific container -- what this test actually guards is that
    // whichever "Evaluate" control a row has points at the same URL as that
    // row's "Open" link, not where in the row it lives.
    const checks = await page.$$eval('#pendingTable tbody tr', (rows) => {
      return rows.map((row, index) => {
        const openLink = row.querySelector('a.action-open');
        const evalBtn = row.querySelector('.action-evaluate');
        return {
          row: index + 1,
          openHref: openLink?.getAttribute('href') || '',
          evalUrl: evalBtn?.getAttribute('data-evaluate-url') || '',
        };
      }).filter((entry) => entry.openHref && entry.evalUrl);
    });

    if (checks.length === 0) {
      console.log('OK: no pending rows currently have both an Open link and an Evaluate button (everything visible is already evaluated) -- nothing to check.');
      return;
    }

    const mismatches = checks.filter((entry) => entry.openHref !== entry.evalUrl);
    assert.equal(
      mismatches.length,
      0,
      `Evaluate/Open URL mismatch in rows: ${mismatches.map((m) => m.row).join(', ')}`,
    );

    console.log(`OK: verified ${checks.length} rows where Evaluate URL matches Open Posting URL.`);
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
