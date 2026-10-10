import {parseOBJ,buildMesh,previewGeometry,renderMeshProjection,MU_SHELL,MU_CORE,MU_UNIFORM,SOURCE_ORIGIN} from './geometry.mjs?bp3d-cortex-v001';
let initialisation;
async function initialise(){
  const start=performance.now(),metrics={assets:{},workerTimeOrigin:performance.timeOrigin};
  const response=await fetch(new URL('./bp3d-cortex-v001/manifest.json',import.meta.url));
  if(!response.ok)throw new Error(`Asset manifest HTTP ${response.status}`);
  const manifest=await response.json(),meshes={};
  for(const name of ['outer','core']){
    const record=manifest[name];
    if(!record||!['femur.obj','core.obj'].includes(record.file)||!/^[a-f0-9]{64}$/.test(record.sha256))throw new Error('Invalid asset manifest');
    const url=new URL('./bp3d-cortex-v001/'+record.file,import.meta.url),fetchStart=performance.now();
    const r=await fetch(url);if(!r.ok)throw new Error(`${name} asset HTTP ${r.status}`);
    const bytes=await r.arrayBuffer(),fetchMs=performance.now()-fetchStart;
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==record.sha256)throw new Error(`${name} asset hash mismatch; no substitute permitted`);
    const parseStart=performance.now(),parsed=previewGeometry(parseOBJ(new TextDecoder().decode(bytes))),parseMs=performance.now()-parseStart,buildStart=performance.now();
    meshes[name]=buildMesh(parsed);
    metrics.assets[name]={bytes:bytes.byteLength,sha256:hash,fetchMs,parseMs,buildMs:performance.now()-buildStart};
  }
  metrics.sourceOrigin=SOURCE_ORIGIN;metrics.totalInitMs=performance.now()-start;
  const vertices=meshes.outer.vertices.slice(),faces=meshes.outer.faces.slice();
  self.postMessage({type:'ready',metrics,vertices,faces},[vertices.buffer,faces.buffer]);
  return {...meshes,metrics,manifest};
}
self.onmessage=async({data:job})=>{
  try{
    initialisation??=initialise().catch(error=>{initialisation=null;throw error;});
    const {outer,core,metrics,manifest}=await initialisation;
    const start=performance.now(),frame=renderMeshProjection(outer,core,job.pose,{size:job.size});
    frame.renderMs=performance.now()-start;
    if(frame.invalidCount!==0){self.postMessage({id:job.id,error:`Projection rejected: ${frame.invalidCount} unresolved rays`,diagnostics:{invalidCount:frame.invalidCount,invalidRays:frame.invalidRays,pose:frame.pose}});return;}
    frame.initialisation=metrics;frame.assetHashes={outer:manifest.outer.sha256,core:manifest.core.sha256};frame.sourceOrigin=SOURCE_ORIGIN;
    frame.material={kind:'authored cortex/core versus uniform',shell:MU_SHELL,core:MU_CORE,uniform:MU_UNIFORM,units:'mm^-1',mapping:'round(255*(1-exp(-A)))'};
    self.postMessage({id:job.id,frame},[frame.pixels.buffer,frame.uniformPixels.buffer]);
  }catch(error){self.postMessage({id:job.id,error:error.message});}
};
