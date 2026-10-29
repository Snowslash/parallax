import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../mesh-spike.html',import.meta.url),'utf8');

test('Femur presents the reviewed material comparison without changing modes',()=>{
  assert.match(html,/<label for="material-mode">Bone appearance<\/label>/);
  assert.match(html,/<select id="material-mode"><option value="layered">Cortex \+ core<\/option><option value="uniform">Uniform<\/option><\/select>/);
  assert.doesNotMatch(html,/Brighter areas block more of the beam/);
  assert.match(html,/<title>Femur — Parallax<\/title>/);
  assert.match(html,/href="lessons.html"/);
  assert.match(html,/href="explore.html"[^>]*aria-current="page"/);
  assert.doesNotMatch(html,/Private preview|baseline-femur|Original model|<details/);
});

test('Femur source-coordinate controls start at the reviewed zero pose',()=>{
  for(const axis of ['x','y','z']){
    const input=html.match(new RegExp(`<input id="${axis}"[^>]+>`))?.[0];
    assert.ok(input,axis);
    assert.match(input,/value="0"/);
    assert.match(html,new RegExp(`for="${axis}">Source ${axis.toUpperCase()} \\(mm\\)`));
  }
  assert.doesNotMatch(html,/lateral|posterior|superior|head centre/);
});

test('Femur retains error and provenance access with a fresh application entry',()=>{
  assert.match(html,/mesh-spike\/app.mjs\?v=bp3d-cortex-1/);
  for(const id of ['mesh-status','retry','diagnostics','load-metrics','reset-beam','reset-observer'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/id="diagnostics" hidden/);
  assert.match(html,/href="licences.html"/);
  assert.doesNotMatch(html,/<meta name="robots" content="noindex/);
});
