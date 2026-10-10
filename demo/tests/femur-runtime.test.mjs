import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=n=>readFile(new URL(`../mesh-spike/${n}.mjs`,import.meta.url),'utf8');
test('changed module chain and worker use one version token; assets have new URLs',async()=>{
  for(const [file,imports] of [['app',['geometry','view','transport','presentation']],['view',['geometry']],['worker',['geometry']],['transport',['worker']],['geometry',['integrator']]]){
    const s=await source(file);for(const name of imports)assert.ok(s.includes(`./${name}.mjs?bp3d-cortex-v001`),`${file} -> ${name}`);
  }
  const worker=await source('worker');assert.ok(worker.includes('./bp3d-cortex-v001/manifest.json'));assert.ok(!worker.includes('./assets/'));
});
test('hash failures never parse, render or substitute; unresolved frames never publish pixels',async()=>{
  const s=(await source('worker')).replace(/^import .*;\n/,'').replaceAll('import.meta.url',"'http://localhost/mesh-spike/worker.mjs'");
  for(const validHash of [false,true]){
    const messages=[];let parses=0,renders=0;
    const hash='a'.repeat(64),context={URL,performance,TextDecoder,Uint8Array,crypto:{subtle:{digest:async()=>new Uint8Array(32).fill(validHash?170:0).buffer}},fetch:async url=>String(url).endsWith('manifest.json')?{ok:true,json:async()=>({outer:{file:'femur.obj',sha256:hash},core:{file:'core.obj',sha256:hash}})}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(1)},parseOBJ:()=>{parses++;return {};},previewGeometry:x=>x,buildMesh:()=>({vertices:new Float64Array(3),faces:new Uint32Array(3)}),renderMeshProjection:()=>{renders++;return {invalidCount:1,invalidRays:[{row:0,col:0}],pose:{}};},MU_SHELL:.04,MU_CORE:.008,MU_UNIFORM:.02,SOURCE_ORIGIN:[0,0,0],self:{postMessage:m=>messages.push(m)}};
    vm.runInNewContext(s,context);await context.self.onmessage({data:{id:7,pose:{},size:128}});
    const last=messages.at(-1);assert.equal(last.id,7);assert.equal(last.frame,undefined);
    if(validHash){assert.equal(parses,2);assert.equal(renders,1);assert.match(last.error,/Projection rejected/);assert.equal(last.diagnostics.invalidCount,1);}else{assert.equal(parses,0);assert.equal(renders,0);assert.match(last.error,/hash mismatch/);}
  }
});
test('material switch keeps same frame and validates both buffers',async()=>{
  const {pixelBuffer}=await import('../mesh-spike/presentation.mjs'),f={width:1,height:1,pixels:new Uint8ClampedArray([1,1,1,255]),uniformPixels:new Uint8ClampedArray([2,2,2,255])};
  assert.equal(pixelBuffer(f,'layered'),f.pixels);assert.equal(pixelBuffer(f,'uniform'),f.uniformPixels);assert.throws(()=>pixelBuffer(f,'other'));assert.throws(()=>pixelBuffer({...f,uniformPixels:null},'uniform'));
});
