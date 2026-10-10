import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const demo = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, demo), 'utf8');
test('crawler endpoints are real resources, not the landing fallback', () => {
  assert.ok(existsSync(new URL('robots.txt', demo)), 'missing robots.txt');
  assert.equal(read('robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://parallax.sangeev.me/sitemap.xml\n');
  assert.ok(existsSync(new URL('sitemap.xml', demo)), 'missing sitemap.xml');
  assert.doesNotMatch(read('sitemap.xml'), /<html|lastmod/i);
});
test('native Pages 404 disables implicit SPA fallback and works at nested paths', () => {
  assert.ok(existsSync(new URL('404.html', demo)), 'missing native Pages 404.html');
  const html = read('404.html');
  assert.match(html, /<h1[^>]*>Page not found<\/h1>/);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/lab"/);
  for (const [,ref] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    assert.ok(ref.startsWith('/') || ref.startsWith('#') || ref.startsWith('data:'), `relative 404 reference: ${ref}`);
  }
  assert.doesNotMatch(html, /http-equiv="refresh"|<base|rel="canonical"|unsafe-inline/i);
  assert.ok(!existsSync(new URL('_redirects', demo)), 'do not replace native routing with a catch-all rewrite');
});
test('mode documents retain their independent indexing policy', () => {
  for (const name of ['lab','guided','beam3d','mesh-spike','licences']) {
    assert.doesNotMatch(read(`${name}.html`), /noindex|rel="canonical"/i);
  }
});
