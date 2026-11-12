// Fresh-process memory and end-to-end handler measurements (not browser/phone RAM).
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
const [mode,output]=process.argv.slice(2);assert.ok(['js','wasm','fallback','baseline'].includes(mode));assert.equal(typeof global.gc,'function');
const root=mode==='baseline'?pathToFileURL(resolve(process.env.BASELINE_ROOT)+'/'):new URL('../../',import.meta.url),base=new URL('demo/guidewire-fracture/',root);
const {createWorkerHandler}=await import(new URL('worker-core.mjs',base)),{LESSON_SHA256}=await import(new URL('identity.mjs',base));
const sha=b=>createHash('sha256').update(b).digest('hex');
const lessonBytes=await readFile(new URL('lesson.json',base));assert.equal(sha(lessonBytes),LESSON_SHA256);const lesson=JSON.parse(lessonBytes);
const snapshots=[],checkpoint=name=>{global.gc();snapshots.push({name,...process.memoryUsage(),maxRSSKiB:process.resourceUsage().maxRSS});};
const requests=[];const fetch=async url=>{requests.push(String(url));if(mode==='fallback'&&url.pathname.endsWith('/renderer.wasm'))throw Error('Synthetic Wasm load failure');const bytes=await readFile(url);return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
checkpoint('before');let handle=createWorkerHandler({lessonSHA256:LESSON_SHA256,baseURL:base,fetch,crypto:webcrypto,engine:mode==='wasm'||mode==='fallback'?'wasm':'js'});
let id=0,info;const samples=[];
async function render(c,pose,phase){const start=performance.now(),result=await handle({type:'render',id:++id,caseId:c.id,pose,size:320}),elapsedMs=performance.now()-start;assert.equal(result.type,'frame',result.error);info=result.frame.engine??null;samples.push({caseId:c.id,pose,phase,elapsedMs,calculationMs:result.frame.elapsedMs,pixelSHA256:sha(result.frame.pixels)});}
await render(lesson.cases[0],{orbit:0,angulation:0},'first');checkpoint('initialized');
for(const c of lesson.cases)for(const pose of [{orbit:0,angulation:0},{orbit:30,angulation:0},{orbit:90,angulation:0},{orbit:45,angulation:20}])await render(c,pose,'warm');
checkpoint('afterFrames');handle.dispose?.();handle=null;checkpoint('disposed');
const report={at:new Date().toISOString(),mode,node:process.version,hardware:os.cpus()[0].model,load:os.loadavg(),info,snapshots,samples,requests:requests.length,limitations:'Fresh Node process; forced-GC heap/external/arrayBuffers and process RSS/high-water, not live-object accounting or physical-phone evidence.'};
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
