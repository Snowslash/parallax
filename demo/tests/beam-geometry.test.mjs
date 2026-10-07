import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../beam-geometry.mjs').catch(e => {
  if (e.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw e;
});
const {DEFAULT_POSE, LIMITS, normalizePose, cameraForPose, projectPoint, renderProjection} = module;
const close = (a,b,e=1e-9) => assert.ok(Math.abs(a-b)<e, `${a} != ${b}`);
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const sub = (a,b) => a.map((x,i)=>x-b[i]);

test('pose defaults, bounds, wrapping and fractional values',()=>{
  assert.equal(typeof normalizePose,'function');
  assert.deepEqual(DEFAULT_POSE,{orbit:0,tilt:0,x:0,y:0,z:0});
  assert.deepEqual(LIMITS,{tilt:[-60,60],x:[-120,120],y:[-200,200],z:[-120,120]});
  assert.deepEqual(normalizePose(),DEFAULT_POSE);
  assert.equal(normalizePose({orbit:17.3}).orbit,17.3);
  assert.equal(normalizePose({orbit:113.65}).orbit,113.65);
  assert.deepEqual(normalizePose({orbit:-.25,tilt:100,x:-200,y:300,z:150}),{orbit:359.75,tilt:60,x:-120,y:200,z:120});
  assert.deepEqual(normalizePose({orbit:720.125,tilt:-12.4,x:1.1,y:-2.2,z:3.3}),{orbit:.125,tilt:-12.4,x:1.1,y:-2.2,z:3.3});
  for(const k of Object.keys(DEFAULT_POSE)) for(const v of [NaN,Infinity,-Infinity,'1',null,undefined]) assert.throws(()=>normalizePose({[k]:v}));
  for(const v of [null,[],42,'x']) assert.throws(()=>normalizePose(v));
});
test('rig cardinal axes and independent matrix rotation of fractional pose',()=>{
  assert.equal(typeof cameraForPose,'function');
  const c = cameraForPose();
  assert.deepEqual(c.source,[0,-800,0]); assert.deepEqual(c.centre,[0,400,0]);
  for(const pose of [{orbit:90},{orbit:0,tilt:60},{orbit:37.25,tilt:-21.75,x:11.2,y:-6.3,z:4.8}]){
    const a=cameraForPose(pose,128), p=normalizePose(pose), t=p.orbit*Math.PI/180, f=p.tilt*Math.PI/180;
    const rotate=v=>{const w=[v[0],Math.cos(f)*v[1]-Math.sin(f)*v[2],Math.sin(f)*v[1]+Math.cos(f)*v[2]];return [Math.cos(t)*w[0]-Math.sin(t)*w[1],Math.sin(t)*w[0]+Math.cos(t)*w[1],w[2]];};
    for(const [name,v] of [['right',[1,0,0]],['forward',[0,1,0]],['up',[0,0,1]]]) a[name].forEach((x,i)=>close(x,rotate(v)[i]));
    close(dot(a.right,a.up),0); close(dot(a.forward,a.up),0); close(dot(a.forward,a.right),0);
    close(Math.hypot(...sub(a.source,a.pivot)),800); close(Math.hypot(...sub(a.centre,a.source)),1200);
    for(let i=0;i<3;i++){close(a.source[i],a.pivot[i]-800*a.forward[i]);close(a.centre[i],a.pivot[i]+400*a.forward[i]);}
    assert.equal(a.pixelMm,1); assert.equal(a.sdd,1200); assert.equal(a.sourcePivot,800);
  }
});
test('pixel centres, signs, depth magnification and ray consistency',()=>{
  assert.equal(typeof projectPoint,'function');
  const c=cameraForPose();
  assert.deepEqual(projectPoint(c,[0,0,0]),[127.5,127.5]);
  assert.deepEqual(projectPoint(c,[2,0,3]),[133.5,118.5]);
  close(projectPoint(c,[2,100,0])[0],127.5+2400/450);
  const a=cameraForPose({orbit:17.3,tilt:28.2,x:-8,y:12,z:3},73);
  for(const [col,row] of [[0,0],[72,72],[18.3,45.6]]){
    const target=a.centre.map((v,i)=>v+(col+.5-a.size/2)*a.pixelMm*a.right[i]-(row+.5-a.size/2)*a.pixelMm*a.up[i]);
    const p=a.source.map((v,i)=>v+.61*(target[i]-v));
    const q=projectPoint(a,p);close(q[0],col);close(q[1],row);
  }
  assert.throws(()=>projectPoint(c,c.source));
  assert.throws(()=>projectPoint(c,[NaN,0,0]));
});
test('size validation applies to camera and rendering',()=>{
  assert.equal(typeof renderProjection,'function');
  for(const n of [0,15,513,32.5,NaN,Infinity,'32']){
    assert.throws(()=>cameraForPose({},n));assert.throws(()=>renderProjection({},{size:n}));
  }
});
test('finite thickness raw integrals and fixed RGBA display mapping',()=>{
  assert.equal(typeof renderProjection,'function');
  const r=renderProjection({}, {size:257,raw:true});
  assert.equal(r.width,257); assert.equal(r.height,257); assert.deepEqual(r.pose,DEFAULT_POSE);
  assert.ok(r.pixels instanceof Uint8ClampedArray); assert.ok(r.total instanceof Float64Array);
  assert.ok(r.shell instanceof Float64Array); assert.ok(r.wire instanceof Float64Array);
  // Central +Y ray at z=0: shell 4mm, wire diagonal chord of diameter 1.3mm.
  const k=128*257+128;close(r.shell[k],.32,1e-7);close(r.wire[k],.6*1.3*Math.hypot(15,36)/36,1e-7);
  assert.ok(r.wire.filter(x=>x>0).length>100);
  for(let i=0;i<r.total.length;i++){
    assert.ok(Number.isFinite(r.total[i])&&r.total[i]>=0); close(r.total[i],r.shell[i]+r.wire[i]);
    const v=Math.round(255*(1-Math.exp(-r.total[i])));assert.deepEqual(Array.from(r.pixels.slice(4*i,4*i+4)),[v,v,v,255]);
  }
  assert.equal('total' in renderProjection({orbit:33.3,tilt:21.7,x:3.4,y:-2.3,z:1.2},{size:16}),false);
});
test('flat caps stop shell and wire outside their finite ends',()=>{
  assert.equal(typeof renderProjection,'function');
  const r=renderProjection({z:120},{size:32,raw:true});
  assert.ok(r.total.every(v=>v===0));
});
