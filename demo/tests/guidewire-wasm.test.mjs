import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRustRenderer} from '../guidewire-fracture/wasm/adapter.mjs';
import {prepareMeshes,parseSTL,renderPose,integrateRay,wireIntervals} from '../guidewire-fracture/render-core.mjs';
import {meshIntervals} from '../guidewire-fracture/kernel/ct/integrator.mjs';
import {compareFrames} from '../../scripts/wasm/compare-frames.mjs';
const wasmBytes=await readFile(new URL('../guidewire-fracture/wasm/renderer.wasm',import.meta.url));
const keys=['outer','core','shell','bone','metal','attenuation'];
const wire={points:[[0,10,-2],[0,30,2]],radiusMm:1,oliveRadiusMm:2};
function cube(r=5,cy=20){return {vertices:new Float64Array([[-r,-r,-r],[r,-r,-r],[r,r,-r],[-r,r,-r],[-r,-r,r],[r,-r,r],[r,r,r],[-r,r,r]].flatMap(p=>[p[0],p[1]+cy,p[2]])),faces:new Uint32Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5])};}
function close(a,b){assert.equal(Number.isNaN(a),Number.isNaN(b));if(Number.isNaN(a))return;assert.ok(Math.abs(a-b)<=1e-9+1e-12*Math.abs(a),`${a} != ${b}`);}
const summaries=[];
test('analytic finite ray: cube path, nesting and finite capsule union',async()=>{const m=prepareMeshes(cube(),cube(3)),r=await createRustRenderer({wasmBytes,meshes:m});const s=[0,20,20],d=[0,20,-20],a=integrateRay(m,s,d,wire),b=r.probeRay(s,d,wire);assert.equal(b.valid,a.valid);assert.equal(a.outer,10);for(const k of keys)close(a[k],b[k]);r.dispose();});
test('strict crossing degenerate boundaries, coplanar, tangent and finite clipping',async()=>{const m=prepareMeshes(cube(),cube(3)),r=await createRustRenderer({wasmBytes,meshes:m});for(const [s,d,maxT] of [[[0,20,20],[0,0,-1],40],[[5,20,20],[0,0,-1],40],[[5,25,20],[0,0,-1],40],[[0,20,0],[0,0,-1],2],[[7,20,20],[0,0,-1],40],[[0,20,20],[1e-16,0,-1],40]]){const a=meshIntervals(m.outer,s,d,maxT),b=r.probeMesh(s,d,maxT);assert.equal(b.valid,a.valid);if(a.valid){assert.equal(b.intervals.length,a.intervals.length);a.intervals.forEach((v,i)=>v.forEach((x,j)=>close(x,b.intervals[i][j])));}else assert.equal(b.reason,a.reason);}r.dispose();});
test('wire tangent, axial, zero-length segment, clipped and asymmetric rays',async()=>{const m=prepareMeshes(cube(),cube(3)),r=await createRustRenderer({wasmBytes,meshes:m});for(const w of [wire,{points:[[0,0,0],[0,0,0]],radiusMm:1,oliveRadiusMm:1}])for(const [s,d,t] of [[[1,0,4],[0,0,-1],8],[[0,0,4],[0,0,-1],3.5],[[0,0,4],[0,0,-1],8],[[.2,17,13],[.1,.2,-Math.sqrt(.95)],30]]){const a=wireIntervals(s,d,t,w),b=r.probeWire(s,d,t,w);assert.equal(b.length,a.length);a.forEach((v,i)=>v.forEach((x,j)=>close(x,b[i][j])));}r.dispose();});
test('invalid nesting yields matching NaNs, frame invalid decisions and exact pixels',async()=>{const m=prepareMeshes(cube(3),cube(5)),r=await createRustRenderer({wasmBytes,meshes:m}),pose={orbit:0,angulation:0},params={pivot:[0,20,0],fieldMm:20};const a=renderPose(m,wire,pose,17,params),b=r.renderPose(wire,pose,17,params),c=compareFrames(a,b);summaries.push({id:'invalid-nesting',...c,invalidCount:a.invalidCount});assert.ok(a.invalidCount>0);assert.deepEqual(c.errors,[]);assert.ok(c.ok,JSON.stringify(c));r.dispose();});
test('input validation and returned buffers remain owned after later renders/disposal',async()=>{const m=prepareMeshes(cube(),cube(3)),r=await createRustRenderer({wasmBytes,meshes:m});assert.throws(()=>r.renderPose(wire,{orbit:0,angulation:61},8));assert.throws(()=>r.probeRay([0,0,0],[0,0,0],wire));assert.throws(()=>r.probeRay([NaN,0,0],[0,0,1],wire));assert.throws(()=>r.renderPose({...wire,radiusMm:0},{orbit:0,angulation:0},8));const a=r.renderPose(wire,{orbit:0,angulation:0},8),saved=a.rgba.slice(),raw=a.arrays.outer.slice();r.renderPose(wire,{orbit:57,angulation:12},19);r.dispose();assert.deepEqual(a.rgba,saved);assert.deepEqual(a.arrays.outer,raw);assert.throws(()=>r.renderPose(wire,{orbit:0,angulation:0},8));});
test('whole-frame strict parity: eight required 320² and four asymmetric frames',async()=>{const base=new URL('../guidewire-fracture/',import.meta.url),lesson=JSON.parse(await readFile(new URL('lesson.json',base),'utf8')),outer=parseSTL(await readFile(new URL(lesson.models.outer.url,base))),canal=parseSTL(await readFile(new URL(lesson.models.canal.url,base))),m=prepareMeshes(outer,canal),r=await createRustRenderer({wasmBytes,meshes:m});for(const c of lesson.cases)for(const pose of [{orbit:0,angulation:0},{orbit:30,angulation:0},{orbit:90,angulation:0},{orbit:45,angulation:20},{orbit:137.25,angulation:-23.5},{orbit:281.7,angulation:37.1}]){const required=[0,30,90,45].includes(pose.orbit),size=required?320:97,params=required?lesson.camera:{...lesson.camera,pivot:[3.25,-7.5,2.75],fieldMm:217},a=renderPose(m,c.wire,pose,size,params),b=r.renderPose(c.wire,pose,size,params),comparison=compareFrames(a,b);summaries.push({id:c.id,pose,size,...comparison,invalidCount:a.invalidCount});assert.ok(comparison.ok,JSON.stringify(summaries.at(-1)));}assert.ok(r.memoryBytes()<=64*1024*1024,`Wasm capacity ${r.memoryBytes()} exceeds 64 MiB budget`);r.dispose();});
test('complete invalid nesting diagnostics match the strict reference, including crossing intervals and ray geometry',async()=>{
 const m=prepareMeshes(cube(3),cube(5)),r=await createRustRenderer({wasmBytes,meshes:m}),pose={orbit:0,angulation:0},params={pivot:[0,20,0],fieldMm:20};
 const expected=renderPose(m,wire,pose,17,params),actual=r.renderPose(wire,pose,17,params);
 assert.ok(expected.invalidCount>0);assert.deepEqual(actual.invalidRays,expected.invalidRays);r.dispose();
});
test('invalid ray and mesh probes preserve face IDs, distances and both boundary diagnostics',async()=>{
 const m=prepareMeshes(cube(),cube(3)),r=await createRustRenderer({wasmBytes,meshes:m});
 for(const s of [[5,20,20],[5,25,20]]){
  assert.deepEqual(r.probeMesh(s,[0,0,-1],40),meshIntervals(m.outer,s,[0,0,-1],40));
  assert.deepEqual(r.probeRay(s,[s[0],s[1],-20],wire),integrateRay(m,s,[s[0],s[1],-20],wire));
 }r.dispose();
});
test.after(async()=>{if(process.env.PARALLAX_PARITY_OUTPUT)await writeFile(process.env.PARALLAX_PARITY_OUTPUT,JSON.stringify({gate:'abs <= 1e-9 + 1e-12*abs(reference); NaN correspondence; exact RGBA and invalid coordinates',summaries},null,2)+'\n',{flag:'wx'});});
