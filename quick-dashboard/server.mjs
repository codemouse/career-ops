#!/usr/bin/env node

import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import yaml from 'js-yaml';
import { cell, resolvePdfIndexPath } from '../tracker-utils.mjs';
import { parsePdfIndex } from '../find.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const publicDir = resolve(__dirname, 'ui');
const webDataDir = resolve(root, '.career-ops-quick-dashboard');
const fitFiltersPath = resolve(webDataDir, 'fit-filters.json');
const excludedPendingSources = new Set(['Glassdoor']);
const defaultAppliedWorkbookPath = resolve(process.env.HOME || '', 'Downloads', '2026 Job Search.xlsx');
const appliedWorkbookPath = process.env.CAREER_OPS_APPLIED_WORKBOOK || defaultAppliedWorkbookPath;
const portArg = process.argv.find((a) => a.startsWith('--port='));
const port = Number((portArg || '').split('=')[1] || 4173);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname.startsWith('/download/')) {
    return handleDownload(req, res, url.pathname);
  }

  if (url.pathname.startsWith('/api/')) {
    return handleApi(req, res, url.pathname);
  }

  return serveStatic(res, url.pathname);
});

server.listen(port, () => {
  console.log(`CareerOps Quick Dashboard running at http://localhost:${port}`);
});

function handleApi(req, res, path) {
  if (req.method === 'GET' && path === '/api/health') {
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && path === '/api/states') {
    return json(res, 200, { states: readStates() });
  }

  if (req.method === 'GET' && path === '/api/pipeline') {
    return json(res, 200, readPipeline());
  }

  if (req.method === 'GET' && path === '/api/tracker') {
    return json(res, 200, readTracker());
  }

  if (req.method === 'POST' && path === '/api/scan') {
    const scanOut = runNode(['scan.mjs']);
    // Generous timeout: the engine's default 15s doesn't actually cancel the
    // Gmail fetch on expiry — it keeps running in the background and later
    // overwrites the processed-message cursor without saving what it found,
    // silently hiding leads. A large label + full history makes 15s too easy to miss.
    const gmailOut = runNode(['plugins.mjs', 'run', 'gmail', '--timeout-ms', '60000']);
    const stdout = [scanOut.stdout, gmailOut.stdout && `\n— Gmail ingest —\n${gmailOut.stdout}`]
      .filter(Boolean).join('\n');
    // Gmail is opt-in (config/plugins.yml); a disabled/misconfigured plugin
    // logs to stderr and exits non-zero without failing the portal scan.
    const stderr = [scanOut.stderr, gmailOut.status !== 0 && gmailOut.stderr && `Gmail ingest: ${gmailOut.stderr}`]
      .filter(Boolean).join('\n');
    return json(res, scanOut.status === 0 ? 200 : 500, { status: scanOut.status, stdout, stderr });
  }

  if (req.method === 'POST' && path === '/api/status') {
    return readBody(req, res, ({ selector, state, note, setNote }) => {
      if (!selector || !state) return json(res, 400, { error: 'selector and state are required' });
      if (note != null && setNote != null) return json(res, 400, { error: 'note and setNote are mutually exclusive' });
      const args = ['set-status.mjs', String(selector), String(state)];
      // setNote replaces the Notes cell verbatim (freeform row edit); note
      // appends with the existing "; "-separated, idempotent semantics.
      if (setNote != null) args.push('--set-note', String(setNote));
      else if (note && String(note).trim()) args.push('--note', String(note).trim());
      const out = runNode(args);
      return json(res, out.status === 0 ? 200 : 500, out);
    });
  }

  if (req.method === 'POST' && path === '/api/pipeline/add') {
    return readBody(req, res, ({ url, company, role, location }) => {
      if (!url || typeof url !== 'string') return json(res, 400, { error: 'url is required' });
      const result = addToPipeline(url.trim(), String(company || '').trim(), String(role || '').trim(), String(location || '').trim());
      return json(res, result.ok ? 200 : 500, result);
    });
  }

  if (req.method === 'POST' && path === '/api/pipeline/process') {
    return readBody(req, res, ({ item, action, rejectRule, resumeNote }) => {
      if (!item) return json(res, 400, { error: 'item is required' });
      const result = movePipelineItemToProcessed(item, String(action || 'processed'), rejectRule || null, resumeNote ? String(resumeNote) : '');
      return json(res, result.ok ? 200 : 500, result);
    });
  }

  if (req.method === 'GET' && path === '/api/fit-filters') {
    return json(res, 200, { rules: readFitFilters() });
  }

  if (req.method === 'POST' && path === '/api/fit-filters/remove') {
    return readBody(req, res, ({ id }) => {
      if (!id || typeof id !== 'string') return json(res, 400, { error: 'id is required' });
      const result = removeFitFilterRule(id);
      return json(res, result.ok ? 200 : 500, result);
    });
  }

  if (req.method === 'GET' && path === '/api/ops/baseline') {
    return json(res, 200, readOpsBaseline());
  }

  if (req.method === 'POST' && path === '/api/ops/run') {
    return readBody(req, res, ({ action }) => {
      if (!action || typeof action !== 'string') return json(res, 400, { error: 'action is required' });
      const result = runOpsAction(action);
      return json(res, 200, { ok: result.status === 0, stdout: result.stdout, stderr: result.stderr });
    });
  }

  if (req.method === 'GET' && path === '/api/resumes') {
    return json(res, 200, { resumes: listResumePdfs() });
  }

  if (req.method === 'POST' && path === '/api/bulk-import') {
    return readBody(req, res, ({ filePath: fp }) => {
      const result = bulkImportFromWorkbook(fp || appliedWorkbookPath);
      return json(res, result.ok ? 200 : 500, result);
    });
  }

  if (req.method === 'GET' && path === '/api/reports') {
    return json(res, 200, { reports: listReports() });
  }

  if (req.method === 'GET' && path === '/api/reports/by-url') {
    const reportUrl = String(new URL(req.url || '/', `http://${req.headers.host}`).searchParams.get('url') || '').trim();
    if (!reportUrl) return json(res, 400, { error: 'url is required' });
    return json(res, 200, { filename: reportFilenameFromUrl(reportUrl), score: scoreFromReportUrl(reportUrl) });
  }

  if (req.method === 'GET' && path.startsWith('/api/reports/')) {
    const slug = decodeURIComponent(path.slice('/api/reports/'.length));
    if (!slug || slug.includes('..') || slug.includes('/')) return json(res, 400, { error: 'invalid slug' });
    const file = resolve(root, 'reports', slug);
    if (!existsSync(file) || !file.startsWith(resolve(root, 'reports'))) return json(res, 404, { error: 'not found' });
    return json(res, 200, { content: readFileSync(file, 'utf8') });
  }

  if (req.method === 'POST' && path === '/api/reports/pdf-on-demand') {
    return readBody(req, res, async ({ company }) => {
      const targetCompany = String(company || '').trim();
      if (!targetCompany) return json(res, 400, { error: 'company is required' });
      const result = await runCareerOpsPdfOnDemand(targetCompany);
      return json(res, result.status === 0 ? 200 : 500, result);
    });
  }

  if (req.method === 'POST' && path === '/api/evaluate') {
    return readBody(req, res, ({ url }) => {
      if (!url || typeof url !== 'string') return json(res, 400, { error: 'url is required' });
      const trimmedUrl = normalizeLinkedInJobUrl(url.trim());
      ensureInPipeline(trimmedUrl);
      streamEvaluate(req, res, trimmedUrl);
    });
  }

  return json(res, 404, { error: 'not found' });
}

