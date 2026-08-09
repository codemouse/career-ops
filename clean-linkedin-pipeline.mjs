#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

const dryRun = process.argv.includes('--dry-run');
const defaultPipeline = 'data/pipeline.md';
const pipelinePath = resolve(argValue('--pipeline') || defaultPipeline);

if (!existsSync(pipelinePath)) {
  console.error(`pipeline not found: ${pipelinePath}`);
  process.exit(1);
}

const PENDING_HEADER_RE = /^##\s+(Pending|Pendientes)\s*$/i;
const SECTION_HEADER_RE = /^##\s+/;
const PENDING_ITEM_RE = /^- \[ \]\s+(.+)$/;
const LINKEDIN_HOST_RE = /(^|\.)linkedin\.com$/i;
const LINKEDIN_VIEW_RE = /^\/comm\/jobs\/view\/(\d+)\/?$/i;
const GLASSDOOR_HOST_RE = /(^|\.)glassdoor\.com$/i;

function splitFields(itemText) {
  const parts = itemText.split('|').map(p => p.trim());
  const url = (parts[0] || '').trim();
  const company = (parts[1] || '').trim();
  const role = (parts[2] || '').trim();
  const rest = parts.slice(3);
  return { url, company, role, rest };
}

function formatItem(url, company, role, rest) {
  const fields = [url];
  if (company || role || rest.length > 0) fields.push(company || '');
  if (role || rest.length > 0) fields.push(role || '');
  fields.push(...rest);
  return `- [ ] ${fields.join(' | ')}`;
}

