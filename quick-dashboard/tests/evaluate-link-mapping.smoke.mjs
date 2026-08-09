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
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('#pendingTable tbody tr');
      if (!rows.length) return false;
      const hasEvaluate = document.querySelectorAll('#pendingTable tbody .action-evaluate').length > 0;
      const hasEmptyState = Array.from(rows).some((r) => /No pending roles match/i.test(r.textContent || ''));
      return hasEvaluate || hasEmptyState;
    }, { timeout: 60000 });

    const hasEvaluateButtons = await page.$$eval('#pendingTable tbody .action-evaluate', (buttons) => buttons.length > 0);
    assert.ok(hasEvaluateButtons, 'No Evaluate buttons found in pending rows.');

    const checks = await page.$$eval('#pendingTable tbody tr', (rows) => {
      return rows.slice(0, 25).map((row, index) => {
        const openLink = row.querySelector('.item-actions a');
        const evalBtn = row.querySelector('.item-actions .action-evaluate');
        return {
          row: index + 1,
          openHref: openLink?.getAttribute('href') || '',
          evalUrl: evalBtn?.getAttribute('data-evaluate-url') || '',
        };
      }).filter((entry) => entry.openHref && entry.evalUrl);
    });

    assert.ok(checks.length > 0, 'No rows with Open Posting + Evaluate controls found.');

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