function serveStatic(res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = resolve(publicDir, `.${safePath}`);
  if (!filePath.startsWith(publicDir)) return text(res, 403, 'Forbidden');
  if (!existsSync(filePath)) return text(res, 404, 'Not Found');

  const ext = extname(filePath).toLowerCase();
  const type = (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
    }[ext] || 'text/plain; charset=utf-8'
  );

  const body = readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
  });
  res.end(body);
}

function handleDownload(req, res, path) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return text(res, 405, 'Method Not Allowed');
  }

  if (path.startsWith('/download/resume/')) {
    const filename = decodeURIComponent(path.slice('/download/resume/'.length));
    return serveResumePdf(req, res, filename);
  }

  return text(res, 404, 'Not Found');
}

// Serves any PDF in output/ by exact filename — the dropdown built from
// /api/resumes (listResumePdfs) is the only source of these filenames, but
// the route still guards against path traversal since it's a public GET.
function serveResumePdf(req, res, filename) {
  if (!filename || filename.includes('..') || filename.includes('/') || !filename.toLowerCase().endsWith('.pdf')) {
    return text(res, 400, 'Invalid filename');
  }
  const outputDir = resolve(root, 'output');
  const file = resolve(outputDir, filename);
  if (!file.startsWith(outputDir + '/') || !existsSync(file)) {
    return text(res, 404, 'Not found');
  }

  const body = readFileSync(file);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${filename}"`,
    'Content-Length': body.length,
  });
  if (req.method === 'HEAD') {
    return res.end();
  }
  res.end(body);
}

function readScanHistoryAddedAtByUrl() {
  const file = resolve(root, 'data', 'scan-history.tsv');
  if (!existsSync(file)) return {};

  const byUrl = {};
  const rows = readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of rows.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    const url = String(cols[0] || '').trim();
    if (!url) continue;
    const firstSeen = String(cols[1] || '').trim();
    const addedAt = String(cols[12] || '').trim() || firstSeen;
    if (!addedAt) continue;
    if (!byUrl[url]) byUrl[url] = addedAt;
  }

  return byUrl;
}

function attachPipelineAddedAt(item, addedAtByUrl) {
  const rawUrl = String(item?.originalUrl || item?.url || '').trim();
  const normalizedUrl = String(item?.url || '').trim();
  const addedAt = addedAtByUrl[rawUrl] || addedAtByUrl[normalizedUrl] || '';
  return { ...item, addedAt };
}

function addToPipeline(url, company, role, location) {
  const file = resolve(root, 'data', 'pipeline.md');
  if (!existsSync(file)) return { ok: false, error: 'pipeline.md not found' };

  const entry = `- [ ] ${url} | ${company} | ${role} | ${location} | note: source: manual`;
  const content = readFileSync(file, 'utf8');
  const pendingIdx = content.indexOf('\n## Pending\n');
  if (pendingIdx === -1) return { ok: false, error: '## Pending section not found in pipeline.md' };

  const insertAt = pendingIdx + '\n## Pending\n'.length;
  const updated = content.slice(0, insertAt) + '\n' + entry + '\n' + content.slice(insertAt);
  writeFileSync(file, updated, 'utf8');
  return { ok: true, entry };
}

// True if `url` already appears anywhere in pipeline.md (Pending or Processed),
// matched loosely via normalizeUrlForMatch so tracking params don't cause misses.
function pipelineHasUrl(url) {
  const file = resolve(root, 'data', 'pipeline.md');
  if (!existsSync(file)) return false;
  const target = normalizeUrlForMatch(url);
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- [')) continue;
    const item = parsePipelineItem(trimmed);
    if (normalizeUrlForMatch(item.url) === target || normalizeUrlForMatch(item.originalUrl) === target) return true;
  }
  return false;
}

// Quick Evaluate lets the user paste any URL, not just ones the scanner already
// queued. Without an inbox entry, a dead link makes oferta.md's liveness gate
// stop with "not in pipeline.md, no inbox entry to mark" instead of resolving
// cleanly — so give it one before evaluation starts. Best-effort: evaluation
// proceeds either way.
function ensureInPipeline(url) {
  try {
    if (!pipelineHasUrl(url)) addToPipeline(url, '', 'Quick Evaluate', '');
  } catch { /* ignore */ }
}

function readPipeline() {
  const file = resolve(root, 'data', 'pipeline.md');
  if (!existsSync(file)) return { pending: [], processed: [] };

  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const pending = [];
  const processed = [];
  const addedAtByUrl = readScanHistoryAddedAtByUrl();

  let section = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '## Pending') {
      section = 'pending';
      continue;
    }
    if (trimmed === '## Processed') {
      section = 'processed';
      continue;
    }
    if (!trimmed.startsWith('- [')) continue;

    if (section === 'pending') pending.push(attachPipelineAddedAt(parsePipelineItem(trimmed), addedAtByUrl));
    if (section === 'processed') processed.push(attachPipelineAddedAt(parsePipelineItem(trimmed), addedAtByUrl));
  }

  const excludedPending = pending.filter((item) => excludedPendingSources.has(String(item.source || '').trim()));
  const visiblePending = dedupePendingItems(
    pending.filter((item) => !excludedPendingSources.has(String(item.source || '').trim())),
  );

  const pendingSegments = {
    fractional: visiblePending.filter((p) => p.employmentType === 'fractional'),
    fullTime: visiblePending.filter((p) => p.employmentType === 'full-time'),
    unknown: visiblePending.filter((p) => p.employmentType === 'unknown'),
  };

  const sourceSummary = {};
  for (const item of visiblePending) {
    sourceSummary[item.source] = (sourceSummary[item.source] || 0) + 1;
  }

  return {
    pending: visiblePending,
    processed,
    excludedPendingCount: excludedPending.length,
    excludedPendingSources: [...excludedPendingSources],
    priorAppliedCompanies: readPriorAppliedCompaniesThisYear(),
    pendingSegments,
    sourceSummary,
    addedAtByUrl,
    pendingSummary: {
      total: visiblePending.length,
      fractional: pendingSegments.fractional.length,
      fullTime: pendingSegments.fullTime.length,
      unknown: pendingSegments.unknown.length,
    },
  };
}

