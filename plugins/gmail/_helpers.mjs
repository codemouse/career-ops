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
    const url = match[0].replace(/[\]\[\}\){.,;:!?]+$/, '').replace(/&amp;/g, '&');
    urls.push(url);
  }
  return [...new Set(urls)];
}

/**
 * Is a URL clean and relevant (not a click tracker, unsubscribe link, or pixel)?
 * @param {string} url
 * @returns {boolean}
 */
export function isCleanUrl(url) {
  try {
    const u = new URL(url);
    const lowerUrl = url.toLowerCase();
    const host = u.hostname.toLowerCase();

    // LinkedIn job links commonly include query params like trackingId;
    // keep those URLs unless they're clearly account/help/legal endpoints.
    if (host === 'linkedin.com' || host === 'www.linkedin.com') {
      const blockedLinkedInPaths = [
        '/legal',
        '/help',
        '/settings',
      ];
      if (blockedLinkedInPaths.some((prefix) => u.pathname.toLowerCase().startsWith(prefix))) {
        return false;
      }
      return u.protocol === 'https:';
    }

    const badKeywords = [
      'click', 'openpixel', 'sendgrid', 'unsubscribe', 'optout',
      'newsletter', 'subscribe', 'w3.org', 'doubleclick', 'googlesyndication',
      'googleadservices', 'mailgun', 'mandrill', 'mjml', 'github.com/login',
      'linkedin.com/legal', 'linkedin.com/help', 'linkedin.com/settings',
    ];
    if (badKeywords.some(kw => lowerUrl.includes(kw))) return false;
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Canonicalize known job URLs so querystring trackers from digest emails do
 * not produce duplicate pipeline entries.
 * Returns null for non-job or noisy links.
 * @param {string} url
 * @returns {string | null}
 */
export function canonicalJobUrl(url) {
  return canonicalJobUrlDepth(url, 0);
}

/**
 * @param {string} url
 * @param {number} depth
 * @returns {string | null}
 */
function canonicalJobUrlDepth(url, depth) {
  if (depth > 3) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;

    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    // Hard-drop common non-job media/tracking hosts.
    if (
      host === 'measurements.lensa.com' ||
      host === 'email.mg2.lensa.com' ||
      host.endsWith('substackcdn.com') ||
      host.endsWith('.kxcdn.com') ||
      host.includes('s3.us-west-2.amazonaws.com') ||
      host === 'static.licdn.com' ||
      host === 'media.licdn.com'
    ) {
      return null;
    }

    if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com' || host.endsWith('.gstatic.com')) {
      return null;
    }

    if (host.startsWith('cdn.') || host.startsWith('static.') || host.startsWith('media.')) {
      return null;
    }

    // AWS SES click-tracking wrapper used by BuiltIn and others.
    if (host.endsWith('.awstrack.me') && path.startsWith('/L0/')) {
      const encoded = path.slice(4).split('/1/')[0];
      if (!encoded) return null;
      const target = decodeURIComponent(encoded);
      return canonicalJobUrlDepth(target, depth + 1);
    }

    // ConvertKit click wrapper: last path segment is typically base64 target URL.
    if (host.includes('convertkit-mail') || host.startsWith('click.')) {
      const parts = path.split('/').filter(Boolean);
      const last = parts[parts.length - 1] || '';
      if (last) {
        try {
          const pad = '='.repeat((4 - (last.length % 4 || 4)) % 4);
          const b64 = (last + pad).replace(/-/g, '+').replace(/_/g, '/');
          const decoded = Buffer.from(b64, 'base64').toString('utf-8').trim();
          if (/^https?:\/\//i.test(decoded)) return canonicalJobUrlDepth(decoded, depth + 1);
        } catch {
          // fall through
        }
      }
      return null;
    }

    // Opaque Lensa wrappers: no stable URL target extraction from query payload.
    if (host.endsWith('lensa.com') && (path.startsWith('/wf/open') || path.startsWith('/ls/click'))) {
      return null;
    }

    // LinkedIn: keep only direct job view links.
    if (host === 'linkedin.com' || host === 'www.linkedin.com') {
      const m = path.match(/^\/comm\/jobs\/view\/(\d+)\/?$/i);
      if (!m) return null;
      return `https://www.linkedin.com/comm/jobs/view/${m[1]}/`;
    }

    // FractionalJobs: keep only actual job pages.
    if (host === 'fractionaljobs.io' || host === 'www.fractionaljobs.io') {
      if (!path.startsWith('/jobs/')) return null;
      return `https://${u.hostname}${u.pathname}`;
    }

    // BuiltIn: keep only specific job pages. Newsletter landing pages and
    // image/link wrappers often open the generic dashboard instead of a post.
    if (host === 'builtin.com' || host === 'www.builtin.com') {
      const m = path.match(/^\/job\/([^/?#]+)\/?(\d+)?/i);
      if (!m || !m[1] || !m[2]) return null;
      return `https://${u.hostname}/job/${decodeURIComponent(m[1])}/${m[2]}`;
    }

    // Social links from newsletters are noise for pipeline ingestion.
    if (host === 'x.com' || host === 'www.x.com' || host === 'twitter.com' || host === 'www.twitter.com') {
      return null;
    }

    // Glassdoor tracking pages: keep only canonical job listing links with ID.
    if (host.endsWith('glassdoor.com')) {
      if (/^\/partner\/jobListing\.htm$/i.test(path)) {
        const id = u.searchParams.get('jobListingId');
        if (!id) return null;
        return `https://www.glassdoor.com/partner/jobListing.htm?jobListingId=${encodeURIComponent(id)}`;
      }
      if (/^\/Job\//i.test(path) && path.endsWith('.htm')) {
        // Drop search index pages such as "...-jobs-SRCH_...".
        if (/\-jobs\-srch_/i.test(path)) return null;
        return `https://${u.hostname}${path}`;
      }
      return null;
    }

    // Adzuna: keep only specific posting landing pages.
    if (host === 'adzuna.com' || host === 'www.adzuna.com') {
      if (/^\/land\/ad\/\d+/i.test(path)) {
        return `https://${u.hostname}${u.pathname}${u.search}`;
      }
      return null;
    }

    // Common ATS job URLs.
    if (
      host.includes('greenhouse.io') ||
      host.includes('lever.co') ||
      host.includes('ashbyhq.com') ||
      host.includes('workdayjobs.com') ||
      host.includes('myworkdayjobs.com') ||
      host.includes('smartrecruiters.com') ||
      host.includes('job-boards.greenhouse.io') ||
      host.includes('jobs.jobvite.com') ||
      host.includes('icims.com')
    ) {
      return `https://${u.hostname}${u.pathname}${u.search}`;
    }

    // Generic anti-noise fallback.
    const lower = url.toLowerCase();
    const badKeywords = [
      'unsubscribe', 'optout', 'openpixel', 'pixel', 'tracking', 'trk=',
      'doubleclick', 'googlesyndication', 'mailgun', 'mandrill',
    ];
    if (badKeywords.some(k => lower.includes(k))) return null;

    const pathQuery = `${u.pathname}${u.search}`.toLowerCase();
    const jobSignals = /(job|jobs|career|careers|opening|position|vacanc|opportunit|apply|requisition|posting|greenhouse|lever|workday|ashby|smartrecruiters|icims|jobvite)/;
    const contentSignals = /(\/video|\/podcast|\/blog|\/news|\/privacy|\/terms|\/about|\/contact|\/press)/;
    if (!jobSignals.test(pathQuery) || contentSignals.test(pathQuery)) return null;

    return `https://${u.hostname}${u.pathname}${u.search}`;
  } catch {
    return null;
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
  clean = clean.replace(/^.+?,\s*apply now to\s*["'“”‘’]?/i, '');
  clean = clean.replace(/["“”'‘’]+$/g, '').trim();
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
 * Parse sender domain from the Gmail message headers.
 * @param {Array<{ name: string, value: string }>} headers
 * @returns {string}
 */
export function senderDomain(headers) {
  if (!Array.isArray(headers)) return '';
  const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
  const email = from.match(/<([^>]+)>/)?.[1] || from;
  const domain = email.split('@')[1] || '';
  return domain.toLowerCase().trim();
}

/**
 * Best-effort source label from email sender metadata.
 * @param {Array<{ name: string, value: string }>} headers
 * @returns {string}
 */
export function sourceFromSender(headers) {
  if (!Array.isArray(headers)) return '';
  const fromRaw = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
  const fromName = fromRaw.replace(/<[^>]+>/g, '').replace(/"/g, '').trim();
  const domain = senderDomain(headers);

  const domainMap = [
    { test: (d) => d.endsWith('linkedin.com'), label: 'LinkedIn' },
    { test: (d) => d.endsWith('glassdoor.com'), label: 'Glassdoor' },
    { test: (d) => d.endsWith('fractionaljobs.io'), label: 'FractionalJobs' },
    { test: (d) => d.endsWith('substack.com'), label: 'Substack' },
    { test: (d) => d.endsWith('beehiiv.com'), label: 'Beehiiv' },
    { test: (d) => d.endsWith('builtin.com'), label: 'BuiltIn' },
    { test: (d) => d.endsWith('adzuna.com'), label: 'Adzuna' },
    { test: (d) => d.endsWith('lensa.com'), label: 'Lensa' },
    { test: (d) => d.endsWith('a16z.com'), label: 'a16z' },
  ];

  for (const m of domainMap) {
    if (m.test(domain)) return m.label;
  }

  // Name-based fallback for newsletter aliases (e.g. "Future by a16z").
  const lowerName = fromName.toLowerCase();
  if (lowerName.includes('a16z')) return 'a16z';
  if (lowerName.includes('linkedin')) return 'LinkedIn';
  if (lowerName.includes('glassdoor')) return 'Glassdoor';
  if (lowerName.includes('fractional')) return 'FractionalJobs';

  return fromName || domain || '';
}

/**
 * Best effort company hint from sender domain for non-ATS links.
 * @param {string} domain
 * @returns {string}
 */
export function companyFromSender(domain) {
  if (!domain) return '';
  const blocked = ['linkedin.com', 'glassdoor.com', 'indeed.com', 'gmail.com'];
  if (blocked.some(d => domain.endsWith(d))) return '';
  const core = domain.split('.').slice(0, -1).pop() || '';
  if (!core || core.length < 3) return '';
  return core.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
    if (hostname.endsWith('linkedin.com')) return '';

    if (hostname.endsWith('glassdoor.com')) {
      if (/^\/partner\/jobListing\.htm$/i.test(pathname)) return 'Glassdoor';
      return '';
    }

    if (hostname === 'boards.greenhouse.io' || hostname.endsWith('.greenhouse.io') ||
        hostname === 'jobs.lever.co' || hostname.endsWith('.lever.co')) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) return parts[0];
    }

    if (hostname.endsWith('ashbyhq.com')) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
  } catch { /* malformed → no company */ }
  return '';
}
