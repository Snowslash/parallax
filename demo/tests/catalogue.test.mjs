import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const demo = process.env.FTV_DEMO ? pathToFileURL(process.env.FTV_DEMO.replace(/\/$/, '') + '/') : new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, demo), 'utf8');
const expected = [
  {id: 'guidewire-fracture', title: 'Guidewire across a fracture', lesson: 'guidewire-fracture/index.html'},
  {id: 'femur', title: 'Femoral wire position', lesson: 'femur-lesson.html'}
];
test('catalogue names the two current learning tasks without separate explorers', async () => {
  const {catalogue} = await import(new URL('catalogue.mjs', demo));
  assert.deepEqual(catalogue.map(({id,title,lesson}) => ({id,title,lesson})), expected);
  assert.ok(catalogue.every(item => !item.explore));
});
test('chooser offers both real lessons without JavaScript and no retired choices', () => {
  const html = read('lessons.html');
  const rows = [...html.matchAll(/<article\b[^>]*data-experience="([^"]+)"[\s\S]*?<\/article>/g)];
  assert.deepEqual(rows.map(row => row[1]), expected.map(item => item.id));
  for (const [i,row] of rows.entries()) {
    const item = expected[i];
    assert.ok(row[0].includes(`aria-labelledby="${item.id}-title"`));
    assert.ok(row[0].includes(`id="${item.id}-title"`));
    assert.ok(row[0].includes(item.title));
    assert.ok(row[0].includes(`href="${item.lesson}"`));
    assert.doesNotMatch(row[0], /Explore:|href=""/);
  }
  assert.doesNotMatch(html, /<select|disabled|coming soon|href="(?:guided|beam3d|mesh-spike|explore)\.html"/i);
});
test('active navigation uses Parallax and Lessons; archived pages identify the archive', () => {
  for (const name of ['index.html','lab.html','lessons.html','licences.html','femur-lesson.html','guidewire-fracture/index.html']) {
    const nav = read(name).match(/<nav class="project-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav, name);
    assert.doesNotMatch(nav,/Explore|Archive/);
    assert.match(nav,/Parallax/); assert.match(nav,/Lessons/);
  }
  for (const name of ['explore.html','guided.html','beam3d.html','mesh-spike.html']) {
    assert.match(read(name), /href="explore.html"[^>]*aria-current="page"[^>]*>Archive/);
  }
});
test('archive preserves original routes but does not pair different femur models', () => {
  const archive = read('explore.html');
  for (const route of ['guided.html','beam3d.html','mesh-spike.html']) {
    assert.ok(existsSync(new URL(route,demo)));
    assert.ok(archive.includes(`href="${route}"`));
  }
  assert.match(archive,/diagonal/);
  assert.doesNotMatch(archive,/href="femur-lesson.html"/);
  assert.match(read('licences.html'),/href="explore.html"/);
});
test('each active lesson destination exists', () => {
  for (const item of expected) assert.match(read(item.lesson),/<!doctype html>/i);
});
