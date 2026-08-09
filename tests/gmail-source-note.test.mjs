// tests/gmail-source-note.test.mjs — keep noisy Jotform source notes off
// BuiltIn-classified leads while preserving normal source notes elsewhere.
import { pass, fail, ROOT } from './helpers.mjs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync } from 'fs';
import { pathToFileURL } from 'url';

console.log('\ngmail plugin — source note suppression for BuiltIn + Jotform sender');

function b64url(text) {
  return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fakeJsonResponse(obj) {
  return { ok: true, json: async () => obj, text: async () => JSON.stringify(obj) };
}

function makeFetch({ messageId, headers, bodyText }) {
  return async (url) => {
    const u = String(url || '');
    if (u.includes('oauth2.googleapis.com/token')) return fakeJsonResponse({ access_token: 'tok' });
    if (u.includes('/messages?q=')) return fakeJsonResponse({ messages: [{ id: messageId }] });
    if (u.includes(`/messages/${messageId}?format=full`)) {
      return fakeJsonResponse({
        payload: { headers, body: { data: b64url(bodyText) }, parts: [] },
      });
    }
    throw new Error(`unexpected URL in mock: ${u}`);
  };
}

try {
  const tmp = mkdtempSync(join(tmpdir(), 'career-ops-gmail-test-'));
  const prevCwd = process.cwd();
  process.chdir(tmp);

  try {
    const gmail = (await import(pathToFileURL(join(ROOT, 'plugins/gmail/index.mjs')).href)).default;

    const commonHeaders = [
      { name: 'Subject', value: 'Lead Software Engineer at Built In' },
      { name: 'From', value: 'Alerts <noreply@form.jotform.com>' },
      { name: 'Authentication-Results', value: 'mx.google.com; dmarc=pass (p=NONE)' },
    ];

    const jobsBuiltin = await gmail.ingest({
      env: { GMAIL_CLIENT_ID: 'a', GMAIL_CLIENT_SECRET: 'b', GMAIL_REFRESH_TOKEN: 'c' },
      settings: { label: 'Job Leads', days_back: 7 },
      fetch: makeFetch({
        messageId: 'm-builtin',
        headers: commonHeaders,
        bodyText: 'https://builtin.com/job/lead-software-engineer-platform-engineering/10545281?utm_source=test',
      }),
      log: () => {},
    });

    const builtinNote = jobsBuiltin?.[0]?.note ?? null;
    if (builtinNote === '') pass('suppresses source note when sender is Jotform and URL is BuiltIn');
    else fail(`expected empty note for BuiltIn+Jotform, got: ${JSON.stringify(builtinNote)}`);

    const jobsLinkedIn = await gmail.ingest({
      env: { GMAIL_CLIENT_ID: 'a', GMAIL_CLIENT_SECRET: 'b', GMAIL_REFRESH_TOKEN: 'c' },
      settings: { label: 'Job Leads', days_back: 7 },
      fetch: makeFetch({
        messageId: 'm-linkedin',
        headers: commonHeaders,
        bodyText: 'https://www.linkedin.com/comm/jobs/view/4438008488/?tracking=foo',
      }),
      log: () => {},
    });

    const linkedInNote = jobsLinkedIn?.[0]?.note ?? null;
    if (linkedInNote === 'source: Alerts') pass('keeps source note for non-BuiltIn URLs from the same sender');
    else fail(`expected source note for non-BuiltIn URL, got: ${JSON.stringify(linkedInNote)}`);
  } finally {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  }
} catch (err) {
  fail(`gmail source-note test crashed: ${err && err.message}`);
}
