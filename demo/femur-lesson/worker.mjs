import {parseOBJ,buildMesh} from './ct/integrator.mjs';
import {validateField} from './ct/material.mjs';
import {caseForId,validatePose} from './model.mjs';
import {renderLessonProjection} from './geometry.mjs';
const FILES=Object.freeze({outer:'outer.obj',envelope:'envelope.obj',density:'density.u8',densityInfo:'density.json'});
// Release pins are independent of the fetched manifest: replacing both cannot authorize new anatomy.
const EXPECTED=Object.freeze({outer:'296926ae65829ad19d4c778942917532a25763b152fdedbd6d3a7d83d8a66117',envelope:'c57021b50cdddb0a42f9a659afa3bd52140faa22d444f87a6b50c797c20cc674',density:'ffb98c0ac02e9c36f078a9d2901e57683c94d914b0455917600f12cd2842f93a',densityInfo:'206f15536b3eece33e1e6a0973d04814fe947cab19d23fe8d3853136e8cc568e'});
let initialisation;
async function initialise(){
  const start=performance.now(),metrics={assets:{},workerTimeOrigin:performance.timeOrigin},loaded={};
  const response=await fetch(new URL('./assets/manifest.json',import.meta.url));
  if(!response.ok)throw new Error(`Manifest HTTP ${response.status}`);
  const manifest=await response.json();
  for(const [name,file]of Object.entries(FILES)){
    const record=manifest?.[name];
    if(record?.file!==file||record?.sha256!==EXPECTED[name])throw new Error('Invalid model manifest: pinned hash mismatch');
    const r=await fetch(new URL('./assets/'+file,import.meta.url));if(!r.ok)throw new Error(`${name} asset HTTP ${r.status}`);
    const bytes=await r.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==record.sha256)throw new Error(`${name} asset hash mismatch; no substitute permitted`);
    loaded[name]=bytes;metrics.assets[name]={sha256:hash,bytes:bytes.byteLength};
  }
  const decode=bytes=>new TextDecoder().decode(bytes);
  const outer=buildMesh(parseOBJ(decode(loaded.outer))),envelope=buildMesh(parseOBJ(decode(loaded.envelope)));
  const field=validateField({...JSON.parse(decode(loaded.densityInfo)),data:new Uint8Array(loaded.density)});
  metrics.totalInitMs=performance.now()-start;
  const vertices=outer.vertices.slice(),faces=outer.faces.slice();
  self.postMessage({type:'ready',metrics,vertices,faces},[vertices.buffer,faces.buffer]);
  return {outer,envelope,field,metrics};
}
self.onmessage=async({data:job})=>{
  try{
    if(!job||typeof job!=='object'||!Number.isSafeInteger(job.id)||job.id<0)throw new TypeError('Invalid lesson request ID');
    caseForId(job.caseId);validatePose(job.pose);
    const size=job.size??256;if(!Number.isInteger(size)||size<16||size>512)throw new RangeError('Invalid render size');
    initialisation??=initialise().catch(e=>{initialisation=null;throw e;});
    const {outer,envelope,field,metrics}=await initialisation,start=performance.now();
    const frame=renderLessonProjection(outer,envelope,job.caseId,job.pose,{size,field});
    frame.id=job.id;frame.renderMs=performance.now()-start;
    if(frame.invalidCount){self.postMessage({id:job.id,error:`Projection rejected: ${frame.invalidCount} unresolved rays`,diagnostics:{invalidCount:frame.invalidCount,invalidRays:frame.invalidRays,pose:frame.pose}});return;}
    frame.assetHashes=Object.fromEntries(Object.entries(metrics.assets).map(([k,v])=>[k,v.sha256]));frame.initialisation=metrics;
    self.postMessage({id:job.id,frame},[frame.pixels.buffer]);
  }catch(error){self.postMessage({id:job?.id,error:error.message});}
};
