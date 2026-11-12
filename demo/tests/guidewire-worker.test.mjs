import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {createWorkerHandler} from '../guidewire-fracture/worker-core.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const wasm=await readFile(new URL('../guidewire-fracture/wasm/renderer.wasm',import.meta.url));
function stl(r){
 const v=[[-r,-r,-r],[r,-r,-r],[r,r,-r],[-r,r,-r],[-r,-r,r],[r,-r,r],[r,r,r],[-r,r,r]].map(p=>[p[0],p[1]+20,p[2]]),faces=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5],b=Buffer.alloc(84+50*faces.length/3);b.writeUInt32LE(faces.length/3,80);
 for(let i=0;i<faces.length;i++)for(let k=0;k<3;k++)b.writeFloatLE(v[faces[i]][k],84+50*Math.floor(i/3)+12+12*(i%3)+4*k);return b;
}
function fixture({engine='js',corrupt=null,nesting=false,fetchHook}={}){
 const outer=stl(nesting?3:5),canal=stl(nesting?5:3),models={outer:{url:'outer.stl',sha256:hash(outer)},canal:{url:'canal.stl',sha256:hash(canal)}},lesson=Buffer.from(JSON.stringify({models,camera:{pivot:[0,20,0],fieldMm:20},cases:[{id:'case-a',wire:{points:[[0,10,-2],[0,30,2]],radiusMm:1,oliveRadiusMm:2}}]}));
 const files={'lesson.json':lesson,'outer.stl':outer,'canal.stl':canal,'wasm/renderer.wasm':wasm},requests=[];
 const fetch=async url=>{const path=url.pathname.slice(1);requests.push(path);if(fetchHook)await fetchHook(path);const bytes=corrupt===path?Buffer.from('corrupt'):files[path];return {ok:!!bytes,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
 const handle=createWorkerHandler({baseURL:'https://fixture.invalid/',lessonSHA256:hash(lesson),fetch,crypto:webcrypto,engine});return {handle,requests};
}
const request=(extra={})=>({type:'render',id:1,caseId:'case-a',pose:{orbit:30,angulation:0},size:320,...extra});
test('real worker defaults to JS, preserves protocol and transfers only independent pixels',async()=>{
 const {handle,requests}=fixture();let sent;const a=await handle(request(),(m,transfer)=>sent={m,transfer});assert.equal(a.type,'frame');assert.equal(a.frame.engine?.active,'js');assert.equal(a.frame.engine.requested,'js');assert.equal(sent.transfer.length,1);assert.equal(sent.transfer[0]===a.frame.pixels.buffer,true);assert.ok(!requests.includes('wasm/renderer.wasm'));
 const copy=a.frame.pixels.slice();await handle(request({id:2,pose:{orbit:90,angulation:0}}));assert.equal(a.frame.pixels.length,copy.length);assert.ok(a.frame.pixels.every((v,i)=>v===copy[i]),'earlier pixels remain owned');handle.dispose();
});
test('real opt-in worker produces identical pixels and metadata with verified Wasm',async()=>{
 const js=fixture(),rust=fixture({engine:'wasm'});const a=await js.handle(request()),b=await rust.handle(request());assert.equal(b.type,'frame');assert.equal(b.frame.engine?.active,'wasm');assert.equal(b.frame.engine.retainedJSGeometry,false);assert.equal(b.frame.pixels.length,a.frame.pixels.length);assert.ok(b.frame.pixels.every((v,i)=>v===a.frame.pixels[i]),'exact worker pixels');assert.deepEqual(b.frame.camera,a.frame.camera);assert.deepEqual(b.pose,a.pose);assert.equal(b.caseId,a.caseId);js.handle.dispose();rust.handle.dispose();
});
test('Wasm integrity/load failure is visible JS fallback, not an integrity bypass',async()=>{
 const {handle}=fixture({engine:'wasm',corrupt:'wasm/renderer.wasm'}),a=await handle(request());assert.equal(a.type,'frame');assert.equal(a.frame.engine?.active,'js');assert.equal(a.frame.engine.requested,'wasm');assert.match(a.frame.engine.fallbackReason,/hash mismatch/);handle.dispose();
});
test('model integrity failure remains fatal for either engine',async()=>{
 for(const engine of ['js','wasm']){const {handle}=fixture({engine,corrupt:'outer.stl'}),r=await handle(request());assert.equal(r.type,'error');assert.match(r.error,/hash mismatch/);handle.dispose?.();}
});
test('case, pose, size and request ID rejection remain fail closed',async()=>{
 for(const engine of ['js','wasm']){const {handle}=fixture({engine});for(const extra of [{id:-1},{caseId:'other'},{pose:{orbit:0,angulation:61}},{size:319},{type:'anything'}]){const r=await handle(request(extra));assert.equal(r.type,'error');}handle.dispose?.();}
});
test('a successful Wasm call with invalid rays cannot publish a frame',async()=>{
 for(const engine of ['js','wasm']){const {handle}=fixture({engine,nesting:true}),r=await handle(request());assert.equal(r.type,'error');assert.match(r.error,/Strict renderer rejected \d+ invalid rays/);handle.dispose?.();}
});
test('disposal during initialization suppresses late delivery',async()=>{
 let release;const wait=new Promise(r=>release=r),{handle}=fixture({fetchHook:()=>wait}),posted=[];
 const pending=handle(request(),m=>posted.push(m));handle.dispose?.();release();await pending;assert.equal(posted.length,0,'disposed initialization must not deliver a frame');const after=await handle(request({id:2}));assert.equal(after.type,'error');assert.match(after.error,/disposed/);
});
