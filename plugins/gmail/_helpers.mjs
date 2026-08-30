// @ts-check
// Pure, side-effect-free Gmail helpers. Ported verbatim from the gmail-helpers
// contributed by @SparshGarg999 in #1203 (with thanks). Files prefixed with _
// are never discovered as plugins.

/**
 * Extract all http/https URLs from a string (plain text or HTML). Normalizes
 * &amp; and strips trailing punctuation. Dedups.
 * @param {string} body
 * @returns {string[]}
 */
export function extractUrls(body) {
  if (!body) return [];
  const urls = [];
  const regex = /https?:\/\/[^\s"'<>\(\)]+/gi;
  let match;
  while ((match = regex.exec(body)) !== null) {
    const url = match[0].replace(/[.,;:!?]+$/, '').replace(/&amp;/g, '&');
    urls.push(url);
  }
  return [...new Set(urls)];
}

// LinkedIn's job-alert emails are full of same-domain chrome links (manage
// alerts, messaging/feed/network glimmers, profile & company-logo images, the
// "see all jobs" search-results page) that a keyword denylist can't keep up
// with — none of them contain a word like "track" or "unsubscribe". A single
// alert email can carry a dozen of these alongside the one real posting link,
// and each carries LinkedIn's per-email tracking params, so they also show up
// as look-alike duplicates across emails. Path-allowlist LinkedIn specifically
// (only /jobs/view/{id} and /comm/jobs/view/{id} are individual postings);
// every other domain (ATS boards, aggregators) keeps the permissive denylist
// check since they don't share this problem and enumerating every legitimate
// job board here would be fragile.
const LINKEDIN_HOSTS = /(^|\.)linkedin\.com$/i;
const LINKEDIN_JOB_VIEW_PATH = /^\/(comm\/)?jobs\/view\/\d+\/?$/i;

/**
 * Is a URL clean and relevant (not a click tracker, unsubscribe link, pixel,
 * or — for LinkedIn specifically — nav chrome/asset link)?
 * @param {string} url
 * @returns {boolean}
 */
export function isCleanUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;

    if (LINKEDIN_HOSTS.test(u.hostname)) {
      return LINKEDIN_JOB_VIEW_PATH.test(u.pathname);
    }
    if (/(^|\.)licdn\.com$/i.test(u.hostname)) return false; // profile/company-logo image CDN, never a posting
    // Glassdoor's own email chrome: brand/tracking-pixel endpoint and static
    // logo/icon assets served from the same domain as real job links.
    if (/(^|\.)glassdoor\.com$/i.test(u.hostname) && /^\/(brand-views|assets\/)/i.test(u.pathname)) return false;
    // Substack's generic click-tracking redirect wrapper — never a posting
    // itself, just how any link in a Substack email routes through their
    // domain. Other substack.com paths are left alone in case a real job
    // board is hosted there.
    if (u.hostname.toLowerCase() === 'substack.com' && u.pathname.startsWith('/redirect/')) return false;
    // Belt-and-suspenders for any board: an image asset is never a posting.
    if (/\.(png|jpe?g|gif|svg|webp|ico)(\?|$)/i.test(u.pathname)) return false;

    const lowerUrl = url.toLowerCase();
    const badKeywords = [
      'click', 'track', 'openpixel', 'sendgrid', 'unsubscribe', 'optout',
      'newsletter', 'subscribe', 'w3.org', 'doubleclick', 'googlesyndication',
      'googleadservices', 'mailgun', 'mandrill', 'mjml', 'github.com/login',
      'brandview-pixel',
    ];
    if (badKeywords.some(kw => lowerUrl.includes(kw))) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Strip volatile per-send tracking params so the same posting/page linked
 * from different emails normalizes to one URL for de-duplication. LinkedIn's
 * /jobs/view/{id} links are already stable and unaffected; this mainly
 * matters for any URL that still carries a query string after isCleanUrl.
 * @param {string} url
 * @returns {string}
 */
export function normalizeTrackingUrl(url) {
  try {
    const u = new URL(url);
    const TRACKING_PARAMS = [
      'lipi', 'midtoken', 'midsig', 'trk', 'trkemail', 'eid', 'otptoken',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'refid', 'ref_id', 'trackingid', 'clickid',
    ];
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.includes(key.toLowerCase())) u.searchParams.delete(key);
    }
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * DMARC alignment check (anti-spoof gate, fail-closed). Only emails whose
 * Authentication-Results header reports dmarc=pass are trusted.
 * @param {Array<{ name: string, value: string }>} headers
 * @returns {boolean}
 */
export function isAuthenticEmail(headers) {
  if (!Array.isArray(headers)) return false;
  for (const h of headers) {
    if (h.name && h.name.toLowerCase() === 'authentication-results') {
      if (h.value && /dmarc=pass/i.test(h.value)) return true;
    }
  }
  return false;
}

/**
 * Parse "{Role} at {Company}" from a subject line.
 * @param {string} subject
 * @returns {{ role: string, company: string } | null}
 */
export function parseRoleAtCompany(subject) {
  if (!subject) return null;
  let clean = subject.replace(/^(re|fwd|new match|job alert|alert|match|notification|alert for|daily alert for):\s*/i, '').trim();
  clean = clean.split(/\s+[-|]\s+/)[0].trim();
  const match = clean.match(/^(.+?)\s+at\s+(.+)$/i);
  if (match) {
    const role = match[1].trim();
    const company = match[2].trim();
    if (role && company && role.length < 100 && company.length < 100) {
      return { role, company };
    }
  }
  return null;
}

/**
 * Recursively decode a Gmail message payload's base64url body parts to text.
 * @param {any} payload
 * @returns {string}
 */
export function getMessageBody(payload) {
  if (!payload) return '';
  let body = '';
  if (payload.body && payload.body.data) {
    const base64 = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
    body += Buffer.from(base64, 'base64').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) body += getMessageBody(part);
  }
  return body;
}

/**
 * Best-effort company name from a known ATS URL (greenhouse/lever slug).
 * @param {string} url
 * @returns {string}
 */
export function companyFromUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname === 'boards.greenhouse.io' || hostname.endsWith('.greenhouse.io') ||
        hostname === 'jobs.lever.co' || hostname.endsWith('.lever.co')) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
  } catch { /* malformed → no company */ }
  return '';
}
