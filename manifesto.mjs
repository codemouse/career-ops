#!/usr/bin/env node
// manifesto.mjs — read The CareerOps Manifesto and open the signing page.
// Zero dependencies. No network calls beyond opening your own browser.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PAGE = 'https://career-ops.org/manifesto';
const argv = process.argv.slice(2);

// signatureStats — local read of the committed ledger, not a network call.
// `n:` is the permanent per-signature ordinal (never reassigned, even when a
// line is later removed — see SIGNATURES.md), so max(n)+1 is "the next spot
// on the wall," not just a line count.
function signatureStats(root) {
  let lines;
  try {
    lines = readFileSync(join(root, 'SIGNATURES.md'), 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('- @'));
  } catch {
    return null;
  }
  if (lines.length === 0) return null;
  let maxN = 0;
  for (const line of lines) {
    const m = line.match(/\bn:(\d+)/);
    if (m) maxN = Math.max(maxN, Number(m[1]));
  }
  const quoteMatch = lines[lines.length - 1].match(/"([^"]+)"/);
  return { count: lines.length, nextOrdinal: maxN + 1, lastQuote: quoteMatch?.[1] ?? null };
}

if (argv.includes('--signatures')) {
  const stats = signatureStats(here);
  if (stats) {
    console.log(`\n${stats.count} signatures on the wall so far.`);
    console.log(`Sign now and you'd be #${stats.nextOrdinal}.`);
    if (stats.lastQuote) console.log(`Most recent: "${stats.lastQuote}"`);
  } else {
    console.log('\nNo signatures recorded yet — you could be the first.');
  }
}

try {
  const text = readFileSync(join(here, 'MANIFESTO.md'), 'utf8');
  const lines = text.split('\n');
  // the opening couplet (lines 5-6 of the manifesto)
  console.log('\n  ' + lines[4] + '\n  ' + lines[5] + '\n');
} catch {
  console.log('');
}
console.log('Read it:  MANIFESTO.md  ·  ' + PAGE);
console.log('Sign it:  takes 10 seconds, becomes a public signature with your name on the wall.');
console.log('');

const openers = { darwin: 'open', win32: 'start', linux: 'xdg-open' };
const cmd = openers[process.platform] || 'xdg-open';
try {
  const child = spawn(cmd, [PAGE], {
    stdio: 'ignore',
    detached: true,
    shell: process.platform === 'win32'
  });
  child.on('error', () => {});
  child.unref();
} catch {
  // no opener available: the URL is printed above
}
