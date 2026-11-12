import {normalizePose} from './camera.mjs';
import {parseSTL,prepareMeshes,oliveInFrame} from './render-core.mjs';
import {createEngine} from './engine.mjs';
import {WASM_SHA256} from './wasm/identity.mjs';
// The handler owns initialization and engine lifetime; the transport owns Worker lifetime.
export function createWorkerHandler({lessonSHA256,baseURL,fetch=globalThis.fetch,crypto=globalThis.crypto,engine='js'}){
 let initialization,renderer=null,disposed=false;
 const abort=new AbortController();
 function active(){if(disposed)throw Error('Worker disposed');}
 async function verified(path,expected){
  active();if(!/^[a-f0-9]{64}$/.test(expected))throw Error('Invalid hash identity');
  const url=new URL(path,baseURL);if(url.origin!==new URL(baseURL).origin)throw Error('Cross-origin asset rejected');
  const response=await fetch(url,{cache:'no-store',signal:abort.signal});active();if(!response.ok)throw Error(`Asset fetch failed: ${path}`);
  const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  active();if(hash!==expected)throw Error(`Asset hash mismatch: ${path}`);return bytes;
 }
 async function initialize(){
  const lesson=JSON.parse(new TextDecoder().decode(await verified('lesson.json',lessonSHA256)));
  // Re-read and re-verify after a Wasm runtime failure; no retained JS geometry or input buffers.
  const loadMeshes=async()=>{
   const outer=await verified(lesson.models.outer.url,lesson.models.outer.sha256),canal=await verified(lesson.models.canal.url,lesson.models.canal.sha256);
   active();return prepareMeshes(parseSTL(outer),parseSTL(canal));
  };
  const candidate=await createEngine({engine,loadMeshes,loadWasm:()=>verified('wasm/renderer.wasm',WASM_SHA256)});
  if(disposed){candidate.dispose();active();}renderer=candidate;
  return {lesson,renderer};
 }
 async function handle(message,post){
  const {id,caseId}=message||{};let pose=message?.pose,result;
  try{
   active();if(message?.type!=='render')throw Error('Unknown worker request type');
   if(!(Number.isSafeInteger(id)&&id>=0)&&!(typeof id==='string'&&id.length>0&&id.length<=128))throw Error('Invalid request ID');
   if(message.size!==320)throw Error('Only 320 pixel frames supported');
   if(typeof caseId!=='string')throw Error('Invalid case ID');
   pose=normalizePose(pose);
   initialization??=initialize();const {lesson,renderer}=await initialization;active();
   const selected=lesson.cases.find(c=>c.id===caseId);if(!selected)throw Error('Unknown case ID');
   const start=performance.now(),rendered=await renderer.renderPose(selected.wire,pose,320,lesson.camera);active();
   if(rendered.invalidCount!==0)throw Error(`Strict renderer rejected ${rendered.invalidCount} invalid rays`);
   const pixels=new Uint8ClampedArray(rendered.rgba.buffer,rendered.rgba.byteOffset,rendered.rgba.byteLength);
   result={type:'frame',id,caseId,pose,frame:{width:rendered.width,height:rendered.height,pixels,camera:rendered.camera,invalidCount:0,elapsedMs:performance.now()-start,framing:{oliveInFrame:oliveInFrame(selected.wire,rendered.camera)},engine:renderer.info()}};
  }catch(error){result={type:'error',id,caseId,pose,error:String(error.message||error)};}
  if(post&&!disposed)post(result,result.type==='frame'?[result.frame.pixels.buffer]:[]);
  return result;
 }
 handle.dispose=()=>{if(disposed)return;disposed=true;abort.abort();renderer?.dispose();renderer=null;initialization=null;};
 return handle;
}
