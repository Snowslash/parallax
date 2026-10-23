import {cameraForPose} from './camera.mjs';
// Offline only: unchanged, strict full-line mesh crossings from the proven integrator.
import {buildMesh,meshIntervals,NUMERICS} from './kernel/ct/integrator.mjs';
export {NUMERICS};
export const POLICY=Object.freeze({shell:.04,canal:.008,metal:.65,mapping:'round(255*(1-exp(-attenuation)))',metalModel:'additive attenuation on unchanged bone; no material displacement',gapMm:16,distalTranslation:[0,0,-10]});
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]);
const length=intervals=>intervals.reduce((s,[a,b])=>s+b-a,0);
export function parseSTL(bytes){
 const b=bytes instanceof ArrayBuffer?new DataView(bytes):ArrayBuffer.isView(bytes)?new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength):null;if(!b||b.byteLength<84)throw Error('Truncated binary STL');
 const n=b.getUint32(80,true);if(!n||b.byteLength!==84+50*n)throw Error('Invalid binary STL length');
 const vertices=[],faces=[],index=new Map();
 for(let i=0;i<n;i++)for(let j=0;j<3;j++){
  const p=Array.from({length:3},(_,k)=>b.getFloat32(84+50*i+12+12*j+4*k,true));if(!p.every(Number.isFinite))throw Error('Nonfinite STL vertex');
  // JS number strings round-trip exactly; no rounding or tolerance welding.
  const key=p.join(',');if(!index.has(key)){index.set(key,vertices.length/3);vertices.push(...p);}faces.push(index.get(key));
 }
 return {vertices:new Float64Array(vertices),faces:new Uint32Array(faces)};
}
export function prepareMeshes(outer,canal){return {outer:buildMesh(outer),canal:buildMesh(canal)};}
export function cameraFor(angleDeg,size=320,params={}){
 const {pivot=[0,0,0],sourcePivot=800,sdd=1200,fieldMm=210}=params;
 if(!Number.isFinite(angleDeg)||!Number.isInteger(size)||size<1||sourcePivot<=0||sdd<=sourcePivot||fieldMm<=0)throw Error('Invalid camera');
 const t=angleDeg*Math.PI/180,forward=[-Math.sin(t),0,-Math.cos(t)],right=[Math.cos(t),0,-Math.sin(t)],up=[0,1,0];
 return {angleDeg,size,pivot,sourcePivot,sdd,fieldMm,pixelMm:fieldMm/size,forward,right,up,source:pivot.map((v,k)=>v-sourcePivot*forward[k]),centre:pivot.map((v,k)=>v+(sdd-sourcePivot)*forward[k])};
}
export function pixelRay(camera,row,col){
 const u=(col+.5-camera.size/2)*camera.pixelMm,v=(camera.size/2-row-.5)*camera.pixelMm;
 const detector=camera.centre.map((x,k)=>x+u*camera.right[k]+v*camera.up[k]),delta=sub(detector,camera.source),maxT=Math.hypot(...delta);
 return {source:camera.source,detector,direction:delta.map(v=>v/maxT),maxT};
}
export function projectPoint(c,p){const delta=sub(p,c.source),depth=dot(delta,c.forward);if(!(depth>0))throw Error('Point behind source');return {col:c.size/2+dot(delta,c.right)*c.sdd/depth/c.pixelMm-.5,row:c.size/2-dot(delta,c.up)*c.sdd/depth/c.pixelMm-.5,depth};}
export function unionIntervals(intervals){
 const result=[];for(const [a,b] of intervals.filter(([a,b])=>b>a).sort((x,y)=>x[0]-y[0])){const last=result.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else result.push([a,b]);}return result;
}
function quadraticInterval(a,b,c){
 if(a===0)return c<=0?[[-Infinity,Infinity]]:[];
 const disc=b*b-4*a*c;if(disc<=0)return [];
 const root=Math.sqrt(disc),q=-.5*(b+(b<0?-root:root));const x=q/a,y=c/q;return [[Math.min(x,y),Math.max(x,y)]];
}
function clip(intervals,lo,hi){return intervals.map(([a,b])=>[Math.max(a,lo),Math.min(b,hi)]).filter(([a,b])=>b>a);}
function sphere(s,d,p,r){const q=sub(s,p);return quadraticInterval(dot(d,d),2*dot(q,d),dot(q,q)-r*r);}
export function wireIntervals(s,d,maxT,wire){
 const {points,radiusMm:r,oliveRadiusMm:olive}=wire;const intervals=[];
 if(!points||points.length<2||!(r>0)||!(olive>0)||!points.every(p=>p.length===3&&p.every(Number.isFinite)))throw Error('Invalid finite wire');
 for(const p of points)intervals.push(...sphere(s,d,p,r));
 for(let i=1;i<points.length;i++){
  const a=points[i-1],ab=sub(points[i],a),h=Math.hypot(...ab);if(!h)continue;
  const axis=ab.map(v=>v/h),q=sub(s,a),qd=dot(q,axis),dd=dot(d,axis),perpQ=q.map((v,k)=>v-qd*axis[k]),perpD=d.map((v,k)=>v-dd*axis[k]);
  let radial=quadraticInterval(dot(perpD,perpD),2*dot(perpQ,perpD),dot(perpQ,perpQ)-r*r);
  if(dd===0){if(qd<0||qd>h)radial=[];}else{const u=-qd/dd,v=(h-qd)/dd;radial=clip(radial,Math.min(u,v),Math.max(u,v));}
  intervals.push(...radial);
 }
 intervals.push(...sphere(s,d,points.at(-1),olive));return unionIntervals(clip(intervals,0,maxT));
}
function halfspace(intervals,s,d,proximal){
 const boundary=proximal?8:-8;
 if(d[1]===0)return (proximal?s[1]>=boundary:s[1]<=boundary)?intervals:[];
 const t=(boundary-s[1])/d[1],lower=proximal?d[1]>0:d[1]<0;return clip(intervals,lower?t:-Infinity,lower?Infinity:t);
}
const keys=['outer','core','shell','bone','metal','attenuation'];
function invalid(detail){return {valid:false,...Object.fromEntries(keys.map(k=>[k,NaN])),...detail};}
export function integrateRay(meshes,source,detector,wire){
 if(![source,detector].every(p=>p.length===3&&p.every(Number.isFinite)))throw Error('Finite endpoints required');
 const delta=sub(detector,source),maxT=Math.hypot(...delta);if(!maxT)throw Error('Zero ray');const d=delta.map(v=>v/maxT);
 const outer=[],core=[];
 for(const proximal of [true,false]){
  const s=source.map((v,k)=>v-(proximal?0:POLICY.distalTranslation[k]));
  const o=meshIntervals(meshes.outer,s,d,maxT),c=meshIntervals(meshes.canal,s,d,maxT);
  const fragment=proximal?'proximal':'distal';
  if(!o.valid||!c.valid)return invalid({fragment,boundary:!o.valid?'outer':'canal',outerCrossings:o,canalCrossings:c,reason:!o.valid?o.reason:c.reason});
  for(const interval of c.intervals)if(!o.intervals.some(([a,b])=>interval[0]>=a-NUMERICS.eventMm&&interval[1]<=b+NUMERICS.eventMm))return invalid({fragment,boundary:'nesting',reason:'core interval not contained/nested in outer',interval,outerCrossings:o,canalCrossings:c});
  outer.push(...halfspace(o.intervals,s,d,proximal));core.push(...halfspace(c.intervals,s,d,proximal));
 }
 const outerLength=length(unionIntervals(outer)),coreLength=length(unionIntervals(core)),shell=outerLength-coreLength;
 if(shell<0)return invalid({reason:'negative shell length',outerIntervals:outer,coreIntervals:core});
 const metal=length(wireIntervals(source,d,maxT,wire)),bone=POLICY.shell*shell+POLICY.canal*coreLength;
 return {valid:true,outer:outerLength,core:coreLength,shell,bone,metal,attenuation:bone+POLICY.metal*metal};
}
export function oliveDistalOverlap(meshes,wire,camera){
 const p=wire.points.at(-1),r=wire.oliveRadiusMm,bounds=[];
 for(const x of [-r,r])for(const y of [-r,r])for(const z of [-r,r])bounds.push(projectPoint(camera,[p[0]+x,p[1]+y,p[2]+z]));
 const loRow=Math.max(0,Math.floor(Math.min(...bounds.map(q=>q.row)))),hiRow=Math.min(camera.size-1,Math.ceil(Math.max(...bounds.map(q=>q.row)))),loCol=Math.max(0,Math.floor(Math.min(...bounds.map(q=>q.col)))),hiCol=Math.min(camera.size-1,Math.ceil(Math.max(...bounds.map(q=>q.col))));
 let olivePixels=0,overlapPixels=0;const invalidRays=[];
 for(let row=loRow;row<=hiRow;row++)for(let col=loCol;col<=hiCol;col++){
  const ray=pixelRay(camera,row,col);if(!clip(sphere(ray.source,ray.direction,p,r),0,ray.maxT).length)continue;olivePixels++;
  const s=ray.source.map((v,k)=>v-POLICY.distalTranslation[k]),result=meshIntervals(meshes.outer,s,ray.direction,ray.maxT);
  if(!result.valid){invalidRays.push({row,col,...ray,...result});continue;}
  if(halfspace(result.intervals,s,ray.direction,false).length)overlapPixels++;
 }
 return {olivePixels,overlapPixels,overlapFraction:olivePixels?overlapPixels/olivePixels:null,invalidRays,method:'320-pixel-centre geometric silhouette overlap, not physical contact or canal containment'};
}
export function render(meshes,wire,angleDeg,size=320,params={}){
 const camera=cameraFor(angleDeg,size,params),rgba=new Uint8Array(size*size*4),arrays=Object.fromEntries(keys.map(k=>[k,new Float64Array(size*size)])),invalidRays=[];
 for(let row=0,i=0;row<size;row++)for(let col=0;col<size;col++,i++){
  const ray=pixelRay(camera,row,col),r=integrateRay(meshes,ray.source,ray.detector,wire);for(const k of keys)arrays[k][i]=r[k];
  if(r.valid){const grey=Math.round(255*(1-Math.exp(-r.attenuation)));rgba.fill(grey,i*4,i*4+3);}else{rgba.set([255,0,255],i*4);invalidRays.push({row,col,...ray,...r});}rgba[i*4+3]=255;
 }
 return {width:size,height:size,camera,rgba,arrays,invalidCount:invalidRays.length,invalidRays};
}