function parseUrlSafe(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isLinkedInHost(parsedUrl) {
  return !!parsedUrl && LINKEDIN_HOST_RE.test(parsedUrl.hostname);
}

function canonicalLinkedInJobUrl(parsedUrl) {
  if (!isLinkedInHost(parsedUrl)) return null;
  const m = parsedUrl.pathname.match(LINKEDIN_VIEW_RE);
  if (!m) return null;
  return `https://www.linkedin.com/comm/jobs/view/${m[1]}/`;
}

function isKnownEmailNoise(parsedUrl) {
  if (!parsedUrl) return false;
  const host = parsedUrl.hostname.toLowerCase();
  const path = parsedUrl.pathname;

  // Common email asset/tracking hosts from LinkedIn digests.
  if (host === 'static.licdn.com' || host === 'media.licdn.com') {
    return true;
  }

  // Common Glassdoor email tracking/assets/preferences links.
  if (GLASSDOOR_HOST_RE.test(host)) {
    if (path.startsWith('/assets/')) return true;
    if (path.startsWith('/brand-views')) return true;
    if (path.startsWith('/about/privacy')) return true;
    if (path.startsWith('/member/')) return true;
    if (path === '/') return true;
  }

  if (/^mail\d*\.glassdoor\.com$/i.test(host) && path.startsWith('/wf/open')) {
    return true;
  }

  // Common wrapped click-tracking hosts from newsletter senders.
  if (host.endsWith('.awstrack.me') && path.startsWith('/L0/')) return true;
  if (host.includes('convertkit-mail') || host.startsWith('click.')) return true;
  if (host === 'sg1email.lensa.com' && (path.startsWith('/wf/open') || path.startsWith('/ls/click'))) return true;
  if (host === 'measurements.lensa.com' || host === 'email.mg2.lensa.com') return true;
  if (host.endsWith('substackcdn.com')) return true;
  if (host.endsWith('.kxcdn.com')) return true;
  if (host.includes('s3.us-west-2.amazonaws.com')) return true;
  if (host === 'x.com' || host === 'www.x.com' || host === 'twitter.com' || host === 'www.twitter.com') return true;
  if ((host === 'fractionaljobs.io' || host === 'www.fractionaljobs.io') && !path.startsWith('/jobs/')) return true;

  // CDN/media hosts that are never job pages.
  if (host.startsWith('cdn.') || host.startsWith('static.') || host.startsWith('media.')) return true;

  return false;
}

const lines = readFileSync(pipelinePath, 'utf-8').split(/\r?\n/);

let pendingStart = -1;
let pendingEnd = lines.length;
for (let i = 0; i < lines.length; i++) {
  if (pendingStart < 0 && PENDING_HEADER_RE.test(lines[i])) {
    pendingStart = i;
    continue;
  }
  if (pendingStart >= 0 && i > pendingStart && SECTION_HEADER_RE.test(lines[i])) {
    pendingEnd = i;
    break;
  }
}

if (pendingStart < 0) {
  console.error('No Pending/Pendientes section found.');
  process.exit(1);
}

const keptLines = [];
const linkedinBest = new Map();

let pendingItems = 0;
let linkedinSeen = 0;
let linkedinNonJobDropped = 0;
let linkedinDuplicateDropped = 0;
let nonLinkedInNoiseDropped = 0;

for (let i = pendingStart + 1; i < pendingEnd; i++) {
  const line = lines[i];
  const m = line.match(PENDING_ITEM_RE);
  if (!m) {
    keptLines.push(line);
    continue;
  }

  pendingItems += 1;
  const fields = splitFields(m[1]);
  const url = fields.url;
  const parsedUrl = parseUrlSafe(url);

  if (!isLinkedInHost(parsedUrl)) {
    if (isKnownEmailNoise(parsedUrl)) {
      nonLinkedInNoiseDropped += 1;
      continue;
    }
    keptLines.push(line);
    continue;
  }

  linkedinSeen += 1;
  const canonical = canonicalLinkedInJobUrl(parsedUrl);
  if (!canonical) {
    linkedinNonJobDropped += 1;
    continue;
  }

  const existing = linkedinBest.get(canonical);
  if (!existing) {
    linkedinBest.set(canonical, {
      url: canonical,
      company: fields.company,
      role: fields.role,
      rest: fields.rest,
      sourceOrder: i,
    });
    continue;
  }

  // Keep richer metadata when duplicates disagree.
  const richerCompany = !existing.company && fields.company;
  const richerRole = !existing.role && fields.role;
  const richerRest = existing.rest.length === 0 && fields.rest.length > 0;
  if (richerCompany || richerRole || richerRest) {
    existing.company = existing.company || fields.company;
    existing.role = existing.role || fields.role;
    existing.rest = existing.rest.length ? existing.rest : fields.rest;
  }
  linkedinDuplicateDropped += 1;
}

// Append canonical LinkedIn items in original appearance order.
const canonicalLinkedInItems = Array.from(linkedinBest.values())
  .sort((a, b) => a.sourceOrder - b.sourceOrder)
  .map(item => formatItem(item.url, item.company, item.role, item.rest));

// Build final pending section while preserving non-item lines and relative order.
const rebuiltPending = [];
let insertedLinkedIn = false;
for (const line of keptLines) {
  const m = line.match(PENDING_ITEM_RE);
  if (m && isLinkedInHost(parseUrlSafe(splitFields(m[1]).url))) {
    // All LinkedIn pending items are reconstructed once, later.
    continue;
  }
  rebuiltPending.push(line);
}

// Place canonical LinkedIn jobs after existing non-LinkedIn pending items.
if (canonicalLinkedInItems.length > 0) {
  if (rebuiltPending.length > 0 && rebuiltPending[rebuiltPending.length - 1].trim() !== '') {
    rebuiltPending.push('');
  }
  rebuiltPending.push(...canonicalLinkedInItems);
  insertedLinkedIn = true;
}

const out = [
  ...lines.slice(0, pendingStart + 1),
  ...rebuiltPending,
  ...lines.slice(pendingEnd),
].join('\n');

const changed = out !== lines.join('\n');
const summary = {
  file: pipelinePath,
  pendingItems,
  linkedinSeen,
  linkedinKeptCanonical: canonicalLinkedInItems.length,
  linkedinNonJobDropped,
  linkedinDuplicateDropped,
  nonLinkedInNoiseDropped,
  changed,
  insertedLinkedIn,
};

if (!dryRun && changed) {
  writeFileSync(pipelinePath, out, 'utf-8');
}

console.log(JSON.stringify(summary, null, 2));