import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

// Small source-composition contracts; browser geometry and interaction are separate gates.
const root = process.env.PARALLAX_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const load = path => readFileSync(resolve(root, 'demo', path), 'utf8');
function tree(html) {
  const top = {children: [], attrs: {}, tag: 'document'}, stack = [top];
  for (const token of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>|[^<]+/gi)) {
    const text = token[0];
    if (text.startsWith('</')) { stack.pop(); continue; }
    if (!text.startsWith('<')) { stack.at(-1).text = (stack.at(-1).text || '') + text; continue; }
    if (text.startsWith('<!')) continue;
    const tag = text.match(/^<([\w-]+)/)[1];
    const attrs = Object.fromEntries([...text.matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)')?/g)].slice(1).map(m => [m[1], m[2] ?? m[3] ?? '']));
    const node = {tag, attrs, children: [], parent: stack.at(-1)};
    node.parent.children.push(node);
    if (!['meta','link','input','img','br','hr','source','wbr'].includes(tag) && !text.endsWith('/>')) stack.push(node);
  }
  return top;
}
const all = node => [node, ...node.children.flatMap(all)];
const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name);
const one = (dom, predicate) => { const found = all(dom).filter(predicate); assert.equal(found.length, 1); return found[0]; };
const id = (dom, value) => one(dom, node => node.attrs.id === value);
const cls = (dom, value) => one(dom, node => hasClass(node, value));
const contains = (parent, child) => all(parent).includes(child);
const text = node => (node.text || '') + node.children.map(text).join('');
const lessons = [
  {path:'femur-lesson.html', title:'Femoral wire position', restart:'reset-case', beam:'tilt', saved:['saved-ap','saved-lateral'], scene:'lesson-scene', decision:'judgement', prefix:''},
  {path:'guidewire-fracture/index.html', title:'Guidewire across a fracture', restart:'restart', beam:'angulation', saved:['ap-image','additional-image'], scene:'rig-host', decision:'answer', prefix:'../'},
];
for (const lesson of lessons) {
  test(`${lesson.title}: common shell, concise title and chooser navigation`, () => {
    const html = load(lesson.path), dom = tree(html);
    assert.equal(text(one(dom, n => n.tag === 'h1')), lesson.title);
    assert.ok(html.includes(`<title>${lesson.title} — Parallax</title>`));
    cls(dom, 'estate-shell--wide-app');
    const nav = cls(dom, 'project-nav');
    assert.ok(all(nav).some(n => n.attrs.href === lesson.prefix+'index.html' && text(n) === 'Parallax'));
    assert.ok(all(nav).some(n => n.attrs.href === lesson.prefix+'lessons.html' && text(n) === 'Lessons'));
    assert.doesNotMatch(html, /href="[^"]*(?:explore|mesh-spike|beam3d)\.html"/);
    assert.ok(html.includes(`href="${lesson.prefix}publication.css?v=estate-1"`));
    assert.ok(html.indexOf('lesson-workspace.css') > html.lastIndexOf('lesson.css'));
    assert.ok(contains(cls(dom,'lesson-start'), id(dom,'case-select')));
    assert.ok(contains(cls(dom,'lesson-start'), id(dom,lesson.restart)));
  });
  test(`${lesson.title}: answer stays beside saved evidence before secondary 3D`, () => {
    const dom = tree(load(lesson.path)), nodes = all(dom);
    const current = cls(dom,'lesson-current'), saved = cls(dom,'lesson-saved'), context = cls(dom,'lesson-context'), decision = cls(dom,'lesson-decision');
    assert.equal(text(all(current).find(n => n.tag === 'h2')), 'Current X-ray');
    assert.equal(text(all(saved).find(n => n.tag === 'h2')), 'Saved views');
    assert.equal(text(all(context).find(n => n.tag === 'h2')), '3D view');
    assert.ok(nodes.indexOf(current) < nodes.indexOf(saved));
    assert.ok(nodes.indexOf(saved) < nodes.indexOf(context));
    assert.ok(contains(saved, decision), 'answer belongs with the saved evidence');
    assert.ok(nodes.indexOf(decision) < nodes.indexOf(context));
    assert.ok(contains(current, id(dom,'live-projection')));
    const controls = cls(dom,'lesson-beam-controls');
    assert.ok(contains(current, controls));
    for (const control of ['orbit',lesson.beam]) assert.ok(contains(controls, id(dom,control)));
    assert.ok(nodes.indexOf(controls) < nodes.indexOf(id(dom,'render-status')));
    assert.ok(nodes.indexOf(id(dom,'live-projection')) < nodes.indexOf(controls));
    for (const image of lesson.saved) assert.ok(contains(saved,id(dom,image)));
    assert.ok(contains(context,id(dom,lesson.scene)));
    assert.ok(contains(decision,id(dom,lesson.decision)));
    assert.equal(text(id(dom,'commit')), 'Confirm answer');
    assert.ok('disabled' in id(dom,'commit').attrs);
  });
}
test('shared workspace defines one comparison grid and does not visually reorder narrow content', () => {
  const path = resolve(root,'demo/lesson-workspace.css');
  assert.ok(existsSync(path), 'shared workspace stylesheet is required');
  const css = readFileSync(path,'utf8');
  for (const name of ['lesson-workspace','lesson-current','lesson-saved','lesson-context','lesson-panel']) assert.ok(css.includes('.'+name));
  assert.match(css,/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css,/@media[^}]+max-width:\s*780px/);
  assert.doesNotMatch(css,/\border\s*:/);
  assert.doesNotMatch(css,/\.estate-site-header|--estate-[\w-]+\s*:/);
});
test('femoral criteria, primary paper and proxy caveat remain available beside the lesson', () => {
  const html = load('femur-lesson.html');
  for (const needed of ['25 mm','8 mm','7608228','noopener noreferrer','How this differs from clinical TAD','wire tip followed by the gold dot']) assert.ok(html.includes(needed));
  assert.match(html,/id="reveal"[^>]*hidden/);
});
test('fracture evidence and reveal remain initially gated with recovery controls intact', () => {
  const dom = tree(load('guidewire-fracture/index.html'));
  for (const name of ['evidence','answer-controls','result','reveal-observer-controls']) assert.ok('hidden' in id(dom,name).attrs);
  assert.ok('disabled' in id(dom,'answer-controls').attrs);
  for (const name of ['retry-load','retry-frame','retry-reveal','rotate-image','reset-beam','tool-mode']) id(dom,name);
});
