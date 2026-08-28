// @ts-check
// Gmail plugin — one-shot OAuth helper to (re)mint GMAIL_REFRESH_TOKEN.
//
// Refresh tokens die (Google-side token rotation, revocation, or a
// Testing-status OAuth consent screen capping them at 7 days) without any
// signal in the pipeline — the plugin just logs a warning and returns 0
// leads every run. This script runs the interactive consent flow locally
// and prints a fresh refresh token to paste into .env.
//
// Usage: node plugins/gmail/reauth.mjs
// Needs GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET already in .env (the OAuth
// Desktop client itself doesn't expire — only the refresh token does).

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDotenvOnce } from '../_engine.mjs';

await loadDotenvOnce();

const PORT = 53682; // arbitrary local port; loopback redirects don't need pre-registration for Desktop clients
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
// --write-env: used by the quick-dashboard reauth flow, which drives this
// script headlessly and can't ask the user to hand-paste a token into .env.
// Off by default so the plain terminal flow (`node plugins/gmail/reauth.mjs`)
// is unchanged — printing the token and letting the user paste it themselves.
const writeEnv = process.argv.includes('--write-env');
const ENV_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.env');

/** Replace GMAIL_REFRESH_TOKEN=... in .env if present, else append it. Preserves every other line verbatim. */
function updateEnvRefreshToken(token) {
  const line = `GMAIL_REFRESH_TOKEN=${token}`;
  if (!existsSync(ENV_PATH)) { writeFileSync(ENV_PATH, `${line}\n`); return; }
  const text = readFileSync(ENV_PATH, 'utf8');
  const re = /^GMAIL_REFRESH_TOKEN=.*$/m;
  const next = re.test(text) ? text.replace(re, line) : `${text.replace(/\n?$/, '\n')}${line}\n`;
  writeFileSync(ENV_PATH, next);
}

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('✗ Missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET in .env — add those first (Google Cloud Console → APIs & Credentials → your Desktop OAuth client).');
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent'); // force a fresh refresh_token even if this account already granted access once

console.log('\nOpen this URL, sign in, and approve read-only Gmail access:\n');
console.log(authUrl.toString());
console.log(`\nWaiting for the redirect on ${REDIRECT_URI} ...\n`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Authorization failed: ${error}. Check the terminal and try again.`);
    console.error(`✗ Authorization failed: ${error}`);
    server.close();
    process.exit(1);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.refresh_token) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Token exchange failed — check the terminal.');
      console.error(`✗ Token exchange failed: ${JSON.stringify(data)}`);
      if (!data.refresh_token && data.access_token) {
        console.error('  (Google only issues a refresh_token on first consent for this client+account. Revoke prior access at https://myaccount.google.com/permissions and re-run this script.)');
      }
      server.close();
      process.exit(1);
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Success — you can close this tab and return to the terminal.');

    if (writeEnv) {
      updateEnvRefreshToken(data.refresh_token);
      console.log('✓ .env updated with the new GMAIL_REFRESH_TOKEN.\n');
    } else {
      console.log('✓ New refresh token:\n');
      console.log(`GMAIL_REFRESH_TOKEN=${data.refresh_token}\n`);
      console.log('Paste that into .env (replacing the old GMAIL_REFRESH_TOKEN line), then verify with:');
      console.log('  node plugins.mjs run gmail --dry-run\n');
    }
  } catch (err) {
    console.error(`✗ ${err.message}`);
  } finally {
    server.close();
  }
});

server.listen(PORT);