function dedupePendingItems(items) {
  const seen = new Set();
  const deduped = [];

  for (const item of items || []) {
    const key = [
      normalizeCompanyName(item.company),
      String(item.role || '').trim().toLowerCase(),
      String(item.source || '').trim().toLowerCase(),
      String(item.employmentType || inferEmploymentType(item)).trim().toLowerCase(),
    ].join('::');

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function readPriorAppliedCompaniesThisYear() {
  const year = new Date().getFullYear();
  const merged = {};

  const appliedStatuses = new Set(['Applied', 'Responded', 'Interview', 'Offer', 'Hired', 'Rejected']);
  const tracker = readTracker();
  for (const row of tracker.rows || []) {
    const rowYear = String(row.date || '').slice(0, 4);
    const status = String(row.status || '').trim();
    const company = String(row.company || '').trim();
    if (!company || rowYear !== String(year) || !appliedStatuses.has(status)) continue;

    const key = normalizeCompanyName(company);
    if (!key) continue;
    if (!merged[key]) {
      merged[key] = { company, status, source: 'tracker' };
    }
  }

  const workbookRows = readAppliedCompaniesFromWorkbook(appliedWorkbookPath, year);
  for (const row of workbookRows) {
    const company = String(row.company || '').trim();
    if (!company) continue;
    const key = normalizeCompanyName(company);
    if (!key) continue;

    if (!merged[key]) {
      merged[key] = { company, status: row.status || 'Applied', source: 'workbook' };
    }
  }

  return merged;
}

function readAppliedCompaniesFromWorkbook(filePath, targetYear) {
  try {
    if (!filePath || !existsSync(filePath)) return [];

    const workbookXml = unzipText(filePath, 'xl/workbook.xml');
    const relsXml = unzipText(filePath, 'xl/_rels/workbook.xml.rels');
    const sharedStringsXml = unzipText(filePath, 'xl/sharedStrings.xml');
    if (!workbookXml || !relsXml) return [];

    const sharedStrings = parseSharedStrings(sharedStringsXml || '');
    const sheetPath = resolveWorkbookSheetPath(workbookXml, relsXml, String(targetYear)) || 'xl/worksheets/sheet1.xml';
    const sheetXml = unzipText(filePath, sheetPath);
    if (!sheetXml) return [];

    const rows = parseWorksheetRows(sheetXml, sharedStrings);
    if (!rows.length) return [];

    const headerRow = rows[0] || {};
    const companyCol = findHeaderColumn(headerRow, ['company']);
    const statusCol = findHeaderColumn(headerRow, ['status']);
    if (!companyCol || !statusCol) return [];

    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || {};
      const company = String(row[companyCol] || '').trim();
      const status = String(row[statusCol] || '').trim();
      if (!company || !isAppliedLikeStatus(status)) continue;
      out.push({ company, status });
    }
    return out;
  } catch {
    return [];
  }
}

function unzipText(zipPath, innerPath) {
  const result = spawnSync('unzip', ['-p', zipPath, innerPath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 32,
  });
  if (result.status !== 0) return '';
  return result.stdout || '';
}

function parseSharedStrings(xml) {
  const out = [];
  const siMatches = xml.matchAll(/<si>([\s\S]*?)<\/si>/g);
  for (const m of siMatches) {
    const combined = [...String(m[1] || '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((x) => decodeXmlText(x[1] || ''))
      .join('');
    out.push(combined);
  }
  return out;
}

function parseWorksheetRows(xml, sharedStrings) {
  const rows = [];
  const rowMatches = xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g);
  for (const rowMatch of rowMatches) {
    const rowXml = rowMatch[1] || '';
    const cells = {};
    const cellMatches = rowXml.matchAll(/<c[^>]*r="([A-Z]+)\d+"[^>]*?(?:t="(\w+)"[^>]*)?>\s*(?:<v>([\s\S]*?)<\/v>|<is>\s*<t[^>]*>([\s\S]*?)<\/t>\s*<\/is>)?/g);
    for (const cell of cellMatches) {
      const col = cell[1];
      const type = cell[2] || '';
      const value = (cell[3] || '').trim();
      const inlineValue = cell[4] || '';
      let finalValue = '';

      if (type === 's') {
        const idx = Number.parseInt(value, 10);
        finalValue = Number.isFinite(idx) ? (sharedStrings[idx] || '') : '';
      } else if (type === 'inlineStr') {
        finalValue = decodeXmlText(inlineValue);
      } else {
        finalValue = decodeXmlText(value);
      }

      cells[col] = finalValue;
    }
    rows.push(cells);
  }
  return rows;
}

function resolveWorkbookSheetPath(workbookXml, relsXml, sheetName) {
  const sheetRe = new RegExp(`<sheet[^>]*name="${escapeRegExp(sheetName)}"[^>]*r:id="([^"]+)"`, 'i');
  const sheetMatch = workbookXml.match(sheetRe);
  if (!sheetMatch) return '';
  const rid = sheetMatch[1];

  const relRe = new RegExp(`<Relationship[^>]*Id="${escapeRegExp(rid)}"[^>]*Target="([^"]+)"`, 'i');
  const relMatch = relsXml.match(relRe);
  if (!relMatch) return '';
  const target = relMatch[1].replace(/^\//, '');
  if (target.startsWith('xl/')) return target;
  return `xl/${target}`;
}

function findHeaderColumn(headerRow, candidates) {
  const lowerCandidates = candidates.map((c) => c.toLowerCase());
  for (const [col, header] of Object.entries(headerRow || {})) {
    const h = String(header || '').trim().toLowerCase();
    if (!h) continue;
    if (lowerCandidates.some((cand) => h === cand || h.includes(cand))) return col;
  }
  return '';
}

function isAppliedLikeStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return false;
  if (/(skip|wishlist|saved|watch|not\s+a\s+fit|discarded)/.test(s)) return false;
  return /(appl|respond|interview|offer|hired|reject|screen|onsite|final)/.test(s);
}

function normalizeCompanyName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|gmbh|plc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeXmlText(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePipelineItem(line) {
  const clean = line.replace(/^- \[[^\]]+\]\s*/, '');
  const parts = clean.split('|').map((p) => p.trim());
  const originalUrl = parts[0] || '';
  const url = normalizeLinkedInJobUrl(unwrapTrackingUrl(originalUrl) || originalUrl);
  const initialCompany = parts[1] || '';
  const initialRole = parts[2] || '';
  const host = hostFromUrl(url);
  const derivedRole = deriveRoleFromUrl(url, host);
  const derivedCompany = deriveCompanyFromUrl(url, host);
  // Some boards (BuiltIn, Adzuna, ...) don't encode the employer in the URL at
  // all -- only the job title. When the pipeline hint is untrustworthy (it's
  // literally the board's own name, e.g. "Builtin") and the URL yields nothing
  // better, check whether this exact posting was already evaluated: reports/
  // carry the real employer the evaluator extracted from the JD itself.
  const resolvedCompany = shouldUseDerivedCompany(initialCompany, host)
    ? (derivedCompany || companyFromReportUrl(url) || stripCompanySalarySuffix(initialCompany))
    : initialCompany;
  const resolvedRole = shouldUseDerivedRole(initialRole) && derivedRole ? derivedRole : initialRole;

  const parsed = {
    raw: line,
    url,
    originalUrl,
    company: resolvedCompany,
    role: resolvedRole,
    location: parts[3] || '',
    posted: parts.find((p) => p.toLowerCase().startsWith('posted:')) || '',
    extra: parts.slice(4),
  };
  parsed.note = (parsed.extra || []).find((p) => p.toLowerCase().startsWith('note:')) || '';
  parsed.source = normalizePipelineSource(sourceFromNote(parsed.note) || sourceFromUrl(parsed.url), parsed);
  parsed.sourceHost = hostFromUrl(parsed.url);
  parsed.employmentType = inferEmploymentType(parsed);
  parsed.score = scoreFromReportUrl(url);
  parsed.reportFilename = reportFilenameFromUrl(url);
  return parsed;
}

function unwrapTrackingUrl(inputUrl, depth = 0) {
  if (!inputUrl || depth > 3) return inputUrl;
  try {
    const u = new URL(inputUrl);
    const keys = ['url', 'u', 'target', 'redirect', 'redirect_uri', 'dest', 'destination'];
    for (const key of keys) {
      const val = u.searchParams.get(key);
      if (!val) continue;
      const decoded = decodeURIComponent(val);
      if (!/^https?:\/\//i.test(decoded)) continue;
      return unwrapTrackingUrl(decoded, depth + 1);
    }
    return inputUrl;
  } catch {
    return inputUrl;
  }
}

// LinkedIn's "comm" job links (the format used in email/mobile-share alerts)
// 302 straight to a bare login wall with zero JD content. The canonical
// /jobs/view/{id}/ path for the same posting serves the JD text behind a
// login overlay instead, so it's the one Open links, Evaluate, and the
// liveness/JD-fetch gate can actually use. Without this, Evaluate silently
// spins forever on these rows (the JD fetch has nothing to work with, so it
// never produces the assistant text the UI streams).
function normalizeLinkedInJobUrl(url) {
  const m = String(url || '').match(/^(https?:\/\/(?:www\.)?linkedin\.com)\/comm\/jobs\/view\/(\d+)/i);
  return m ? `${m[1]}/jobs/view/${m[2]}/` : url;
}

// LinkedIn appends a compensation-insight suffix to the poster label, e.g.
// "Ladders: up to $502K/year" or "talisman: up to $350K/year" -- the leading
// name is the job board/recruiter/aggregator that posted it, not reliably the
// real employer, so treat it the same as the generic board names below.
const SALARY_SUFFIX_RE = /:\s*(up to\s*)?\$[\d,.]+\s*k?\s*(\/|per\s*)?(year|yr)\b/i;

function shouldUseDerivedCompany(company, host) {
  const c = String(company || '').trim().toLowerCase();
  if (!c) return true;
  if (host === 'fractionaljobs.io' || host === 'www.fractionaljobs.io') {
    return c === 'fractionaljobs' || c === 'fractional jobs';
  }
  if (SALARY_SUFFIX_RE.test(c)) return true;
  return c === 'builtin' || c === 'linkedin' || c === 'adzuna' || c === 'glassdoor';
}

function stripCompanySalarySuffix(company) {
  const c = String(company || '');
  const m = c.match(SALARY_SUFFIX_RE);
  return (m ? c.slice(0, m.index) : c).trim();
}

function shouldUseDerivedRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (!r) return true;
  return r === 'job lead (email)' || r === 'job lead' || r === 'role' || r.startsWith('your application to ');
}

function deriveRoleFromUrl(url, host) {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();

    const linkedInRole = deriveLinkedInRoleFromText(url);
    if (linkedInRole) return linkedInRole;

    if (host === 'fractionaljobs.io' || host === 'www.fractionaljobs.io') {
      const m = path.match(/^\/jobs\/([^/?#]+)/i);
      if (!m) return '';
      const slug = decodeURIComponent(m[1]);
      const rolePart = slug.split(/-at-/i)[0] || slug;
      return humanizeSlug(rolePart);
    }

    if (host === 'builtin.com' || host === 'www.builtin.com') {
      const m = path.match(/^\/job\/([^/?#]+)/i);
      if (m && m[1]) return humanizeSlug(decodeURIComponent(m[1]));
    }

    if (host === 'adzuna.com' || host === 'www.adzuna.com') {
      const hint = u.searchParams.get('utm_content') || '';
      const token = hint.split('~')[0] || '';
      if (token) return humanizeSlug(token);
    }

    // Generic fallback: derive from obvious '/jobs/<slug>' style URLs.
    const jobsMatch = path.match(/\/(jobs?|careers?)\/([^/?#]+)/i);
    if (jobsMatch && jobsMatch[2]) {
      const slug = decodeURIComponent(jobsMatch[2]).replace(/[-_]?\d{5,}$/i, '');
      if (slug && !/^job(s)?$/i.test(slug)) return humanizeSlug(slug);
    }

    return '';
  } catch {
    return '';
  }
}

function deriveCompanyFromUrl(url, host) {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();

    if (host === 'fractionaljobs.io' || host === 'www.fractionaljobs.io') {
      const m = path.match(/^\/jobs\/([^/?#]+)/i);
      if (!m) return '';
      const slug = decodeURIComponent(m[1]);
      const parts = slug.split(/-at-/i);
      if (parts.length < 2) return '';
      const companyPart = parts.slice(1).join(' at ');
      return humanizeSlug(companyPart);
    }

    if (host.endsWith('myworkdayjobs.com') || host.endsWith('workdayjobs.com')) {
      const sub = host.split('.')[0] || '';
      if (sub && sub !== 'www') return humanizeSlug(sub);
    }

    if (host.endsWith('greenhouse.io')) {
      const m = path.match(/^\/(?:embed\/)?(?:job_app|job)?\/?([^/?#]+)/i);
      if (m && m[1] && !/^job|jobs|boards$/i.test(m[1])) return humanizeSlug(decodeURIComponent(m[1]));
    }

    if (host.endsWith('lever.co')) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 1) return humanizeSlug(decodeURIComponent(parts[0]));
    }

    if (host.endsWith('ashbyhq.com')) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 1 && parts[0] !== 'jobs') return humanizeSlug(decodeURIComponent(parts[0]));
      if (parts.length >= 2 && parts[0] === 'jobs') return humanizeSlug(decodeURIComponent(parts[1]));
    }

    if (host.endsWith('smartrecruiters.com')) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 2 && parts[0].toLowerCase() === 'company') {
        return humanizeSlug(decodeURIComponent(parts[1]));
      }
    }

    return '';
  } catch {
    return '';
  }
}

function deriveLinkedInRoleFromText(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/your application to\s+(.+)$/i);
  return m && m[1] ? m[1].trim() : '';
}

function humanizeSlug(slug) {
  const tokens = String(slug || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  if (!tokens.length) return '';

  const upper = new Set(['vp', 'cfo', 'ceo', 'cto', 'coo', 'ciso', 'cio', 'gtm', 'it', 'hr', 'ai', 'ml', 'seo']);
  return tokens
    .map((w) => {
      const lw = w.toLowerCase();
      if (upper.has(lw)) return lw.toUpperCase();
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(' ');
}

function sourceFromNote(note) {
  if (!note || typeof note !== 'string') return '';
  const m = note.match(/source:\s*([^;|]+)/i);
  return m ? m[1].trim() : '';
}

function normalizePipelineSource(source, item = {}) {
  const raw = String(source || '').trim();
  if (!raw) return 'Unknown';

  const normalizedCompany = normalizeCompanyName(item?.company || '');
  const rawHost = hostFromUrl(raw);
  const host = rawHost || raw.toLowerCase().replace(/^www\./, '');

  if (host === 'form.jotform.com' || host.endsWith('.jotform.com') || host === 'jotform.com') {
    if (normalizedCompany === 'builtin') return 'BuiltIn';
  }

  if (host.endsWith('linkedin.com')) return 'LinkedIn';
  if (host.endsWith('glassdoor.com')) return 'Glassdoor';
  if (host === 'fractionaljobs.io' || host === 'www.fractionaljobs.io') return 'FractionalJobs';
  if (host === 'builtin.com' || host === 'www.builtin.com') return 'BuiltIn';
  if (host === 'adzuna.com' || host === 'www.adzuna.com') return 'Adzuna';
  if (host.endsWith('ashbyhq.com')) return 'Ashby';
  if (host.includes('greenhouse.io')) return 'Greenhouse';
  if (host.includes('lever.co')) return 'Lever';
  if (host.includes('workdayjobs.com') || host.includes('myworkdayjobs.com')) return 'Workday';
  if (host.endsWith('lensa.com')) return 'Lensa';
  if (host.endsWith('substack.com')) return 'Substack';
  if (host.endsWith('beehiiv.com')) return 'Beehiiv';

  return raw;
}

function sourceFromUrl(url) {
  const host = hostFromUrl(url);
  return normalizePipelineSource(host || 'Unknown');
}

function inferEmploymentType(item) {
  const haystack = `${item.url} ${item.company} ${item.role} ${item.location} ${(item.extra || []).join(' ')}`.toLowerCase();
  const host = hostFromUrl(item.url);
  const path = pathFromUrl(item.url);

  const fractionalSignals = [
    'fractional',
    'contract',
    'contractor',
    'consultant',
    'consulting',
    'interim',
    'part-time',
    'part time',
    'hourly',
    'freelance',
  ];
  if (host === 'fractionaljobs.io' || host === 'www.fractionaljobs.io' || fractionalSignals.some((k) => haystack.includes(k))) {
    return 'fractional';
  }

  const fullTimeSignals = ['full-time', 'full time', 'permanent', 'fte'];
  if (fullTimeSignals.some((k) => haystack.includes(k))) {
    return 'full-time';
  }

  // Most direct ATS/job board posting URLs are full-time unless explicitly marked fractional.
  if (looksLikeFullTimeByHost(host, path)) {
    return 'full-time';
  }

  return 'full-time';
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function pathFromUrl(url) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}

function looksLikeFullTimeByHost(host, path) {
  if (!host) return false;

  if (host.endsWith('linkedin.com') && path.startsWith('/comm/jobs/view/')) return true;
  if (host.endsWith('glassdoor.com') && (path.startsWith('/partner/joblisting.htm') || path.startsWith('/job/'))) return true;

  const fullTimeHosts = [
    'builtin.com',
    'www.builtin.com',
    'adzuna.com',
    'www.adzuna.com',
    'jobs.ashbyhq.com',
    'solid.jobs',
  ];
  if (fullTimeHosts.includes(host)) return true;

  if (
    host.includes('greenhouse.io') ||
    host.includes('lever.co') ||
    host.includes('workdayjobs.com') ||
    host.includes('myworkdayjobs.com') ||
    host.includes('smartrecruiters.com') ||
    host.includes('jobvite.com') ||
    host.includes('icims.com')
  ) return true;

  return false;
}

// Latest date per tracker row from the append-only transition ledger
// (data/status-log.tsv, written by set-status.mjs — never edited in place).
// Rows with no logged transition yet (e.g. never had a status change) fall
// back to the tracker's own date column in readTracker().
function readLastUpdatedByNum(trackerFile) {
  const logPath = resolve(dirname(trackerFile), 'status-log.tsv');
  if (!existsSync(logPath)) return {};

  const lastByNum = {};
  const lines = readFileSync(logPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const [num, date] = line.split('\t');
    if (!num || !date) continue;
    if (!lastByNum[num] || date > lastByNum[num]) lastByNum[num] = date;
  }
  return lastByNum;
}

function readTracker() {
  const pathCandidates = [resolve(root, 'data', 'applications.md'), resolve(root, 'applications.md')];
  const file = pathCandidates.find((p) => existsSync(p));
  if (!file) return { found: false, rows: [], summary: {} };

  const lastUpdatedByNum = readLastUpdatedByNum(file);
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue;
    const cols = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cols.length < 9) continue;
    if (cols[0] === '#' || cols[0].startsWith('---')) continue;

    rows.push({
      num: cols[0],
      date: cols[1],
      company: cols[2],
      role: cols[3],
      score: cols[4],
      status: cols[5],
      pdf: cols[6],
      report: cols[7],
      notes: cols[8],
      lastUpdated: lastUpdatedByNum[cols[0]] || cols[1],
    });
  }

  const summary = {};
  for (const r of rows) {
    summary[r.status] = (summary[r.status] || 0) + 1;
  }

  return { found: true, file, rows, summary };
}

function readStates() {
  const file = resolve(root, 'templates', 'states.yml');
  const doc = yaml.load(readFileSync(file, 'utf8'));
  return (doc?.states || []).map((s) => s.label);
}

function movePipelineItemToProcessed(itemTarget, action = 'processed', rejectRuleInput = null, resumeNote = '') {
  try {
    const file = resolve(root, 'data', 'pipeline.md');
    const textBody = readFileSync(file, 'utf8');
    const lines = textBody.split(/\r?\n/);

    const target = normalizePipelineItemTarget(itemTarget);
    const normalizedTarget = target.raw;
    let targetIndex = -1;
    let processedHeaderIndex = -1;
    let fallbackTarget = null;

    if (normalizedTarget) {
      fallbackTarget = parsePipelineItem(normalizedTarget);
    } else if (target.url || target.company || target.role) {
      fallbackTarget = {
        url: target.url,
        company: target.company,
        role: target.role,
      };
    }

    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t === '## Processed') processedHeaderIndex = i;
      if (t === normalizedTarget) targetIndex = i;
    }

    if (targetIndex === -1 && fallbackTarget?.url) {
      const normalizedUrl = String(fallbackTarget.url || '').trim();
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t.startsWith('- [')) continue;
        const parsed = parsePipelineItem(t);
        if (String(parsed.url || '').trim() === normalizedUrl) {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex === -1 && fallbackTarget?.url) {
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t.startsWith('- [')) continue;
        const parsed = parsePipelineItem(t);
        const sameUrl = String(parsed.url || '') === String(fallbackTarget.url || '');
        const sameCompany = normalizeCompanyName(parsed.company) === normalizeCompanyName(fallbackTarget.company);
        const sameRole = String(parsed.role || '').trim().toLowerCase() === String(fallbackTarget.role || '').trim().toLowerCase();
        if (sameUrl && sameCompany && sameRole) {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex === -1) {
      return { ok: false, error: 'Pending item not found in pipeline.md' };
    }

    const normalizedAction = action === 'remove' ? 'processed' : action;

    const original = lines[targetIndex];
    let processedLine = original.replace('- [ ]', '- [x]');
    if (normalizedAction === 'applied') {
      const trackerWrite = addOrUpdateTrackerAppliedFromPipelineLine(original, resumeNote);
      if (!trackerWrite.ok) {
        return { ok: false, error: trackerWrite.error || 'failed to write tracker row' };
      }
    }
    lines.splice(targetIndex, 1);

    if (processedHeaderIndex === -1) {
      lines.push('', '## Processed', processedLine);
    } else {
      const insertAt = processedHeaderIndex + 1;
      lines.splice(insertAt, 0, processedLine);
    }

    writeFileSync(file, lines.join('\n'));

    if (normalizedAction === 'reject' && rejectRuleInput) {
      const addResult = addFitFilterRule(rejectRuleInput);
      if (!addResult.ok) return addResult;
      return { ok: true, action: 'reject', filterRuleAdded: true, filterRule: addResult.rule };
    }

    if (action === 'remove') return { ok: true, action: 'remove' };
    return { ok: true, action: normalizedAction };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

function normalizePipelineItemTarget(input) {
  if (input && typeof input === 'object') {
    return {
      raw: String(input.raw || '').trim(),
      url: String(input.url || '').trim(),
      company: String(input.company || '').trim(),
      role: String(input.role || '').trim(),
    };
  }

  return {
    raw: String(input || '').trim(),
    url: '',
    company: '',
    role: '',
  };
}

function readFitFilters() {
  if (!existsSync(fitFiltersPath)) return [];
  const data = safeJsonParse(readFileSync(fitFiltersPath, 'utf8'), []);
  return Array.isArray(data) ? data : [];
}

function writeFitFilters(rules) {
  mkdirSync(webDataDir, { recursive: true });
  writeFileSync(fitFiltersPath, JSON.stringify(rules, null, 2));
}

function addFitFilterRule(ruleInput) {
  const rule = sanitizeFitFilterRule(ruleInput);
  if (!rule) {
    return { ok: false, error: 'invalid reject rule' };
  }
  const current = readFitFilters();
  current.unshift(rule);
  writeFitFilters(current);
  return { ok: true, rule };
}

function removeFitFilterRule(id) {
  const current = readFitFilters();
  const next = current.filter((r) => r && r.id !== id);
  writeFitFilters(next);
  return { ok: true, removed: current.length - next.length };
}

function sanitizeFitFilterRule(ruleInput) {
  if (!ruleInput || typeof ruleInput !== 'object') return null;

  const reasonId = String(ruleInput.reasonId || '').trim();
  const reasonLabel = String(ruleInput.reasonLabel || '').trim();
  const company = String(ruleInput.company || '').trim();
  const source = String(ruleInput.source || '').trim();
  const employmentType = String(ruleInput.employmentType || '').trim();

  const roleKeywords = Array.isArray(ruleInput.roleKeywords)
    ? ruleInput.roleKeywords.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 8)
    : [];

  const locationKeywords = Array.isArray(ruleInput.locationKeywords)
    ? ruleInput.locationKeywords.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 8)
    : [];

  const hasFilter = Boolean(company || source || employmentType || roleKeywords.length || locationKeywords.length);
  if (!hasFilter || !reasonId || !reasonLabel) return null;

  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    reasonId,
    reasonLabel,
    company,
    source,
    employmentType,
    roleKeywords,
    locationKeywords,
  };
}

function upsertPipelineNote(line, value) {
  const noteRe = /\|\s*note:\s*[^|]+/i;
  if (noteRe.test(line)) {
    return line.replace(noteRe, `| note: ${value}`);
  }
  return `${line} | note: ${value}`;
}

function addOrUpdateTrackerAppliedFromPipelineLine(rawLine, resumeNote = '') {
  try {
    const parsed = parsePipelineItem(rawLine);
    const company = (parsed.company || '').trim();
    const role = (parsed.role || '').trim();
    if (!company || !role) {
      return { ok: false, error: 'Cannot add tracker row: pipeline item missing company or role' };
    }

    const trackerPath = resolve(root, 'data', 'applications.md');
    if (!existsSync(trackerPath)) {
      const header = [
        '# Applications Tracker',
        '',
        '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
        '|---|------|---------|------|-------|--------|-----|--------|-------|',
      ].join('\n');
      writeFileSync(trackerPath, `${header}\n`);
    }

    const trackerLines = readFileSync(trackerPath, 'utf8').split(/\r?\n/);
    const today = new Date().toISOString().slice(0, 10);
    // cell() strips/replaces literal "|" (and newlines) from free text -- a
    // raw "|" here would split into an extra table column and corrupt every
    // later cell on the row, exactly like row #7's malformed "|" separator did.
    const noteText = cell(resumeNote ? `Applied from dashboard; Resume: ${resumeNote}` : 'Applied from dashboard pipeline action');

    let maxNum = 0;
    let existingRowIndex = -1;
    for (let i = 0; i < trackerLines.length; i++) {
      const line = trackerLines[i];
      if (!line.trim().startsWith('|')) continue;
      const cols = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cols.length < 9) continue;
      if (cols[0] === '#' || cols[0].startsWith('---')) continue;
      const n = Number.parseInt(cols[0], 10);
      if (Number.isFinite(n)) maxNum = Math.max(maxNum, n);

      const rowCompany = (cols[2] || '').toLowerCase();
      const rowRole = (cols[3] || '').toLowerCase();
      if (rowCompany === company.toLowerCase() && rowRole === role.toLowerCase()) {
        existingRowIndex = i;
      }
    }

    if (existingRowIndex >= 0) {
      const cols = trackerLines[existingRowIndex].split('|').slice(1, -1).map((c) => c.trim());
      cols[5] = 'Applied';
      const existingNotes = (cols[8] || '').trim();
      const resumePart = resumeNote ? cell(`Resume: ${resumeNote}`) : '';
      cols[8] = resumePart ? `${existingNotes ? existingNotes + '; ' : ''}${resumePart}` : (existingNotes || noteText);
      trackerLines[existingRowIndex] = `| ${cols.join(' | ')} |`;
      writeFileSync(trackerPath, trackerLines.join('\n'));
      return { ok: true, updated: true };
    }

    const nextNum = maxNum + 1;
    const newRow = `| ${nextNum} | ${today} | ${cell(company)} | ${cell(role)} | N/A | Applied | ❌ | - | ${noteText} |`;

    let insertAt = trackerLines.length;
    for (let i = trackerLines.length - 1; i >= 0; i--) {
      if (trackerLines[i].trim().startsWith('|')) {
        insertAt = i + 1;
        break;
      }
    }
    trackerLines.splice(insertAt, 0, newRow);
    writeFileSync(trackerPath, trackerLines.join('\n'));
    return { ok: true, added: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

function runNode(args) {
  const result = spawnSync('node', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
  });

  return {
    status: result.status || 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

// Runs the headless PDF pipeline via async spawn (not spawnSync): this call
// can take minutes (LLM + Playwright), and spawnSync would block Node's
// single-threaded event loop for the whole server, freezing every other
// endpoint (including /api/reports) until it exits.
function runCareerOpsPdfOnDemand(company) {
  const claudePath = resolve(process.env.HOME || '', '.local', 'bin', 'claude');
  const claude = existsSync(claudePath) ? claudePath : 'claude';
  const command = `Run /career-ops pdf ${company}`;

  return new Promise((resolvePromise) => {
    const child = spawn(
      claude,
      [
        '-p', command,
        '--output-format', 'text',
        '--permission-mode', 'acceptEdits',
        '--allowedTools', 'Read,Write,Edit,Bash,Glob,Grep',
        '--disallowedTools', 'Task,NotebookEdit',
      ],
      {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (err) => {
      resolvePromise({ status: 1, stdout: stdout.trim(), stderr: String(err?.message || err), command });
    });
    child.on('close', (code) => {
      resolvePromise({
        status: Number.isInteger(code) ? code : 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        command,
      });
    });
  });
}

function readOpsBaseline() {
  const doctorRaw = runNode(['doctor.mjs', '--json']);
  const updateRaw = runNode(['update-system.mjs', 'check']);
  const statsRaw = runNode(['stats.mjs', '--summary']);

  const doctor = safeJsonParse(doctorRaw.stdout, {});
  const update = safeJsonParse(updateRaw.stdout, { status: 'unknown' });

  return {
    doctor,
    update,
    statsSummary: statsRaw.stdout,
    checks: {
      onboardingReady: !doctor?.onboardingNeeded,
      hasWarnings: Array.isArray(doctor?.warnings) && doctor.warnings.length > 0,
      upToDate: update?.status === 'up-to-date',
      trackerPresent: existsSync(resolve(root, 'data', 'applications.md')),
      followupsPresent: existsSync(resolve(root, 'data', 'follow-ups.md')),
    },
  };
}

function runOpsAction(action) {
  const map = {
    'verify-pipeline': ['verify-pipeline.mjs'],
    'verify-portals': ['verify-portals.mjs'],
    'stats-summary': ['stats.mjs', '--summary'],
    'refresh-baseline': null,
  };

  if (!(action in map)) {
    return { status: 1, stdout: '', stderr: `Unknown ops action: ${action}` };
  }

  if (action === 'refresh-baseline') {
    return { status: 0, stdout: 'Baseline refreshed.', stderr: '' };
  }

  return runNode(map[action]);
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text || '');
  } catch {
    return fallback;
  }
}

function readBody(req, res, onJson) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const jsonBody = body ? JSON.parse(body) : {};
      onJson(jsonBody);
    } catch {
      json(res, 400, { error: 'invalid JSON body' });
    }
  });
}

function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function text(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(payload);
}

function listResumePdfs() {
  const dir = resolve(root, 'output');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    // generate-cover-letter.mjs always suffixes cover-letter PDFs "-cover.pdf"
    // (cover.md's own output_path convention) — excluded so this list, used
    // both by the dashboard's resume dropdown and the "Mark Applied" resume
    // picker, only ever offers actual resumes.
    .filter((f) => f.endsWith('.pdf') && !f.toLowerCase().endsWith('-cover.pdf'))
    .sort((a, b) => {
      // newest first by mtime
      try { return statSync(resolve(dir, b)).mtimeMs - statSync(resolve(dir, a)).mtimeMs; } catch { return 0; }
    })
    .map((f) => {
      const stat = safeStat(resolve(dir, f));
      return {
        filename: f,
        label: f.replace(/\.pdf$/i, ''),
        mtime: stat ? new Date(stat.mtimeMs).toISOString() : null,
      };
    });
}

function safeStat(file) {
  try {
    return statSync(file);
  } catch {
    return null;
  }
}

function bulkImportFromWorkbook(filePath) {
  if (!filePath || !existsSync(filePath)) return { ok: false, error: `File not found: ${filePath}` };

  const trackerFile = resolve(root, 'data', 'applications.md');
  if (!existsSync(trackerFile)) return { ok: false, error: 'applications.md not found' };

  // read existing tracker to dedup by normalised company+role
  const existing = new Set();
  for (const row of (readTracker().rows || [])) {
    const key = `${normalizeCompanyName(row.company)}::${String(row.role || '').trim().toLowerCase()}`;
    existing.add(key);
  }

  const statusMap = (s) => {
    const lc = String(s || '').toLowerCase();
    if (/reject|closed/.test(lc)) return 'Rejected';
    if (/abandon|discard/.test(lc)) return 'Discarded';
    if (/offer/.test(lc)) return 'Offer';
    if (/hire|hired/.test(lc)) return 'Hired';
    if (/interview/.test(lc)) return 'Interview';
    return 'Applied';
  };

  const excelDate = (n) => {
    if (!n || !isFinite(+n)) return new Date().toISOString().slice(0, 10);
    const d = new Date(Date.UTC(1899, 11, 30) + (+n) * 86400000);
    return d.toISOString().slice(0, 10);
  };

  let rows;
  try {
    const wbXml = unzipText(filePath, 'xl/workbook.xml');
    const relsXml = unzipText(filePath, 'xl/_rels/workbook.xml.rels');
    const ssXml = unzipText(filePath, 'xl/sharedStrings.xml');
    if (!wbXml || !relsXml) return { ok: false, error: 'Could not read workbook XML' };
    const ss = parseSharedStrings(ssXml || '');
    const sheetPath = resolveWorkbookSheetPath(wbXml, relsXml, '2026') || 'xl/worksheets/sheet1.xml';
    rows = parseWorksheetRows(unzipText(filePath, sheetPath), ss);
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }

  if (!rows.length) return { ok: false, error: 'No rows found in 2026 sheet' };

  const header = rows[0] || {};
  const companyCol = findHeaderColumn(header, ['company']) || 'A';
  const roleCol = findHeaderColumn(header, ['role', 'title', 'position']) || 'B';
  const statusCol = findHeaderColumn(header, ['status']) || 'C';
  const dateCol = findHeaderColumn(header, ['initial date', 'date']) || 'D';
  const notesCol = findHeaderColumn(header, ['notes', 'note']) || 'J';

  const toAdd = [];
  for (const row of rows.slice(1)) {
    const company = String(row[companyCol] || '').trim();
    const role = String(row[roleCol] || '').trim();
    if (!company || company.toLowerCase() === 'company') continue;
    const key = `${normalizeCompanyName(company)}::${role.toLowerCase()}`;
    if (existing.has(key)) continue;
    existing.add(key); // prevent dupes within the import batch
    const status = statusMap(row[statusCol]);
    const date = excelDate(row[dateCol]);
    const notes = String(row[notesCol] || '').trim().replace(/\|/g, ';');
    toAdd.push({ date, company, role, status, notes });
  }

  if (!toAdd.length) return { ok: true, added: 0, message: 'All entries already in tracker.' };

  // append rows to applications.md after the header divider
  const content = readFileSync(trackerFile, 'utf8');
  const dividerIdx = content.indexOf('\n|---|');
  if (dividerIdx === -1) return { ok: false, error: 'Could not find table header divider in applications.md' };
  const insertAt = content.indexOf('\n', dividerIdx + 1) + 1;

  const newRows = toAdd.map((r) =>
    `| — | ${r.date} | ${r.company} | ${r.role} | — | ${r.status} | ❌ | - | ${r.notes || 'Imported from 2026 Job Search.xlsx'} |`
  ).join('\n');

  const updated = content.slice(0, insertAt) + newRows + '\n' + content.slice(insertAt);
  writeFileSync(trackerFile, updated, 'utf8');

  return { ok: true, added: toAdd.length, message: `Imported ${toAdd.length} entries from 2026 sheet.` };
}

let reportUrlIndexCache = null;
let reportUrlIndexKey = '';

function normalizeUrlForMatch(url) {
  try {
    const u = new URL(String(url || '').trim());
    return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/$/, '')}`;
  } catch {
    return String(url || '').trim().toLowerCase();
  }
}

// Maps posting URL -> report metadata extracted by a past evaluation.
// Rebuilt only when reports/ changes.
function reportUrlIndex() {
  const dir = resolve(root, 'reports');
  if (!existsSync(dir)) return new Map();
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const key = files.join(',');
  if (reportUrlIndexCache && reportUrlIndexKey === key) return reportUrlIndexCache;

  const index = new Map();
  for (const filename of files) {
    try {
      const lines = readFileSync(resolve(dir, filename), 'utf8').split('\n').slice(0, 15);
      const urlLine = lines.find((l) => l.startsWith('**URL:**'));
      const companyLine = lines.find((l) => l.startsWith('# Evaluation:'));
      const scoreLine = lines.find((l) => l.startsWith('**Score:**'));
      if (!urlLine || !companyLine) continue;
      const reportUrl = urlLine.replace('**URL:**', '').trim();
      const company = (companyLine.replace('# Evaluation:', '').trim().split('—')[0] || '').trim();
      const score = scoreLine ? scoreLine.replace('**Score:**', '').trim() : '';
      if (reportUrl && company) index.set(normalizeUrlForMatch(reportUrl), { company, filename, score });
    } catch { /* skip unreadable report */ }
  }
  reportUrlIndexCache = index;
  reportUrlIndexKey = key;
  return index;
}

function companyFromReportUrl(url) {
  return reportUrlIndex().get(normalizeUrlForMatch(url))?.company || '';
}

function reportFilenameFromUrl(url) {
  return reportUrlIndex().get(normalizeUrlForMatch(url))?.filename || '';
}

function scoreFromReportUrl(url) {
  return reportUrlIndex().get(normalizeUrlForMatch(url))?.score || '';
}

// "008" and "8" both refer to the same report — same normalization find.mjs
// uses to match the tracker's Report-link number against the manifest.
const normReportNum = (s) => String(s ?? '').trim().replace(/^0+(?=\d)/, '');

function readPdfIndexMap() {
  const manifestPath = resolvePdfIndexPath(resolve(root, 'data', 'applications.md'));
  if (!existsSync(manifestPath)) return new Map();
  try {
    return parsePdfIndex(readFileSync(manifestPath, 'utf8'));
  } catch {
    return new Map();
  }
}

function listReports() {
  const dir = resolve(root, 'reports');
  if (!existsSync(dir)) return [];
  const pdfIndex = readPdfIndexMap();
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort((a, b) => b.localeCompare(a))
    .map((filename) => {
      // filename: 042-company-slug-YYYY-MM-DD.md
      const m = filename.match(/^(\d+)-(.+)-(\d{4}-\d{2}-\d{2})\.md$/);
      const num = m ? m[1] : '';
      const slug = m ? m[2] : filename.replace('.md', '');
      const date = m ? m[3] : '';
      // peek at first 30 lines for score + company
      let score = '';
      let company = slug;
      let role = '';
      try {
        const lines = readFileSync(resolve(dir, filename), 'utf8').split('\n').slice(0, 30);
        const scoreLine = lines.find((l) => l.startsWith('**Score:**'));
        const companyLine = lines.find((l) => l.startsWith('# Evaluation:'));
        const roleLine = lines.find((l) => l.startsWith('# Evaluation:'));
        if (scoreLine) score = scoreLine.replace('**Score:**', '').trim();
        if (companyLine) {
          const parts = companyLine.replace('# Evaluation:', '').trim().split('—');
          company = (parts[0] || '').trim();
          role = (parts[1] || '').trim();
        }
      } catch { /* ignore */ }
      const pdfPath = num ? pdfIndex.get(normReportNum(num)) || '' : '';
      const pdfFilename = pdfPath ? basename(pdfPath) : '';
      return { filename, num, slug, date, score, company, role, pdfFilename };
    });
}

function buildEvalPrompt(url, today) {
  const memFile = resolve(root, '.career-ops-quick-dashboard', 'memory.json');
  let memory = '';
  try { memory = existsSync(memFile) ? JSON.parse(readFileSync(memFile, 'utf8')).content || '' : ''; } catch { /* ignore */ }
  const mem = memory.trim() ? `\n\nDurable notes about the user (from their profile):\n${memory.trim()}\n` : '';
  return `You are running the OFFICIAL career-ops job evaluation, HEADLESS, on the user's own machine. Today is ${today}. Run the REAL career-ops evaluation — do NOT improvise your own scoring.

1. Read modes/oferta.md and follow it EXACTLY (blocks A–F, G posting-legitimacy, the Machine Summary, and its "Record in tracker" section — including its Step 3, which checks modes/_custom.md for a PDF auto-generation score threshold and runs the PDF pipeline immediately when the final score meets it). Ground the fit in THIS person: read cv.md, config/profile.yml and modes/_profile.md.

   Liveness + JD fetch: you have no browser MCP tools here, so use career-ops' own headless-Playwright helper instead of browser_navigate/browser_snapshot — run \`node browser-extract.mjs "<posting URL>" --mode jd\` via Bash. It launches a real headless browser and returns compact JSON \`{ url, title, text }\`. Use \`text\` to run the Liveness gate (a real job description or apply path = active; only nav/footer text, an expired/closed message, or a 404 = closed — stop before Block A per modes/oferta.md) and as the JD source for Blocks A-F and Block G's freshness signal. This counts as Playwright-verified — do NOT add a "Verification: unconfirmed" header marker.

   Fallback only: if the command errors (exit 1, e.g. bot-walled) or is missing, use WebFetch instead and mark the report header "Verification: unconfirmed (batch mode)".

2. Persist the result CANONICALLY so the web and the CLI share ONE source of truth:
   a. Reserve a report number: run \`node reserve-report-num.mjs\` — its stdout is a 3-digit number (e.g. 035).
   b. Write the full report to reports/{num}-{company-slug}-${today}.md  (company-slug = company lowercased, non-alphanumerics → hyphens).
   c. Append ONE row of 9 TAB-separated columns to batch/tracker-additions/{num}-{company-slug}.tsv, in THIS exact order (real \\t tabs, status BEFORE score):
      {num}\\t${today}\\t{Company}\\t{Role}\\t{CanonicalStatus e.g. Evaluated}\\t{score}/5\\t❌\\t[{num}](reports/{num}-{company-slug}-${today}.md)\\t{one-line note}
   d. Merge into the tracker: run \`node merge-tracker.mjs\` (it dedupes by company+role+report-num, validates the status, and writes data/applications.md — NEVER edit applications.md by hand).

3. NEVER submit an application, fill no forms, contact no one. This is evaluation + persistence ONLY.${mem}

After everything above is written and merged, output EXACTLY one final line, nothing after it:
VERDICT: {score}/5 — {reason in 12 words or fewer}

Posting URL: ${url}`;
}

function streamEvaluate(req, res, url) {
  const claudePath = resolve(process.env.HOME || '', '.local', 'bin', 'claude');
  const claude = existsSync(claudePath) ? claudePath : 'claude';
  const today = new Date().toISOString().slice(0, 10);
  const prompt = buildEvalPrompt(url, today);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (type, data) => {
    try {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch { /* client disconnected */ }
  };

  const isBenignStdinWarning = (text) => {
    const msg = String(text || '').toLowerCase();
    return msg.includes('no stdin data received in 3s') && msg.includes('redirect stdin explicitly');
  };

  sendEvent('start', { url, today });

  const child = spawn(
    claude,
    ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
     '--permission-mode', 'acceptEdits',
     '--allowedTools', 'Read,WebFetch,WebSearch,Write,Edit,Bash,Glob,Grep',
     '--disallowedTools', 'Task,NotebookEdit'],
    {
      cwd: root,
      env: process.env,
      // Prevent the CLI from waiting on stdin and emitting the 3s warning.
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let finished = false;
  const finish = (code) => {
    if (finished) return;
    finished = true;
    sendEvent('done', { code });
    try { res.end(); } catch { /* ignore */ }
  };

  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const evt = JSON.parse(line);
        // extract text from content_block_delta events
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
          sendEvent('text', { text: evt.delta.text });
        } else if (evt.type === 'message_delta' && evt.usage) {
          // ignore usage
        } else if (evt.type === 'result' && evt.result) {
          sendEvent('text', { text: evt.result });
        }
      } catch {
        // non-JSON line — emit as plain text
        if (line.trim()) sendEvent('text', { text: line + '\n' });
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    const msg = chunk.toString().trim();
    if (!msg || isBenignStdinWarning(msg)) return;
    sendEvent('stderr', { text: msg });
  });

  child.on('error', (err) => {
    sendEvent('stderr', { text: `Failed to start evaluator: ${err.message}` });
    finish(127);
  });

  child.on('close', (code, signal) => {
    if (buf.trim()) {
      try {
        const evt = JSON.parse(buf);
        if (evt.type === 'content_block_delta' && evt.delta?.text) sendEvent('text', { text: evt.delta.text });
      } catch {
        sendEvent('text', { text: buf });
      }
    }
    const normalizedCode = Number.isInteger(code) ? code : (signal ? 128 : 1);
    finish(normalizedCode);
  });

  // For SSE, req closes as soon as the POST body is consumed; abort only when
  // the response stream disconnects (browser/tab closed, navigation, etc.).
  res.on('close', () => {
    if (!finished) {
      try { child.kill(); } catch { /* ignore */ }
    }
  });
}
