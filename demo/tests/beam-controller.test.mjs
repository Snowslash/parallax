import test from 'node:test';
import assert from 'node:assert/strict';
import {BeamController} from '../beam-controller.mjs';

const home=()=>({orbit:0,tilt:0,x:0,y:0,z:0});
const frame=(job)=>({pose:{...job.pose},width:job.size,height:job.size,pixels:new Uint8ClampedArray(job.size*job.size*4),renderMs:3});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
  const calls=[],events=[];
  const controller=new BeamController(job=>new Promise((resolve,reject)=>calls.push({job,resolve,reject})),state=>events.push(state));
  return {controller,calls,events};
}

test('initial request publishes only the completed frame and pins that frame',async()=>{
  const {controller:c,calls}=harness();c.stage(home(),16);
  assert.equal(c.state.pending,true);assert.equal(c.state.frame,null);
  calls[0].resolve(frame(calls[0].job));await tick();
  assert.equal(c.state.pending,false);assert.deepEqual(c.state.frame.pose,home());assert.deepEqual(c.state.pinned.pose,home());
});
test('rapid input bounds work, discards the obsolete result and renders only latest queued pose',async()=>{
  const {controller:c,calls,events}=harness();c.stage(home(),16);
  c.stage({...home(),orbit:25},16);c.stage({...home(),orbit:37.4,tilt:19,x:12},16);
  assert.equal(calls.length,1);calls[0].resolve(frame(calls[0].job));await tick();
  assert.equal(c.state.frame,null);assert.equal(calls.length,2);assert.equal(calls[1].job.pose.orbit,37.4);
  calls[1].resolve(frame(calls[1].job));await tick();
  assert.equal(c.state.frame.pose.orbit,37.4);assert.equal(c.state.pending,false);
  assert.ok(events.filter(s=>s.frame).every(s=>s.frame.pose.orbit===37.4));
});
test('pin retains displayed pixels and full pose while another acquisition is pending',async()=>{
  const {controller:c,calls}=harness();c.stage({...home(),tilt:13,x:6,y:-22,z:15},16);
  const first=frame(calls[0].job);first.pixels[0]=73;calls[0].resolve(first);await tick();
  c.stage({...home(),orbit:90},16);c.pin();
  assert.deepEqual(c.state.pinned.pose,first.pose);assert.equal(c.state.pinned.pixels[0],73);
  first.pixels[0]=22;assert.equal(c.state.pinned.pixels[0],73);
  calls[1].resolve(frame(calls[1].job));await tick();assert.equal(c.state.pinned.pose.tilt,13);
});
test('wrong-pose or wrong-sized worker result is rejected; last good frame remains labelled',async()=>{
  const {controller:c,calls}=harness();c.stage(home(),16);calls[0].resolve(frame(calls[0].job));await tick();
  c.stage({...home(),orbit:90},16);
  calls[1].resolve({...frame(calls[1].job),pose:home()});await tick();
  assert.match(c.state.error,/pose|match/i);assert.equal(c.state.frame.pose.orbit,0);assert.equal(c.state.pending,false);
  c.retry();calls[2].resolve({...frame(calls[2].job),width:32});await tick();assert.match(c.state.error,/size|match/i);
});
test('render errors stop without retry loop; explicit retry recovers latest request',async()=>{
  const {controller:c,calls}=harness();c.stage(home(),16);calls[0].reject(new Error('worker unavailable'));await tick();await tick();
  assert.equal(calls.length,1);assert.match(c.state.error,/unavailable/);assert.equal(c.state.pending,false);
  c.retry();calls[1].resolve(frame(calls[1].job));await tick();assert.equal(c.state.error,null);assert.ok(c.state.frame);
});
test('pose snapshots cannot be changed by later edits to the input object',async()=>{
  const {controller:c,calls}=harness(),pose=home();c.stage(pose,16);pose.orbit=99;
  assert.equal(calls[0].job.pose.orbit,0);calls[0].resolve(frame(calls[0].job));await tick();assert.equal(c.state.frame.pose.orbit,0);
});
test('a beam reset does not discard the previously pinned projection',async()=>{
  const {controller:c,calls}=harness();c.stage({...home(),orbit:90,tilt:10},16);calls[0].resolve(frame(calls[0].job));await tick();c.pin();
  c.stage(home(),16);calls[1].resolve(frame(calls[1].job));await tick();assert.equal(c.state.frame.pose.orbit,0);assert.equal(c.state.pinned.pose.orbit,90);
});
test('same pose needs no second render but a resolution change does',async()=>{
  const {controller:c,calls}=harness();c.stage(home(),16);calls[0].resolve(frame(calls[0].job));await tick();
  c.stage(home(),16);assert.equal(calls.length,1);c.stage(home(),32);assert.equal(calls.length,2);
  calls[1].resolve(frame(calls[1].job));await tick();assert.equal(c.state.frame.width,32);
});
