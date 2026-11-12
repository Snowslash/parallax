// Test-only isolate. The production worker and every integrity/retry assertion are unchanged.
import {parentPort,workerData} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {pins,target}=workerData;let mode=workerData.mode,messages=[],fetches=0;
const base=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const m=await import('../femur-lesson/model.mjs'),job={id:7,caseId:'central-deep',pose:m.DEFAULT_LESSON_POSE,size:32};
const manifest=Object.fromEntries(Object.entries(pins).map(([k,[file,sha256]])=>[k,{file,sha256}]));
globalThis.self={postMessage:x=>messages.push(x)};
globalThis.fetch=async url=>{fetches++;const file=new URL(url).pathname.split('/').at(-1),copy=structuredClone(manifest);
 if(file==='manifest.json'){if(mode==='missing-record')delete copy[target];if(mode==='coordinated'){const b=await readFile(new URL('femur-lesson/assets/'+pins[target][0],base));b[50]^=1;copy[target].sha256=hash(b);}return {ok:true,json:async()=>copy};}
 if(mode==='missing'&&file===pins[target][0])return {ok:false,status:404};
 const b=new Uint8Array(await readFile(new URL('femur-lesson/assets/'+file,base)));if(['tamper','coordinated'].includes(mode)&&file===pins[target][0])b[50]^=1;return {ok:true,arrayBuffer:async()=>b.buffer};
};
await import('../femur-lesson/worker.mjs');await self.onmessage({data:job});
assert.ok(messages.at(-1)?.error,target+'/'+mode);assert.ok(!messages.some(x=>x.frame||x.type==='ready'));assert.match(messages.at(-1).error,/hash mismatch|manifest|HTTP/);
mode='good';messages=[];await self.onmessage({data:job});assert.equal(messages[0]?.type,'ready');assert.equal(messages.at(-1)?.frame?.invalidCount,0);for(const [k,[,pin]]of Object.entries(pins))assert.equal(messages.at(-1).frame.assetHashes[k],pin);
const before=fetches;for(const data of [null,{...job,caseId:'absent'},{...job,size:NaN}]){messages=[];await self.onmessage({data});assert.ok(messages.at(-1).error);}assert.equal(fetches,before);
parentPort.postMessage({target,mode:workerData.mode,passed:true});
