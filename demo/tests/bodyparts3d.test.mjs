import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {boxOBJ,boxLength,OUTER,CORE,POSES,referenceCamera,materialReference} from '../../spikes/005-mesh-projection/fixtures.mjs';
const url=new URL('../mesh-spike/geometry.mjs',import.meta.url);
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const pair=g=>[g.buildMesh(g.parseOBJ(boxOBJ(OUTER))),g.buildMesh(g.parseOBJ(boxOBJ(CORE)))];

test('paired renderer exposes unchanged dual-material integrator and framing',async()=>{
  const g=await import(url),base=await import('../mesh-spike/integrator.mjs');
  for(const k of ['parseOBJ','buildMesh','integrateRay'])assert.equal(g[k].toString(),base[k].toString());
  assert.equal(g.MU_SHELL,.04);assert.equal(g.MU_CORE,.008);assert.equal(g.MU_UNIFORM,.02);
  assert.deepEqual(g.DEFAULT_MESH_POSE,{orbit:0,tilt:0,x:0,y:0,z:0});
  assert.deepEqual(g.meshCamera().pivot,[0,0,0]);
  const framing=JSON.parse(await readFile(new URL('../../spikes/008-bodyparts3d-cortex/framing.json',import.meta.url),'utf8'));
  assert.deepEqual(g.SOURCE_ORIGIN,framing.source_origin);
  const p=g.parseOBJ(boxOBJ(OUTER)),before=structuredClone(p),q=g.previewGeometry(p);
  assert.deepEqual(p,before);assert.deepEqual(q.faces,p.faces);
  q.vertices.forEach((v,i)=>assert.equal(v,p.vertices[i]-g.SOURCE_ORIGIN[i%3]));
});
test('paired pixels and raw arrays match independent boxes at the same pixel centres',async()=>{
  const g=await import(url),[outer,core]=pair(g);
  for(const pose of POSES){const size=32,f=g.renderMeshProjection(outer,core,pose,{size,raw:true}),ref=referenceCamera(pose,size);
    assert.equal(f.invalidCount,0);assert.deepEqual(f.pose,pose);assert.equal(f.camera.pixelMm,320/size);
    assert.equal(f.pixels.length,size*size*4);assert.equal(f.uniformPixels.length,f.pixels.length);
    for(let row=0;row<size;row++)for(let col=0;col<size;col++){
      const i=row*size+col,r=materialReference(ref.source,ref.detector(row,col));
      for(const k of ['outer','core','shell','attenuation'])near(f[k][i],r[k]);
      near(f.uniformAttenuation[i],.02*r.outer);
      for(const [pixels,A] of [[f.pixels,r.attenuation],[f.uniformPixels,.02*r.outer]]){
        const grey=Math.round(255*(1-Math.exp(-A)));assert.deepEqual(Array.from(pixels.slice(4*i,4*i+4)),[grey,grey,grey,255]);
      }
    }
  }
});
test('finite rays inside and outside agree with independent material lengths',async()=>{
  const g=await import(url),[o,c]=pair(g);
  for(const [s,d] of [[[0,-100,0],[0,100,0]],[[0,0,0],[1,100,2]],[[1,-100,2],[0,0,0]],[[0,0,0],[1,2,3]],[[100,100,100],[110,110,110]]]){
    for(const [a,b] of [[s,d],[d,s]]){const r=g.integrateRay(o,c,a,b),ref=materialReference(a,b);assert.equal(r.valid,true);for(const k of ['outer','core','shell','attenuation'])near(r[k],ref[k]);}
  }
});
test('invalid boundaries and escaping cores are not hidden by comparison mode',async()=>{
  const g=await import(url),[o,c]=pair(g),escaping=g.buildMesh(g.parseOBJ(boxOBJ({lo:[-2,40,-2],hi:[2,45,2]})));
  const r=g.integrateRay(o,escaping,[0,-100,0],[0,100,0]);assert.equal(r.valid,false);assert.match(r.reason,/nest|contain/);
  const f=g.renderMeshProjection(o,c,{orbit:0,tilt:0,x:-31,y:0,z:0},{size:17,raw:true});assert.ok(f.invalidCount>0);
  for(const r of f.invalidRays){const i=r.row*17+r.col;assert.ok(Number.isNaN(f.uniformAttenuation[i]));for(const a of [f.pixels,f.uniformPixels])assert.deepEqual(Array.from(a.slice(4*i,4*i+4)),[255,0,255,255]);}
});
test('planar refinement preserves both material calculations and camera validation',async()=>{
  const g=await import(url),[o,c]=pair(g),or=g.buildMesh(g.parseOBJ(boxOBJ(OUTER,true))),cr=g.buildMesh(g.parseOBJ(boxOBJ(CORE,true)));
  const a=g.renderMeshProjection(o,c,POSES[0],{size:32}),b=g.renderMeshProjection(or,cr,POSES[0],{size:32});
  assert.deepEqual(a.pixels,b.pixels);assert.deepEqual(a.uniformPixels,b.uniformPixels);assert.equal('outer' in a,false);
  assert.throws(()=>g.renderMeshProjection(o,c,{}, {size:15}),/size/);assert.throws(()=>g.meshCamera({orbit:NaN}),/Non-finite/);
});

test('exact reviewed assets, translation, counts and ten actual matched projections',async()=>{
  const {createHash}=await import('node:crypto'),g=await import(url),sha=b=>createHash('sha256').update(b).digest('hex');
  const report=JSON.parse(await readFile(new URL('../../spikes/008-bodyparts3d-cortex/evidence/report.json',import.meta.url),'utf8'));
  const meshes={};
  for(const [name,file,expected,count] of [['outer','femur','c941760d62e6e42546202830e1322812bae3f5de325320a3295ed10c63c2956f',report.outerTriangles],['core','core','d142649bab1ecce717f1c58c50f2043fcba2a5bf20e6e399103deec21888c04c',report.coreTriangles]]){
    const bytes=await readFile(new URL(`../mesh-spike/bp3d-cortex-v001/${file}.obj`,import.meta.url));assert.equal(sha(bytes),expected);
    const parsed=g.parseOBJ(bytes.toString()),translated=g.previewGeometry(parsed);translated.vertices.forEach((v,i)=>assert.equal(v,parsed.vertices[i]-g.SOURCE_ORIGIN[i%3]));
    meshes[name]=g.buildMesh(translated);assert.equal(meshes[name].faces.length/3,count);
  }
  assert.equal(report.frames.length,10);
  for(const expected of report.frames){
    const frame=g.renderMeshProjection(meshes.outer,meshes.core,expected.pose,{size:expected.size,raw:true});assert.equal(frame.invalidCount,0);
    for(const [name,pixels] of [['layered',frame.pixels],['uniform',frame.uniformPixels]])assert.equal(sha(pixels),expected.files[name].sha256,`${expected.tag} ${name}`);
    for(const name of ['outer','core','shell','attenuation','uniformAttenuation']){const b=Buffer.alloc(frame[name].length*8);frame[name].forEach((v,i)=>b.writeDoubleLE(v,i*8));assert.equal(sha(b),expected.files[name].sha256,`${expected.tag} ${name}`);}
  }
});
