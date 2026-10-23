import test from 'node:test';
import assert from 'node:assert/strict';
const load=async()=>import('../guidewire-fracture/camera.mjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('pose validates without clipping, wraps only orbit, rejects translation',async()=>{
 const {normalizePose,isAdditionalPose}=await load();
 assert.deepEqual(normalizePose({orbit:-343,angulation:11}),{orbit:17,angulation:11});
 for(const p of [null,{}, {orbit:NaN,angulation:0},{orbit:0,angulation:61},{orbit:0,angulation:-61},{orbit:0,angulation:0,x:1}])assert.throws(()=>normalizePose(p));
 assert.equal(isAdditionalPose({orbit:180,angulation:0}),false);assert.equal(isAdditionalPose({orbit:0,angulation:0}),false);assert.equal(isAdditionalPose({orbit:0,angulation:11}),true);
});
test('matrix rotation and asymmetric depth fiducials independently match pose camera',async()=>{
 const {cameraForPose}=await load();const {projectPoint,pixelRay}=await import('../guidewire-fracture/render-core.mjs');
 for(const orbit of [17,73,213,321])for(const angulation of [-19,11]){
  const o=orbit*Math.PI/180,a=angulation*Math.PI/180;
  const Ry=[[Math.cos(o),0,Math.sin(o)],[0,1,0],[-Math.sin(o),0,Math.cos(o)]];
  const Rx=[[1,0,0],[0,Math.cos(a),-Math.sin(a)],[0,Math.sin(a),Math.cos(a)]];
  const mul=(m,v)=>m.map(r=>r.reduce((s,x,k)=>s+x*v[k],0)),rotate=v=>mul(Ry,mul(Rx,v));
  const c=cameraForPose({orbit,angulation});
  for(const [key,v] of [['right',[1,0,0]],['up',[0,1,0]],['forward',[0,0,-1]]])rotate(v).forEach((x,k)=>near(x,c[key][k]));
  for(const p of [[13,29,41],[-22,7,-37],[4,-51,19]]){
   const cam=mul(Rx[0].map((_,i)=>Rx.map(r=>r[i])),mul(Ry[0].map((_,i)=>Ry.map(r=>r[i])),p));
   const q=projectPoint(c,p),depth=800-cam[2];near(q.depth,depth);near(q.col,159.5+cam[0]*1200/depth/(210/320));near(q.row,159.5-cam[1]*1200/depth/(210/320));
   const ray=pixelRay(c,q.row,q.col),delta=p.map((x,k)=>x-c.source[k]);const t=Math.hypot(...delta);delta.forEach((x,k)=>near(x/t,ray.direction[k]));
  }
 }
});
test('olive full sphere framing rejects clipped and behind-source cases',async()=>{
 const {cameraForPose}=await load(),{oliveInFrame}=await import('../guidewire-fracture/render-core.mjs');const c=cameraForPose({orbit:0,angulation:0});
 const wire=p=>({points:[p],oliveRadiusMm:2.25});assert.equal(oliveInFrame(wire([0,-50,0]),c),true);assert.equal(oliveInFrame(wire([70,0,0]),c),false);assert.equal(oliveInFrame(wire([0,0,801]),c),false);
});
