import {normalizePose} from '../beam-geometry.mjs';
import {CASES,REFERENCE_POSES,DEFAULT_LESSON_POSE,classifyFrame,measureFrame,assessCaptures} from './model.mjs';
import {createLessonRenderer} from './transport.mjs';
import {LessonController} from './state.mjs';
import {LessonView} from './view.mjs';
import {pixelAt,markPoint,measuredDistance} from './calipers.mjs';
const $=id=>document.getElementById(id),axes=['orbit','tilt','x','y','z'];
const labels={meets:'Meets the criteria','does-not-meet':'Does not meet the criteria',insufficient:'I am not yet sure'};
let pose={...DEFAULT_LESSON_POSE},observer={yaw:-35,elevation:22,zoom:1},view,drawnFrame,revealedCase=null;
const shown={ap:null,lateral:null};
const marks={ap:[],lateral:[]},cursors={ap:[127.5,127.5],lateral:[127.5,127.5]};
let marking=null;
function poseText(p){return `Orbit ${p.orbit.toFixed(1)}° · angulation ${p.tilt.toFixed(1)}° · rig ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} mm`;}
function paint(canvas,frame,label){
  canvas.width=frame.width;canvas.height=frame.height;
  canvas.getContext('2d',{willReadFrequently:true}).putImageData(new ImageData(frame.pixels,frame.width,frame.height),0,0);
  canvas.dataset.frame=frame.id;canvas.dataset.caseId=frame.caseId;canvas.dataset.pose=JSON.stringify(frame.pose);
  canvas.setAttribute('aria-label',label+': '+poseText(frame.pose));
}
function clear(canvas){canvas.getContext('2d',{willReadFrequently:true}).clearRect(0,0,canvas.width,canvas.height);delete canvas.dataset.frame;delete canvas.dataset.caseId;delete canvas.dataset.pose;}
function drawMarks(kind){
  const svg=$('marks-'+kind),ns='http://www.w3.org/2000/svg';svg.replaceChildren();
  const add=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);svg.append(el);};
  const saved=controller.state.captures[kind];
  if(saved){const p=measureFrame(saved).apexPx;add('circle',{cx:p[0]+.5,cy:p[1]+.5,r:2.5,class:'reference-landmark'});}
  for(const p of marks[kind])add('circle',{cx:p[0]+.5,cy:p[1]+.5,r:2.5});
  if(marks[kind].length===2){const [a,b]=marks[kind];add('line',{x1:a[0]+.5,y1:a[1]+.5,x2:b[0]+.5,y2:b[1]+.5});}
  if(marking===kind){const [x,y]=cursors[kind];add('line',{x1:x-4,y1:y+.5,x2:x+5,y2:y+.5});add('line',{x1:x+.5,y1:y-4,x2:x+.5,y2:y+5});}
  const values={};
  for(const k of ['ap','lateral']){
    const frame=controller.state.captures[k];
    const m=frame?measureFrame(frame):null;
    values[k]=frame?measuredDistance(marks[k],frame.camera.pixelMm,{tip:m.magnification,apex:m.apexMagnification,centre:frame.width/2-.5}):null;
    $('estimate-'+k).textContent=values[k]===null?(marks[k].length?'Now mark the gold dot.':''):`Your measurement: ${values[k].toFixed(1)} mm`;
  }
  $('estimate-total').textContent=Object.values(values).every(v=>v!==null)?`Your combined distance: ${(values.ap+values.lateral).toFixed(1)} mm`:'';
}
function syncScene(){
  view?.setPose(pose);view?.setObserver(observer);
  view?.setWire(CASES.find(c=>c.id===controller.state.caseId)?.wire,controller.state.revealed);
}
const transport=createLessonRenderer({onReady:data=>{
  try{
    view?.dispose();view=new LessonView($('lesson-scene'),data.vertices,data.faces,message=>{$('scene-note').textContent=message;document.body.dataset.scene='unavailable';});
    syncScene();document.body.dataset.scene='ready';
  }catch(error){view=null;document.body.dataset.scene='unavailable';$('scene-note').textContent='3D unavailable. You can still acquire and compare images. '+error.message;}
}});
function overlay(kind,frame){
  const m=measureFrame(frame),svg=$('measure-'+kind),ns='http://www.w3.org/2000/svg';
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${frame.width} ${frame.height}`);
  // Pixel coordinates refer to pixel centres, while SVG coordinates start at the edge.
  const line=document.createElementNS(ns,'line');
  for(const [k,v] of Object.entries({x1:m.tipPx[0]+.5,y1:m.tipPx[1]+.5,x2:m.apexPx[0]+.5,y2:m.apexPx[1]+.5}))line.setAttribute(k,v);
  svg.append(line);
  for(const p of [m.tipPx,m.apexPx]){const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',p[0]+.5);circle.setAttribute('cy',p[1]+.5);circle.setAttribute('r','2');svg.append(circle);}
  svg.hidden=false;svg.removeAttribute('hidden');
  $('caption-'+kind).textContent=`${kind==='ap'?'AP':'Lateral'} · ${m.distanceMm.toFixed(1)} mm`;
  return m;
}
function update(state){
  document.body.dataset.pending=String(state.pending);document.body.dataset.error=String(Boolean(state.error));document.body.dataset.revealed=String(state.revealed);document.body.dataset.caseId=state.caseId??'';
  if(state.frame&&state.frame!==drawnFrame){drawnFrame=state.frame;paint($('live-projection'),state.frame,'Current femur and wire projection');$('displayed-pose').textContent=poseText(state.frame.pose);}
  else if(!state.frame&&drawnFrame){drawnFrame=null;clear($('live-projection'));$('displayed-pose').textContent='Preparing the new case…';}
  const kind=!state.pending&&!state.error&&state.frame?classifyFrame(state.frame):null;
  $('render-status').classList.toggle('error',Boolean(state.error));
  $('render-status').textContent=state.error?state.error+(state.frame?' Still showing the previous valid image.':' No image was accepted.'):state.pending?'Updating… wait before saving a view.':kind?'Image ready to save.':'Image ready; adjust the beam before saving.';
  $('retry').hidden=!state.error;$('capture').disabled=!kind||state.revealed;
  $('capture').textContent=kind?`Save ${kind==='ap'?'AP':'lateral'} view`:'Save this view';
  $('view-quality').textContent=state.revealed?'Answer saved. You can still move the beam.':kind?`${kind==='ap'?'AP':'Lateral'} view`:'Show the head and wire clearly in an AP or lateral view.';
  $('view-guidance').hidden=!$('assistance').checked;
  const refs=REFERENCE_POSES;$('guidance-text').textContent=`Targets: AP ${refs.ap.orbit.toFixed(1)}° / ${refs.ap.tilt.toFixed(1)}°; lateral ${refs.lateral.orbit.toFixed(1)}° / ${refs.lateral.tilt.toFixed(1)}° (orbit / angulation).`;
  for(const k of ['ap','lateral']){
    const f=state.captures[k];
    if(f!==shown[k]){
      shown[k]=f??null;$('measure-'+k).setAttribute('hidden','');
      marks[k]=[];if(marking===k)marking=null;drawMarks(k);
      if(f){paint($('saved-'+k),f,`Saved ${k} projection`);$('caption-'+k).textContent=`${k==='ap'?'AP':'Lateral'} · ${poseText(f.pose)}`;}
      else{clear($('saved-'+k));$('saved-'+k).setAttribute('aria-label',`No saved ${k} view`);$('caption-'+k).textContent=`${k==='ap'?'AP':'Lateral'} · not yet saved`;}
    }
    $('mark-'+k).disabled=!f||state.revealed;$('saved-'+k).tabIndex=f&&!state.revealed?0:-1;
  }
  const paired=Boolean(state.captures.ap&&state.captures.lateral);
  $('evidence-status').textContent=state.revealed?'Answer saved. Compare it with the revealed wire.':paired?'Both views saved. Choose your answer and explain why.':`Still needed: ${[!state.captures.ap&&'AP',!state.captures.lateral&&'lateral'].filter(Boolean).join(' and ')}.`;
  $('judgement').disabled=!paired||state.revealed;$('reason').disabled=!paired||state.revealed;$('judgement').value=state.choice??'';
  if($('reason').value!==state.reason)$('reason').value=state.reason;
  $('commit').disabled=!controller.canCommit();$('reveal').hidden=!state.revealed;
  if(state.revealed&&revealedCase!==state.caseId){
    marking=null;drawMarks('ap');drawMarks('lateral');
    const result=assessCaptures(state.caseId,state.captures),ap=overlay('ap',state.captures.ap),lat=overlay('lateral',state.captures.lateral);
    $('your-answer').textContent=`Your answer: ${labels[state.choice]}. Your reason: ${state.reason}`;
    const matches=state.choice===(result.meets?'meets':'does-not-meet');
    $('feedback').textContent=(state.choice==='insufficient'?'Compare both views with the revealed wire. ':matches?'Your answer agrees with the reveal. ':'Your answer differs from the reveal. ')+result.feedback;
    $('measurements').textContent=`${result.measurementLabel}: AP ${ap.distanceMm.toFixed(1)} + lateral ${lat.distanceMm.toFixed(1)} = ${result.sumMm.toFixed(1)} mm.`;
    $('scene-note').textContent='Gold shows the wire through the bone; coral marks its tip. Looking around does not change the images.';
    $('lesson-scene').setAttribute('aria-label','3D femur and revealed wire');revealedCase=state.caseId;syncScene();
  }
  if(!state.revealed&&revealedCase!==null){revealedCase=null;syncScene();}
}
const controller=new LessonController({render:transport.render,onChange:update,caseIds:CASES.map(c=>c.id),classifyFrame});
function beam(){for(const k of axes){$(k).value=pose[k];$(k+'-value').textContent=pose[k].toFixed(1)+(['orbit','tilt'].includes(k)?'°':'');}view?.setPose(pose);controller.stage(pose);}
function start(caseId){
  pose={...DEFAULT_LESSON_POSE};$('case-select').value=caseId;
  // Case labels never disclose their preset geometry before commitment.
  $('case-brief').textContent='Take AP and lateral views, then judge the wire position.';
  $('scene-note').textContent='The wire stays hidden here until you answer. Looking around does not change the images.';$('lesson-scene').setAttribute('aria-label','Femur and imaging rig; wire hidden until you answer');
  for(const k of axes){$(k).value=pose[k];$(k+'-value').textContent=pose[k].toFixed(1)+(['orbit','tilt'].includes(k)?'°':'');}
  for(const k of ['ap','lateral'])$('measure-'+k).setAttribute('hidden','');
  controller.selectCase(caseId,pose);syncScene();
}
for(const [i,c] of CASES.entries()){
  const option=document.createElement('option');option.value=c.id;option.textContent=`Case ${i+1}`;
  if(i===0)$('case-select').replaceChildren();$('case-select').append(option);
}
$('case-select').disabled=false;$('reset-case').disabled=false;
$('case-select').addEventListener('change',event=>start(event.target.value));$('reset-case').addEventListener('click',()=>start(controller.state.caseId));
for(const k of axes)$(k).addEventListener('input',event=>{pose=normalizePose({...pose,[k]:Number(event.target.value)});beam();});
for(const kind of ['ap','lateral'])$('aim-'+kind).addEventListener('click',()=>{pose={...REFERENCE_POSES[kind]};beam();});
$('assistance').addEventListener('change',()=>update(controller.state));
$('capture').addEventListener('click',()=>controller.capture());$('retry').addEventListener('click',()=>controller.retry());
$('judgement').addEventListener('change',event=>controller.choose(event.target.value||null));
$('reason').addEventListener('input',event=>controller.reason(event.target.value));
$('commit').addEventListener('click',()=>{controller.commit();$('reveal-title').focus({preventScroll:true});});
$('next-case').addEventListener('click',()=>{const index=CASES.findIndex(c=>c.id===controller.state.caseId);start(CASES[(index+1)%CASES.length].id);$('case-select').focus({preventScroll:true});});
for(const kind of ['ap','lateral']){
  const canvas=$('saved-'+kind);
  const mark=point=>{if(controller.state.revealed||!controller.state.captures[kind])return;marking=kind;marks[kind]=markPoint(marks[kind],point);drawMarks(kind);};
  $('mark-'+kind).addEventListener('click',()=>{marking=kind;drawMarks('ap');drawMarks('lateral');canvas.focus({preventScroll:true});});
  canvas.addEventListener('click',event=>{if(marking!==kind)return;const p=pixelAt(canvas.getBoundingClientRect(),event.clientX,event.clientY,canvas.width);cursors[kind]=p;mark(p);});
  canvas.addEventListener('keydown',event=>{
    if(controller.state.revealed||!controller.state.captures[kind])return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key))return;event.preventDefault();marking=kind;
    if(event.key==='Enter'||event.key===' '){mark(cursors[kind]);return;}
    const step=event.shiftKey?10:1,[x,y]=cursors[kind];
    cursors[kind]=[Math.max(0,Math.min(canvas.width-1,x+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0))),Math.max(0,Math.min(canvas.height-1,y+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)))];drawMarks(kind);
  });
}
function observe(){for(const [key,value] of Object.entries(observer))$('observer-'+key).value=value;view?.setObserver(observer);}
for(const key of Object.keys(observer))$('observer-'+key).addEventListener('input',event=>{observer={...observer,[key]:Number(event.target.value)};observe();});
$('reset-observer').addEventListener('click',()=>{observer={yaw:-35,elevation:22,zoom:1};observe();});
window.addEventListener('pagehide',()=>{controller.dispose();transport.dispose();view?.dispose();});
start(CASES[0].id);
