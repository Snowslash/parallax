import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../guidewire-fracture/state.mjs';
import {normalizePose,isAdditionalPose} from '../guidewire-fracture/camera.mjs';
import {createTransport} from '../guidewire-fracture/transport.mjs';
const frame=()=>({width:1,height:1,pixels:new Uint8ClampedArray([1,2,3,255]),invalidCount:0,framing:{oliveInFrame:true}});
function rig(){
 const state=createState({normalizePose,isAdditionalPose}),workers=[],timers=new Map();let serial=0,changes=0;
 class Worker {constructor(){this.sent=[];this.terminated=false;workers.push(this);}postMessage(r){this.sent.push(r);}terminate(){this.terminated=true;}reply(r=this.sent.at(-1),extra={}){this.onmessage({data:{...r,type:'frame',frame:frame(),...extra}});}}
 const transport=createTransport({state,createWorker:()=>new Worker(),setTimeout:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial;},clearTimeout:id=>timers.delete(id),onChange:()=>changes++});
 const tick=ms=>{for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}};
 const ready=()=>state.acceptAP(state.snapshot().generation,frame(),'pinned');ready();
 return {state,workers,timers,transport,tick,ready,changes:()=>changes};
}
test('lazy initialization and settled coalescing preserve displayed identity until the matching reply',()=>{
 const r=rig();assert.equal(r.workers.length,0);const previous=r.state.snapshot().displayedFrameId;
 r.transport.stage({orbit:30,angulation:0});r.transport.stage({orbit:90,angulation:0});assert.equal(r.timers.size,1);r.tick(180);
 assert.equal(r.workers.length,1);assert.equal(r.workers[0].sent.length,1);assert.equal(r.workers[0].sent[0].pose.orbit,90);assert.equal(r.state.snapshot().displayedFrameId,previous);assert.equal(r.state.snapshot().canCapture,false);
 r.workers[0].reply();assert.equal(r.state.snapshot().displayedPose.orbit,90);assert.equal(r.state.snapshot().canCapture,true);assert.equal(r.timers.size,0);
});
test('stale request IDs do not consume the current timeout or publish pixels',()=>{
 const r=rig();r.transport.stage({orbit:30,angulation:0});r.tick(180);const w=r.workers[0],id=r.state.snapshot().displayedFrameId;
 w.reply(w.sent[0],{id:'unrelated'});assert.equal(r.state.snapshot().displayedFrameId,id);assert.equal(r.timers.size,1);
 r.transport.stage({orbit:90,angulation:0});r.tick(180);w.reply(w.sent[0]);assert.equal(r.state.snapshot().displayedFrameId,id);assert.equal(w.sent.length,2);w.reply();assert.equal(r.state.snapshot().displayedPose.orbit,90);
});
test('case reset terminates initialization and ignores its late replies and errors',()=>{
 const r=rig();r.transport.stage({orbit:30,angulation:0});r.tick(180);const w=r.workers[0];r.transport.cancel();r.state.reset('case-b');r.ready();const id=r.state.snapshot().displayedFrameId;
 w.reply();w.onerror({preventDefault(){},message:'late'});assert.equal(r.state.snapshot().displayedFrameId,id);assert.equal(r.state.snapshot().error,'');assert.equal(r.timers.size,0);assert.ok(w.terminated);
 r.transport.stage({orbit:90,angulation:0});r.tick(180);assert.equal(r.workers.length,2);assert.equal(r.workers[1].sent[0].caseId,'case-b');
});
for(const failure of ['timeout','crash','messageerror','reply-error','mismatch'])test(`${failure} preserves the last valid frame and Retry replaces the Worker`,()=>{
 const r=rig();const id=r.state.snapshot().displayedFrameId;r.transport.stage({orbit:90,angulation:0});r.tick(180);const w=r.workers[0];
 if(failure==='timeout')r.tick(120000);else if(failure==='crash')w.onerror({preventDefault(){},message:'crash'});else if(failure==='messageerror')w.onmessageerror();else w.reply(w.sent[0],failure==='reply-error'?{type:'error',error:'invalid rays'}:{pose:{orbit:45,angulation:0}});
 assert.ok(r.state.snapshot().error);assert.equal(r.state.snapshot().displayedFrameId,id);assert.equal(r.state.snapshot().canCapture,false);
 r.transport.retry();assert.ok(w.terminated);assert.equal(r.workers.length,2);w.reply();assert.equal(r.state.snapshot().displayedFrameId,id);r.workers[1].reply();assert.equal(r.state.snapshot().error,'');assert.equal(r.state.snapshot().displayedPose.orbit,90);
});
test('disposal releases timers and worker and cannot restart work',()=>{
 const r=rig();r.transport.stage({orbit:30,angulation:0});r.tick(180);const w=r.workers[0],before=r.changes();r.transport.dispose();r.transport.dispose();w.reply();
 r.transport.stage({orbit:90,angulation:0});r.transport.retry();r.transport.pump();assert.ok(w.terminated);assert.equal(r.timers.size,0);assert.equal(r.workers.length,1);assert.equal(r.changes(),before);
});
test('synchronous Worker construction and send errors become visible failures',()=>{
 for(const createWorker of [()=>{throw Error('construction');},()=>({postMessage(){throw Error('send');},terminate(){}})]){
  const r=rig();const t=createTransport({state:r.state,createWorker});r.state.stage({orbit:30,angulation:0});r.state.settle();t.pump();assert.match(r.state.snapshot().error,/construction|send/);t.dispose();
 }
});
