import {createState,feedback,caseFeedback} from './state.mjs';
import {normalizePose,isAdditionalPose} from './camera.mjs';
import {loadLesson,loadVerified,validatePng,parseStl} from './loading.mjs';
import {LESSON_SHA256} from './identity.mjs';
const $=id=>document.getElementById(id),state=createState({normalizePose,isAdditionalPose});
let lesson,positions,lessonHash=null,rig=null,viewer=null,worker=null,debounce=null,timeout=null,abort=null,revealAbort=null,epoch=0,bootError='',rigError='';
let drawnId=null,drawnRotation=null,savedId=null,detailObserver={yaw:0,elevation:0,zoom:1};
const poseText=p=>p?`rotation ${p.orbit.toFixed(1)}° · angulation ${p.angulation.toFixed(1)}°`:'not yet available';
function paint(canvas,frame,rotation=0){
 canvas.width=frame.width;canvas.height=frame.height;
 const raw=document.createElement('canvas');raw.width=frame.width;raw.height=frame.height;raw.getContext('2d').putImageData(new ImageData(frame.pixels,frame.width,frame.height),0,0);
 const ctx=canvas.getContext('2d');ctx.save();if(rotation===90){ctx.translate(canvas.width,0);ctx.rotate(Math.PI/2);}ctx.drawImage(raw,0,0);ctx.restore();
 canvas.dataset.frameId=frame.id;canvas.dataset.caseId=frame.caseId;canvas.dataset.pose=JSON.stringify(frame.pose);canvas.dataset.rotation=String(rotation);canvas.setAttribute('aria-label',`${frame.caseId.replace('case-a','Case A').replace('case-b','Case B')} · ${poseText(frame.pose)} · picture rotation ${rotation}°`);
}
function evidenceCanvas(id,frame,rotation){const canvas=document.createElement('canvas');canvas.setAttribute('role','img');paint(canvas,frame,rotation);$(id).replaceChildren(canvas);}
function stopWorker(){clearTimeout(timeout);timeout=null;worker?.terminate();worker=null;}
function cancel(){epoch++;abort?.abort();revealAbort?.abort();clearTimeout(debounce);stopWorker();rig?.dispose();rig=null;viewer?.dispose();viewer=null;}
function sync(){
 const s=state.snapshot();document.body.dataset.ready=String(s.ready);document.body.dataset.pending=String(s.pending);document.body.dataset.error=bootError||s.error;document.body.dataset.caseId=s.caseId;
 $('case-select').disabled=!lesson;$('evidence').hidden=!s.ready;$('answer-controls').hidden=!s.ready;$('answer-controls').disabled=!s.canCommit;$('commit').disabled=!s.canCommit||!$('answer').value;$('capture').disabled=!s.canCapture;$('restart').disabled=!lesson;$('beam-controls').disabled=!s.ready||s.committed;
 $('retry-frame').hidden=!s.error||!s.ready;$('result').hidden=!s.committed;$('rotate-image').checked=s.displayRotationDeg===90;
 $('requested-pose').textContent=`C-arm position: ${poseText(s.requestedPose)}`;$('displayed-pose').textContent=`Image shown: ${poseText(s.displayedPose)}`;
 $('live-projection').classList.toggle('projection-stale',s.pending||Boolean(s.error));
 $('render-status').textContent=s.error?'The X-ray could not be updated. The picture still shows the earlier view. Try again before saving or answering.':s.pending?'Updating the X-ray. Wait for it to finish before saving or answering.':s.committed?'Your answer is confirmed. Your saved X-ray is unchanged.':!s.framed?'The wire tip is not fully in view. Adjust the C-arm before saving.':s.canCapture?'X-ray ready. Save it to compare with the AP.':'This view is too similar to the AP. Move the C-arm to choose another angle.';
 for(const k of ['orbit','angulation']){$(k).value=s.requestedPose[k];$(k+'-value').textContent=`${s.requestedPose[k].toFixed(1)}°`;}
 for(const k of ['yaw','elevation','zoom']){$('observer-'+k).value=s.observer[k];$('observer-'+k+'-value').textContent=k==='zoom'?`${s.observer[k].toFixed(1)}×`:`${s.observer[k].toFixed(1)}°`;}
 if(s.displayedFrameId&&(drawnId!==s.displayedFrameId||drawnRotation!==s.displayRotationDeg)){paint($('live-projection'),state.evidence('displayed'),s.displayRotationDeg);drawnId=s.displayedFrameId;drawnRotation=s.displayRotationDeg;}
 if(s.capturedFrameId&&savedId!==s.capturedFrameId){const f=state.evidence('captured');evidenceCanvas('additional-image',f,f.displayRotationDeg);savedId=f.id;$('additional-caption').textContent=`Saved X-ray · ${poseText(f.pose)} · ${f.displayRotationDeg===90?'rotated 90° clockwise':'upright'}`;}
 rig?.setPose(s.requestedPose);rig?.setObserver(s.observer);
}
function failedWorker(error){stopWorker();state.workerFailed(error);sync();}
function pump(){
 const request=state.nextRequest();if(!request)return;
 try{
  if(!worker){worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});const current=worker;
   worker.onmessage=event=>{if(worker!==current)return;const m=event.data;if(m?.id!==state.snapshot().activeRequestId)return;clearTimeout(timeout);state.receive(m);sync();pump();};
   worker.onerror=event=>{if(worker!==current)return;event.preventDefault();failedWorker(event.message||'Worker stopped unexpectedly');};
   worker.onmessageerror=()=>{if(worker===current)failedWorker('Could not read projection reply');};
  }
  worker.postMessage(request);timeout=setTimeout(()=>failedWorker('Projection timed out'),120000);
 }catch(error){failedWorker(error.message);}
}
function stage(pose){if(!state.stage(pose))return;clearTimeout(debounce);sync();debounce=setTimeout(()=>{state.settle();pump();},180);}
async function loadAP(g,signal){
 const s=state.snapshot(),f=lesson.cases.find(c=>c.id===s.caseId).frames.ap;
 const bytes=await loadVerified(f,{signal});validatePng(bytes,f);
 const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
 try{const image=new Image();image.src=url;await image.decode();signal.throwIfAborted();if(image.naturalWidth!==f.width||image.naturalHeight!==f.height)throw Error('Decoded image dimensions mismatch');
  const canvas=document.createElement('canvas');canvas.width=f.width;canvas.height=f.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
  const frame={width:f.width,height:f.height,pixels:ctx.getImageData(0,0,f.width,f.height).data,invalidCount:0,framing:{oliveInFrame:true}};
  if(state.acceptAP(g,frame,f.sha256))evidenceCanvas('ap-image',state.evidence('ap'),0);
 }finally{URL.revokeObjectURL(url);}
}
function clearSurfaces(){drawnId=drawnRotation=savedId=null;for(const id of ['ap-image','additional-image','reveal-host','rig-host'])$(id).replaceChildren();const c=$('live-projection');c.width=320;c.height=320;for(const key of Object.keys(c.dataset))delete c.dataset[key];$('answer').value='';$('additional-caption').textContent='Saved X-ray · none yet';$('reveal-observer-controls').hidden=true;$('retry-reveal').hidden=true;$('reveal-status').textContent='';$('tool-mode').value='beam';detailObserver={yaw:0,elevation:0,zoom:1};syncDetail();}
async function reset(caseId){
 cancel();state.reset(caseId);clearSurfaces();bootError='';rigError='';const e=epoch;abort=new AbortController();const signal=abort.signal;sync();$('status').textContent='Loading the AP reference…';
 try{await loadAP(state.snapshot().generation,signal);if(e!==epoch)return;$('status').textContent='Compare the AP reference with an X-ray you choose.';$('retry-load').hidden=true;sync();
  try{const {createRig}=await import('./rig-view.mjs');if(e!==epoch)return;rig=createRig({host:$('rig-host'),positions,onError:error=>{rigError=error.message;$('rig-status').textContent='The 3D view stopped. Restart the case to restore it. You can still use the C-arm sliders.';}});$('rig-status').textContent='Gold source · blue detector. Sliders and arrow keys also move the C-arm.';sync();}catch(error){if(e!==epoch)return;rigError=error.message;$('rig-status').textContent='The 3D view could not be loaded. You can still use the C-arm sliders.';}
 }catch(error){if(e!==epoch||signal.aborted)return;bootError=error.message;$('status').textContent='The AP image could not be loaded. Try again.';$('retry-load').hidden=false;sync();}
}
async function boot(){
 cancel();state.reset();lesson=null;positions=null;bootError='';clearSurfaces();const e=epoch;abort=new AbortController();const signal=abort.signal;$('retry-load').hidden=true;$('status').textContent='Loading the lesson…';sync();
 try{const loaded=await loadLesson({signal});if(loaded.digest!==LESSON_SHA256)throw Error('Lesson hash mismatch');const p={};for(const id of ['outer','canal'])p[id]=parseStl(await loadVerified(loaded.lesson.models[id],{signal}));if(e!==epoch)return;lesson=loaded.lesson;lessonHash=loaded.digest;positions=p;await reset($('case-select').value);}catch(error){if(e!==epoch||signal.aborted)return;bootError=error.message;$('status').textContent='The lesson could not be loaded. Try again.';$('retry-load').hidden=false;sync();}
}
function syncDetail(){for(const k of ['yaw','elevation','zoom']){$(k).value=detailObserver[k];$(k+'-value').textContent=k==='zoom'?`${detailObserver[k].toFixed(1)}×`:`${detailObserver[k]}°`;}viewer?.setObserver(detailObserver);}
async function reveal(){
 if(!state.snapshot().committed||viewer)return;revealAbort?.abort();revealAbort=new AbortController();const signal=revealAbort.signal,e=epoch;
 const unavailable=error=>{if(e!==epoch||signal.aborted)return;viewer?.dispose();viewer=null;state.hideReveal();$('reveal-host').replaceChildren();$('reveal-observer-controls').hidden=true;$('reveal-status').textContent='The 3D view could not be shown. Try again.';$('retry-reveal').hidden=false;};
 $('retry-reveal').hidden=true;$('reveal-status').textContent='Loading the 3D view…';
 try{const {createReveal}=await import('./reveal.mjs');signal.throwIfAborted();const candidate=await createReveal({state:state.snapshot(),host:$('reveal-host'),positions,wire:lesson.cases.find(c=>c.id===state.snapshot().caseId).wire,signal,onError:unavailable});if(e!==epoch||signal.aborted){candidate.dispose();return;}viewer=candidate;state.reveal();$('reveal-observer-controls').hidden=false;$('reveal-status').textContent='Look around the fracture to compare the wire with the canal.';syncDetail();}catch(error){unavailable(error);}
}
for(const key of ['orbit','angulation'])$(key).addEventListener('input',()=>stage({...state.snapshot().requestedPose,[key]:Number($(key).value)}));
$('reset-beam').addEventListener('click',()=>stage({orbit:0,angulation:0}));
$('rotate-image').addEventListener('change',()=>{state.setRotation($('rotate-image').checked);sync();});
$('capture').addEventListener('click',()=>{state.capture();savedId=null;sync();});
$('retry-frame').addEventListener('click',()=>{stopWorker();state.retry();state.settle();sync();pump();});
$('answer').addEventListener('change',sync);
$('commit').addEventListener('click',()=>{state.commit($('answer').value);const s=state.snapshot(),c=lesson.cases.find(c=>c.id===s.caseId);$('feedback').textContent=feedback(s.answer,c.truth);$('preset-detail').textContent=caseFeedback(c.truth);sync();$('result-title').focus({preventScroll:true});reveal();});
$('case-select').addEventListener('change',()=>reset($('case-select').value));$('restart').addEventListener('click',()=>reset(state.snapshot().caseId));$('retry-load').addEventListener('click',boot);$('retry-reveal').addEventListener('click',reveal);
for(const key of ['yaw','elevation','zoom']){$('observer-'+key).addEventListener('input',()=>{state.setObserver({...state.snapshot().observer,[key]:Number($('observer-'+key).value)});sync();});$(key).addEventListener('input',()=>{detailObserver[key]=Number($(key).value);syncDetail();});}
$('reset-observer').addEventListener('click',()=>{state.setObserver({yaw:-35,elevation:22,zoom:1});sync();});$('reset-detail').addEventListener('click',()=>{detailObserver={yaw:0,elevation:0,zoom:1};syncDetail();});
let drag=null;
function move(dx,dy){const s=state.snapshot();if($('tool-mode').value==='observer'){state.setObserver({...s.observer,yaw:s.observer.yaw+dx,elevation:s.observer.elevation-dy});sync();}else stage({orbit:s.requestedPose.orbit+dx,angulation:Math.max(-60,Math.min(60,s.requestedPose.angulation-dy))});}
$('rig-host').addEventListener('pointerdown',e=>{if(e.button!==0||!state.snapshot().ready)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};$('rig-host').setPointerCapture(e.pointerId);$('rig-host').focus({preventScroll:true});});
$('rig-host').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;move((e.clientX-drag.x)*.35,(e.clientY-drag.y)*.35);drag={id:e.pointerId,x:e.clientX,y:e.clientY};});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('rig-host').addEventListener(event,()=>{drag=null;});
$('rig-host').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const d=e.shiftKey?10:1;move(e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0,e.key==='ArrowDown'?d:e.key==='ArrowUp'?-d:0);});
Object.defineProperty(window,'guidewireLesson',{value:Object.freeze({getState(){const s=state.snapshot();return Object.freeze({...s,error:bootError||s.error,lessonSha256:lessonHash,modelHashes:lesson?Object.freeze(Object.fromEntries(Object.entries(lesson.models).map(([k,v])=>[k,v.sha256]))):null,rigError,rigWireVisible:false,canvasPresent:!!$('reveal-host').querySelector('canvas'),displayedImages:Object.freeze({ap:!!$('ap-image').firstChild,current:!!s.displayedFrameId,additional:!!$('additional-image').firstChild})});}}),writable:false,configurable:false});
window.addEventListener('pagehide',cancel);boot();
