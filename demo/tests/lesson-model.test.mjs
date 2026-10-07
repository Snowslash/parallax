import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduce,canAcquire,canCommit,caseFor,frameFor,scenePayload,viewExplanation,judgementFeedback} from '../lesson-model.mjs';

// Small explicit test fixture; real generated assets have a separate integration gate.
const angles=[0,30,45,60,90,135];
const lesson={angles,geometry:{cameras:angles.map(angle_deg=>({angle_deg}))},cases:[
  {id:'c1',initialAngles:[0],tip:[0,15,18],truth:'breached',takeaway:'Depth is hidden.',frames:angles.map(angle=>({angle,evidence:angle===90?'beyond':'overlap'}))},
  {id:'c2',initialAngles:[0,90],tip:[10,10,18],truth:'breached',takeaway:'Two outlines do not settle the geometry.',frames:angles.map(angle=>({angle,evidence:angle===45?'beyond':'overlap'}))},
  {id:'c3',initialAngles:[0],tip:[0,7,18],truth:'contained',takeaway:'Containment is not guaranteed by overlap.',frames:angles.map(angle=>({angle,evidence:'overlap'}))}
]};
const step=(s,...actions)=>actions.reduce((state,action)=>reduce(state,action,lesson),s);
const acquire=(s,angle)=>step(s,{type:'select',angle},{type:'predict',value:'unsure'},{type:'acquire'});
const reveal=(s=initialState(lesson),angle=90,judgement='insufficient')=>step(acquire(s,angle),{type:'judge',value:judgement},{type:'commit'});

