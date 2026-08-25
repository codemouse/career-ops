#!/usr/bin/env node

/**
 * enrich-pipeline.mjs — backfill company/title/location (and flag closed
 * postings) for pending data/pipeline.md rows from BuiltIn, FractionalJobs,
 * Adzuna, and Glassdoor. LinkedIn needs its own authenticated session and
 * has its own pair of scripts — see linkedin-login.mjs / enrich-linkedin-pipeline.mjs.
 *
 * Why real page navigation, not a lighter HTTP client: Adzuna and Glassdoor
 * both block plain requests (curl, WebFetch, Playwright's own context.request
 * API — confirmed directly, all three get a 403 challenge page) but let a
 * real rendered browser through. The difference is specifically the browser
 * engine's own network stack/fingerprint, not any header or cookie this
 * script could add — context.request is Playwright's lightweight Node-side
 * client, not the actual Chromium engine, and gets the same 403 curl does.
 * So every URL here goes through page.goto(), one page reused sequentially
 * (project rule: never Playwright in parallel).
 *
 * Per-host extraction:
 *   - fractionaljobs.io: "This Role is Closed" banner (closure signal) and a
 *     "Location" / "Location:" label immediately followed by its value.
 *   - builtin.com: <title> is "{role} - {company} | Built In"; location sits
 *     a few nodes after a "(Re)posted X (days/hours) Ago" node, past optional
 *     badge labels ("Easy Apply", "Be an Early Applicant", ...).
 *   - adzuna.com: /land/ad/{id} either redirects to /details/{id} (live —
 *     company/role/location parsed from the rendered card) or to a search
 *     page carrying `expired_ad_id=` (closed), or a literal "Cannot find
 *     page" title (closed). A stuck "Adzuna Jobs Search" / "Checking
 *     traffic..." shell means the bot-challenge didn't clear — uncertain,
 *     left untouched rather than guessed.
 *   - glassdoor.com: partner/jobListing.htm redirects to a slug page whose
 *     <title> is "{company} hiring {role} Job in {location} | Glassdoor" —
 *     when it clears the challenge. A "Security | Glassdoor" / "Just a
 *     moment..." title means it didn't — uncertain, same as Adzuna.
 *
 * Usage:
 *   node enrich-pipeline.mjs [--dry-run] [--all] [--throttle[=ms]]
 *
 * --all       also re-check rows that already carry company/role/location
 *             (default: only rows missing at least one of those)
 * --dry-run   print what would change, write nothing
 * --throttle  jittered delay between page loads (default 800ms base)
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { withPipelineLock } from './pipeline-lock.mjs';
import { sleep, jitteredDelayMs, LIVENESS_CONTEXT_OPTIONS } from './liveness-browser.mjs';
import { parseRow, serializeRow } from './enrich-linkedin-pipeline.mjs';

const PIPELINE_PATH = 'data/pipeline.md';
const PLACEHOLDER_ROLE_RE = /^(Job lead|View|JobListing\.Htm|Imp)\b/i;
const GENERIC_COMPANY_RE = /^(builtin|linkedin|adzuna|glassdoor|fractionaljobs|fractional jobs)$/i;
const SUPPORTED_HOSTS = new Set(['fractionaljobs.io', 'builtin.com', 'adzuna.com', 'glassdoor.com']);

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const all = argv.includes('--all');
  const throttleArg = argv.find((a) => a === '--throttle' || a.startsWith('--throttle='));
  const throttleBaseMs = throttleArg ? (Number(throttleArg.split('=')[1]) || 800) : 800;
  return { dryRun, all, throttleBaseMs };
}

function findEnrichableRows(lines) {
  const pendingStart = lines.findIndex((l) => l.trim() === '## Pending');
  const processedStart = lines.findIndex((l) => l.trim() === '## Processed');
  const rows = [];
  for (let i = pendingStart + 1; i < processedStart; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('- [ ]')) continue;
    const content = line.replace(/^- \[ \]\s*/, '');
    const { positional, labeled } = parseRow(content);
    const url = positional[0] || '';
    const host = hostOf(url);
    if (!SUPPORTED_HOSTS.has(host)) continue;
    const company = (positional[1] || '').trim();
    const role = (positional[2] || '').trim();
    const location = (positional[3] || '').trim();
    const needsEnrichment = !company || GENERIC_COMPANY_RE.test(company) || PLACEHOLDER_ROLE_RE.test(role) || !location;
    rows.push({ lineIdx: i, url, host, positional, labeled, needsEnrichment });
  }
  return { pendingStart, processedStart, rows };
}

async function extract(page, url, host) {
  let response;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForTimeout(1500); // let client-side redirects/hydration settle
  } catch (e) {
    return { ok: false, reason: `navigation error: ${e.message}` };
  }
  const finalUrl = page.url();
  const title = await page.title();
  const innerText = await page.evaluate(() => document.body.innerText).catch(() => '');

  if (host === 'fractionaljobs.io') return extractFractionalJobs(innerText);
  if (host === 'builtin.com') return extractBuiltIn(title, innerText);
  if (host === 'adzuna.com') return extractAdzuna(finalUrl, title, innerText);
  if (host === 'glassdoor.com') return extractGlassdoor(title);
  return { ok: false, reason: 'unsupported host' };
}

function extractFractionalJobs(innerText) {
  if (/This Role is Closed/i.test(innerText)) return { ok: false, closed: true };
  const lines = innerText.split('\n').map((l) => l.trim()).filter(Boolean);
  let idx = lines.findIndex((l) => l === 'Location' || l === 'Location:');
  const location = idx >= 0 ? lines[idx + 1] : null;
  return { ok: true, location };
}

