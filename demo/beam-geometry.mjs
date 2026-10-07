// Synthetic finite-source projection only; mm, degrees, right-handed world.
// At zero: source -Y, image-right +X, image-up +Z. Rows increase down.
export const DEFAULT_POSE = Object.freeze({orbit:0, tilt:0, x:0, y:0, z:0});
export const LIMITS = Object.freeze({tilt:Object.freeze([-60,60]), x:Object.freeze([-120,120]), y:Object.freeze([-200,200]), z:Object.freeze([-120,120])});
export function normalizePose(partial = {}) {
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) throw new TypeError('Pose must be an object');
  const pose = {...DEFAULT_POSE};
  for (const key of Object.keys(pose)) {
    const value = Object.hasOwn(partial,key) ? partial[key] : pose[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Non-finite pose ${key}`);
    if (key === 'orbit') {
      const wrapped = value % 360;
      // Preserve in-range fractional inputs bit-for-bit; canonicalise -0.
      pose[key] = wrapped < 0 ? (wrapped + 360) % 360 : (wrapped || 0);
    } else pose[key] = Math.max(LIMITS[key][0], Math.min(LIMITS[key][1],value));
  }
  return pose;
}
function validateSize(size) {
  if (!Number.isInteger(size) || size < 16 || size > 512) throw new RangeError('size must be an integer in 16..512');
}
export function cameraForPose(pose = {}, size = 256) {
  validateSize(size);
  const p = normalizePose(pose), theta=p.orbit*Math.PI/180, phi=p.tilt*Math.PI/180;
  const ct=Math.cos(theta), st=Math.sin(theta), cp=Math.cos(phi), sp=Math.sin(phi);
  const right=[ct,st,0], forward=[-st*cp,ct*cp,sp], up=[st*sp,-ct*sp,cp], pivot=[p.x,p.y,p.z];
  return {source:pivot.map((v,i)=>v-800*forward[i]), centre:pivot.map((v,i)=>v+400*forward[i]), right,up,forward,pivot,size,pixelMm:128/size,sdd:1200,sourcePivot:800};
}
export function projectPoint(camera, point) {
  if (!point || point.length !== 3 || !Array.from(point).every(Number.isFinite)) throw new TypeError('Point must contain three finite numbers');
  const x=point[0]-camera.source[0], y=point[1]-camera.source[1], z=point[2]-camera.source[2];
  const dot=v=>x*v[0]+y*v[1]+z*v[2], depth=dot(camera.forward);
  if (!(depth>0)) throw new RangeError('Point must be in front of source');
  const scale=camera.sdd/depth/camera.pixelMm, centre=camera.size/2-.5;
  return [centre+dot(camera.right)*scale,centre-dot(camera.up)*scale];
}
// Cache source-dependent cylinder coefficients once per frame, not per pixel.
function cylinder(source, a, axis, length, radius) {
  const x=source[0]-a[0],y=source[1]-a[1],z=source[2]-a[2];
  const axial=x*axis[0]+y*axis[1]+z*axis[2];
  const rx=x-axial*axis[0],ry=y-axial*axis[1],rz=z-axial*axis[2];
  return {axis,length,axial,rx,ry,rz,qc:rx*rx+ry*ry+rz*rz-radius*radius};
}
// Writes a clipped interval to reusable scratch; directions are unit length.
function interval(c,dx,dy,dz,maxT,out,k) {
  const ad=dx*c.axis[0]+dy*c.axis[1]+dz*c.axis[2];
  const rx=dx-ad*c.axis[0],ry=dy-ad*c.axis[1],rz=dz-ad*c.axis[2];
  const qa=rx*rx+ry*ry+rz*rz,qb=2*(rx*c.rx+ry*c.ry+rz*c.rz);
  let lo=0,hi=maxT;
  if (qa<1e-12) { if(c.qc>0) {out[k]=out[k+1]=0;return;} }
  else {
    const disc=qb*qb-4*qa*c.qc;
    if(disc<0){out[k]=out[k+1]=0;return;}
    const root=Math.sqrt(disc);lo=Math.max(lo,(-qb-root)/(2*qa));hi=Math.min(hi,(-qb+root)/(2*qa));
  }
  if(Math.abs(ad)<1e-12){if(c.axial<0||c.axial>c.length){out[k]=out[k+1]=0;return;}}
  else {const a=-c.axial/ad,b=(c.length-c.axial)/ad;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
  if(hi<lo){out[k]=out[k+1]=0;return;}
  out[k]=lo;out[k+1]=hi;
}
export function renderProjection(pose = {}, {size=256,raw=false} = {}) {
  const normalized=normalizePose(pose),camera=cameraForPose(normalized,size),n=size*size;
  const pixels=new Uint8ClampedArray(n*4);
  const total=raw?new Float64Array(n):null,shell=raw?new Float64Array(n):null,wire=raw?new Float64Array(n):null;
  const s=camera.source,r=camera.right,u=camera.up,f=camera.forward;
  const length=Math.hypot(15,36);
  const outer=cylinder(s,[0,0,-30],[0,0,1],60,12),inner=cylinder(s,[0,0,-30],[0,0,1],60,10);
  const metal=cylinder(s,[0,0,-18],[0,15/length,36/length],length,.65),scratch=new Float64Array(6);
  for(let row=0,i=0;row<size;row++){
    const py=(size/2-row-.5)*camera.pixelMm;
    for(let col=0;col<size;col++,i++){
      const px=(col+.5-size/2)*camera.pixelMm;
      let dx=1200*f[0]+px*r[0]+py*u[0],dy=1200*f[1]+px*r[1]+py*u[1],dz=1200*f[2]+px*r[2]+py*u[2];
      const maxT=Math.hypot(dx,dy,dz);dx/=maxT;dy/=maxT;dz/=maxT;
      interval(outer,dx,dy,dz,maxT,scratch,0);interval(inner,dx,dy,dz,maxT,scratch,2);interval(metal,dx,dy,dz,maxT,scratch,4);
      const overlapOuter=Math.max(0,Math.min(scratch[5],scratch[1])-Math.max(scratch[4],scratch[0]));
      const overlapInner=Math.max(0,Math.min(scratch[5],scratch[3])-Math.max(scratch[4],scratch[2]));
      const sh=.08*Math.max(0,scratch[1]-scratch[0]-(scratch[3]-scratch[2])-overlapOuter+overlapInner);
      const w=.6*(scratch[5]-scratch[4]),value=sh+w;
      if(raw){total[i]=value;shell[i]=sh;wire[i]=w;}
      const grey=Math.round(255*(1-Math.exp(-value))),k=4*i;
      pixels[k]=pixels[k+1]=pixels[k+2]=grey;pixels[k+3]=255;
    }
  }
  return {pose:normalized,camera,width:size,height:size,pixels,...(raw?{total,shell,wire}:{})};
}
