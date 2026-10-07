// Real same-origin DOM/worker/WebGL checks; accepts a narrow iframe document.
const delay=(w,n)=>new Promise(r=>w.setTimeout(r,n));
export async function imageAgreement(){
  const cases=[{orbit:0,tilt:0,x:24,y:7,z:-68},{orbit:23.7,tilt:-17.3,x:7,y:-13,z:-21},{orbit:41.3,tilt:53.1,x:44,y:12,z:-120}],out=[];
  const canvas=document.querySelector('#mesh-projection');
  for(const pose of cases){
    for(const [id,value]of Object.entries(pose)){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}
    const end=Date.now()+10000;while(document.body.dataset.pending==='true'){if(Date.now()>end)throw new Error('agreement timeout');await delay(window,10);}
    const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',rgba)),v=>v.toString(16).padStart(2,'0')).join('');
    out.push({pose:JSON.parse(canvas.dataset.pose),size:canvas.width,rgbaSHA256:hash,invalidCount:Number(canvas.dataset.invalidCount)});
  }return out;
}
export async function run(doc=document){
  const w=doc.defaultView,$=s=>doc.querySelector(s),checks=[],errors=[];
  const check=(name,pass)=>checks.push({name,pass:Boolean(pass)});
  if(!$('#mesh-projection'))return {checks:[{name:'isolated mesh harness exists',pass:false}],passed:0,total:1};
  const err=e=>errors.push(e.message||String(e.reason));w.addEventListener('error',err);w.addEventListener('unhandledrejection',err);
  const input=(id,value)=>{const e=$('#'+id);e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
  const settle=async()=>{const end=Date.now()+60000;while(doc.body.dataset.pending!=='false'||!$('#mesh-projection').dataset.pose){if(doc.body.dataset.error==='true'||Date.now()>end)throw new Error($('#mesh-status').textContent);await delay(w,10);}};
  const pose=()=>JSON.parse($('#mesh-projection').dataset.pose),image=()=>$('#mesh-projection').toDataURL();
  await settle();$('#reset-beam').click();await settle();const home=image();
  check('bone-only page and real explanatory WebGL',doc.body.dataset.scene==='ready'&&!$('#commit')&&!$('#pin-current'));
  input('orbit',37.4);input('tilt',19.2);input('x',30);input('y',-23);input('z',-57);await settle();
  check('all acquisition axes reach matching image',pose().orbit===37.4&&pose().tilt===19.2&&pose().x===30&&pose().y===-23&&pose().z===-57&&image()!==home);
  const held=image(),heldPose=$('#mesh-projection').dataset.pose,id=$('#mesh-projection').dataset.frame,scene=$('#mesh-scene').toDataURL();
  input('observer-yaw',105);input('observer-elevation',41);input('observer-zoom',1.4);await delay(w,100);
  check('observer changes explanatory scene',$('#mesh-scene').toDataURL()!==scene);
  check('observer cannot acquire or relabel',image()===held&&$('#mesh-projection').dataset.pose===heldPose&&$('#mesh-projection').dataset.frame===id);
  input('orbit',13);input('orbit',73);input('tilt',-21.3);input('z',-77);
  check('pending retains old image and exact label',doc.body.dataset.pending==='true'&&image()===held&&$('#mesh-projection').dataset.pose===heldPose);
  await settle();check('rapid inputs settle at latest pose',pose().orbit===73&&pose().tilt===-21.3&&pose().z===-77);
  const observer=$('#observer-yaw').value;$('#reset-beam').click();await settle();check('beam reset restores exact home pixels but not observer',image()===home&&$('#observer-yaw').value===observer);
  const frame=$('#mesh-projection').dataset.frame;$('#reset-observer').click();await delay(w,60);check('observer reset does not acquire',$('#mesh-projection').dataset.frame===frame);
  input('resolution',128);await settle();check('resolution explicitly labelled with image',$('#mesh-projection').width===128&&$('#displayed-size').textContent.includes('128'));
  input('resolution',256);await settle();check('256 restored explicitly',$('#mesh-projection').width===256);
  check('zero unresolved rays',$('#mesh-projection').dataset.invalidCount==='0');
  check('no overflow',doc.documentElement.scrollWidth<=w.innerWidth);
  const r=$('#mesh-projection').getBoundingClientRect(),parent=$('#mesh-projection').parentElement.getBoundingClientRect();
  check('projection square and not clipped',Math.abs(r.width-r.height)<1&&r.left>=parent.left&&r.right<=parent.right+1);
  check('native controls named',['orbit','tilt','x','y','z','resolution','observer-yaw'].every(id=>$('#'+id).labels.length));
  check('same origin only',w.performance.getEntriesByType('resource').every(r=>new URL(r.name).origin===w.location.origin));
  check('no observed runtime errors',errors.length===0);
  w.removeEventListener('error',err);w.removeEventListener('unhandledrejection',err);
  return {viewport:[w.innerWidth,w.innerHeight],passed:checks.filter(c=>c.pass).length,total:checks.length,checks,errors};
}
export function stats(values){
  const a=[...values].sort((a,b)=>a-b),n=a.length;
  return n?{n,min:a[0],median:n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2,p95:a[Math.ceil(.95*n)-1],max:a[n-1]}:{n:0};
}
export async function coldLoads(count=5,doc=document){
  const w=doc.defaultView,loads=[];
  for(let i=0;i<count;i++){
    const f=doc.createElement('iframe');f.style.cssText='width:1280px;height:720px;position:fixed;inset:0;border:0;z-index:999';
    const loaded=new Promise(r=>f.onload=r);f.src=`mesh-spike.html?cold-sample=${i}`;doc.body.append(f);await loaded;
    const end=Date.now()+30000;
    while(!f.contentDocument.body.dataset.firstImageMs){if(Date.now()>end)throw new Error('cold-load timeout');await delay(w,20);}
    const d=f.contentDocument;
    loads.push({index:i,metrics:JSON.parse(d.querySelector('#load-metrics').textContent),workerMs:Number(d.querySelector('#mesh-projection').dataset.renderMs),resources:f.contentWindow.performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize,duration:r.duration}))});
    f.remove();
  }
  return {method:'Five fresh documents/workers, zero warm-up. Existing browser/network cache NOT cleared; Resource Timing records transfer/cache behaviour. Default 256². Not Windows-client cold start.',loads,navigationToFirstCanvasMs:stats(loads.map(l=>l.metrics.navigationToFirstCanvasMs)),parseMs:stats(loads.map(l=>l.metrics.assets.outer.parseMs+l.metrics.assets.core.parseMs)),buildMs:stats(loads.map(l=>l.metrics.assets.outer.buildMs+l.metrics.assets.core.buildMs))};
}
export async function workerFailure(){
  const {MeshController}=await import('../mesh-spike/controller.mjs'),{createWorkerRenderer}=await import('../mesh-spike/transport.mjs');
  let worker;class CapturedWorker{constructor(url,options){worker=new Worker(url,options);return worker;}}
  const t=createWorkerRenderer({WorkerClass:CapturedWorker,timeoutMs:2000}),c=new MeshController(t.render,()=>{}),home={orbit:0,tilt:0,x:24,y:7,z:-68};
  const settle=async()=>{const end=Date.now()+10000;while(c.state.pending){if(Date.now()>end)throw new Error('fault-check timeout');await delay(window,20);}};
  c.stage(home,128);await settle();const held=c.state.frame;if(!held)throw new Error(c.state.error);
  worker.terminate();c.stage({...home,orbit:31.2},128);await settle();
  const failure={message:c.state.error,retainedFrame:c.state.frame===held,retainedPose:c.state.frame.pose};
  c.retry();await settle();const recovery={error:c.state.error,pose:c.state.frame.pose,invalidCount:c.state.frame.invalidCount};t.dispose();
  return {failure,recovery,pass:failure.retainedFrame&&failure.message.includes('timed out')&&!recovery.error&&recovery.pose.orbit===31.2};
}
export async function measure(size,doc=document){
  const w=doc.defaultView,$=s=>doc.querySelector(s),samples=[],rafGaps=[],timerGaps=[];
  const input=(id,v)=>{const e=$('#'+id);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
  async function settle(){const end=w.performance.now()+60000;while(true){await new Promise(r=>w.requestAnimationFrame(r));if(doc.body.dataset.error==='true')throw new Error($('#mesh-status').textContent);if(doc.body.dataset.pending==='false'&&$('#mesh-projection').width===size)return;if(w.performance.now()>end)throw new Error('Timeout');}}
  input('resolution',size);await settle();
  let running=true,last=w.performance.now(),lastTimer=last;
  function raf(t){if(!running)return;rafGaps.push(t-last);last=t;w.requestAnimationFrame(raf);}w.requestAnimationFrame(raf);
  const timer=w.setInterval(()=>{const t=w.performance.now();timerGaps.push(t-lastTimer);lastTimer=t;},16);
  for(let i=-2;i<20;i++){
    const j=i+2,pose={orbit:(j*17.3+11.7)%360,tilt:(j%7-3)*8.1,x:24+(j%3-1)*9.2,y:7+(j%5-2)*11.3,z:-68+(j%4-1.5)*6.4};
    const start=w.performance.now();for(const [id,v]of Object.entries(pose))input(id,v);await settle();
    if(i>=0)samples.push({pose:JSON.parse($('#mesh-projection').dataset.pose),latencyMs:w.performance.now()-start,workerMs:Number($('#mesh-projection').dataset.renderMs),frame:Number($('#mesh-projection').dataset.frame)});
  }
  const motion=[],start=w.performance.now();
  for(let i=0;i<40;i++){
    input('orbit',i*3.7+3.1);await delay(w,15);
    motion.push({timeMs:w.performance.now()-start,requested:Number($('#orbit').value),displayed:JSON.parse($('#mesh-projection').dataset.pose).orbit,frame:Number($('#mesh-projection').dataset.frame),pending:doc.body.dataset.pending==='true'});
  }
  const released=w.performance.now();await settle();const releaseToImageMs=w.performance.now()-released;
  running=false;w.clearInterval(timer);
  return {size,warmup:2,samples,latencyMs:stats(samples.map(s=>s.latencyMs)),workerMs:stats(samples.map(s=>s.workerMs)),rapid:{events:40,requestedIntervalMs:15,elapsedMs:w.performance.now()-start,releaseToImageMs,finalPose:JSON.parse($('#mesh-projection').dataset.pose),monotonicFrames:motion.every((s,i)=>!i||s.frame>=motion[i-1].frame),samples:motion},responsiveness:{rafGapsMs:stats(rafGaps),timerGapsMs:stats(timerGaps),rawRafGapsMs:rafGaps,rawTimerGapsMs:timerGaps},method:'Real DOM input events; latency to animation-frame observation of matching canvas. Not FPS. Two unrecorded warm-up poses, nearest-rank p95.'};
}
