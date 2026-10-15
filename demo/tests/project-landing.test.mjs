import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const demo=process.env.FTV_DEMO?pathToFileURL(process.env.FTV_DEMO.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,demo),'utf8');

test('project composition references only tokens defined by the pinned estate package',()=>{
  const css=read('project.css'),contract=read('vendor/estate-ui/src/contract.css');
  for(const [,token] of css.matchAll(/var\((--[a-z0-9-]+)\)/g))assert.ok(contract.includes(`${token}:`),token);
  assert.doesNotMatch(css,/--estate-[a-z0-9-]+\s*:/,'do not override shared tokens');
});

test('the project page explains Parallax before the Explore and Lessons hubs',()=>{
  const html=read('index.html');
  assert.match(html,/data-page="project"/);
  assert.match(html,/<h1\b[^>]*>Parallax<span class="title-stop">\.<\/span><\/h1>/);
  assert.match(html,/id="open-lab"[^>]*href="explore.html"/);
  assert.match(html,/href="lessons.html"/);
  assert.match(html,/href="https:\/\/github.com\/Snowslash\/parallax">Source code and notes on GitHub/);
  assert.match(html,/class="back-link" href="https:\/\/sangeev.me\/#parallax"/);
  assert.match(html,/<script src="project-page.js[^"]*" defer><\/script>/);
  for(const label of ['Explore','Lessons','femur'])assert.ok(html.includes(label),label);
  assert.doesNotMatch(html,/<script[^>]*type="module"|Start the guided lesson|id="lesson"|<canvas/);
  assert.match(html,/href="licences.html"/);
});

test('the project screenshot has local assets, dimensions and useful alternative text',()=>{
  const html=read('index.html');
  const image=html.match(/<img[^>]*src="(assets\/project\/[^"?]+)"[^>]*>/);
  assert.ok(image,'project page needs its actual interface screenshot');
  assert.match(image[0],/width="\d+" height="\d+"/);
  assert.match(image[0],/alt="[^"]*3D Explore[^"]*"/);
  assert.ok(existsSync(new URL(image[1],demo)),'screenshot must be distributed');
});

test('the legacy lab chooser leads to both hubs and existing applications remain available',()=>{
  assert.ok(existsSync(new URL('lab.html',demo)),'separate lab chooser');
  const html=read('lab.html');
  for(const page of ['guided.html','beam3d.html','mesh-spike.html']){
    assert.ok(existsSync(new URL(page,demo)),page);
  }
  for(const page of ['explore.html','lessons.html'])assert.match(html,new RegExp(`href="${page}"`));
  for(const page of ['guided.html','beam3d.html','mesh-spike.html','femur-lesson.html'])assert.ok(read('lessons.html').includes(`href="${page}"`),page);
  assert.match(html,/href="index.html"/);
  assert.match(html,/href="licences.html"/);
});
