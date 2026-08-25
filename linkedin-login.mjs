#!/usr/bin/env node

/**
 * linkedin-login.mjs — one-time interactive LinkedIn session saver
 *
 * LinkedIn redirects every unauthenticated /jobs/view/{id}/ request to an
 * authwall (no JD, no closure banner, nothing to read) — confirmed directly,
 * not documented behavior. enrich-linkedin-pipeline.mjs and any future
 * LinkedIn-reading tool need a real session to get past it. Browser
 * automation can't complete LinkedIn's login (password + likely 2FA/captcha)
 * unattended, so this opens a headed browser and waits for a human.
 *
 * Usage:
 *   node linkedin-login.mjs
 *
 * Saves Playwright storageState (cookies) to .linkedin-session.json — never
 * commit this file (it's equivalent to a session credential). It's
 * gitignored; keep it that way.
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import readline from 'node:readline';

const SESSION_FILE = '.linkedin-session.json';

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => { rl.close(); resolve(); }));
}

async function main() {
  console.log('Opening a browser window — log into LinkedIn there, then come back here.\n');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/login');

  await waitForEnter('Press Enter once you are logged in and see your LinkedIn feed... ');

  // Verify: an authenticated session lands on /feed (or at least clears the
  // login form) when re-navigated to the login URL.
  await page.goto('https://www.linkedin.com/login');
  const url = page.url();
  if (url.includes('/login') || url.includes('/authwall')) {
    console.error(`\nStill looks logged out (landed on ${url}). Run this again once you're able to reach your feed.`);
    await browser.close();
    process.exit(1);
  }

  await context.storageState({ path: SESSION_FILE });
  await browser.close();
  console.log(`\nSaved session to ${SESSION_FILE}. This file is gitignored — never commit it.`);
  console.log('Sessions expire after some time; re-run this script if enrich-linkedin-pipeline.mjs starts reporting it needs a fresh login.');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
