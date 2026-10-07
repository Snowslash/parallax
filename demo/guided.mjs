import {initialState,reduce,canAcquire,canCommit,caseFor,frameFor,scenePayload,viewExplanation,judgementFeedback} from './lesson-model.mjs?v=copy-1';
import {SceneView,projectPoint} from './scene.mjs';
import {SectionView} from './reveal.mjs';

const $=id=>document.getElementById(id);
const labels={contained:'Contained',breached:'Breached',insufficient:'Still insufficient'};
const predictions={separate:'beyond the outline',overlap:'overlapping the outline',unsure:'not sure'};
let lesson,state,scene,section,stripKey='';

function dispatch(action){
  state=reduce(state,action,lesson);render();
  if(action.type==='commit'&&state.revealed)$('feedback-title').focus();
  if(['next','replay','chapter','restart'].includes(action.type))$(state.finished?'completion-title':'question').focus();
}
function drawGeometry(){
  if(!scene)return;
  const payload=scenePayload(state,lesson);
  scene.render(payload);
  section.render({tip:payload.tip,visible:state.revealed&&!state.finished,z:payload.tip?payload.tip[2]-1:0,camera:payload.camera,showRay:false});
}
function frameCaption(angle){
  const initial=caseFor(state,lesson).initialAngles.includes(angle), prediction=state.predictions[angle];
  return `${initial?'Provided':'Acquired'} · ${angle}°${prediction?' · Predicted: '+predictions[prediction]:''}`;
}
function setMarker(id,angle){
  const svg=$(id);svg.toggleAttribute('hidden',!state.revealed);
  const circle=svg.querySelector('circle'),cross=svg.querySelector('path');
  if(!state.revealed){circle.removeAttribute('cx');circle.removeAttribute('cy');cross?.removeAttribute('d');return;}
  const camera=lesson.geometry.cameras.find(c=>c.angle_deg===angle),uv=projectPoint(camera,caseFor(state,lesson).tip);
  const x=uv[0]+.5,y=uv[1]+.5;
  circle.setAttribute('cx',String(x));circle.setAttribute('cy',String(y));
  cross?.setAttribute('d',`M ${x-9} ${y} h 4 M ${x+5} ${y} h 4 M ${x} ${y-9} v 4 M ${x} ${y+5} v 4`);
}
function updateStrip(){
  const key=state.caseId+':'+state.captured.join(',');
  if(key!==stripKey){
    $('filmstrip').replaceChildren(...state.captured.map(angle=>{
      const button=document.createElement('button');button.type='button';button.dataset.capture=String(angle);
      button.setAttribute('aria-label',`Inspect captured ${angle}° view`);
      const image=document.createElement('img');image.src=frameFor(state,lesson,angle).image;image.alt='';image.width=64;image.height=64;
      const label=document.createElement('span');label.textContent=angle+'°';button.append(image,label);
      button.addEventListener('click',()=>dispatch({type:'view',angle}));return button;
    }));stripKey=key;
  }
  for(const b of $('filmstrip').children)b.setAttribute('aria-pressed',String(Number(b.dataset.capture)===state.viewed));
}
function render(){
  const current=caseFor(state,lesson),staged=state.selected!==state.viewed,captured=state.captured.includes(state.selected);
  document.body.dataset.caseId=state.caseId;document.body.dataset.revealed=String(state.revealed);document.body.dataset.finished=String(state.finished);
  $('challenge').hidden=state.finished;$('completion').hidden=!state.finished;
  for(const [index,b] of [...$('chapter-nav').children].entries()){
    b.disabled=index!==state.index&&!state.completed.includes(lesson.cases[index].id);
    if(index===state.index&&!state.finished)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
    b.querySelector('.done').textContent=state.completed.includes(lesson.cases[index].id)?'Explored':'';
  }
  $('question').textContent=current.title;$('prompt').textContent=current.brief;
  $('geometry-badge').textContent=(staged?'Staged · ':'')+state.selected+'°';
  $('reference-angle').textContent=state.reference+'°';$('image-badge').textContent=state.viewed+'°';
  for(const [id,angle] of [['reference-image',state.reference],['projection',state.viewed]]){
    const image=$(id);image.src=frameFor(state,lesson,angle).image;image.dataset.angle=String(angle);
    image.alt=`${angle} degree projection${state.revealed?', tip centre marked':''}`;
  }
  $('reference-caption').textContent=frameCaption(state.reference);$('projection-caption').textContent=frameCaption(state.viewed);
  $('comparison-hint').textContent=state.reference===state.viewed?'Same captured view.':'Same scale and contrast.';
  $('pin-current').disabled=state.reference===state.viewed;
  $('capture-count').textContent=state.captured.length+' captured';
  setMarker('reference-overlay',state.reference);setMarker('tip-overlay',state.viewed);$('marker-key').hidden=!state.revealed;
  for(const b of $('angle-controls').children)b.setAttribute('aria-pressed',String(Number(b.dataset.angle)===state.selected));
  $('prediction-wrap').hidden=state.revealed;
  for(const b of $('prediction').children){b.disabled=captured||state.revealed;b.setAttribute('aria-pressed',String(b.dataset.prediction===state.prediction));}
  $('acquire').disabled=!canAcquire(state);
  $('acquire').textContent=captured?'View already captured':`Acquire ${state.selected}° view ↗`;
  $('acquire-hint').textContent=captured?'Choose a new angle to acquire.':!state.revealed&&!state.prediction?'Make a prediction first.':'Ready to acquire.';
  $('status').textContent=state.finished?'Lesson complete.':staged?`Beam set to ${state.selected}° · viewing the ${state.viewed}° image.`:state.revealed?'Wire revealed. Explore another view or continue.':`Choose an angle, then predict what you will see. ${current.initialAngles.length===2?'You already have two views.':''}`;
  const newEvidence=state.captured.length>current.initialAngles.length;
  for(const b of $('judgement').children){b.disabled=state.revealed||!newEvidence;b.setAttribute('aria-pressed',String(b.dataset.judgement===state.judgement));}
  $('commit').disabled=!canCommit(state,lesson);
  $('decision-hint').textContent=state.revealed?'Compare your answer with the revealed wire.':newEvidence?'Choose an answer, then reveal the wire.':'Take another view before answering.';
  $('orbit-controls').hidden=!state.revealed;$('feedback').hidden=!state.revealed;
  $('scene-label').textContent=state.revealed?'Wire revealed':'Wire hidden';
  $('scene').setAttribute('aria-label',state.revealed?`Revealed three-dimensional wire. Projection ray corresponds to inspected ${state.viewed} degree image.`:'Hollow cylinder. Entire wire and section hidden until commitment.');
  $('yaw').value=String(state.yaw);$('elevation').value=String(state.elevation);$('yaw-value').textContent=state.yaw+'°';$('elevation-value').textContent=state.elevation+'°';
  $('show-ray').checked=state.showRay;$('show-section').checked=state.showSection;
  $('feedback-title').textContent=state.revealed?current.revealTitle:'';
  $('your-choice').textContent=state.revealed?'Your answer: '+labels[state.judgement]:'';
  $('judgement-feedback').textContent=judgementFeedback(state,lesson);$('takeaway').textContent=state.revealed?current.takeaway:'';
  $('explanation').textContent=viewExplanation(state,lesson);$('explanation-angle').textContent=state.viewed+'°';
  $('section-note').textContent=state.revealed?`1 mm behind the tip centre (Z = ${current.tip[2]-1} mm). Gold is wire; grey is wall.`:'';
  $('ray-hint').textContent=`Dashed line: the source-to-tip ray for the ${state.viewed}° image, cropped to the close-up.`;
  $('next').textContent=state.index===lesson.cases.length-1?'Review the lesson →':'Next challenge →';
  updateStrip();drawGeometry();
}
async function start(){
  const response=await fetch('assets/v2/lesson.json',{cache:'no-cache'});if(!response.ok)throw new Error('The lesson data could not be loaded.');
  lesson=await response.json();
  await Promise.all(lesson.cases.flatMap(c=>c.frames).map(frame=>new Promise((resolve,reject)=>{
    const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error('Missing projection: '+frame.image));image.src=frame.image;
  })));
  state=initialState(lesson);scene=new SceneView($('scene'),$('rig'),lesson.geometry.fixture);section=new SectionView($('section'),lesson.geometry.fixture);
  $('chapter-nav').replaceChildren(...lesson.cases.map((c,index)=>{
    const b=document.createElement('button');b.type='button';b.dataset.chapter=String(index);
    const number=document.createElement('span');number.className='number';number.textContent=String(index+1).padStart(2,'0');
    const title=document.createElement('span');title.textContent=c.title;const done=document.createElement('span');done.className='done';
    b.append(number,title,done);b.addEventListener('click',()=>dispatch({type:'chapter',index}));return b;
  }));
  $('angle-controls').replaceChildren(...lesson.angles.map(angle=>{
    const b=document.createElement('button');b.type='button';b.dataset.angle=String(angle);b.textContent=angle+'°';
    b.addEventListener('click',()=>dispatch({type:'select',angle}));return b;
  }));
  for(const b of $('prediction').children)b.addEventListener('click',()=>dispatch({type:'predict',value:b.dataset.prediction}));
  for(const b of $('judgement').children)b.addEventListener('click',()=>dispatch({type:'judge',value:b.dataset.judgement}));
  for(const id of ['acquire','commit','next','replay','restart'])$(id).addEventListener('click',()=>dispatch({type:id}));
  $('pin-current').addEventListener('click',()=>dispatch({type:'pin',angle:state.viewed}));
  for(const id of ['yaw','elevation'])$(id).addEventListener('input',()=>dispatch({type:'orbit',yaw:Number($('yaw').value),elevation:Number($('elevation').value)}));
  for(const [id,key] of [['show-ray','showRay'],['show-section','showSection']])$(id).addEventListener('change',()=>dispatch({type:'toggle',key,value:$(id).checked}));
  const observer=new ResizeObserver(drawGeometry);for(const id of ['scene','rig','section'])observer.observe($(id));
  window.addEventListener('pagehide',()=>{observer.disconnect();scene.destroy?.();section.destroy?.();},{once:true});
  render();
}
start().catch(error=>{
  $('status').textContent='Lesson unavailable. '+error.message+' Try reloading the page.';
  $('status').classList.add('error');document.querySelectorAll('#lesson button,#lesson input').forEach(e=>{e.disabled=true;});console.error(error);
});
