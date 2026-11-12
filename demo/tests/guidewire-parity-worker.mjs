// Raw-array parity only; headline timing uses the actual application's worker.mjs.
import {LESSON_SHA256} from '../guidewire-fracture/identity.mjs';
import {createEngine} from '../guidewire-fracture/engine.mjs';
import {WASM_SHA256} from '../guidewire-fracture/wasm/identity.mjs';
import {normalizePose} from '../guidewire-fracture/camera.mjs';
import {parseSTL,prepareMeshes} from '../guidewire-fracture/render-core.mjs';
const engine=new URL(import.meta.url).searchParams.get('engine')||'js',base=new URL('../guidewire-fracture/',import.meta.url);
async function verified(path,hash){const res=await fetch(new URL(path,base),{cache:'no-store'});if(!res.ok)throw Error('Fetch failed');const b=await res.arrayBuffer(),got=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');if(got!==hash)throw Error('Hash mismatch');return b;}
let init;
async function initialize(){const lesson=JSON.parse(new TextDecoder().decode(await verified('lesson.json',LESSON_SHA256)));const renderer=await createEngine({engine,loadWasm:()=>verified('wasm/renderer.wasm',WASM_SHA256),loadMeshes:async()=>prepareMeshes(parseSTL(await verified(lesson.models.outer.url,lesson.models.outer.sha256)),parseSTL(await verified(lesson.models.canal.url,lesson.models.canal.sha256)))});return {lesson,renderer};}
self.onmessage=async({data:m})=>{
 try{
  if(m.type!=='render'||!Number.isSafeInteger(m.id)||m.size!==320)throw Error('Invalid request');const pose=normalizePose(m.pose);
  init??=initialize();const {lesson,renderer}=await init,c=lesson.cases.find(c=>c.id===m.caseId);if(!c)throw Error('Invalid case');
  const frame=await renderer.renderPose(c.wire,pose,320,lesson.camera),transfers=[frame.rgba.buffer,...Object.values(frame.arrays).map(a=>a.buffer)];
  self.postMessage({id:m.id,type:'raw',...frame,engine:renderer.info()},transfers);
 }catch(error){self.postMessage({type:'error',id:m.id,error:String(error)});}
};
