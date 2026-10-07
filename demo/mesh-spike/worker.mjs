import {parseOBJ,buildMesh,renderMeshProjection} from './geometry.mjs';
const ASSETS={outer:'1367defee70c21312f504b42d07d2e2208e0ec2d2aa309bcb0ed3eace32fda4d',core:'05a504a797ef08d37aef092dba0de1c187b9a7a43d94c808489e35bb9abc8a99'};
let initialisation;
async function initialise(){
  const start=performance.now(),metrics={assets:{},workerTimeOrigin:performance.timeOrigin};
  const meshes={};
  for(const name of ['outer','core']){
    const url=new URL(`./assets/${name}.obj`,import.meta.url),fetchStart=performance.now();
    const response=await fetch(url);if(!response.ok)throw new Error(`${name} asset HTTP ${response.status}`);
    const bytes=await response.arrayBuffer(),fetchMs=performance.now()-fetchStart,hashStart=performance.now();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==ASSETS[name])throw new Error(`${name} frozen asset hash mismatch; no substitute permitted`);
    const hashMs=performance.now()-hashStart,parseStart=performance.now(),parsed=parseOBJ(new TextDecoder().decode(bytes)),parseMs=performance.now()-parseStart,buildStart=performance.now();
    meshes[name]=buildMesh(parsed);
    const buildMs=performance.now()-buildStart,resource=performance.getEntriesByName(url.href).at(-1);
    metrics.assets[name]={bytes:bytes.byteLength,sha256:hash,fetchMs,hashMs,parseMs,buildMs,transferSize:resource?.transferSize??null,encodedBodySize:resource?.encodedBodySize??null,decodedBodySize:resource?.decodedBodySize??null};
  }
  metrics.totalInitMs=performance.now()-start;
  const vertices=meshes.outer.vertices.slice(),faces=meshes.outer.faces.slice();
  self.postMessage({type:'ready',metrics,vertices,faces},[vertices.buffer,faces.buffer]);
  return {...meshes,metrics};
}
self.onmessage=async({data:job})=>{
  try{
    initialisation??=initialise().catch(error=>{initialisation=null;throw error;});
    const {outer,core,metrics}=await initialisation;
    const start=performance.now(),frame=renderMeshProjection(outer,core,job.pose,{size:job.size});
    frame.renderMs=performance.now()-start;
    if(frame.invalidCount!==0){self.postMessage({id:job.id,error:`Projection rejected: ${frame.invalidCount} unresolved rays`,diagnostics:{invalidCount:frame.invalidCount,invalidRays:frame.invalidRays,pose:frame.pose}});return;}
    frame.initialisation=metrics;frame.assetHashes=ASSETS;
    frame.material={muShell:.04,muCore:.008,units:'mm^-1',mapping:'round(255*(1-exp(-A)))'};
    self.postMessage({id:job.id,frame},[frame.pixels.buffer]);
  }catch(error){self.postMessage({id:job.id,error:error.message});}
};
