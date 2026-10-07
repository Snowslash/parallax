import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectPoint, detectorPoint, cylinderMesh, SceneView } from '../scene.mjs';

// Current guided fixtures, not the omitted first-demo evidence directory.
const lesson = JSON.parse(readFileSync(new URL('../assets/v2/lesson.json',import.meta.url)));
const cameras=lesson.geometry.cameras;
const fixture={...lesson.geometry.fixture,tips_mm:{...lesson.geometry.fixture.tips_mm,...Object.fromEntries(lesson.cases.map(c=>[c.id,c.tip]))}};
const frames=lesson.cases.flatMap(c=>c.frames.map(f=>({key:`${c.id}-${f.angle}`,state:c.id,angle_deg:f.angle,tip_uv_px:f.tip_uv_px})));
const sub = (a,b) => a.map((x,i)=>x-b[i]);
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const near = (a,b,tol=1e-9) => assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`);

for (const frame of frames) {
  test(`PNG pixel centres match Python: ${frame.key}`, () => {
    const camera = cameras.find(c=>c.angle_deg===frame.angle_deg);
    projectPoint(camera,fixture.tips_mm[frame.state]).forEach((v,i)=>near(v,frame.tip_uv_px[i]));
  });
  test(`detector plane and source-tip collinearity: ${frame.key}`, () => {
    const camera = cameras.find(c=>c.angle_deg===frame.angle_deg);
    const p = detectorPoint(camera, fixture.tips_mm[frame.state]);
    near(dot(sub(p,camera.detector_centre_mm),camera.forward),0);
    const direction = sub(fixture.tips_mm[frame.state],camera.source_mm);
    near(Math.hypot(...cross(sub(p,camera.source_mm),direction)),0,1e-7);
    assert.ok(dot(sub(p,camera.source_mm),direction)>0);
  });
}

test('cylinder preserves endpoints, physical radius, and closed triangle caps', () => {
  for (const b of [[3,5,9],[0,0,14],[0,14,0]]) {
    const a=[0,0,0], radius=0.65, n=48;
    const {vertices,faces}=cylinderMesh(a,b,radius);
    const length=Math.hypot(...b), axis=b.map(x=>x/length);
    assert.equal(vertices.length,2*n+2);
    assert.equal(faces.length,4*n);
    assert.ok(vertices.some(v=>v.every((x,i)=>x===a[i])));
    assert.ok(vertices.some(v=>v.every((x,i)=>x===b[i])));
    for (const v of vertices) {
      const t=dot(sub(v,a),axis);
      assert.ok(Math.abs(t)<1e-9 || Math.abs(t-length)<1e-9);
      const radial=Math.hypot(...sub(v,a).map((x,i)=>x-t*axis[i]));
      assert.ok(radial<1e-9 || Math.abs(radial-radius)<1e-9);
    }
    const edges=new Map();
    for (const f of faces) {
      assert.equal(f.length,3);
      assert.ok(Math.hypot(...cross(sub(vertices[f[1]],vertices[f[0]]),sub(vertices[f[2]],vertices[f[0]])))>0);
      for(let i=0;i<3;i++) { const key=[f[i],f[(i+1)%3]].sort((x,y)=>x-y).join(','); edges.set(key,(edges.get(key)||0)+1); }
    }
    assert.ok([...edges.values()].every(count=>count===2));
  }
});
test('invalid cylinder and parallel detector ray fail explicitly',()=>{
  assert.throws(()=>cylinderMesh([0,0,0],[0,0,0],1),RangeError);
  assert.throws(()=>cylinderMesh([0,0,0],[0,0,1],0),RangeError);
  assert.throws(()=>cylinderMesh([0,0,0],[0,0,1],1,2),RangeError);
  assert.throws(()=>detectorPoint(cameras[0],[1,-800,0]),RangeError);
});

// Recording Canvas2D boundary: real geometry/render methods execute without a browser.
function canvas(w=600,h=460) {
  const ops=[];
  const context=new Proxy({}, {
    get(target,key) { if(key in target)return target[key]; return (...args)=>ops.push([key,...args]); },
    set(target,key,value) { target[key]=value;ops.push(['set',key,value]);return true; }
  });
  return {width:0,height:0,ops,getContext:()=>context,getBoundingClientRect:()=>({width:w,height:h})};
}
function render(tip, visible=false, yaw=35, camera=cameras[0]) {
  const main=canvas(),rig=canvas(600,220),view=new SceneView(main,rig,fixture);
  view.render({camera,tip,wireVisible:visible,yaw});
  return {main,rig,view};
}
test('hidden scene and rig are identical across secret tips, including absent tip',()=>{
  const a=render(fixture.tips_mm.contained),b=render(fixture.tips_mm.breached),c=render(undefined);
  assert.deepEqual(a.main.ops,b.main.ops);assert.deepEqual(a.rig.ops,b.rig.ops);
  assert.deepEqual(a.main.ops,c.main.ops);assert.deepEqual(a.rig.ops,c.rig.ops);
  assert.ok(!JSON.stringify(a.main.ops).includes('#e6b96b'));
  assert.ok(a.main.ops.some(op=>op[0]==='fill'));
});
test('canvas leaves the top scene strip to DOM status and closeup labels',()=>{
  const {main}=render(undefined);
  assert.ok(!main.ops.some(op=>op[0]==='fillText' && op[3]<40));
});
test('rig labels remain separated at narrow and desktop canvas sizes',()=>{
  for(const width of [164,234,411])for(const camera of cameras){
    const main=canvas(),rig=canvas(width,108);
    new SceneView(main,rig,fixture).render({camera});
    const boxes=rig.ops.filter(op=>op[0]==='fillText').map(([,text,x,y])=>({text,x,y,w:text.length*6.5,h:11}));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      const overlaps=a.x<b.x+b.w&&b.x<a.x+a.w&&a.y-b.y<b.h&&b.y-a.y<a.h;
      assert.ok(!overlaps,`${width}px ${camera.angle_deg}°: ${a.text} overlaps ${b.text}`);
    }
  }
});
test('reveal adds amber wire/ray and tip; observer orbit never mutates inputs',()=>{
  const camera=structuredClone(cameras[1]),tip=[...fixture.tips_mm.breached];
  const before=JSON.stringify({camera,tip,fixture});
  const hidden=render(tip,false,35,camera),shown=render(tip,true,35,camera),orbited=render(tip,true,90,camera);
  assert.notDeepEqual(hidden.main.ops,shown.main.ops);
  assert.ok(JSON.stringify(shown.main.ops).includes('#e6b96b'));
  assert.notDeepEqual(shown.main.ops,orbited.main.ops);
  assert.deepEqual(shown.rig.ops,orbited.rig.ops);
  assert.equal(JSON.stringify({camera,tip,fixture}),before);
  shown.view.destroy();shown.view.destroy();
});
function extended(options={}) {
  const main=canvas(),rig=canvas(234,108),view=new SceneView(main,rig,fixture);
  view.render({camera:cameras[0],tip:[10,10,18],wireVisible:true,...options});
  return {main:main.ops,rig:rig.ops};
}
test('staged rig changes independently of captured ray and observer',()=>{
  const base=extended(),staged=extended({rigCamera:cameras[1]});
  assert.deepEqual(base.main,staged.main);assert.notDeepEqual(base.rig,staged.rig);
  const captured=extended({camera:cameras[1],rigCamera:cameras[0]});
  assert.notDeepEqual(base.main,captured.main);assert.deepEqual(base.rig,captured.rig);
  assert.deepEqual(extended({showRay:false}).main,extended({showRay:false,camera:cameras[1]}).main);
});
test('showRay only toggles captured beam, retaining wire and tip',()=>{
  const on=extended(),off=extended({showRay:false});
  assert.notDeepEqual(on.main,off.main);assert.deepEqual(on.rig,off.rig);
  assert.ok(on.main.some(o=>o[0]==='setLineDash'&&o[1].length));
  assert.ok(!off.main.some(o=>o[0]==='setLineDash'&&o[1].length));
  assert.ok(off.main.some(o=>o[0]==='arc'&&o[3]===3));
  assert.equal(on.main.filter(o=>o[0]==='fill').length,off.main.filter(o=>o[0]==='fill').length);
});
test('section cue is linked to z and gated by reveal independently of ray',()=>{
  const absent=extended({showRay:false}),section=extended({showRay:false,sectionZ:17}),moved=extended({showRay:false,sectionZ:5});
  assert.notDeepEqual(absent.main,section.main);assert.notDeepEqual(section.main,moved.main);
  assert.deepEqual(absent.rig,section.rig);
  assert.ok(section.main.some(o=>o[0]==='fillText'&&/section.*17.*mm/i.test(o[1])));
  const hidden=extended({wireVisible:false,sectionZ:17}),other=extended({wireVisible:false,tip:[0,7,18],sectionZ:9,showRay:false});
  assert.deepEqual(hidden,other);assert.deepEqual(hidden,extended({wireVisible:false}));
});

test('new plane cue label fits narrow scene and stays above observer caption',()=>{
  const main=canvas(164,180);
  new SceneView(main,null,fixture).render({camera:cameras[0],tip:[10,10,18],wireVisible:true,sectionZ:17});
  const text=main.ops.filter(o=>o[0]==='fillText'),cue=text.find(o=>/Axial section/.test(o[1]));
  assert.ok(cue);assert.ok(cue[4]>0&&cue[2]+cue[4]<=164);
  assert.ok(text.find(o=>/Observer/.test(o[1]))[3]-cue[3]>=14);
});

test('fractional layout clears and fills the whole integer backing bitmap',()=>{
  const main=canvas(385.833333,267.666667);
  new SceneView(main,null,fixture).render({camera:cameras[0]});
  assert.deepEqual(main.ops[0],['setTransform',1,0,0,1,0,0]);
  assert.deepEqual(main.ops.find(o=>o[0]==='clearRect'),['clearRect',0,0,386,268]);
  assert.deepEqual(main.ops.find(o=>o[0]==='fillRect'),['fillRect',0,0,386,268]);
});
test('rig labels actual scale overview; responsive DPR and zero-size rendering',()=>{
  const old=globalThis.devicePixelRatio;globalThis.devicePixelRatio=2;
  try {
    const {main,rig}=render(undefined);
    assert.equal(main.width,1200);assert.equal(main.height,920);
    const labels=rig.ops.filter(op=>op[0]==='fillText').map(op=>op[1]);
    for(const word of ['source','detector','phantom'])assert.ok(labels.some(label=>label.toLowerCase().includes(word)));
    // Circle is the actual 12 mm radius, scaled by the same world-to-pixel factor as the rig.
    const arc=rig.ops.find(op=>op[0]==='arc');
    assert.ok(arc[3]>0 && arc[3]<6);
    const zero=canvas(0,0);assert.doesNotThrow(()=>new SceneView(zero,zero,fixture).render({camera:cameras[0],wireVisible:false}));
  } finally { if(old===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=old; }
});
