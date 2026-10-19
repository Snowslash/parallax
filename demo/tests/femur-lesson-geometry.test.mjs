import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const demoDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage=demoDir;
const m=await import('../femur-lesson/model.mjs'),g=await import('../femur-lesson/geometry.mjs');
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('lesson numerical API exists',()=>{assert.ok(m&&g,'implemented lesson modules required');for(const k of ['CASES','REFERENCE_POSES','DEFAULT_LESSON_POSE','assessmentForCase','classifyView','classifyFrame','measurePair'])assert.ok(m[k],k);});
test('finite cylinder exact diameter, chord, oblique and end caps',()=>{assert.ok(g);const w={start:[0,0,0],tip:[0,0,10],radius:1};near(g.wireChord([-3,0,5],[3,0,5],w),2);near(g.wireChord([-3,.6,5],[3,.6,5],w),1.6);near(g.wireChord([0,0,-3],[0,0,13],w),10);near(g.wireChord([-3,0,2],[3,0,8],w),2*Math.sqrt(2));near(g.wireChord([-3,2,5],[3,2,5],w),0);near(g.wireChord([0,0,9],[0,0,13],w),1);assert.throws(()=>g.wireChord([0,0,0],[0,0,0],w));});
test('authored references, strict pose validity, distinct placement truth',()=>{assert.ok(m);assert.ok(m.REFERENCE_POSES.ap.orbit>180&&m.REFERENCE_POSES.ap.orbit<200);near(m.REFERENCE_POSES.lateral.orbit-m.REFERENCE_POSES.ap.orbit,90);assert.equal(m.classifyView(m.REFERENCE_POSES.ap),'ap');assert.equal(m.classifyView({...m.REFERENCE_POSES.ap,orbit:0}),null);assert.equal(m.classifyView({...m.REFERENCE_POSES.ap,tilt:NaN}),null);assert.throws(()=>m.assessmentForCase('missing'));assert.equal(m.CASES.length,3);assert.equal(m.assessmentForCase('central-deep').meetsCriteria,true);assert.equal(m.assessmentForCase('shallow').meetsCriteria,false);assert.equal(m.assessmentForCase('eccentric-lateral').meetsCriteria,false);assert.equal(m.assessmentForCase('eccentric-lateral').centred,false);});
test('independent world-to-detector oracle, asymmetric points at varying depth',()=>{assert.ok(m);for(const pose of [m.REFERENCE_POSES.ap,m.REFERENCE_POSES.lateral,{orbit:37,tilt:-23,x:31,y:-18,z:42}])for(const point of [[-23,51,63],[35,-72,11],[6,120,-43]]){const a=pose.orbit*Math.PI/180,b=pose.tilt*Math.PI/180,dx=point[0]-pose.x,dy=point[1]-pose.y,dz=point[2]-pose.z;const rx=Math.cos(a)*dx+Math.sin(a)*dy,ry=-Math.sin(a)*dx+Math.cos(a)*dy;const depth=800+Math.cos(b)*ry+Math.sin(b)*dz;const vertical=-Math.sin(b)*ry+Math.cos(b)*dz;const got=m.projectLandmark(pose,point,256);near(got.px[0],127.5+1200*rx/depth/(320/256));near(got.px[1],127.5-1200*vertical/depth/(320/256));near(got.magnification,1200/depth);}});
test('magnification correction invariant to source depth and pixel resolution',()=>{assert.ok(m);for(const view of ['ap','lateral']){const ref=m.measureCase('central-deep',m.REFERENCE_POSES[view],256);for(const size of [64,512]){const p={...m.REFERENCE_POSES[view],y:m.REFERENCE_POSES[view].y+80};const r=m.measureCase('central-deep',p,size);near(r.distanceMm,ref.distanceMm);assert.notEqual(r.magnification,ref.magnification);}}});
test('learner calipers and reference use identical endpoint correction for all presets and translated views',async()=>{
  const {measuredDistance}=await import(pathToFileURL(path.join(demoDir,'femur-lesson/calipers.mjs')));
  for(const c of m.CASES)for(const ref of Object.values(m.REFERENCE_POSES))for(const offset of [0,50]){
    const r=m.measureCase(c.id,{...ref,y:ref.y+offset},256);
    near(measuredDistance([r.tipPx,r.apexPx],320/256,{tip:r.magnification,apex:r.apexMagnification,centre:127.5}),r.distanceMm);
  }
});
let loaded;
async function meshes(){if(loaded)return loaded;const engine=await import('../femur-lesson/ct/integrator.mjs'),{renderRestrained}=await import('../femur-lesson/ct/material.mjs');const assets=new URL('../femur-lesson/assets/',import.meta.url);const field={...JSON.parse(await readFile(new URL('density.json',assets),'utf8')),data:new Uint8Array(await readFile(new URL('density.u8',assets)))};const old={renderMeshProjection:(a,b,p,o)=>renderRestrained(a,b,field,p,o)},out={old,field};for(const [k,file]of [['outer','outer.obj'],['core','envelope.obj']])out[k]=engine.buildMesh(engine.parseOBJ(await readFile(new URL(file,assets),'utf8')));return loaded=out;}
test('every preset follows a 130 degree guide trajectory rather than the neck axis',()=>{
  for(const c of m.CASES){
    const d=c.wire.tip.map((v,i)=>v-c.wire.start[i]),length=Math.hypot(...d);
    near(length,105);const shaft=[-0.11116470192903292,0.17603582406488205,-0.9780868047831067];near(Math.acos(d.reduce((s,v,i)=>s+v*shaft[i],0)/length)*180/Math.PI,130);
    assert.ok(Math.abs(d[0]*m.LANDMARKS.axis[1]-d[1]*m.LANDMARKS.axis[0])>1,'refitted guide is not the neck axis');
  }
});
test('130 degree wires enter lower lateral cortex without sampled neck re-entry or an internal tail',async()=>{
  const {outer}=await meshes(),sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>a.map(v=>v/Math.hypot(...a));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function exits(p,d){
    const hits=[];
    for(const t of outer.triangles){const ab=sub(t.b,t.a),ac=sub(t.c,t.a),q=cross(d,ac),det=dot(ab,q);if(Math.abs(det)<1e-10)continue;const s=sub(p,t.a),u=dot(s,q)/det,r=cross(s,ab),v=dot(d,r)/det,distance=dot(ac,r)/det;if(u>=-1e-10&&v>=-1e-10&&u+v<=1+1e-10&&distance>1e-7)hits.push(distance);}
    return hits.sort((a,b)=>a-b).filter((v,i,a)=>i===0||Math.abs(v-a[i-1])>1e-6);
  }
  for(const c of m.CASES){
    const back=unit(sub(c.wire.start,c.wire.tip)),current=exits(c.wire.tip,back);
    assert.equal(current.length,1);
    const entry=c.wire.tip.map((v,i)=>v+current[0]*back[i]);
    // CT anatomy: test the actual lateral/distal entry, not the old model's neck-axis counterfactual.
    const distal=[-0.11116470192903292,0.17603582406488205,-0.9780868047831067];
    assert.ok(dot(sub(entry,m.LANDMARKS.neckBase),distal)>0,`${c.id}: entry is distal to the neck base`);
    assert.ok(entry[0]<m.LANDMARKS.neckBase[0],`${c.id}: entry stays lateral`);
    const u=unit(cross(back,[0,0,1])),v=cross(back,u);
    for(let k=0;k<8;k++){
      const a=k*Math.PI/4,p=c.wire.tip.map((x,i)=>x+c.wire.radius*(u[i]*Math.cos(a)+v[i]*Math.sin(a))),hits=exits(p,back);
      assert.equal(hits.length,1,`${c.id}: sampled cylinder rim crosses cortex once`);
      assert.ok(hits[0]<105-2,`${c.id}: sampled finite tail extends outside cortex`);
    }
  }
});
test('all six actual mesh renders: valid, visible wire, independent head and tip framing, paired criteria',async()=>{assert.ok(g&&m);const {outer,core,old,field}=await meshes();for(const c of m.CASES){const frames={};for(const view of ['ap','lateral']){const pose=m.REFERENCE_POSES[view],frame=g.renderLessonProjection(outer,core,c.id,pose,{size:256,raw:true,field});frames[view]=frame;assert.equal(frame.caseId,c.id);assert.equal(frame.invalidCount,0);assert.equal(m.classifyFrame(frame),view);assert.equal(frame.adequacy.framed,true);assert.ok(frame.wire.filter(x=>x>.1).length>20);const bone=old.renderMeshProjection(outer,core,pose,{size:256,raw:true});assert.deepEqual(frame.boneAttenuation,bone.attenuation);let changed=0;for(let i=0;i<frame.wire.length;i++){if(frame.wire[i]===0)assert.equal(frame.pixels[4*i],bone.pixels[4*i]);if(frame.pixels[4*i]>bone.pixels[4*i]+20)changed++;}assert.ok(changed>20,`visible ${c.id}/${view}: ${changed}`);const tip=frame.measurement.tipPx;let tipVisible=false;for(let y=Math.floor(tip[1])-2;y<=Math.ceil(tip[1])+2;y++)for(let x=Math.floor(tip[0])-2;x<=Math.ceil(tip[0])+2;x++){const i=y*256+x;if(i>=0&&i<frame.wire.length&&frame.wire[i]>.1)tipVisible=true;}assert.ok(tipVisible,'tip neighbourhood samples metal');}
const pair=m.measurePair(frames.ap,frames.lateral);assert.equal(pair.valid,true);assert.equal(pair.meetsCriteria,m.assessmentForCase(c.id).meetsCriteria);assert.equal(m.measurePair(frames.ap,frames.ap).valid,false);assert.equal(m.classifyFrame({...frames.ap,invalidCount:1}),null);assert.equal(m.classifyFrame({...frames.ap,pose:{...frames.ap.pose,x:120,y:200,z:-120}}),null);}
});
test('mesh apex and finite tip surface clearance independently checked',async()=>{assert.ok(m);const {outer}=await meshes();const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]);function distance(p,t){const a=t.a,b=t.b,c=t.c,ab=sub(b,a),ac=sub(c,a),ap=sub(p,a);const n=t.normal;const s=dot(ap,n)/dot(n,n);const q=p.map((x,i)=>x-s*n[i]);const v=sub(q,a),aa=dot(ab,ab),bb=dot(ab,ac),cc=dot(ac,ac),dd=dot(v,ab),ee=dot(v,ac),den=aa*cc-bb*bb;const u=(cc*dd-bb*ee)/den,w=(aa*ee-bb*dd)/den;if(u>=0&&w>=0&&u+w<=1)return Math.abs(s)*Math.hypot(...n);return Math.min(...[[a,b],[b,c],[c,a]].map(([a,b])=>{const v=sub(b,a),f=Math.max(0,Math.min(1,dot(sub(p,a),v)/dot(v,v)));return Math.hypot(...sub(p,a.map((x,i)=>x+f*v[i])));}));}const apexDistance=Math.min(...outer.triangles.map(t=>distance(m.LANDMARKS.apex,t)));assert.ok(apexDistance<1e-5);for(const c of m.CASES){const clearance=Math.min(...outer.triangles.map(t=>distance(c.wire.tip,t)))-c.wire.radius;assert.ok(clearance>.5,`${c.id} tip cap clearance ${clearance}`);}});
test('saved-frame API uses actual pose, rejects missing/mismatched captures and discloses proxy',async()=>{assert.equal(typeof m?.measureFrame,'function');assert.equal(typeof m?.assessCaptures,'function');const {outer,core,field}=await meshes();const ap=g.renderLessonProjection(outer,core,'eccentric-lateral',{...m.REFERENCE_POSES.ap,orbit:m.REFERENCE_POSES.ap.orbit+2},{size:64,field});const lateral=g.renderLessonProjection(outer,core,'eccentric-lateral',m.REFERENCE_POSES.lateral,{size:64,field});const r=m.assessCaptures('eccentric-lateral',{ap,lateral});assert.equal(r.valid,true);assert.equal(r.meets,false);assert.ok(r.tadMm<25);assert.match(r.feedback,/centre|centr/);assert.notEqual(m.measureFrame(ap).distanceMm,m.assessmentForCase('eccentric-lateral').ap.distanceMm);near(r.tadMm,m.measureFrame(ap).distanceMm+m.measureFrame(lateral).distanceMm);assert.equal(m.assessCaptures('shallow',{ap,lateral}).valid,false);assert.equal(m.assessCaptures('eccentric-lateral',{}).valid,false);});
test('authored head envelope contains every selected head triangle vertex',async()=>{const {outer}=await meshes();let count=0;for(const t of outer.triangles){const points=[t.a,t.b,t.c];if(points.some(p=>p.reduce((sum,v,i)=>sum+(v-m.LANDMARKS.neckBase[i])*m.LANDMARKS.axis[i],0)>=0))for(const p of points){count++;assert.ok(Math.hypot(...p.map((v,k)=>v-m.LANDMARKS.head[k]))<m.LANDMARKS.headEnvelopeRadius);}}assert.ok(count>100);});
test('strict render rejection of unknown cases and malformed requests',async()=>{assert.ok(g);const {outer,core,field}=await meshes();assert.throws(()=>g.renderLessonProjection(outer,core,'missing',m.DEFAULT_LESSON_POSE));assert.throws(()=>g.renderLessonProjection(outer,core,'central-deep',{orbit:0}));assert.throws(()=>g.renderLessonProjection(outer,core,'central-deep',{...m.DEFAULT_LESSON_POSE,x:999}));assert.throws(()=>g.renderLessonProjection(outer,core,'central-deep',m.DEFAULT_LESSON_POSE,{size:NaN,field}));});
// Actual-worker hash substitution and retry coverage lives in femur-ct-runtime.test.mjs.
test('invalid bone rays remain magenta and cannot satisfy a capture gate',async()=>{const {outer,core,old,field}=await meshes();const bone=old.renderMeshProjection(core,outer,m.DEFAULT_LESSON_POSE,{size:64,raw:true});const frame=g.renderLessonProjection(core,outer,'central-deep',m.DEFAULT_LESSON_POSE,{size:64,raw:true,field});assert.ok(bone.invalidCount>0);assert.equal(frame.invalidCount,bone.invalidCount);assert.deepEqual(frame.invalidRays,bone.invalidRays);for(const r of frame.invalidRays){const i=r.row*64+r.col;assert.ok(Number.isNaN(frame.attenuation[i]));assert.deepEqual(Array.from(frame.pixels.slice(4*i,4*i+4)),[255,0,255,255]);}assert.equal(m.classifyFrame(frame),null);});
test('transport busy, ID mismatch, timeout, dispose and ready callback',async()=>{assert.ok(m);const {createLessonRenderer}=await import(pathToFileURL(path.join(stage,'femur-lesson/transport.mjs')));let w,ready=0;class W{constructor(){w=this;}postMessage(){}terminate(){this.dead=true;}}const r=createLessonRenderer({WorkerClass:W,timeoutMs:20,onReady:()=>ready++});let p=r.render({id:1});await assert.rejects(r.render({id:2}),/busy/);w.onmessage({data:{type:'ready'}});assert.equal(ready,1);w.onmessage({data:{id:3,frame:{}}});await assert.rejects(p,/ID mismatch/);p=r.render({id:4});await assert.rejects(p,/timed out/);p=r.render({id:5});r.dispose();await assert.rejects(p,/disposed/);});
