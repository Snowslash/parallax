import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../mesh-spike/controller.mjs').catch(()=>({}));
const transport=await import('../mesh-spike/transport.mjs').catch(()=>({}));
const home={orbit:0,tilt:0,x:24,y:7,z:-68};
const tick=()=>new Promise(r=>setImmediate(r));
const frame=j=>({pose:{...j.pose},width:j.size,height:j.size,pixels:new Uint8ClampedArray(j.size*j.size*4),invalidCount:0});
test('same-task input burst starts only the final target, not intermediate work',async()=>{
  const {c,calls}=harness();c.stage(home,128);c.stage({...home,orbit:37.4,tilt:19.2},256);
  assert.equal(calls.length,0);assert.equal(c.state.pending,true);assert.equal(c.state.requested.pose.orbit,37.4);
  await tick();assert.equal(calls.length,1);assert.equal(calls[0].j.pose.orbit,37.4);
  calls[0].resolve(frame(calls[0].j));await tick();assert.equal(c.state.frame.width,256);
});
function harness(){
  assert.equal(typeof api.MeshController,'function','MeshController API exists');
  const calls=[],events=[];
  const c=new api.MeshController(j=>new Promise((resolve,reject)=>calls.push({j,resolve,reject})),s=>events.push(s));
  return {c,calls,events};
}
test('one in-flight job, one latest target; obsolete success and failure cannot publish',async()=>{
  const {c,calls,events}=harness();c.stage(home,128);await tick();c.stage({...home,orbit:13},128);c.stage({...home,orbit:37.4,tilt:19},256);
  assert.equal(calls.length,1);calls[0].resolve(frame(calls[0].j));await tick();
  assert.equal(c.state.frame,null);assert.equal(calls.length,2);assert.equal(calls[1].j.pose.orbit,37.4);
  c.stage({...home,orbit:42},256);calls[1].reject(new Error('obsolete failure'));await tick();
  assert.equal(c.state.error,null);assert.equal(calls.length,3);calls[2].resolve(frame(calls[2].j));await tick();
  assert.equal(c.state.frame.pose.orbit,42);assert.ok(events.filter(s=>s.frame).every(s=>s.frame.pose.orbit===42));assert.equal(c.state.pending,false);
});
test('pending and failed frame retain exact displayed image/pose; explicit retry recovers',async()=>{
  const {c,calls}=harness();c.stage(home,128);await tick();calls[0].resolve(frame(calls[0].j));await tick();const held=c.state.frame;
  c.stage({...home,x:30},256);assert.equal(c.state.frame,held);assert.equal(c.state.requested.size,256);
  await tick();calls[1].reject(new Error('worker lost'));await tick();assert.equal(c.state.frame,held);assert.match(c.state.error,/worker lost/);assert.equal(c.state.pending,false);
  await tick();assert.equal(calls.length,2);c.retry();calls[2].resolve(frame(calls[2].j));await tick();assert.equal(c.state.frame.pose.x,30);assert.equal(c.state.error,null);
});
for(const [name,alter] of [['pose',f=>({...f,pose:{...home,orbit:8}})],['size',f=>({...f,width:256})],['pixels',f=>({...f,pixels:new Uint8ClampedArray(4)})],['invalid',f=>({...f,invalidCount:1,invalidRays:[{row:4,col:7,reason:'unresolved'}]})],['missing validity',f=>({...f,invalidCount:undefined})]]){
  test('rejects '+name+' result without falsely displaying it',async()=>{
    const {c,calls}=harness();c.stage(home,128);await tick();calls[0].resolve(alter(frame(calls[0].j)));await tick();assert.equal(c.state.frame,null);assert.ok(c.state.error);
  });
}
test('snapshot, deduplication, resolution change and reset correspondence',async()=>{
  const {c,calls}=harness(),p={...home};c.stage(p,128);p.x=99;await tick();assert.equal(calls[0].j.pose.x,24);calls[0].resolve(frame(calls[0].j));await tick();
  c.stage(home,128);assert.equal(calls.length,1);c.stage(home,256);await tick();calls[1].resolve(frame(calls[1].j));await tick();assert.equal(c.state.frame.width,256);
  c.stage({...home,orbit:80},256);await tick();c.stage(home,256);calls[2].resolve(frame(calls[2].j));await tick();assert.equal(c.state.frame.pose.orbit,0);calls[3].resolve(frame(calls[3].j));await tick();assert.deepEqual(c.state.frame.pose,home);
  assert.equal('pinned' in c.state,false);
});
test('only supported sizes and finite full poses are admitted',()=>{
  const {c,calls}=harness();assert.throws(()=>c.stage(home,64));assert.throws(()=>c.stage({...home,x:NaN},128));assert.equal(calls.length,0);
});
class FakeWorker{
  static instances=[];
  constructor(){FakeWorker.instances.push(this);this.dead=false;}
  postMessage(j){this.job=j;}
  terminate(){this.dead=true;}
  reply(data){this.onmessage({data});}
}
function workerHarness(){
  assert.equal(typeof transport.createWorkerRenderer,'function','worker transport API exists');FakeWorker.instances=[];
  return transport.createWorkerRenderer({WorkerClass:FakeWorker,timeoutMs:20});
}
test('transport rejects wrong IDs and restarts a terminated worker on retry',async()=>{
  const t=workerHarness(),j={id:1,pose:home,size:128};const p=t.render(j);const w=FakeWorker.instances[0];w.reply({id:9,frame:frame(j)});await assert.rejects(p,/ID/);assert.equal(w.dead,true);
  const p2=t.render({...j,id:2});assert.equal(FakeWorker.instances.length,2);FakeWorker.instances[1].reply({id:2,frame:frame(j)});assert.equal((await p2).width,128);t.dispose();
});
test('timeout/crash are explicit, do not hang and allow new worker',async()=>{
  const t=workerHarness(),j={id:1,pose:home,size:128};const p=t.render(j);await assert.rejects(p,/timed out/);assert.equal(FakeWorker.instances[0].dead,true);
  const p2=t.render({...j,id:2});FakeWorker.instances[1].onerror({message:'forced crash',preventDefault(){}});await assert.rejects(p2,/forced crash/);t.dispose();
});
test('numerical errors retain details and do not pretend to be successful transport frames',async()=>{
  const t=workerHarness(),p=t.render({id:1,pose:home,size:128});FakeWorker.instances[0].reply({id:1,error:'2 unresolved rays',diagnostics:{invalidCount:2,invalidRays:[{row:3,col:9}]}});
  await assert.rejects(p,e=>e.message.includes('2 unresolved')&&e.diagnostics.invalidRays[0].col===9);t.dispose();
});
