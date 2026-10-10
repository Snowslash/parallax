import {pixelBuffer} from './presentation.mjs?bp3d-cortex-v001';
import {normalizePose} from '../beam-geometry.mjs';
import {poseLabel} from '../beam-interaction.mjs';
import {DEFAULT_MESH_POSE,meshCamera} from './geometry.mjs?bp3d-cortex-v001';
import {MeshController} from './controller.mjs';
import {createWorkerRenderer} from './transport.mjs?bp3d-cortex-v001';
import {MeshView} from './view.mjs?bp3d-cortex-v001';
const $=s=>document.querySelector(s),axes=['orbit','tilt','x','y','z'];
let pose={...DEFAULT_MESH_POSE},observer={yaw:-35,elevation:22,zoom:1},view,drawnFrame,first=true,metrics;
const transport=createWorkerRenderer({onReady:data=>{
  metrics=data.metrics;
  try{view?.dispose();view=new MeshView($('#mesh-scene'),data.vertices,data.faces,message=>{$('#scene-note').textContent=message;document.body.dataset.scene='unavailable';});view.setPose(pose);view.setObserver(observer);document.body.dataset.scene='ready';}
  catch(error){document.body.dataset.scene='unavailable';$('#scene-note').textContent='3D unavailable: '+error.message+'. You can still use the controls to change the projection.';}
}});
const controller=new MeshController(transport.render,state=>{
  document.body.dataset.pending=String(state.pending);document.body.dataset.error=String(Boolean(state.error));
  $('#requested-pose').textContent=poseLabel(state.requested.pose)+` · ${state.requested.size}²`;
  if(state.frame&&state.frame!==drawnFrame){
    const f=state.frame;drawnFrame=f;paint(f);
    if(first){first=false;document.body.dataset.firstImageMs=performance.now();$('#load-metrics').textContent=JSON.stringify({navigationToFirstCanvasMs:Number(document.body.dataset.firstImageMs),...metrics},null,2);}
  }
  $('#retry').hidden=!state.error;$('#mesh-status').classList.toggle('error',Boolean(state.error));
  $('#diagnostics').textContent=state.diagnostics?JSON.stringify(state.diagnostics,null,2):'';
  if(state.error)$('#mesh-status').textContent=state.error+(state.frame?'. Still showing the last valid image.':'. No valid image yet.');
  else if(state.pending)$('#mesh-status').textContent=state.frame?'Updating… still showing the previous view.':'Loading the model and preparing the first image…';
  else $('#mesh-status').textContent=`Image up to date · render time ${state.frame.renderMs.toFixed(1)} ms.`;
});
function paint(f){
  const mode=$('#material-mode').value,pixels=pixelBuffer(f,mode),c=$('#mesh-projection');
  c.width=f.width;c.height=f.height;c.getContext('2d',{willReadFrequently:true}).putImageData(new ImageData(pixels,f.width,f.height),0,0);
  c.dataset.pose=JSON.stringify(f.pose);c.dataset.frame=f.id;c.dataset.renderMs=f.renderMs;c.dataset.invalidCount=f.invalidCount;c.dataset.mode=mode;
  c.setAttribute('aria-label',(mode==='layered'?'Cortex + core':'Uniform')+' femur projection: '+poseLabel(f.pose));
  $('#displayed-pose').textContent=poseLabel(f.pose);$('#displayed-size').textContent=`Displayed ${f.width} × ${f.height} · 320 mm field`;
}
$('#material-mode').addEventListener('input',()=>{if(drawnFrame)paint(drawnFrame);});
function update(){
  for(const k of axes){$('#'+k).value=pose[k];$('#'+k+'-value').textContent=pose[k].toFixed(1)+(['orbit','tilt'].includes(k)?'°':'');}
  const c=meshCamera(pose);$('#distance').textContent=`Source to model origin: ${Math.hypot(...c.source).toFixed(1)} mm.`;
  view?.setPose(pose);controller.stage(pose,Number($('#resolution').value));
}
for(const k of axes)$('#'+k).addEventListener('input',e=>{pose=normalizePose({...pose,[k]:Number(e.target.value)});update();});
$('#resolution').addEventListener('input',update);$('#reset-beam').addEventListener('click',()=>{pose={...DEFAULT_MESH_POSE};update();});
function observe(){for(const k of Object.keys(observer))$('#observer-'+k).value=observer[k];view?.setObserver(observer);}
for(const k of Object.keys(observer))$('#observer-'+k).addEventListener('input',e=>{observer[k]=Number(e.target.value);observe();});
$('#reset-observer').addEventListener('click',()=>{observer={yaw:-35,elevation:22,zoom:1};observe();});
$('#retry').addEventListener('click',()=>controller.retry());window.addEventListener('pagehide',()=>{transport.dispose();view?.dispose();});update();