export function renderPose(meshes,wire,pose,size=320,params={}){
 const camera=cameraForPose(pose,size,params),rgba=new Uint8Array(size*size*4),arrays=Object.fromEntries(keys.map(k=>[k,new Float64Array(size*size)])),invalidRays=[];
 for(let row=0,i=0;row<size;row++)for(let col=0;col<size;col++,i++){
  const ray=pixelRay(camera,row,col),r=integrateRay(meshes,ray.source,ray.detector,wire);for(const k of keys)arrays[k][i]=r[k];
  if(r.valid){const grey=Math.round(255*(1-Math.exp(-r.attenuation)));rgba.fill(grey,i*4,i*4+3);}else{rgba.set([255,0,255],i*4);invalidRays.push({row,col,...ray,...r});}rgba[i*4+3]=255;
 }
 return {width:size,height:size,camera,rgba,arrays,invalidCount:invalidRays.length,invalidRays};
}

// Perspective sphere is fully within four detector half-planes, not merely its centre.
export function oliveInFrame(wire,camera){
 const p=wire.points.at(-1),r=wire.oliveRadiusMm,q=p.map((v,k)=>v-camera.source[k]);
 const depth=dot(q,camera.forward),half=camera.fieldMm/2/camera.sdd;
 if(!(r>0)||!Number.isFinite(r)||!(depth>r))return false;
 for(const axis of [camera.right,camera.up])for(const sign of [-1,1]){
  const normal=camera.forward.map((v,k)=>half*v+sign*axis[k]);
  if(dot(q,normal)<r*Math.hypot(...normal))return false;
 }
 return true;
}
