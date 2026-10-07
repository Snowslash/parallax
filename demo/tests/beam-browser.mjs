// Real DOM/worker/WebGL checks, run on beam3d.html. No application-only test hooks.
export async function run(doc=document){
  const win=doc.defaultView,$=s=>doc.querySelector(s),results=[],errors=[];
  const check=(name,value)=>results.push({name,pass:Boolean(value)});
  if(!$('#rig-scene'))return {passed:0,total:1,results:[{name:'3D Explore exists',pass:false}]};
  const onError=e=>errors.push(e.message),onRejection=e=>errors.push(String(e.reason));
  win.addEventListener('error',onError);win.addEventListener('unhandledrejection',onRejection);
  const wait=async test=>{const end=Date.now()+15000;while(!test()){if(Date.now()>end)throw new Error('3D settle timeout: '+$('#render-status').textContent);await new Promise(r=>win.setTimeout(r,10));}};
  const settled=()=>wait(()=>doc.body.dataset.pending==='false'&&$('#projection').dataset.pose);
  const input=(id,value)=>{const e=$('#'+id);e.value=value;e.dispatchEvent(new win.Event('input',{bubbles:true}));};
  const click=s=>$(s).click(),pixels=id=>$('#'+id).toDataURL();
  const pose=()=>JSON.parse($('#projection').dataset.pose);
  await settled();click('#reset-beam');click('#reset-observer');await settled();
  const home=pixels('projection');
  check('3D WebGL scene is available',doc.body.dataset.scene==='ready'&&$('#rig-scene').width>0);
  check('wire visible from outset and modes clearly distinct',doc.body.dataset.mode==='beam3d'&&$('#wire-note').textContent.includes('visible')&&!$('#commit'));
  click('#tool-angle');input('orbit',37.4);input('tilt',19.2);await settled();
  check('non-preset orbit plus angulation changes real projection',pose().orbit===37.4&&pose().tilt===19.2&&pixels('projection')!==home);
  click('#tool-position');input('x',12);input('y',-30);input('z',8);await settled();
  const shifted=pixels('projection');check('all translation axes are preserved in acquisition',pose().x===12&&pose().y===-30&&pose().z===8);
  click('#pin-current');const pin=pixels('reference-image'),pinPose=$('#reference-image').dataset.pose;
  const sceneBefore=pixels('rig-scene');click('#tool-look');const frame=$('#projection').dataset.frame;
  input('observer-yaw',105);input('observer-elevation',41);input('observer-zoom',1.3);
  await new Promise(resolve=>win.requestAnimationFrame(resolve));
  check('observer changes neither acquisition nor captured images',pixels('projection')===shifted&&pixels('reference-image')===pin&&$('#projection').dataset.frame===frame);
  check('observer controls actually change the explanatory scene',pixels('rig-scene')!==sceneBefore);
  const sceneCanvas=$('#rig-scene'),sceneRect=sceneCanvas.getBoundingClientRect(),scenePoint={x:sceneRect.x+sceneRect.width/2,y:sceneRect.y+sceneRect.height/2};
  const pointer=(target,type,x,y,buttons=1)=>target.dispatchEvent(new win.PointerEvent(type,{bubbles:true,pointerId:12,pointerType:'mouse',clientX:x,clientY:y,button:0,buttons}));
  pointer(sceneCanvas,'pointerdown',scenePoint.x,scenePoint.y);pointer(sceneCanvas,'pointermove',scenePoint.x+25,scenePoint.y+10);pointer(sceneCanvas,'pointerup',scenePoint.x+25,scenePoint.y+10,0);
  check('observer direct drag changes viewpoint without acquisition',$('#observer-yaw').value!=='105'&&pixels('projection')===shifted&&$('#projection').dataset.frame===frame);
  click('#reset-observer');check('observer reset leaves acquisition untouched',pixels('projection')===shifted&&$('#orbit').value==='37.4'&&$('#x').value==='12');
  click('#tool-angle');click('[data-preset="90"]');await settled();
  check('orbit preset leaves tilt and translation untouched',pose().orbit===90&&pose().tilt===19.2&&pose().x===12&&pose().y===-30&&pose().z===8);
  check('pin stores immutable image and complete acquisition pose',pixels('reference-image')===pin&&$('#reference-image').dataset.pose===pinPose);
  const handle=$('[data-handle="orbit"]');handle.focus({preventScroll:true});handle.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await settled();
  check('rig handle is keyboard-operable',pose().orbit===91&&doc.activeElement===handle);
  handle.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowLeft',shiftKey:true,bubbles:true}));await settled();check('coarse keyboard step works',pose().orbit===81);
  // Constructed pointer input at actual rendered handle position, not app-state mutation.
  click('#reset-beam');click('#reset-observer');await settled();
  // Wait for shared smooth scrolling, including a target clamped by page edges.
  const scrollTarget=Math.max(0,Math.min(doc.documentElement.scrollHeight-win.innerHeight,win.scrollY+$('#rig-view').getBoundingClientRect().bottom-win.innerHeight));
  $('#rig-view').scrollIntoView({block:'end'});
  await wait(()=>Math.abs(win.scrollY-scrollTarget)<1);
  await new Promise(resolve=>win.requestAnimationFrame(resolve));
  if(win.innerWidth<=780){
    const r=$('#rig-view').getBoundingClientRect();
    const images=[...doc.querySelectorAll('.projection-surface')].map(e=>e.getBoundingClientRect());
    check('narrow screen can see both projections while manipulating the rig',images.every(i=>i.top>=0&&i.bottom<=win.innerHeight)&&r.bottom<=win.innerHeight+1);
  }
  const drag=async(axis,dx,dy)=>{
    await new Promise(resolve=>win.requestAnimationFrame(resolve));
    const h=$(`[data-handle="${axis}"]`),r=h.getBoundingClientRect(),sx=r.x+r.width/2,sy=r.y+r.height/2;
    check(axis+' handle is visible and directly hittable',!h.hidden&&doc.elementFromPoint(sx,sy)===h);
    const top=$('#rig-view').getBoundingClientRect().top,scroll=win.scrollY;
    for(const [type,x,y,buttons] of [['pointerdown',sx,sy,1],['pointermove',sx+dx,sy+dy,1],['pointerup',sx+dx,sy+dy,0]])h.dispatchEvent(new win.PointerEvent(type,{bubbles:true,pointerId:11,pointerType:'mouse',clientX:x,clientY:y,button:0,buttons}));
    check(axis+' drag keeps scene position and scroll stable',Math.abs($('#rig-view').getBoundingClientRect().top-top)<.1&&win.scrollY===scroll);
    await settled();
  };
  await drag('orbit',30,0);check('direct orbital handle changes acquisition',Math.abs(pose().orbit)>.1&&pixels('projection')!==home);
  await drag('tilt',20,15);check('direct angulation handle changes acquisition',Math.abs(pose().tilt)>.1);
  click('#tool-position');await new Promise(resolve=>win.requestAnimationFrame(resolve));
  const axisBounds=['x','y','z'].map(axis=>$(`[data-handle="${axis}"]`).getBoundingClientRect());
  check('translation labels do not overlap in the default observer view',axisBounds.every((a,i)=>axisBounds.slice(i+1).every(b=>a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top)));
  await drag('x',20,0);check('direct translation handle changes acquisition',Math.abs(pose().x)>.1);
  await drag('y',0,-20);check('direct height handle changes acquisition',Math.abs(pose().y)>.1);
  await drag('z',-20,10);check('direct along-phantom handle changes acquisition',Math.abs(pose().z)>.1);
  const unchanged=JSON.stringify(pose()),canvasRect=sceneCanvas.getBoundingClientRect();
  pointer(sceneCanvas,'pointerdown',canvasRect.x+10,canvasRect.y+50);pointer(sceneCanvas,'pointermove',canvasRect.x+30,canvasRect.y+65);pointer(sceneCanvas,'pointerup',canvasRect.x+30,canvasRect.y+65,0);
  check('empty-space acquisition dragging has no side effects',JSON.stringify(pose())===unchanged&&$('#observer-yaw').value==='35');
  const before=pixels('projection'),beforePose=$('#projection').dataset.pose;
  input('x',15);input('y',22);input('z',17);input('orbit',173.2);input('tilt',-23.4);
  check('rapid staging does not relabel the previous frame',doc.body.dataset.pending==='true'&&pixels('projection')===before&&$('#projection').dataset.pose===beforePose);
  click('#pin-current');check('pin during pending work holds displayed frame',$('#reference-image').dataset.pose===beforePose);
  await settled();check('rapid input settles at latest full pose',pose().orbit===173.2&&pose().tilt===-23.4&&pose().x===15&&pose().y===22&&pose().z===17);
  const held=$('#reference-image').dataset.pose;click('#reset-beam');await settled();
  check('beam reset restores original exact raster but retains pin',pixels('projection')===home&&$('#reference-image').dataset.pose===held);
  click('#tool-angle');click('[data-preset="90"]');await settled();
  const image=new win.Image();image.src='tests/fixtures/beam-090.png';await image.decode();
  const expected=doc.createElement('canvas');expected.width=expected.height=256;expected.getContext('2d').drawImage(image,0,0);
  check('on-demand reference-angle raster matches original exact cache',pixels('projection')===expected.toDataURL());
  click('#tool-position');input('z',120);await settled();
  const data=$('#projection').getContext('2d').getImageData(0,0,256,256).data;
  check('out-of-field acquisition is not silently recentered',pose().z===120&&data.filter((v,i)=>i%4!==3).every(v=>v===0));
  click('#reset-beam');await settled();click('#tool-angle');
  const bounds=[...doc.querySelectorAll('.projection-surface')].map(e=>e.getBoundingClientRect());
  check('comparison images are equal squares',bounds.length===2&&bounds.every(r=>Math.abs(r.width-r.height)<1)&&Math.abs(bounds[0].width-bounds[1].width)<1);
  check('no document overflow',doc.documentElement.scrollWidth<=win.innerWidth);
  check('all controls have accessible names',['orbit','tilt','x','y','z'].every(id=>$('#'+id).labels.length>0));
  check('runtime uses only same-origin resources',win.performance.getEntriesByType('resource').every(r=>new URL(r.name).origin===win.location.origin));
  check('no observed pointer or runtime errors',errors.length===0);
  win.removeEventListener('error',onError);win.removeEventListener('unhandledrejection',onRejection);
  return {viewport:[win.innerWidth,win.innerHeight],passed:results.filter(r=>r.pass).length,total:results.length,results,errors};
}

