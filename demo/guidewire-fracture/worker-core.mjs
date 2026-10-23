import {normalizePose} from './camera.mjs';
import {parseSTL,prepareMeshes,renderPose,oliveInFrame} from './render-core.mjs';
// Injection is for the Node transport adapter only; production uses browser globals.
export function createWorkerHandler({lessonSHA256,baseURL,fetch=globalThis.fetch,crypto=globalThis.crypto}){
 let initialization;
 async function verified(path,expected){
  if(!/^[a-f0-9]{64}$/.test(expected))throw Error('Invalid hash identity');
  const url=new URL(path,baseURL);if(url.origin!==new URL(baseURL).origin)throw Error('Cross-origin asset rejected');
  const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error(`Asset fetch failed: ${path}`);
  const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==expected)throw Error(`Asset hash mismatch: ${path}`);return bytes;
 }
 async function initialize(){
  const lesson=JSON.parse(new TextDecoder().decode(await verified('lesson.json',lessonSHA256)));
  const outer=await verified(lesson.models.outer.url,lesson.models.outer.sha256),canal=await verified(lesson.models.canal.url,lesson.models.canal.sha256);
  return {lesson,meshes:prepareMeshes(parseSTL(outer),parseSTL(canal))};
 }
 return async function handle(message,post){
  const {id,caseId}=message||{};let pose=message?.pose,result;
  try{
   if(message?.type!=='render')throw Error('Unknown worker request type');
   if(!(Number.isSafeInteger(id)&&id>=0)&&!(typeof id==='string'&&id.length>0&&id.length<=128))throw Error('Invalid request ID');
   if(message.size!==320)throw Error('Only 320 pixel frames supported');
   if(typeof caseId!=='string')throw Error('Invalid case ID');
   pose=normalizePose(pose);
   initialization??=initialize();const {lesson,meshes}=await initialization;
   const selected=lesson.cases.find(c=>c.id===caseId);if(!selected)throw Error('Unknown case ID');
   const start=performance.now(),rendered=renderPose(meshes,selected.wire,pose,320,lesson.camera);
   if(rendered.invalidCount!==0)throw Error(`Strict renderer rejected ${rendered.invalidCount} invalid rays`);
   const pixels=new Uint8ClampedArray(rendered.rgba.buffer);
   result={type:'frame',id,caseId,pose,frame:{width:rendered.width,height:rendered.height,pixels,camera:rendered.camera,invalidCount:0,elapsedMs:performance.now()-start,framing:{oliveInFrame:oliveInFrame(selected.wire,rendered.camera)}}};
  }catch(error){result={type:'error',id,caseId,pose,error:String(error.message||error)};}
  if(post)post(result,result.type==='frame'?[result.frame.pixels.buffer]:[]);
  return result;
 };
}
