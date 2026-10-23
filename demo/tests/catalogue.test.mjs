import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const demo = process.env.FTV_DEMO ? pathToFileURL(process.env.FTV_DEMO.replace(/\/$/, '') + '/') : new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, demo), 'utf8');
const expected = [
  {id: 'femur', title: 'Femur', explore: 'mesh-spike.html', lesson: 'femur-lesson.html'},
  {id: 'fundamentals', title: 'Projection fundamentals', explore: 'beam3d.html', lesson: 'guided.html'},
  {id: 'guidewire-fracture', title: 'Guidewire across a fracture', explore: '', lesson: 'guidewire-fracture/index.html'}
];

test('catalogue preserves paired experiences and adds a lesson-only guidewire', async () => {
  assert.ok(existsSync(new URL('catalogue.mjs', demo)), 'shared catalogue exists');
  const {catalogue} = await import(new URL('catalogue.mjs', demo));
  assert.deepEqual(catalogue.map(({id, title, explore, lesson}) => ({id, title, explore, lesson})), expected);
});

test('hubs offer accessible static choices only for supported modes without JavaScript', () => {
  for (const name of ['explore.html', 'lessons.html']) {
    assert.ok(existsSync(new URL(name, demo)), `${name} exists`);
    const html = read(name);
    const rows = [...html.matchAll(/<article\b[^>]*data-experience="([^"]+)"[\s\S]*?<\/article>/g)];
    assert.deepEqual(rows.map(row => row[1]), expected.filter(item => name === 'lessons.html' || item.explore).map(item => item.id));
    for (const [i, row] of rows.entries()) {
      const item = expected.filter(item => name === 'lessons.html' || item.explore)[i];
      assert.ok(row[0].includes(`aria-labelledby="${item.id}-title"`));
      assert.ok(row[0].includes(`id="${item.id}-title"`));
      assert.ok(row[0].includes(item.title));
      if (item.explore) assert.ok(row[0].includes(`href="${item.explore}"`));
      else { assert.doesNotMatch(row[0], /Explore:|href=""/); }
      assert.ok(row[0].includes(`href="${item.lesson}"`));
    }
    assert.doesNotMatch(html, /<select|disabled|coming soon/i);
  }
});

test('project navigation has only Parallax Explore Lessons and highlights each route section', () => {
  const sections = {'index.html': 'index.html', 'lab.html': 'index.html', 'explore.html': 'explore.html', 'lessons.html': 'lessons.html', 'beam3d.html': 'explore.html', 'mesh-spike.html': 'explore.html', 'guided.html': 'lessons.html', 'licences.html': null};
  sections['femur-lesson.html'] = 'lessons.html';
  for (const [name, section] of Object.entries(sections)) {
    const nav = read(name).match(/<nav class="project-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav, `${name} project navigation`);
    const links = [...nav.matchAll(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)];
    assert.deepEqual(links.map(link => [link[1], link[3]]), [['index.html', 'Parallax'], ['explore.html', 'Explore'], ['lessons.html', 'Lessons']], name);
    assert.deepEqual(links.filter(link => link[2].includes('aria-current="page"')).map(link => link[1]), section ? [section] : [], name);
  }
});

test('catalogue explorer and lesson destinations exist as independent documents', async t => {
  for (const item of expected) {
    for (const route of [item.explore, item.lesson].filter(Boolean)) {
      await t.test(route, () => {
        assert.match(read(route), /<!doctype html>/i);
      });
    }
  }
});

test('landing and legacy lab lead into both hubs rather than disconnected demos', () => {
  for (const name of ['index.html', 'lab.html']) {
    const main = read(name).match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
    for (const href of ['explore.html', 'lessons.html']) assert.ok(main.includes(`href="${href}"`), `${name}: ${href}`);
  }
});
