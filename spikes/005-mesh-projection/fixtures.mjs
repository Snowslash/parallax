// Independent analytic controls: affine boxes, half-space clipping, no triangle intersections.
export const TOLERANCES = Object.freeze({lengthMm:1e-7, attenuation:1e-8, tessellationMm:1e-7, actualReferenceMm:2e-6, samplingRelative:.02});
export const OUTER = {lo:[-31,-19,-78],hi:[43,27,39]};
export const CORE = {lo:[-23,-11,-63],hi:[32,18,28]};
export const POSES = [{orbit:23.7,tilt:-17.3,x:7,y:-13,z:-21},{orbit:137.2,tilt:31.6,x:-9,y:24,z:-18},{orbit:281.1,tilt:-39.2,x:12,y:17,z:-37}];
export function boxOBJ({lo,hi}, refine=false) {
  const vertices=[]; for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++)vertices.push([x?hi[0]:lo[0],y?hi[1]:lo[1],z?hi[2]:lo[2]]);
  const faces=[[0,2,3],[0,3,1],[4,5,7],[4,7,6],[0,1,5],[0,5,4],[2,6,7],[2,7,3],[0,4,6],[0,6,2],[1,3,7],[1,7,5]];
  let out=faces;
  if(refine){const mids=new Map();const mid=(a,b)=>{const key=[a,b].sort((a,b)=>a-b).join(',');if(!mids.has(key)){mids.set(key,vertices.length);vertices.push(vertices[a].map((v,i)=>(v+vertices[b][i])/2));}return mids.get(key);};out=faces.flatMap(([a,b,c])=>{const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);return [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];});}
  return vertices.map(v=>'v '+v.join(' ')).concat(out.map(f=>'f '+f.map(i=>i+1).join(' '))).join('\n');
}
export function boxLength(box,source,detector) {
  const d=detector.map((v,i)=>v-source[i]);let lo=0,hi=1;
  for(let a=0;a<3;a++){if(d[a]===0){if(source[a]<box.lo[a]||source[a]>box.hi[a])return 0;}else{const p=(box.lo[a]-source[a])/d[a],q=(box.hi[a]-source[a])/d[a];lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));}}
  return Math.max(0,hi-lo)*Math.hypot(...d);
}
// Camera reference independently uses explicit Rz*Rx matrices, not candidate camera helpers.
export function referenceCamera(pose,size){const a=pose.orbit*Math.PI/180,b=pose.tilt*Math.PI/180;const R=[[Math.cos(a),-Math.sin(a)*Math.cos(b),Math.sin(a)*Math.sin(b)],[Math.sin(a),Math.cos(a)*Math.cos(b),-Math.cos(a)*Math.sin(b)],[0,Math.sin(b),Math.cos(b)]];const pivot=[pose.x,pose.y,pose.z];const world=v=>R.map((r,i)=>r.reduce((s,x,j)=>s+x*v[j],pivot[i]));return {source:world([0,-800,0]),detector:(row,col)=>world([(col+.5-size/2)*320/size,400,(size/2-row-.5)*320/size])};}
export function materialReference(source,detector){const outer=boxLength(OUTER,source,detector),core=boxLength(CORE,source,detector),shell=outer-core;return {outer,core,shell,attenuation:.04*shell+.008*core};}
