import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pass, ROOT } from './helpers.mjs';

const { clearPluginAuthStatus, readPluginAuthStatus } = await import(pathToFileURL(join(ROOT, 'plugins/_engine.mjs')).href);

test('clearPluginAuthStatus drops only the given plugin\'s needs-reauth flag', () => {
  const dir = mkdtempSync(join(tmpdir(), 'co-auth-clear-'));
  try {
    mkdirSync(join(dir, 'data'));
    writeFileSync(join(dir, 'data', 'plugin-status.json'), JSON.stringify({
      gmail: { needsReauth: true, error: 'invalid_grant', at: '2026-09-26T13:01:10.759Z' },
      other: { needsReauth: true, error: '401', at: '2026-09-26T13:01:10.759Z' },
    }));
    clearPluginAuthStatus(dir, 'gmail');
    const state = readPluginAuthStatus(dir);
    assert.equal(state.gmail, undefined);
    assert.equal(state.other?.needsReauth, true);
    pass('clearPluginAuthStatus drops only the given plugin\'s needs-reauth flag');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('clearPluginAuthStatus is a no-op when there is no status file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'co-auth-clear-'));
  try {
    mkdirSync(join(dir, 'data'));
    clearPluginAuthStatus(dir, 'gmail');
    assert.equal(existsSync(join(dir, 'data', 'plugin-status.json')), false);
    pass('clearPluginAuthStatus is a no-op when there is no status file');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