function extractBuiltIn(title, innerText) {
  const t = title.replace(/\s*\|\s*Built In\s*$/i, '').trim();
  const parts0 = t.split(' - ');
  if (parts0.length < 2) return { ok: false, reason: `unparsed title: ${title}` };
  const company = parts0.pop().trim();
  const role = parts0.join(' - ').trim();
  const lines = innerText.split('\n').map((l) => l.trim()).filter(Boolean);
  const postedIdx = lines.findIndex((l) => /^(Re)?posted .* Ago$/i.test(l));
  let location = null;
  if (postedIdx >= 0) {
    for (let j = postedIdx + 1; j < Math.min(postedIdx + 5, lines.length); j++) {
      if (/^(Easy Apply|Be an Early Applicant|Actively Hiring|Actively Reviewing Applicants)$/i.test(lines[j])) continue;
      location = lines[j];
      if (/^Hiring Remotely in$/i.test(location) && lines[j + 1]) location = `${location} ${lines[j + 1]}`;
      break;
    }
  }
  return { ok: true, company, role, location };
}

function extractAdzuna(finalUrl, title, innerText) {
  if (finalUrl.includes('expired_ad_id=')) return { ok: false, closed: true };
  if (/cannot find page/i.test(title)) return { ok: false, closed: true };
  if (/checking traffic/i.test(title) || /^adzuna jobs search$/i.test(title.trim())) {
    return { ok: false, reason: 'bot-challenge did not clear' };
  }
  const lines = innerText.split('\n').map((l) => l.trim()).filter(Boolean);
  const backIdx = lines.findIndex((l) => /back to last search/i.test(l));
  if (backIdx < 0) return { ok: false, reason: 'unrecognized page layout' };
  const company = lines[backIdx + 1] || null;
  const location = lines[backIdx + 2] || null;
  return { ok: true, role: title.trim(), company, location };
}

function extractGlassdoor(title) {
  const m = title.match(/^(.+?) hiring (.+?) Job in (.+?)\s*\|\s*Glassdoor$/i);
  if (!m) return { ok: false, reason: 'bot-challenge did not clear' };
  return { ok: true, company: m[1].trim(), role: m[2].trim(), location: m[3].trim() };
}

async function main() {
  const { dryRun, all, throttleBaseMs } = parseArgs(process.argv.slice(2));

  const text = readFileSync(PIPELINE_PATH, 'utf-8');
  const lines = text.split('\n');
  const { rows } = findEnrichableRows(lines);
  const targets = all ? rows : rows.filter((r) => r.needsEnrichment);

  if (targets.length === 0) {
    console.log(all ? 'No BuiltIn/FractionalJobs/Adzuna/Glassdoor rows found in Pending.' : 'Nothing needs enrichment (use --all to re-check every row).');
    return;
  }

  console.log(`Checking ${targets.length} posting(s)${dryRun ? ' (dry run)' : ''}...\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(LIVENESS_CONTEXT_OPTIONS);
  const page = await context.newPage();

  const results = [];
  for (let i = 0; i < targets.length; i++) {
    const row = targets[i];
    const r = await extract(page, row.url, row.host);
    results.push({ row, r });
    const icon = r.ok ? '✅' : (r.closed ? '❌' : '⚠️');
    console.log(`${icon} ${row.host.padEnd(20)} ${row.url.slice(0, 70)}`);
    const wait = i < targets.length - 1 ? jitteredDelayMs(throttleBaseMs) : 0;
    if (wait) await sleep(wait);
  }
  await browser.close();

  let enriched = 0, failed = 0;
  const failedUrls = [];
  const closedRows = [];

  const newLines = [...lines];
  for (const { row, r } of results) {
    if (r.closed) {
      closedRows.push({ lineIdx: row.lineIdx, content: serializeRow(row.positional, row.labeled) });
      continue;
    }
    if (!r.ok) {
      failed++;
      failedUrls.push(`${row.url} (${r.reason})`);
      continue;
    }
    const pos = [...row.positional];
    if (r.company) pos[1] = r.company;
    if (r.role) pos[2] = r.role;
    if (r.location) pos[3] = r.location;
    newLines[row.lineIdx] = `- [ ] ${serializeRow(pos, row.labeled)}`;
    enriched++;
  }

  const sortedClosed = [...closedRows].sort((a, b) => b.lineIdx - a.lineIdx);
  for (const { lineIdx } of sortedClosed) newLines.splice(lineIdx, 1);
  const processedIdx = newLines.findIndex((l) => l.trim() === '## Processed');
  const strikeLines = closedRows.map(({ content }) =>
    `- [x] ~~${content.trimEnd()}~~ — posting expired (liveness sweep)`
  );
  newLines.splice(processedIdx + 1, 0, ...strikeLines);

  console.log(`\nEnriched: ${enriched}`);
  console.log(`Closed (moved to Processed): ${closedRows.length}`);
  if (failed) console.log(`Unresolved: ${failed} — ${failedUrls.join(', ')}`);

  if (dryRun) {
    console.log('\nDry run — no files written.');
    return;
  }

  await withPipelineLock(PIPELINE_PATH, async () => {
    writeFileSync(PIPELINE_PATH, newLines.join('\n'));
  });
  console.log(`\nWrote ${PIPELINE_PATH}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}
