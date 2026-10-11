import test from 'node:test';
import assert from 'node:assert/strict';
import {LessonController} from '../femur-lesson/state.mjs';
const ap={orbit:0,tilt:0,x:0,y:0,z:0}, lateral={...ap,orbit:90};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const frame=job=>({caseId:job.caseId,pose:{...job.pose},width:job.size,height:job.size,pixels:new Uint8ClampedArray(job.size*job.size*4),invalidCount:0});
function setup(render=async job=>frame(job)){
  return new LessonController({render,onChange:()=>{},caseIds:['a','b'],classifyFrame:f=>f.pose.orbit===0?'ap':f.pose.orbit===90?'lateral':null});
}
async function paired(c){c.selectCase('a',ap);await tick();assert.equal(c.capture(),'ap');c.stage(lateral);await tick();assert.equal(c.capture(),'lateral');}
test('starts without evidence, decision or revealed geometry',()=>{const c=setup();assert.equal(c.canCommit(),false);assert.equal(c.state.revealed,false);assert.deepEqual(c.state.captures,{});});
test('AP and lateral, a judgement and a reason are all required',async()=>{const c=setup();await paired(c);assert.equal(c.canCommit(),false);c.choose('meets');assert.equal(c.canCommit(),false);c.reason('The tip is central and close on both views.');assert.equal(c.canCommit(),true);c.commit();assert.equal(c.state.revealed,true);});
test('clearing a judgement disables commitment without discarding evidence or reason',async()=>{
  const c=setup();await paired(c);c.reason('My reason stays available while reconsidering.');const captures=c.state.captures;
  for(const choice of ['meets','does-not-meet','insufficient']){
    c.choose(choice);assert.equal(c.canCommit(),true);c.choose(null);
    assert.equal(c.state.choice,null);assert.equal(c.canCommit(),false);
    assert.throws(()=>c.commit(),/choose an answer/);assert.equal(c.state.revealed,false);
    assert.equal(c.state.captures,captures);assert.equal(c.state.reason,'My reason stays available while reconsidering.');
  }
  c.choose('does-not-meet');c.commit();c.choose(null);assert.equal(c.state.choice,'does-not-meet');
});
test('duplicate AP captures never substitute for a lateral',async()=>{const c=setup();c.selectCase('a',ap);await tick();c.capture();c.capture();c.choose('meets');c.reason('A reason');assert.equal(c.canCommit(),false);assert.throws(()=>c.commit(),/AP and lateral/);assert.equal(c.state.revealed,false);});
test('off-angle frame is inspectable but not accepted as required evidence',async()=>{const c=setup();c.selectCase('a',{...ap,orbit:33});await tick();assert.equal(c.capture(),null);assert.deepEqual(c.state.captures,{});});
test('pending acquisition cannot capture a stale displayed frame',async()=>{let finish;const c=setup(job=>new Promise(r=>{finish=()=>r(frame(job));}));c.selectCase('a',ap);await tick();assert.equal(c.capture(),null);finish();await tick();assert.equal(c.capture(),'ap');c.stage(lateral);assert.equal(c.capture(),null);await tick();finish();await tick();assert.equal(c.capture(),'lateral');});
test('case switch during work discards old response and all old evidence',async()=>{const jobs=[];const c=setup(job=>new Promise(resolve=>jobs.push({job,resolve})));c.selectCase('a',ap);await tick();c.selectCase('b',lateral);jobs[0].resolve(frame(jobs[0].job));await tick();assert.equal(c.state.frame,null);assert.equal(c.state.pending,true);assert.equal(jobs[1].job.caseId,'b');jobs[1].resolve(frame(jobs[1].job));await tick();assert.equal(c.state.frame.caseId,'b');assert.deepEqual(c.state.captures,{});assert.equal(c.state.revealed,false);});
test('reset same case clears saved pair, judgement, reason and reveal',async()=>{const c=setup();await paired(c);c.choose('does-not-meet');c.reason('Too shallow');c.commit();c.selectCase('a',ap);assert.deepEqual(c.state.captures,{});assert.equal(c.state.choice,null);assert.equal(c.state.reason,'');assert.equal(c.state.revealed,false);await tick();});
test('captured pixels and pose are snapshots, not mutable render buffers',async()=>{const c=setup();c.selectCase('a',ap);await tick();c.state.frame.pixels[0]=93;c.capture();c.state.frame.pixels[0]=1;c.state.frame.pose.orbit=35;assert.equal(c.state.captures.ap.pixels[0],93);assert.equal(c.state.captures.ap.pose.orbit,0);});
test('failure retains last good image but cannot acquire it as the new view; retry recovers',async()=>{let fail=false;const c=setup(async job=>{if(fail)throw new Error('Worker failed');return frame(job);});c.selectCase('a',ap);await tick();c.capture();fail=true;c.stage(lateral);await tick();assert.match(c.state.error,/Worker failed/);assert.equal(c.state.frame.pose.orbit,0);assert.equal(c.capture(),null);fail=false;c.retry();await tick();assert.equal(c.capture(),'lateral');});
test('rejects wrong case, wrong pose, invalid rays and malformed frame',async()=>{for(const mutate of [f=>({...f,caseId:'b'}),f=>({...f,pose:lateral}),f=>({...f,invalidCount:1}),f=>({...f,pixels:new Uint8ClampedArray(4)})]){const c=setup(async job=>mutate(frame(job)));c.selectCase('a',ap);await tick();assert.ok(c.state.error);assert.equal(c.state.frame,null);assert.equal(c.capture(),null);}});
test('unknown inputs cannot mutate a committed answer',async()=>{const c=setup();assert.throws(()=>c.selectCase('unknown',ap));assert.throws(()=>c.choose('safe'));await paired(c);c.choose('insufficient');c.reason('I am not confident about the lateral tip.');c.commit();c.choose('meets');c.reason('rewrite');assert.equal(c.state.choice,'insufficient');assert.equal(c.state.reason,'I am not confident about the lateral tip.');assert.equal(c.capture(),null);});
test('rapid staging coalesces to newest valid full pose and does not track observer state',async()=>{const seen=[];const c=setup(async job=>{seen.push(job);return frame(job);});c.selectCase('a',ap);c.stage({...ap,orbit:22});c.stage(lateral);await tick();assert.equal(seen.length,1);assert.equal(c.state.frame.pose.orbit,90);assert.equal(Object.hasOwn(c.state,'observer'),false);assert.throws(()=>c.stage({...ap,x:NaN}));});
