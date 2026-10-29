import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const demo=process.env.FTV_DEMO?pathToFileURL(process.env.FTV_DEMO.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,demo),'utf8');
test('project composition uses the exact pinned estate tokens',()=>{
  const css=read('consolidation.css'),contract=read('vendor/estate-ui/src/contract.css');
  for(const [,token] of css.matchAll(/var\((--[a-z0-9-]+)\)/g))assert.ok(contract.includes(`${token}:`),token);
  assert.doesNotMatch(css,/--estate-[a-z0-9-]+\s*:/);
});
test('landing gives one lab entry into the chooser, not competing modes',()=>{
  const html=read('index.html');
  assert.match(html,/data-page="project"/);
  assert.match(html,/<h1\b[^>]*>Parallax<\/h1>/);
  assert.match(html,/id="open-lab"[^>]*href="lessons.html"[^>]*>Open lab<\/a>/);
  assert.equal((html.match(/id="open-lab"/g)||[]).length,1);
  assert.match(html,/href="https:\/\/github.com\/Snowslash\/parallax"/);
  assert.match(html,/href="licences.html"/);
  assert.doesNotMatch(html,/<canvas|index-cards|Explore in 3D|starter scene|href="explore.html"|project-page.js/);
});
test('landing uses a current, dimensioned, self-hosted lesson screenshot',()=>{
  const html=read('index.html');
  const image=html.match(/<img[^>]*src="(assets\/project\/[^"?]+)"[^>]*>/);
  assert.ok(image);assert.match(image[0],/width="\d+" height="\d+"/);
  assert.match(image[0],/alt="[^"]*Guidewire across a fracture/);
  assert.ok(existsSync(new URL(image[1],demo)));
});
test('legacy lab remains usable without automatic redirect or retired primary choices',()=>{
  const html=read('lab.html');
  assert.match(html,/href="lessons.html"/);
  assert.match(html,/href="index.html"/);
  assert.doesNotMatch(html,/http-equiv="refresh"|href="explore.html"/);
});
