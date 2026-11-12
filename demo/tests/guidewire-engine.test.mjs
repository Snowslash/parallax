import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine} from '../guidewire-fracture/engine.mjs';
const pose={orbit:30,angulation:0},wire={points:[[0,0,0],[0,1,0]],radiusMm:1,oliveRadiusMm:2};
const result={rgba:new Uint8Array([1,2,3,255]),invalidCount:0};
function setup(options={}){
 const counts={load:0,dispose:0,js:0,wasm:0};
 const engineOptions={loadMeshes:async()=>({revision:++counts.load}),loadWasm:async()=>new Uint8Array([0]),renderJS:(m,w,p,size)=>{counts.js++;return {...result,revision:m.revision,pose:p,size};},createRustRenderer:async()=>({renderPose(){counts.wasm++;return result;},dispose(){counts.dispose++;},memoryBytes:()=>123,setup:{instantiateMs:1,serializationMs:2}}),...options};
 return {counts,engineOptions};
}
test('JavaScript remains the default without attempting Wasm loading',async()=>{
 const {counts,engineOptions}=setup({loadWasm:async()=>{throw Error('must not load');}}),e=await createEngine(engineOptions);
 assert.equal((await e.renderPose(wire,pose,320,{})).revision,1);assert.equal(e.info().active,'js');assert.equal(e.info().requested,'js');assert.equal(e.info().fallbackReason,null);assert.equal(counts.load,1);e.dispose();
});
test('opt-in uses one whole-frame Wasm call and releases prepared JS geometry',async()=>{
 const {counts,engineOptions}=setup(),e=await createEngine({...engineOptions,engine:'wasm'});
 assert.equal(await e.renderPose(wire,pose,320,{}),result);assert.equal(e.info().active,'wasm');assert.equal(e.info().retainedJSGeometry,false);assert.equal(e.info().wasmMemoryBytes,123);assert.equal(counts.wasm,1);assert.equal(counts.js,0);e.dispose();e.dispose();assert.equal(counts.dispose,1);await assert.rejects(()=>e.renderPose(wire,pose,320,{}),/disposed/);
});
for(const phase of ['load','compile','initialize'])test(`${phase} failure falls back visibly to the same JavaScript result`,async()=>{
 const {counts,engineOptions}=setup(phase==='load'?{loadWasm:async()=>{throw Error(phase);}}:{createRustRenderer:async()=>{throw Error(phase);}}),e=await createEngine({...engineOptions,engine:'wasm'});
 assert.equal((await e.renderPose(wire,pose,320,{})).revision,1);assert.equal(e.info().active,'js');assert.equal(e.info().requested,'wasm');assert.match(e.info().fallbackReason,new RegExp(phase));assert.equal(counts.load,1);e.dispose();
});
test('runtime failure recreates validated meshes after release and disposes Wasm once',async()=>{
 let disposed=0;const {counts,engineOptions}=setup({createRustRenderer:async()=>({renderPose(){throw Error('trap');},dispose(){disposed++;},memoryBytes:()=>123})}),e=await createEngine({...engineOptions,engine:'wasm'});
 assert.equal(e.info().retainedJSGeometry,false);const a=await e.renderPose(wire,pose,320,{});assert.equal(a.revision,2);assert.equal(counts.load,2);assert.equal(disposed,1);assert.match(e.info().fallbackReason,/trap/);assert.equal((await e.renderPose(wire,pose,320,{})).revision,2);e.dispose();assert.equal(disposed,1);
});
test('invalid-ray results are not relabelled as successful fallback frames',async()=>{
 const {counts,engineOptions}=setup({createRustRenderer:async()=>({renderPose:()=>({invalidCount:1}),dispose(){},memoryBytes:()=>0})}),e=await createEngine({...engineOptions,engine:'wasm'});
 assert.equal((await e.renderPose(wire,pose,320,{})).invalidCount,1);assert.equal(e.info().active,'wasm');assert.equal(counts.js,0);e.dispose();
});
test('failed fallback model integrity remains an error, not a frame',async()=>{
 let loads=0;const {engineOptions}=setup({loadMeshes:async()=>{if(++loads>1)throw Error('model hash mismatch');return {};},createRustRenderer:async()=>({renderPose(){throw Error('trap');},dispose(){},memoryBytes:()=>0})}),e=await createEngine({...engineOptions,engine:'wasm'});
 await assert.rejects(()=>e.renderPose(wire,pose,320,{}),/model hash mismatch/);e.dispose();
});
test('disposal while fallback is loading prevents a late frame',async()=>{
 let resolve,loads=0;const {engineOptions}=setup({loadMeshes:async()=>++loads===1?{}:new Promise(r=>resolve=r),createRustRenderer:async()=>({renderPose(){throw Error('trap');},dispose(){},memoryBytes:()=>0})}),e=await createEngine({...engineOptions,engine:'wasm'});
 const late=e.renderPose(wire,pose,320,{});await Promise.resolve();e.dispose();resolve({});await assert.rejects(()=>late,/disposed/);
});
