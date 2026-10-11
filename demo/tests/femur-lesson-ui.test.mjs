import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wireDescriptor} from '../femur-lesson/presentation.mjs';
const load=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('no part of the explanatory wire exists before commitment',()=>{assert.equal(wireDescriptor({start:[0,0,0],tip:[5,6,7],radius:1},false),null);assert.equal(wireDescriptor(null,false),null);});
test('revealed finite wire keeps endpoints, diameter and length in model coordinates',()=>{const d=wireDescriptor({start:[1,2,3],tip:[1,5,7],radius:.8},true);assert.deepEqual(d.centre,[1,3.5,5]);assert.deepEqual(d.direction,[0,.6,.8]);assert.equal(d.length,5);assert.equal(d.radius,.8);assert.deepEqual(d.tip,[1,5,7]);});
test('malformed revealed wires cannot draw deceptive geometry',()=>{for(const wire of [null,{start:[0,0,0],tip:[0,0,0],radius:1},{start:[0,0,0],tip:[1,0,0],radius:NaN}])assert.throws(()=>wireDescriptor(wire,true));});
test('lesson has labelled acquisition, comparison, judgement and separate observer controls',()=>{const html=load('../femur-lesson.html');for(const id of ['case-select','live-projection','saved-ap','saved-lateral','capture','orbit','tilt','x','y','z','observer-yaw','observer-elevation','observer-zoom','judgement','reason','commit','retry','reset-case'])assert.match(html,new RegExp(`id="${id}"`));assert.match(html,/id="reveal"[^>]*hidden/);assert.match(html,/id="commit"[^>]*disabled/);assert.match(html,/femur-lesson\/app\.mjs/);assert.match(html,/licences.html#femur-lesson/);assert.match(load('../licences.html'),/7608228/);assert.match(html,/AP and lateral/);});
test('3D wire is only created from a gated descriptor and removed on reset',()=>{const view=load('../femur-lesson/view.mjs');assert.match(view,/wireDescriptor\(wire,revealed\)/);assert.match(view,/this\.scene\.remove\(this\.wire\)/);assert.match(view,/if\(!descriptor\)/);});
test('criteria are explicit and the clinical TAD distinction remains linked',()=>{
  const html=load('../femur-lesson.html'),app=load('../femur-lesson/app.mjs');
  assert.match(html,/How this differs from clinical TAD/);assert.match(load('../licences.html'),/not clinical TAD/);assert.match(html,/25 mm/);assert.match(html,/8 mm/);
  assert.match(app,/result\.measurementLabel/);assert.match(html,/wire tip followed by the gold dot/);
});