export async function measure(doc=document){
  const win=doc.defaultView,$=s=>doc.querySelector(s),samples=[];
  for(let i=0;i<24;i++){
    const orbit=(i*13.7+11.3)%360,tilt=(i%7-3)*8.1;
    const start=win.performance.now();
    for(const [id,value] of [['orbit',orbit],['tilt',tilt]]){const e=$('#'+id);e.value=value;e.dispatchEvent(new win.Event('input',{bubbles:true}));}
    await new Promise((resolve,reject)=>{const end=start+15000;function inspect(){const p=JSON.parse($('#projection').dataset.pose||'{}');if(doc.body.dataset.pending==='false'&&Math.abs(p.orbit-Number($('#orbit').value))<1e-7&&p.tilt===Number($('#tilt').value))resolve();else if(win.performance.now()>end)reject(new Error('measure timeout'));else win.requestAnimationFrame(inspect);}win.requestAnimationFrame(inspect);});
    samples.push({orbit:JSON.parse($('#projection').dataset.pose).orbit,tilt,pose_to_frame_ms:win.performance.now()-start,worker_render_ms:Number($('#projection').dataset.renderMs)});
  }
  const stats=key=>{const a=samples.map(s=>s[key]).sort((a,b)=>a-b);return {min:a[0],median:(a[11]+a[12])/2,p95:a[22],max:a[23]};};
  $('#reset-beam').click();
  return {userAgent:win.navigator.userAgent,viewport:[win.innerWidth,win.innerHeight],method:'two synchronous pose inputs to first animation frame observing matching rendered pose; analytic worker time separately; not remote-client FPS',samples,pose_to_frame_ms:stats('pose_to_frame_ms'),worker_render_ms:stats('worker_render_ms')};
}

