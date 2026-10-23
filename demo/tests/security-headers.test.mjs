import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const headersUrl = new URL('../_headers', import.meta.url);

test('Pages responses restrict framing and retain same-origin workers and model fetches', () => {
  const headers = readFileSync(headersUrl, 'utf8');
  assert.match(headers, /^\/\*$/m);
  assert.match(headers, /^  X-Frame-Options: DENY$/m);
  assert.match(headers, /^  X-Content-Type-Options: nosniff$/m);
  assert.match(headers, /^  Referrer-Policy: no-referrer$/m);
  assert.match(headers, /^  Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\)$/m);
  assert.match(headers, /^  ! Access-Control-Allow-Origin$/m);
  const csp = headers.match(/^  Content-Security-Policy: (.+)$/m)?.[1];
  assert.ok(csp, 'CSP must be sent as a response header');
  for (const directive of ["default-src 'self'", "script-src 'self'", "worker-src 'self'", "style-src 'self'", "img-src 'self' data:", "connect-src 'self'", "font-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"]) {
    assert.ok(csp.split(';').map(part => part.trim()).includes(directive), directive);
  }
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https?:/);
});


test('only guidewire images gain Blob decoding; all other CSP directives stay identical', () => {
  const headers=readFileSync(headersUrl,'utf8'), blocks=headers.trim().split(/\n\s*\n/);
  assert.equal(blocks.length,2);
  assert.ok(blocks[0].startsWith('/*\n'));
  assert.ok(blocks[1].startsWith('/guidewire-fracture/*\n'));
  assert.match(blocks[1],/^  ! Content-Security-Policy$/m);
  const policy=b=>b.match(/^  Content-Security-Policy: (.+)$/m)[1];
  assert.equal(policy(blocks[1]),policy(blocks[0]).replace("img-src 'self' data:","img-src 'self' data: blob:"));
  assert.doesNotMatch(policy(blocks[1]),/unsafe-inline|unsafe-eval|https?:/);
});
