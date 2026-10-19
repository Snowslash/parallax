import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../',import.meta.url),load=p=>import(new URL(p,base));
const hash=b=>createHash('sha256').update(b).digest('hex');
const pins={outer:['outer.obj','296926ae65829ad19d4c778942917532a25763b152fdedbd6d3a7d83d8a66117'],envelope:['envelope.obj','c57021b50cdddb0a42f9a659afa3bd52140faa22d444f87a6b50c797c20cc674'],density:['density.u8','ffb98c0ac02e9c36f078a9d2901e57683c94d914b0455917600f12cd2842f93a'],densityInfo:['density.json','206f15536b3eece33e1e6a0973d04814fe947cab19d23fe8d3853136e8cc568e']};
const expected=['83ce1cb6032dafabd5e8188b1c53d778e0ff45d06f48d628d845c63226f1ae40','6fc770687e0a86f9d1ddf4236d0878265b15efb00de58c2afe7f2bd55e0c9e15','0a54b1694d81520406b7e595f0e0d0c34a5d9b8ca90961bbe7b405a47db24ebf','6d694ac1da4abe90be98613f90b27d425d5ddaa485d473f0681ed0707fe3a8cb','1ff13360d3ae9eb59ce743f893c9c62e5c0b5fa5470cc93d483e5c058df887fd','4cd82305832712e26a70b3fbb3724c79385a85bb2cdbaa8526d242d7367a9381'];
test('reviewed CT model has 105 mm wires and fixed radius',async()=>{const m=await load('femur-lesson/model.mjs');for(const c of m.CASES){assert.ok(Math.abs(Math.hypot(...c.wire.tip.map((v,i)=>v-c.wire.start[i]))-105)<1e-9);assert.equal(c.wire.radius,1);}});
test('six 256 square frames retain reviewed exact pixels',async()=>{
 const engine=await load('femur-lesson/ct/integrator.mjs').catch(()=>null);assert.ok(engine,'lesson-local strict CT engine required');
 const {renderLessonProjection}=await load('femur-lesson/geometry.mjs'),m=await load('femur-lesson/model.mjs');
 const bytes={};for(const [key,[file,pin]]of Object.entries(pins)){bytes[key]=await readFile(new URL('femur-lesson/assets/'+file,base));assert.equal(hash(bytes[key]),pin);}
 const outer=engine.buildMesh(engine.parseOBJ(bytes.outer.toString())),envelope=engine.buildMesh(engine.parseOBJ(bytes.envelope.toString())),field={...JSON.parse(bytes.densityInfo),data:new Uint8Array(bytes.density)};
 let i=0;for(const c of m.CASES)for(const view of ['ap','lateral']){const f=renderLessonProjection(outer,envelope,c.id,m.REFERENCE_POSES[view],{size:256,field});assert.equal(f.invalidCount,0);assert.equal(hash(f.pixels),expected[i++],c.id+'/'+view);}assert.equal(i,6);
 assert.throws(()=>renderLessonProjection(outer,envelope,'central-deep',m.DEFAULT_LESSON_POSE,{size:32}),/density/);
});
test('actual worker rejects tampered or missing fields and coordinated manifest replacement, then retries',async()=>{
 const saved={self:globalThis.self,fetch:globalThis.fetch};let messages=[],mode='good',target='density',fetches=0;
 const m=await load('femur-lesson/model.mjs'),job={id:7,caseId:'central-deep',pose:m.DEFAULT_LESSON_POSE,size:32};
 const manifest=Object.fromEntries(Object.entries(pins).map(([k,[file,sha256]])=>[k,{file,sha256}]));
 globalThis.self={postMessage:x=>messages.push(x)};
 globalThis.fetch=async url=>{fetches++;const file=new URL(url).pathname.split('/').at(-1),copy=structuredClone(manifest);
  if(file==='manifest.json'){if(mode==='missing-record')delete copy[target];if(mode==='coordinated'){const b=await readFile(new URL('femur-lesson/assets/'+pins[target][0],base));b[50]^=1;copy[target].sha256=hash(b);}return {ok:true,json:async()=>copy};}
  if(mode==='missing'&&file===pins[target][0])return {ok:false,status:404};
  const b=new Uint8Array(await readFile(new URL('femur-lesson/assets/'+file,base)));if(['tamper','coordinated'].includes(mode)&&file===pins[target][0])b[50]^=1;return {ok:true,arrayBuffer:async()=>b.buffer};
 };
 try{
  for(target of Object.keys(pins))for(mode of ['tamper','coordinated','missing','missing-record']){
   messages=[];await import(new URL('femur-lesson/worker.mjs?test='+target+'-'+mode,base));await self.onmessage({data:job});assert.ok(messages.at(-1)?.error,target+'/'+mode);assert.ok(!messages.some(x=>x.frame||x.type==='ready'));assert.match(messages.at(-1).error,/hash mismatch|manifest|HTTP/);
   mode='good';messages=[];await self.onmessage({data:job});assert.equal(messages[0]?.type,'ready');assert.equal(messages.at(-1)?.frame?.invalidCount,0);for(const [k,[,pin]]of Object.entries(pins))assert.equal(messages.at(-1).frame.assetHashes[k],pin);
  }
  const before=fetches;for(const data of [null,{...job,caseId:'absent'},{...job,size:NaN}]){messages=[];await self.onmessage({data});assert.ok(messages.at(-1).error);}assert.equal(fetches,before);
 }finally{globalThis.self=saved.self;globalThis.fetch=saved.fetch;}
});