export async function sweep(doc=document){
  const win=doc.defaultView,$=s=>doc.querySelector(s),THREE=await import('../vendor/three-r186/three.module.js');
  $('#reset-beam').click();$('#reset-observer').click();$('#tool-angle').click();
  while(doc.body.dataset.pending==='true')await new Promise(r=>win.setTimeout(r,10));
  $('#rig-view').scrollIntoView({block:'end'});await new Promise(r=>win.requestAnimationFrame(r));
  const rect=$('#rig-scene').getBoundingClientRect(),camera=new THREE.PerspectiveCamera(48,rect.width/rect.height,1,7000);
  const az=35*Math.PI/180,el=25*Math.PI/180,distance=3000/Math.min(1,camera.aspect);
  camera.position.set(Math.sin(az)*Math.cos(el)*distance,Math.sin(el)*distance,Math.cos(az)*Math.cos(el)*distance);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const point=angle=>{const a=angle*Math.PI/180,v=new THREE.Vector3(800*Math.sin(a),-800*Math.cos(a),0).project(camera);return {x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};};
  const handle=$('#handle-orbit'),dispatch=(type,p,buttons=1)=>handle.dispatchEvent(new win.PointerEvent(type,{bubbles:true,pointerId:18,pointerType:'mouse',clientX:p.x,clientY:p.y,button:0,buttons}));
  const samples=[],start=win.performance.now();dispatch('pointerdown',point(0));
  for(let i=1;i<=72;i++){
    const target=i*2.5;dispatch('pointermove',point(target));
    await new Promise(r=>win.setTimeout(r,12));
    samples.push({target,staged:Number($('#orbit').value),displayed:JSON.parse($('#projection').dataset.pose).orbit,frame:Number($('#projection').dataset.frame),pending:doc.body.dataset.pending==='true'});
  }
  dispatch('pointerup',point(180),0);const released=win.performance.now();
  const deadline=released+10000;while(doc.body.dataset.pending==='true'){if(win.performance.now()>deadline)throw new Error('Sweep settle timeout');await new Promise(r=>win.setTimeout(r,5));}
  const final=JSON.parse($('#projection').dataset.pose),ids=samples.map(s=>s.frame);
  return {method:'72 constructed pointer moves around source orbit, 2.5° targets, requested 12ms between moves; real worker/Three.js via HTTPS; not native mouse/touch or a frame-rate claim',elapsed_ms:win.performance.now()-start,release_to_settled_ms:win.performance.now()-released,distinct_observed_frames:new Set(ids).size,max_staged_error_deg:Math.max(...samples.map(s=>Math.abs(s.target-s.staged))),monotonic_frame_ids:ids.every((v,i)=>i===0||v>=ids[i-1]),final_pose:final,passed:Math.abs(final.orbit-180)<.1&&ids.every((v,i)=>i===0||v>=ids[i-1]),samples};
}
