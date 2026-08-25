#!/usr/bin/env node

/**
 * enrich-linkedin-pipeline.mjs — backfill real company/title/location/posted
 * date on LinkedIn pipeline.md leads, and flag closed postings while we're
 * already reading them.
 *
 * Why this exists: LinkedIn job-alert emails rarely carry a clean subject per
 * link, so the Gmail plugin (plugins/gmail/_helpers.mjs titleFromUrl) falls
 * back to a placeholder — blank company, title "Job lead #{id}" — because a
 * numeric LinkedIn job URL has no readable slug to derive one from. The same
 * gap leaves location and the `posted:` freshness segment (modes/pipeline.md
 * §Format of pipeline.md) blank for LinkedIn rows specifically — the scanner
 * fills them from the ATS API for every other portal, but there's no
 * unauthenticated API read for a LinkedIn posting. Filling any of this in
 * means reading the actual posting, and LinkedIn redirects every
 * unauthenticated /jobs/view/{id}/ request to an authwall (confirmed
 * directly: no JD, no closure banner, nothing to read) — the same reason
 * check-liveness.mjs silently returns "uncertain" for every LinkedIn URL.
 * There's no way around that without a real logged-in session, which is what
 * linkedin-login.mjs (run once, occasionally again after expiry) provides.
 *
 * With that session, this script batch-reads each pending LinkedIn URL's
 * <title> tag ("{role} | {company} | LinkedIn") and its top-card insight
 * line ("{location} · {Reposted }X {unit} ago · N people clicked apply") via
 * the authenticated browser context's request API — no page navigation
 * needed per URL, so it's fast even over ~150+ leads. Since it's already
 * reading the page, it also checks for LinkedIn's own closure banner ("No
 * longer accepting applications") and moves those rows straight to
 * Processed, same convention modes/pipeline.md's liveness sweep uses for
 * every other portal.
 *
 * Usage:
 *   node linkedin-login.mjs                  # once, or after session expiry
 *   node enrich-linkedin-pipeline.mjs [--dry-run] [--all] [--throttle[=ms]]
 *
 * --all       also re-check rows that already carry everything (title,
 *             company, location, posted:) — default: only rows missing at
 *             least one of those
 * --dry-run   print what would change, write nothing
 * --throttle  jittered delay between requests (default 300ms base)
 *
 * This only touches data/pipeline.md. If a closed posting also has a tracker
 * row in data/applications.md, that's printed as a flag, never auto-written —
 * discarding an already-evaluated (or further along) application is a call
 * for the person running this, not something to do unattended.
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';
import { withPipelineLock } from './pipeline-lock.mjs';
import { sleep, jitteredDelayMs } from './liveness-browser.mjs';

const SESSION_FILE = '.linkedin-session.json';
const PIPELINE_PATH = 'data/pipeline.md';
const TRACKER_PATH = 'data/applications.md';
const ID_RE = /linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)/;
const PLACEHOLDER_ROLE_RE = /^(Job lead|View)\b/i;
// modes/pipeline.md §Format of pipeline.md — canonical label order.
export const LABEL_ORDER = ['dead', 'posted', 'trust', 'note', 'rank'];

export function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const all = argv.includes('--all');
  const throttleArg = argv.find((a) => a === '--throttle' || a.startsWith('--throttle='));
  const throttleBaseMs = throttleArg ? (Number(throttleArg.split('=')[1]) || 300) : 300;
  return { dryRun, all, throttleBaseMs };
}

/** "3 weeks ago" / "Reposted 4 days ago" -> "YYYY-MM-DD", approximate. */
export function relativeAgoToDate(phrase, now = new Date()) {
  const m = phrase.match(/(\d+)\s+(hour|day|week|month)s?\s+ago/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unitMs = { hour: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3 }[m[2].toLowerCase()];
  return new Date(now.getTime() - n * unitMs).toISOString().slice(0, 10);
}

/** Split a pending-row content string ("url | company | ... | note: ...") into
 * positional cells (url, company, role, location, compensation — as present)
 * and labeled segments (dead/posted/trust/note/rank — as present). Labeled
 * segments "ride on any row shape" (modes/pipeline.md), identified by their
 * `{label}:` prefix rather than column position. */
export function parseRow(content) {
  const cells = content.split('|').map((c) => c.trim());
  const labelRe = new RegExp(`^(${LABEL_ORDER.join('|')}):\\s*(.*)$`, 'i');
  const positional = [];
  const labeled = {};
  for (const cell of cells) {
    const m = cell.match(labelRe);
    if (m) {
      labeled[m[1].toLowerCase()] = m[2];
    } else if (Object.keys(labeled).length === 0) {
      // Only collect as positional until the first labeled cell is seen —
      // matches the documented shape (positional cells first, then labels).
      positional.push(cell);
    }
  }
  return { positional, labeled };
}

export function serializeRow(positional, labeled) {
  // Trim trailing empty positional cells (don't manufacture a bare "| |").
  const pos = [...positional];
  while (pos.length > 1 && pos[pos.length - 1] === '') pos.pop();
  const parts = [...pos];
  for (const label of LABEL_ORDER) {
    if (labeled[label] !== undefined && labeled[label] !== '') {
      parts.push(`${label}: ${labeled[label]}`);
    }
  }
  return parts.join(' | ');
}

/** Parse data/pipeline.md's Pending block into rows carrying a LinkedIn job id. */
export function findLinkedInPendingRows(lines) {
  const pendingStart = lines.findIndex((l) => l.trim() === '## Pending');
  const processedStart = lines.findIndex((l) => l.trim() === '## Processed');
  const rows = [];
  for (let i = pendingStart + 1; i < processedStart; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('- [ ]')) continue;
    const m = line.match(ID_RE);
    if (!m) continue;
    const content = line.replace(/^- \[ \]\s*/, '');
    const { positional, labeled } = parseRow(content);
    const company = (positional[1] || '').trim();
    const role = (positional[2] || '').trim();
    const location = (positional[3] || '').trim();
    const hasPosted = Boolean(labeled.posted && labeled.posted.trim());
    const needsEnrichment = !company || PLACEHOLDER_ROLE_RE.test(role) || !location || !hasPosted;
    rows.push({ lineIdx: i, id: m[1], positional, labeled, needsEnrichment });
  }
  return { pendingStart, processedStart, rows };
}