test('chapter starts with its authored evidence and no truth',()=>{
  const s=initialState(lesson);assert.equal(s.caseId,'c1');assert.deepEqual(s.captured,[0]);assert.equal(s.reference,0);assert.equal(s.viewed,0);
  assert.equal(s.revealed,false);assert.equal(canCommit(s,lesson),false);assert.equal(viewExplanation(s,lesson),'');assert.equal(judgementFeedback(s,lesson),'');
});
test('second chapter starts with TWO baseline images, not a new acquisition',()=>{
  const s=initialState(lesson,1);assert.deepEqual(s.captured,[0,90]);assert.equal(s.reference,0);assert.equal(s.viewed,90);assert.equal(canCommit(s,lesson),false);
});
test('staging and prediction do not change captured images or expose truth',()=>{
  const s=step(initialState(lesson),{type:'select',angle:45},{type:'predict',value:'separate'});
  assert.equal(s.selected,45);assert.equal(s.viewed,0);assert.deepEqual(s.captured,[0]);assert.equal(scenePayload(s,lesson).tip,null);assert.equal(canAcquire(s),true);
});
test('prediction required before new acquisition, not after reveal',()=>{
  let s=step(initialState(lesson),{type:'select',angle:90});assert.equal(canAcquire(s),false);assert.deepEqual(step(s,{type:'acquire'}),s);
  s=step(s,{type:'predict',value:'separate'},{type:'acquire'});assert.equal(s.viewed,90);assert.equal(s.predictions[90],'separate');assert.equal(canAcquire(s),false);
  s=step(s,{type:'judge',value:'breached'},{type:'commit'},{type:'select',angle:45});assert.equal(canAcquire(s),true);
});
test('prediction belongs to candidate angle; changing candidate clears it',()=>{
  const s=step(initialState(lesson),{type:'select',angle:90},{type:'predict',value:'separate'},{type:'select',angle:45});assert.equal(s.prediction,null);assert.equal(canAcquire(s),false);
});
test('invalid inputs, duplicate acquisition and uncaptured comparison are ignored',()=>{
  const s=acquire(initialState(lesson),90);
  for(const action of [{type:'select',angle:7},{type:'view',angle:45},{type:'predict',value:'bad'},{type:'judge',value:'safe'},{type:'acquire'}])assert.deepEqual(step(s,action),s);
});
test('pinning changes only reference; both panels point at captured evidence',()=>{
  let s=acquire(initialState(lesson),90);s=step(s,{type:'pin',angle:90},{type:'view',angle:0});
  assert.equal(s.reference,90);assert.equal(s.viewed,0);assert.equal(s.selected,0);assert.deepEqual(s.captured,[0,90]);
  assert.deepEqual(step(s,{type:'pin',angle:45}),s);assert.equal(frameFor(s,lesson,s.reference).angle,90);
});
test('each chapter requires a NEW image and explicit judgement',()=>{
  let s=initialState(lesson,1);s=step(s,{type:'judge',value:'contained'},{type:'commit'});assert.equal(s.revealed,false);
  s=acquire(s,45);assert.equal(canCommit(s,lesson),false);s=step(s,{type:'judge',value:'insufficient'});assert.equal(canCommit(s,lesson),true);
});
test('acquiring new evidence resets a provisional judgement',()=>{
  let s=step(acquire(initialState(lesson),30),{type:'judge',value:'contained'});s=acquire(s,90);assert.equal(s.judgement,null);
});
test('commit reveals and records completion without points or safety score',()=>{
  const s=reveal();assert.equal(s.revealed,true);assert.deepEqual(s.completed,['c1']);assert.match(judgementFeedback(s,lesson),/What would you need to see/);
  assert.doesNotMatch(viewExplanation(s,lesson),/clinically safe|competent|score/i);assert.equal(canCommit(s,lesson),false);
});
test('reveal ray follows displayed frame, rig follows independently staged angle',()=>{
  const s=step(reveal(),{type:'select',angle:45});const p=scenePayload(s,lesson);
  assert.equal(p.camera.angle_deg,90);assert.equal(p.rigCamera.angle_deg,45);assert.deepEqual(p.tip,[0,15,18]);assert.equal(p.sectionZ,17);
});
test('orbit and reveal toggles do not affect acquisition or hidden scene',()=>{
  let s=initialState(lesson);assert.deepEqual(step(s,{type:'orbit',yaw:60,elevation:45},{type:'toggle',key:'showRay',value:false}),s);
  s=reveal();const next=step(s,{type:'orbit',yaw:110,elevation:50},{type:'toggle',key:'showRay',value:false},{type:'toggle',key:'showSection',value:false});
  assert.deepEqual(next.captured,s.captured);assert.equal(next.viewed,s.viewed);assert.equal(next.yaw,110);assert.equal(scenePayload(next,lesson).showRay,false);assert.equal(scenePayload(next,lesson).sectionZ,null);
});
test('next and future chapter navigation cannot bypass commitment',()=>{
  const s=initialState(lesson);assert.deepEqual(step(s,{type:'next'},{type:'chapter',index:2}),s);
  const next=step(reveal(),{type:'next'});assert.equal(next.caseId,'c2');assert.deepEqual(next.captured,[0,90]);assert.equal(next.revealed,false);assert.deepEqual(next.completed,['c1']);
});
test('replay clears hidden state, predictions and observer controls',()=>{
  let s=step(reveal(),{type:'orbit',yaw:110,elevation:50},{type:'toggle',key:'showRay',value:false},{type:'replay'});
  assert.equal(s.revealed,false);assert.equal(s.prediction,null);assert.deepEqual(s.predictions,{});assert.equal(s.yaw,35);assert.equal(s.showRay,true);assert.deepEqual(s.captured,[0]);assert.deepEqual(s.completed,['c1']);
});
test('full sequence finishes and restart really clears progress',()=>{
  let s=step(reveal(),{type:'next'});s=step(reveal(s,45),{type:'next'});s=step(reveal(s,90,'contained'),{type:'next'});
  assert.equal(s.finished,true);assert.deepEqual(s.completed,['c1','c2','c3']);assert.deepEqual(step(s,{type:'restart'}),initialState(lesson));
});
test('completed chapter revisits reset trial without silently exposing truth',()=>{
  let s=step(reveal(),{type:'next'},{type:'chapter',index:0});assert.equal(s.caseId,'c1');assert.equal(s.revealed,false);assert.equal(scenePayload(s,lesson).sectionZ,null);
});
test('per-view explanation distinguishes diagonal overlap from exposed tip',()=>{
  let s=reveal(initialState(lesson,1),45);assert.match(viewExplanation(s,lesson),/45°/);assert.match(viewExplanation(s,lesson),/beyond/);
  s=step(s,{type:'view',angle:90});assert.match(viewExplanation(s,lesson),/90°/);assert.match(viewExplanation(s,lesson),/overlap/);assert.equal(caseFor(s,lesson).id,'c2');
});
