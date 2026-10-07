// Bone-only engineering spike. Numeric mm; identity asset-to-world mapping.
// Small median-split triangle BVH + signed, grouped full-line crossings, clipped to finite rays.
import {cameraForPose,normalizePose} from '../beam-geometry.mjs';
export const FOV_MM=320, MU_SHELL=.04, MU_CORE=.008;
export const DEFAULT_MESH_POSE=Object.freeze({orbit:0,tilt:0,x:24,y:7,z:-68});
// Explicit numerical policy, not a tissue/model tolerance. No ray perturbation/restart.
export const NUMERICS=Object.freeze({eventMm:1e-7,planeMm:1e-9,parallelCos:1e-14,edgeRoundoff:32*Number.EPSILON});
export function parseOBJ(text){
  const vertices=[],faces=[];
  for(const raw of text.split(/\r?\n/)){
    const line=raw.split('#')[0].trim();if(!line)continue;
    const [kind,...parts]=line.split(/\s+/);
    if(kind==='v'){
      if(parts.length!==3||parts.some(x=>!Number.isFinite(Number(x))))throw new Error('Invalid OBJ vertex');
      vertices.push(...parts.map(Number));
    }else if(kind==='f'){
      if(parts.length!==3||parts.some(x=>!/^\d+(?:\/\d*(?:\/\d+)?)?$/.test(x)))throw new Error('Only positive indexed OBJ triangles supported');
      const f=parts.map(x=>Number(x.split('/')[0])-1);
      if(f.some(i=>!Number.isSafeInteger(i)||i<0||i>=vertices.length/3)||new Set(f).size!==3)throw new Error('Invalid OBJ face index');
      faces.push(...f);
    }else if(!['o','g','s','vn','vt','usemtl','mtllib'].includes(kind))throw new Error(`Unsupported OBJ record ${kind}`);
  }
  if(!vertices.length||!faces.length)throw new Error('Empty OBJ geometry');
  return {vertices:new Float64Array(vertices),faces:new Uint32Array(faces)};
}
export function buildMesh({vertices,faces}){
  if(!(vertices instanceof Float64Array)||!(faces instanceof Uint32Array)||vertices.length%3||faces.length%3||!faces.length||!vertices.every(Number.isFinite))throw new Error('Invalid mesh arrays');
  const triangles=[],edges=new Map();let volume6=0;
  for(let i=0;i<faces.length;i+=3){
    const ids=Array.from(faces.slice(i,i+3));if(ids.some(v=>3*v>=vertices.length)||new Set(ids).size!==3)throw new Error('Invalid triangle indices');
    const [a,b,c]=ids.map(v=>Array.from(vertices.slice(3*v,3*v+3)));
    const e=b.map((v,k)=>v-a[k]),f=c.map((v,k)=>v-a[k]);
    const normal=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]],area2=Math.hypot(...normal);
    if(!(area2>0))throw new Error('Degenerate triangle');
    volume6+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
    const lo=a.map((v,k)=>Math.min(v,b[k],c[k])),hi=a.map((v,k)=>Math.max(v,b[k],c[k]));
    triangles.push({a,b,c,normal,area2,lo,hi,id:i/3});
    for(let j=0;j<3;j++){const u=ids[j],v=ids[(j+1)%3],key=`${Math.min(u,v)},${Math.max(u,v)}`,edge=edges.get(key)||[0,0];edge[0]++;edge[1]+=u<v?1:-1;edges.set(key,edge);}
  }
  if([...edges.values()].some(([n,s])=>n!==2||s!==0))throw new Error('Mesh must have closed, consistently oriented edges');
  if(!(volume6>0))throw new Error('Mesh must have positive outward volume');
  const build=ids=>{
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(const id of ids)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],triangles[id].lo[k]);hi[k]=Math.max(hi[k],triangles[id].hi[k]);}
    if(ids.length<=8)return {lo,hi,ids};
    const widths=hi.map((v,k)=>v-lo[k]),axis=widths.indexOf(Math.max(...widths));
    ids.sort((a,b)=>(triangles[a].lo[axis]+triangles[a].hi[axis])-(triangles[b].lo[axis]+triangles[b].hi[axis]));
    const mid=ids.length>>1;return {lo,hi,left:build(ids.slice(0,mid)),right:build(ids.slice(mid))};
  };
  return {vertices,faces,triangles,bvh:build(triangles.map((_,i)=>i))};
}
export function meshCamera(pose=DEFAULT_MESH_POSE,size=256){return {...cameraForPose(pose,size),pixelMm:FOV_MM/size};}
function lineBox(node,s,d){
  let lo=-Infinity,hi=Infinity;
  for(let k=0;k<3;k++){
    if(d[k]===0){if(s[k]<node.lo[k]-NUMERICS.planeMm||s[k]>node.hi[k]+NUMERICS.planeMm)return false;}
    else{const a=(node.lo[k]-NUMERICS.planeMm-s[k])/d[k],b=(node.hi[k]+NUMERICS.planeMm-s[k])/d[k];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(hi<lo)return false;}
  }return true;
}
function meshIntervals(mesh,s,d,maxT){
  const hits=[],stack=[mesh.bvh];let issue=null;
  // Dominant-axis shearing evaluates shared projected edges with identical arithmetic.
  let kz=0;if(Math.abs(d[1])>Math.abs(d[kz]))kz=1;if(Math.abs(d[2])>Math.abs(d[kz]))kz=2;
  let kx=(kz+1)%3,ky=(kx+1)%3;if(d[kz]<0)[kx,ky]=[ky,kx];
  const sx=d[kx]/d[kz],sy=d[ky]/d[kz],sz=1/d[kz];
  while(stack.length){
    const node=stack.pop();if(!lineBox(node,s,d))continue;
    if(!node.ids){stack.push(node.left,node.right);continue;}
    for(const id of node.ids){
      const t=mesh.triangles[id];if(!lineBox(t,s,d))continue;
      const nd=t.normal[0]*d[0]+t.normal[1]*d[1]+t.normal[2]*d[2];
      if(Math.abs(nd)<=NUMERICS.parallelCos*t.area2){
        const dist=t.normal.reduce((sum,n,k)=>sum+n*(s[k]-t.a[k]),0)/t.area2;
        if(Math.abs(dist)<=NUMERICS.planeMm){issue={reason:'coplanar/near-parallel boundary unresolved',face:id};break;}
        continue;
      }
      // Same arithmetic, no three temporary xyz arrays per candidate triangle.
      const az=t.a[kz]-s[kz],bz=t.b[kz]-s[kz],cz=t.c[kz]-s[kz];
      const ax=t.a[kx]-s[kx]-sx*az,ay=t.a[ky]-s[ky]-sy*az,bx=t.b[kx]-s[kx]-sx*bz,by=t.b[ky]-s[ky]-sy*bz,cx=t.c[kx]-s[kx]-sx*cz,cy=t.c[ky]-s[ky]-sy*cz;
      const u=cx*by-cy*bx,v=ax*cy-ay*cx,w=bx*ay-by*ax;
      const err=NUMERICS.edgeRoundoff*Math.max(Math.abs(cx*by)+Math.abs(cy*bx),Math.abs(ax*cy)+Math.abs(ay*cx),Math.abs(bx*ay)+Math.abs(by*ax));
      if((u < -err || v < -err || w < -err)&&(u > err || v > err || w > err))continue;
      const det=u+v+w;
      if(Math.abs(det)<=3*err){issue={reason:'ill-conditioned triangle intersection',face:id};break;}
      const distance=(u*az+v*bz+w*cz)*sz/det;
      hits.push({t:distance,sign:nd<0?1:-1,face:id,boundary:Math.min(Math.abs(u),Math.abs(v),Math.abs(w))<=err});
    }
    if(issue)break;
  }
  if(issue)return {valid:false,...issue};
  hits.sort((a,b)=>a.t-b.t);const intervals=[];let inside=false,entry=0;
  for(let i=0;i<hits.length;){
    const h=hits[i];let j=i+1;
    while(j<hits.length&&Math.abs(hits[j].t-h.t)<=NUMERICS.eventMm)j++;
    if(hits.slice(i,j).some(x=>x.sign!==h.sign))return {valid:false,reason:'mixed-sign tangent/close crossings unresolved',faces:hits.slice(i,j).map(x=>x.face),distance:h.t};
    // Merging interior hits could conceal a thin interval / overlapping surfaces.
    if(j-i>1&&hits.slice(i,j).filter(x=>!x.boundary).length>1)return {valid:false,reason:'coincident interior crossings unresolved',distance:h.t};
    if(h.sign===1){if(inside)return {valid:false,reason:'nonalternating entry',distance:h.t};inside=true;entry=h.t;}
    else{if(!inside)return {valid:false,reason:'exit without entry',distance:h.t};inside=false;const lo=Math.max(0,entry),hi=Math.min(maxT,h.t);if(hi>lo)intervals.push([lo,hi]);}
    i=j;
  }
  if(inside)return {valid:false,reason:'unclosed line interval'};
  return {valid:true,intervals,length:intervals.reduce((s,[a,b])=>s+b-a,0)};
}
function invalid(detail,boundary){return {valid:false,outer:NaN,core:NaN,shell:NaN,attenuation:NaN,...detail,boundary};}
export function integrateRay(outer,core,source,detector){
  if(!source||!detector||source.length!==3||detector.length!==3||![...source,...detector].every(Number.isFinite))throw new TypeError('Finite xyz endpoints required');
  const d=detector.map((v,k)=>v-source[k]),maxT=Math.hypot(...d);if(!(maxT>0))throw new RangeError('Zero length ray');
  for(let k=0;k<3;k++)d[k]/=maxT;
  const o=meshIntervals(outer,source,d,maxT);if(!o.valid)return invalid(o,'outer');
  const c=meshIntervals(core,source,d,maxT);if(!c.valid)return invalid(c,'core');
  for(const [lo,hi] of c.intervals)if(!o.intervals.some(([a,b])=>lo>=a-NUMERICS.eventMm&&hi<=b+NUMERICS.eventMm))return invalid({reason:'core interval not contained/nested in outer',interval:[lo,hi]},'nesting');
  const shell=o.length-c.length;if(shell<0)return invalid({reason:'negative shell length'},'nesting');
  return {valid:true,outer:o.length,core:c.length,shell,attenuation:MU_SHELL*shell+MU_CORE*c.length};
}
export function renderMeshProjection(outer,core,pose=DEFAULT_MESH_POSE,{size=256,raw=false}={}){
  const normalized=normalizePose(pose),camera=meshCamera(normalized,size),n=size*size,pixels=new Uint8ClampedArray(4*n),invalidRays=[];
  const arrays=raw?Object.fromEntries(['outer','core','shell','attenuation'].map(k=>[k,new Float64Array(n)])):{};
  for(let row=0,i=0;row<size;row++)for(let col=0;col<size;col++,i++){
    const x=(col+.5-size/2)*camera.pixelMm,y=(size/2-row-.5)*camera.pixelMm;
    const detector=camera.centre.map((v,k)=>v+x*camera.right[k]+y*camera.up[k]);
    const result=integrateRay(outer,core,camera.source,detector);
    if(raw)for(const k of Object.keys(arrays))arrays[k][i]=result[k];
    if(result.valid){const grey=Math.round(255*(1-Math.exp(-result.attenuation)));pixels[4*i]=pixels[4*i+1]=pixels[4*i+2]=grey;}
    else{invalidRays.push({row,col,...result});pixels[4*i]=255;pixels[4*i+1]=0;pixels[4*i+2]=255;}
    pixels[4*i+3]=255;
  }
  return {pose:normalized,camera,width:size,height:size,pixels,invalidCount:invalidRays.length,invalidRays,...arrays};
}