export async function fetchLinkedInPosting(context, id) {
  const res = await context.request.get(`https://www.linkedin.com/jobs/view/${id}/`);
  const text = await res.text();
  const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
  if (!titleMatch) return { ok: false, reason: 'no <title> tag in response' };
  let t = decodeEntities(titleMatch[1]).replace(/\s*\|\s*LinkedIn\s*$/i, '').trim();
  const closed = /no longer accepting applications/i.test(text);
  if (t === 'Jobs' || t === '') {
    // Redirected to LinkedIn's generic /jobs landing page — the posting is gone,
    // not just closed-with-a-banner (same class as a portal 301'ing a dead
    // permalink to its generic search page elsewhere in the pipeline).
    return { ok: false, closed: true, reason: 'redirected to generic LinkedIn jobs page' };
  }
  const parts = t.split(' | ');
  const company = parts.pop();
  const role = parts.join(' | ');
  if (!company || !role) return { ok: false, reason: `unparsed title: ${t}` };

  // Top-card insight line: "{location} · {Reposted }X {unit} ago · N people clicked apply".
  // Same <p class="...">...</p> element every time; identified by containing
  // "ago" rather than by its (webpack-hashed, unstable) class name.
  const pBlocks = [...text.matchAll(/<p class="[^"]*">([\s\S]*?)<\/p>/g)];
  let location = null, postedRaw = null;
  for (const m of pBlocks) {
    if (!/\bago\b/i.test(m[1])) continue;
    const plain = m[1].replace(/<[^>]+>/g, '|').split('|').map((s) => s.trim()).filter(Boolean);
    location = plain[0] || null;
    postedRaw = plain.find((s) => /\bago\b/i.test(s)) || null;
    break;
  }
  const posted = postedRaw ? relativeAgoToDate(postedRaw) : null;

  return { ok: true, role, company, closed, location, posted };
}

async function main() {
  const { dryRun, all, throttleBaseMs } = parseArgs(process.argv.slice(2));

  if (!existsSync(SESSION_FILE)) {
    console.error(`No ${SESSION_FILE} found. Run 'node linkedin-login.mjs' once first (logs in, saves the session).`);
    process.exit(1);
  }

  const text = readFileSync(PIPELINE_PATH, 'utf-8');
  const lines = text.split('\n');
  const { rows } = findLinkedInPendingRows(lines);
  const targets = all ? rows : rows.filter((r) => r.needsEnrichment);

  const uniqueIds = [...new Set(targets.map((r) => r.id))];

  if (uniqueIds.length === 0) {
    console.log(all ? 'No LinkedIn rows found in Pending.' : 'No LinkedIn rows need enrichment (use --all to re-check every row).');
    return;
  }

  console.log(`Checking ${uniqueIds.length} LinkedIn posting(s)${dryRun ? ' (dry run)' : ''}...\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION_FILE });

  // Session validity check: an authwalled request redirects and its body never
  // contains a real posting <title>. Cheap canary using the first target id.
  const canary = await fetchLinkedInPosting(context, uniqueIds[0]);
  if (!canary.ok && !canary.closed) {
    console.error(`Session looks invalid or expired (${canary.reason}). Run 'node linkedin-login.mjs' again.`);
    await browser.close();
    process.exit(1);
  }

  const results = new Map(); // id -> fetchLinkedInPosting() result
  results.set(uniqueIds[0], canary);
  for (let i = 1; i < uniqueIds.length; i++) {
    const id = uniqueIds[i];
    try {
      results.set(id, await fetchLinkedInPosting(context, id));
    } catch (e) {
      results.set(id, { ok: false, reason: String(e.message || e) });
    }
    const wait = jitteredDelayMs(throttleBaseMs);
    if (wait) await sleep(wait);
  }
  await browser.close();

  let enriched = 0, closed = 0, failed = 0;
  const failedIds = [];
  const closedRows = []; // { lineIdx, content }

  const newLines = [...lines];
  for (const row of targets) {
    const r = results.get(row.id);
    if (!r) continue;
    if (!r.ok && !r.closed) {
      failed++;
      failedIds.push(`${row.id} (${r.reason})`);
      continue;
    }
    if (r.closed) {
      const positional = [...row.positional];
      if (r.ok) {
        positional[1] = r.company;
        positional[2] = r.role;
      }
      closedRows.push({ lineIdx: row.lineIdx, content: serializeRow(positional, row.labeled) });
      closed++;
      continue;
    }
    const positional = [...row.positional];
    positional[1] = r.company;
    positional[2] = r.role;
    if (r.location) positional[3] = r.location;
    const labeled = { ...row.labeled };
    if (r.posted && !labeled.posted) labeled.posted = r.posted;
    newLines[row.lineIdx] = `- [ ] ${serializeRow(positional, labeled)}`;
    enriched++;
  }

  // Remove closed rows from Pending (highest index first so earlier indices
  // stay valid) and re-add them as struck-through Processed entries.
  const sortedClosed = [...closedRows].sort((a, b) => b.lineIdx - a.lineIdx);
  for (const { lineIdx } of sortedClosed) newLines.splice(lineIdx, 1);
  const processedIdx = newLines.findIndex((l) => l.trim() === '## Processed');
  const strikeLines = closedRows.map(({ content }) =>
    `- [x] ~~${content.trimEnd()}~~ — posting expired (liveness sweep: no longer accepting applications)`
  );
  newLines.splice(processedIdx + 1, 0, ...strikeLines);

  console.log(`Enriched: ${enriched}`);
  console.log(`Closed (moved to Processed): ${closed}`);
  if (failed) console.log(`Unresolved: ${failed} — ${failedIds.join(', ')}`);

  // Flag — never auto-write — tracker rows whose company matches a closed posting.
  if (closed && existsSync(TRACKER_PATH)) {
    const tracker = readFileSync(TRACKER_PATH, 'utf-8');
    const flaggedCompanies = new Set();
    for (const { content } of closedRows) {
      const company = content.split('|')[1]?.trim();
      if (company && tracker.includes(`| ${company} |`)) flaggedCompanies.add(company);
    }
    if (flaggedCompanies.size) {
      console.log(`\nThese closed postings' companies also have a tracker row — check data/applications.md manually (not auto-updated):`);
      for (const c of flaggedCompanies) console.log(`  - ${c}`);
    }
  }

  if (dryRun) {
    console.log('\nDry run — no files written.');
    return;
  }

  await withPipelineLock(PIPELINE_PATH, async () => {
    // Re-read under the lock in case another process wrote in the meantime;
    // re-running the same diff against fresh content is out of scope for this
    // one-shot script, so just write what we computed — acceptable because
    // pipeline.md is single-user, locally-edited data, not a shared resource.
    writeFileSync(PIPELINE_PATH, newLines.join('\n'));
  });
  console.log(`\nWrote ${PIPELINE_PATH}.`);
}

// Guarded so this module can be imported (its helpers reused by a one-off
// script) without launching a browser as a side effect.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}
