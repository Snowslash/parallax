import test from 'node:test';
import assert from 'node:assert/strict';
// Dynamic import lets missing feature assertions fail without hiding other test results.
const api = await import('../reveal.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const fixture={inner_radius_mm:10,outer_radius_mm:12,half_length_mm:30,wire_start_mm:[0,0,-18],wire_radius_mm:.65};
const tips=[[0,15,18],[10,10,18],[0,7,18]];
function implicit(p,tip) {
  const d=tip.map((v,i)=>v-fixture.wire_start_mm[i]),q=p.map((v,i)=>v-fixture.wire_start_mm[i]);
  const len=Math.hypot(...d),s=q.reduce((v,x,i)=>v+x*d[i]/len,0);
  const r2=q.reduce((v,x,i)=>v+(x-s*d[i]/len)**2,0);
  return {s,len,r2,inside:s>=-1e-9&&s<=len+1e-9&&r2<=fixture.wire_radius_mm**2+1e-9};
}
function contains(poly,p) {
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
test('wireSection returns sampled axial ellipse on the implicit cylinder, not wire projection',()=>{
  assert.equal(typeof api.wireSection,'function');
  for(const tip of [...tips,[3,-4,-30],[0,0,18]]) {
    const z=(tip[2]+fixture.wire_start_mm[2])/2,poly=api.wireSection(fixture,tip,z);
    assert.equal(poly.length,128);
    for(const p of poly){assert.equal(p[2],z);const m=implicit(p,tip);assert.ok(m.inside);assert.ok(Math.abs(m.r2-.65**2)<1e-9);}
    const centre=tip.map((v,i)=>(v+fixture.wire_start_mm[i])/2);
    assert.ok(contains(poly,centre));assert.ok(!contains(poly,[centre[0]+3,centre[1]+3,z]));
    for(let x=-1.5;x<1.5;x+=.071)for(let y=-1.5;y<1.5;y+=.073){
      const p=[centre[0]+x,centre[1]+y,z],m=implicit(p,tip);
      // Inscribed polygon error vanishes with refinement; omit a narrow boundary band.
      if(Math.abs(m.r2-.65**2)>.001)assert.equal(contains(poly,p),m.inside);
    }
  }
});
test('flat caps clip tilted ellipse at tip, allow actual cap overhang, and reject beyond wire',()=>{
  assert.equal(typeof api.wireSection,'function');
  for(const tip of tips)for(const z of [tip[2],tip[2]+.05,fixture.wire_start_mm[2]-.05]) {
    const poly=api.wireSection(fixture,tip,z,256);assert.ok(poly.length>=3&&poly.length<256);
    assert.ok(poly.every(p=>implicit(p,tip).inside));
    assert.ok(poly.some(p=>{const m=implicit(p,tip);return Math.min(Math.abs(m.s),Math.abs(m.s-m.len))<1e-9;}));
    const c=poly[0].map((_,i)=>poly.reduce((s,p)=>s+p[i],0)/poly.length);assert.ok(implicit(c,tip).inside);
  }
  assert.deepEqual(api.wireSection(fixture,tips[0],20),[]);
  assert.deepEqual(api.wireSection(fixture,tips[0],-20),[]);
});
test('one mm proximal sections distinguish c2 outside wall and c3 inside lumen',()=>{
  assert.equal(typeof api.wireSection,'function');
  assert.ok(api.wireSection(fixture,tips[1],17).every(p=>Math.hypot(p[0],p[1])>12));
  assert.ok(api.wireSection(fixture,tips[2],17).every(p=>Math.hypot(p[0],p[1])<10));
});
test('invalid inputs and unsupported parallel-axis section fail explicitly',()=>{
  assert.equal(typeof api.wireSection,'function');
  for(const [tip,z,n] of [[[1,0,-18],17,128],[[0,0,-18],17,128],[tips[0],NaN,128],[tips[0],17,2],[tips[0],17,3.5]])assert.throws(()=>api.wireSection(fixture,tip,z,n),RangeError);
  assert.throws(()=>api.wireSection({...fixture,wire_radius_mm:0},tips[0],17),RangeError);
});
function canvas(w=240,h=220) {
  const ops=[],ctx=new Proxy({}, {get:(t,k)=>k in t?t[k]:(...a)=>{ops.push([k,...a]);},set:(t,k,v)=>{t[k]=v;ops.push(['set',k,v]);return true;}});
  return {ops,width:0,height:0,getBoundingClientRect:()=>({width:w,height:h}),getContext:()=>ctx};
}
test('hidden section clears identically without reading tip, z or camera',()=>{
  assert.equal(typeof api.SectionView,'function');
  const a=canvas(),b=canvas();
  new api.SectionView(a,fixture).render({tip:tips[0],z:17});
  new api.SectionView(b,fixture).render({get tip(){throw Error('secret');},get z(){throw Error('secret');},get camera(){throw Error('secret');}});
  assert.deepEqual(a.ops,b.ops);assert.ok(a.ops.some(o=>o[0]==='clearRect'));
  assert.ok(!a.ops.some(o=>['fill','fillText','arc','lineTo'].includes(o[0])));
});
test('revealed annulus, footprint, axes and proximal label fit narrow panels with separate label rows',()=>{
  assert.equal(typeof api.SectionView,'function');
  for(const [w,h] of [[164,180],[240,220],[600,320]]) {
    const c=canvas(w,h);new api.SectionView(c,fixture).render({tip:tips[1],visible:true,z:17});
    const text=c.ops.filter(o=>o[0]==='fillText');
    assert.ok(text.some(o=>/1 mm proximal/.test(o[1])));assert.ok(text.some(o=>/z = 17/.test(o[1])));
    assert.ok(text.some(o=>o[1]==='+X'));assert.ok(text.some(o=>o[1]==='+Y'));
    assert.ok(c.ops.some(o=>o[0]==='fill'&&o[1]==='evenodd'));
    for(const o of c.ops.filter(o=>['moveTo','lineTo'].includes(o[0])))assert.ok(o[1]>=0&&o[1]<=w&&o[2]>=0&&o[2]<=h,JSON.stringify(o));
    for(const [,str,x,y] of text){assert.ok(x>=0&&y>=11&&y<=h);assert.ok(x+str.length*6.5<=w);}
    const header=text.filter(o=>o[1].length>3);assert.ok(Math.abs(header[0][3]-header[1][3])>=14);
  }
});
test('fractional hidden section clears the whole integer backing bitmap',()=>{
  const c=canvas(239.833333,219.666667);
  new api.SectionView(c,fixture).render({visible:false});
  assert.deepEqual(c.ops[0],['setTransform',1,0,0,1,0,0]);
  assert.deepEqual(c.ops.find(o=>o[0]==='clearRect'),['clearRect',0,0,240,220]);
});
test('section supports DPR, zero size, true z label, and omits optional projected beam',()=>{
  assert.equal(typeof api.SectionView,'function');
  const old=globalThis.devicePixelRatio;globalThis.devicePixelRatio=2;
  try {
    const a=canvas(),b=canvas();
    new api.SectionView(a,fixture).render({tip:tips[0],visible:true,z:16,showRay:false});
    new api.SectionView(b,fixture).render({tip:tips[0],visible:true,z:16,showRay:true,camera:{}});
    assert.deepEqual(a.ops,b.ops);assert.equal(a.width,480);assert.equal(a.height,440);
    assert.ok(a.ops.some(o=>o[0]==='fillText'&&/2 mm proximal/.test(o[1])));
    assert.doesNotThrow(()=>new api.SectionView(canvas(0,0),fixture).render({visible:true}));
  } finally {if(old===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=old;}
});
