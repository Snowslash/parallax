import test from 'node:test';
import assert from 'node:assert/strict';
import {angleDelta,poseLabel,stepControl} from '../beam-interaction.mjs';

test('angle drags cross the wrap boundary without jumping a revolution',()=>{
  assert.equal(angleDelta(359,1),2);assert.equal(angleDelta(1,359),-2);assert.equal(angleDelta(-25,17),42);
});
test('labels include the full pose, with no implied exact integer-angle acquisition',()=>{
  const label=poseLabel({orbit:37.42,tilt:-17.23,x:8.42,y:-30,z:5});
  assert.match(label,/37.4/);assert.match(label,/-17.2/);assert.match(label,/8.4/);assert.match(label,/-30.0/);assert.match(label,/5.0/);
});
test('focused control keyboard equivalence supports fine and coarse stepping',()=>{
  assert.equal(stepControl(20,'ArrowRight',false),21);assert.equal(stepControl(20,'ArrowLeft',true),10);
  assert.equal(stepControl(20,'ArrowDown',false),19);assert.equal(stepControl(20,'Home',false),0);
  assert.equal(stepControl(20,'Tab',false),null);
});
