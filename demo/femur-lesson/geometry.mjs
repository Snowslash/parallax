import {renderRestrained} from './ct/material.mjs';
import {caseForId,validatePose,measureCase,captureAdequacy} from './model.mjs';
export const MU_METAL=.65;
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
// Exact finite ray / flat-ended solid-cylinder chord, including oblique/end-cap intersections.
export function wireChord(source,detector,wire){
  if(!source||!detector||!wire||![source,detector,wire.start,wire.tip].every(p=>p?.length===3&&Array.from(p).every(Number.isFinite))||!(wire.radius>0&&Number.isFinite(wire.radius)))throw new TypeError('Finite ray and wire required');
  const v=sub(detector,source),length=Math.hypot(...v),axis=sub(wire.tip,wire.start),h=Math.hypot(...axis);if(!(length>0&&h>0))throw new RangeError('Zero length ray/wire');
  const d=v.map(x=>x/length),u=axis.map(x=>x/h),q=sub(source,wire.start),z=dot(q,u),dz=dot(d,u),r=q.map((x,i)=>x-z*u[i]),dr=d.map((x,i)=>x-dz*u[i]);
  const a=dot(dr,dr),b=2*dot(r,dr),c=dot(r,r)-wire.radius**2;let lo=0,hi=length;
  if(a<1e-24){if(c>0)return 0;}else{const disc=b*b-4*a*c;if(disc<0)return 0;const root=Math.sqrt(disc);lo=Math.max(lo,(-b-root)/(2*a));hi=Math.min(hi,(-b+root)/(2*a));}
  if(Math.abs(dz)<1e-12){if(z<0||z>h)return 0;}else{const x=-z/dz,y=(h-z)/dz;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}
  return Math.max(0,hi-lo);
}
export function renderLessonProjection(outer,envelope,caseId,pose,{size=256,raw=false,field,stepMm=.5}={}){
  const c=caseForId(caseId),normalized=validatePose(pose);
  // Exact approved restrained bone term; existing additive metal, not material displacement.
  const frame=renderRestrained(outer,envelope,field,normalized,{size,raw:true,stepMm}),camera=frame.camera,n=size*size,wire=new Float64Array(n),boneAttenuation=frame.attenuation.slice();
  for(let row=0,i=0;row<size;row++)for(let col=0;col<size;col++,i++){
    const x=(col+.5-size/2)*camera.pixelMm,y=(size/2-row-.5)*camera.pixelMm,detector=camera.centre.map((v,k)=>v+x*camera.right[k]+y*camera.up[k]);
    wire[i]=wireChord(camera.source,detector,c.wire);
    if(!Number.isFinite(boneAttenuation[i]))continue; // Never repair or hide an invalid bone ray.
    frame.attenuation[i]=boneAttenuation[i]+MU_METAL*wire[i];const value=Math.round(255*(1-Math.exp(-frame.attenuation[i])));frame.pixels[4*i]=frame.pixels[4*i+1]=frame.pixels[4*i+2]=value;
  }
  const result={...frame,caseId,measurement:measureCase(caseId,normalized,size),adequacy:captureAdequacy(caseId,normalized,size,frame.invalidCount),material:{metal:MU_METAL,units:'synthetic mm^-1',composition:'additive metal opacity over unchanged bone',mapping:'round(255*(1-exp(-A)))'}};
  delete result.uniformPixels;delete result.uniformAttenuation;
  if(raw){result.wire=wire;result.boneAttenuation=boneAttenuation;}else for(const k of ['outer','core','shell','interior','densityIntegral','corticalAttenuation','interiorAttenuation','attenuation'])delete result[k];
  return result;
}
