import {DEFAULT_POSE,normalizePose,cameraForPose} from './beam-geometry.mjs';
import {BeamController} from './beam-controller.mjs';
import {poseLabel,stepControl} from './beam-interaction.mjs';
import {RigView} from './beam-view.mjs?v=3';

const $=selector=>document.querySelector(selector),axes=['orbit','tilt','x','y','z'];
let pose={...DEFAULT_POSE},observer={yaw:35,elevation:25,zoom:1},view,worker,drawnFrame,drawnPin;
const handles=Object.fromEntries(axes.map(axis=>[axis,$(`[data-handle="${axis}"]`)]));
function render(job){
  return new Promise((resolve,reject)=>{
    try{worker??=new Worker(new URL('./beam-worker.mjs',import.meta.url),{type:'module'});}catch(error){reject(error);return;}
    const fail=message=>{clearTimeout(timer);worker?.terminate();worker=null;reject(new Error(message));};
    const timer=setTimeout(()=>fail('Rendering timed out. Try again.'),15000);
    worker.onerror=event=>{event.preventDefault();fail(event.message||'The renderer could not start.');};
    worker.onmessageerror=()=>fail('The rendered image could not be read.');
    worker.onmessage=({data})=>{
      if(data.id!==job.id){fail('The renderer returned a different view. Try again.');return;}
      clearTimeout(timer);if(data.error)reject(new Error(data.error));else resolve(data.frame);
    };
    worker.postMessage(job);
  });
}
function drawFrame(canvas,frame){
  canvas.width=frame.width;canvas.height=frame.height;
  canvas.getContext('2d').putImageData(new ImageData(frame.pixels,frame.width,frame.height),0,0);
  canvas.dataset.pose=JSON.stringify(frame.pose);canvas.dataset.frame=frame.id;canvas.dataset.renderMs=frame.renderMs.toFixed(3);
  canvas.setAttribute('aria-label','Synthetic projection: '+poseLabel(frame.pose));
}
const controller=new BeamController(render,state=>{
  document.body.dataset.pending=String(state.pending);
  $('#requested-pose').textContent=poseLabel(state.staged);
  if(state.frame&&state.frame!==drawnFrame){drawFrame($('#projection'),state.frame);$('#displayed-pose').textContent=poseLabel(state.frame.pose);drawnFrame=state.frame;}
  if(state.pinned&&state.pinned!==drawnPin){drawFrame($('#reference-image'),state.pinned);$('#pin-pose').textContent=poseLabel(state.pinned.pose);drawnPin=state.pinned;}
  $('#pin-current').disabled=!state.frame;$('#retry').hidden=!state.error;
  const status=$('#render-status');status.classList.toggle('error',Boolean(state.error));
  if(state.error)status.textContent=state.error+(state.frame?' Still showing the last image.':'');
  else if(state.pending)status.textContent=state.frame?'Updating… still showing the previous view.':'Preparing the first image…';
  else status.textContent=`Image up to date · render time ${state.frame.renderMs.toFixed(1)} ms.`;
});
function updateControls(){
  for(const axis of axes){$('#'+axis).value=pose[axis];$('#'+axis+'-value').textContent=pose[axis].toFixed(1)+(['orbit','tilt'].includes(axis)?'°':' mm');}
  for(const button of document.querySelectorAll('[data-preset]'))button.setAttribute('aria-pressed',String(Math.abs(pose.orbit-Number(button.dataset.preset))<1e-8));
  const camera=cameraForPose(pose);$('#object-distance').textContent=`Source–phantom-centre distance: ${Math.hypot(...camera.source).toFixed(1)} mm.`;
}
function changePose(patch){
  pose=normalizePose({...pose,...patch});updateControls();view?.setPose(pose);controller.stage(pose);
}
function changeObserver(patch){
  observer={...observer,...patch};observer.yaw=((observer.yaw+180)%360+360)%360-180;observer.elevation=Math.max(-65,Math.min(75,observer.elevation));observer.zoom=Math.max(.7,Math.min(1.6,observer.zoom));
  for(const [key,value] of Object.entries(observer)){$('#observer-'+key).value=value;$('#observer-'+key+'-value').textContent=key==='zoom'?value.toFixed(1)+'×':value.toFixed(0)+'°';}
  view?.setObserver(observer);
}
function selectTool(tool){
  document.body.dataset.tool=tool;
  for(const button of document.querySelectorAll('button[data-tool]'))button.setAttribute('aria-pressed',String(button.dataset.tool===tool));
  for(const name of ['angle','position','look'])$('#'+name+'-controls').hidden=name!==tool;
  const copy={angle:['Angle the beam','Acquisition','Drag the gold orbit or blue tilt handle, or use the sliders.'],position:['Reposition the rig','Acquisition','Drag a labelled axis to move the whole rig. The phantom stays fixed.'],look:['Look around the scene','Observer only','Drag to look around; scroll to zoom. The beam and images stay unchanged.']};
  $('#rig-title').textContent=copy[tool][0];$('#scene-tool-label').textContent=copy[tool][1];$('#tool-help').textContent=copy[tool][2];view?.setMode(tool);
  if(!view)for(const handle of Object.values(handles))handle.hidden=true;
}
for(const axis of axes){
  $('#'+axis).addEventListener('input',event=>changePose({[axis]:Number(event.target.value)}));
  for(const element of [$('#'+axis),handles[axis]])element.addEventListener('keydown',event=>{
    const value=stepControl(pose[axis],event.key,event.shiftKey);if(value===null)return;
    event.preventDefault();changePose({[axis]:value});
  });
}
for(const button of document.querySelectorAll('button[data-tool]'))button.addEventListener('click',()=>selectTool(button.dataset.tool));
for(const button of document.querySelectorAll('[data-preset]'))button.addEventListener('click',()=>changePose({orbit:Number(button.dataset.preset)}));
for(const key of ['yaw','elevation','zoom'])$('#observer-'+key).addEventListener('input',event=>changeObserver({[key]:Number(event.target.value)}));
$('#reset-beam').addEventListener('click',()=>changePose(DEFAULT_POSE));
$('#reset-observer').addEventListener('click',()=>changeObserver({yaw:35,elevation:25,zoom:1}));
$('#pin-current').addEventListener('click',()=>controller.pin());$('#retry').addEventListener('click',()=>controller.retry());
try{
  view=new RigView($('#rig-scene'),handles,changePose,changeObserver,message=>{$('#tool-help').textContent=message;});
  document.body.dataset.scene='ready';
}catch(error){
  document.body.dataset.scene='unavailable';$('#scene-error').hidden=false;$('#scene-error').textContent='3D view unavailable: '+error.message+'. You can still use the sliders to change the projection.';
}
for(const axis of axes){$('#'+axis).disabled=false;handles[axis].disabled=!view;}
$('#reset-beam').disabled=false;selectTool('angle');updateControls();controller.stage(pose);
window.addEventListener('pagehide',()=>worker?.terminate());
