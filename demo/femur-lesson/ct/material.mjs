// Same finite-ray surface solver; bounded continuous modulation inside a separate envelope.
import {integrateRay,meshIntervals,meshCamera,renderMeshProjection,MU_SHELL,MU_CORE} from './integrator.mjs';
import {normalizePose} from '../../beam-geometry.mjs';
export const MU_INTERNAL=.004;
export const DEFAULT_STEP_MM=.5;
export function validateField(f){
 if(!f||!Array.isArray(f.shape)||f.shape.length!==3||!f.shape.every(n=>Number.isInteger(n)&&n>=2))throw new Error('Invalid density shape');
 if(!Array.isArray(f.origin)||f.origin.length!==3||!f.origin.every(Number.isFinite))throw new Error('Invalid density origin');
 if(!Array.isArray(f.spacing)||f.spacing.length!==3||!f.spacing.every(n=>Number.isFinite(n)&&n>0))throw new Error('Invalid density spacing');
 if(f.order!=='C-xyz-z-fastest')throw new Error('Invalid density order');
 if(!(f.data instanceof Uint8Array)||f.data.length!==f.shape.reduce((a,b)=>a*b,1))throw new Error('Invalid density byte count');
 return f;
}
export function sampleDensity(f,p){
 const x=(p[0]-f.origin[0])/f.spacing[0],y=(p[1]-f.origin[1])/f.spacing[1],z=(p[2]-f.origin[2])/f.spacing[2];
 const [nx,ny,nz]=f.shape;
 if(x<0||y<0||z<0||x>nx-1||y>ny-1||z>nz-1)return 0;
 const i=Math.min(nx-2,Math.floor(x)),j=Math.min(ny-2,Math.floor(y)),k=Math.min(nz-2,Math.floor(z)),a=x-i,b=y-j,c=z-k;
 const q=(i*ny+j)*nz+k,dx=ny*nz,dy=nz,v=f.data;
 const z00=v[q]*(1-c)+v[q+1]*c,z01=v[q+dy]*(1-c)+v[q+dy+1]*c;
 const z10=v[q+dx]*(1-c)+v[q+dx+1]*c,z11=v[q+dx+dy]*(1-c)+v[q+dx+dy+1]*c;
 return ((z00*(1-b)+z01*b)*(1-a)+(z10*(1-b)+z11*b)*a)/255;
}
function validateStep(stepMm){if(!Number.isFinite(stepMm)||stepMm<.05||stepMm>2)throw new RangeError('Integration step must be 0.05..2 mm');}
function integrateValidated(outer,envelope,field,source,detector,stepMm){
 // Existing solver owns all crossing/nesting rejection and exact shell lengths.
 const result=integrateRay(outer,envelope,source,detector);if(!result.valid)return result;
 const maxT=Math.hypot(...detector.map((v,k)=>v-source[k])),d=detector.map((v,k)=>(v-source[k])/maxT);
 const crossings=meshIntervals(envelope,source,d,maxT);if(!crossings.valid)return {...crossings,attenuation:NaN};
 let densityIntegral=0;
 for(const [lo,hi] of crossings.intervals){
  const n=Math.ceil((hi-lo)/stepMm),ds=(hi-lo)/n;
  for(let j=0;j<n;j++){
   const t=lo+(j+.5)*ds;
   densityIntegral+=sampleDensity(field,[source[0]+t*d[0],source[1]+t*d[1],source[2]+t*d[2]])*ds;
  }
 }
 const corticalAttenuation=MU_SHELL*result.shell,interiorAttenuation=MU_CORE*result.core+MU_INTERNAL*densityIntegral;
 return {...result,interior:result.core,densityIntegral,corticalAttenuation,interiorAttenuation,attenuation:corticalAttenuation+interiorAttenuation};
}
export function integrateRestrainedRay(outer,envelope,field,source,detector,{stepMm=DEFAULT_STEP_MM}={}){
 validateField(field);validateStep(stepMm);return integrateValidated(outer,envelope,field,source,detector,stepMm);
}
export function renderRestrained(outer,envelope,field,pose,{size=256,raw=false,stepMm=DEFAULT_STEP_MM}={}){
 validateField(field);validateStep(stepMm);
 const normalized=normalizePose(pose),camera=meshCamera(normalized,size),n=size*size,pixels=new Uint8ClampedArray(n*4),invalidRays=[];
 const arrays=raw?Object.fromEntries(['outer','shell','interior','densityIntegral','corticalAttenuation','interiorAttenuation','attenuation'].map(k=>[k,new Float64Array(n)])):{};
 for(let row=0,i=0;row<size;row++)for(let col=0;col<size;col++,i++){
  const x=(col+.5-size/2)*camera.pixelMm,y=(size/2-row-.5)*camera.pixelMm;
  const detector=camera.centre.map((v,k)=>v+x*camera.right[k]+y*camera.up[k]);
  const r=integrateValidated(outer,envelope,field,camera.source,detector,stepMm);
  if(raw)for(const key of Object.keys(arrays))arrays[key][i]=r[key];
  if(r.valid){const gray=Math.round(255*(1-Math.exp(-r.attenuation)));pixels[4*i]=pixels[4*i+1]=pixels[4*i+2]=gray;}
  else{invalidRays.push({row,col,...r});pixels[4*i]=255;pixels[4*i+2]=255;}
  pixels[4*i+3]=255;
 }
 return {pose:normalized,camera,width:size,height:size,pixels,invalidCount:invalidRays.length,invalidRays,stepMm,...arrays};
}
export function renderComparison(outer,oldCore,envelope,field,pose,options={}){
 const original=renderMeshProjection(outer,oldCore,pose,options),restrained=renderRestrained(outer,envelope,field,pose,options);
 for(const [label,frame] of [['original',original],['restrained',restrained]])if(frame.invalidCount){
  const e=new Error(`Projection rejected (${label}): ${frame.invalidCount} unresolved rays`);e.diagnostics={label,invalidCount:frame.invalidCount,invalidRays:frame.invalidRays};throw e;
 }
 return {...original,controlPixels:restrained.pixels,material:{cortex:MU_SHELL,interiorBase:MU_CORE,interiorModulation:MU_INTERNAL,stepMm:restrained.stepMm},...(options.raw?{restrained}:{} )};
}
