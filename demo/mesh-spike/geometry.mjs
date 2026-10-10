// Paired material preview. Reuse the existing strict two-boundary integrator.
import {integrateRay,meshCamera as baseCamera} from './integrator.mjs?bp3d-cortex-v001';
import {normalizePose} from '../beam-geometry.mjs';
export {parseOBJ,buildMesh,integrateRay,FOV_MM,MU_SHELL,MU_CORE,NUMERICS} from './integrator.mjs?bp3d-cortex-v001';
export const MU_UNIFORM=.02;
export const SOURCE_ORIGIN=Object.freeze([91.10159999999999,-80.8791,744.239]);
export const DEFAULT_MESH_POSE=Object.freeze({orbit:0,tilt:0,x:0,y:0,z:0});
export function meshCamera(pose=DEFAULT_MESH_POSE,size=256){return baseCamera(pose,size);}
export function previewGeometry(parsed){
  return {vertices:Float64Array.from(parsed.vertices,(v,i)=>v-SOURCE_ORIGIN[i%3]),faces:new Uint32Array(parsed.faces)};
}
export function renderMeshProjection(outer,core,pose=DEFAULT_MESH_POSE,{size=256,raw=false}={}){
  const normalized=normalizePose(pose),camera=meshCamera(normalized,size),n=size*size;
  const pixels=new Uint8ClampedArray(4*n),uniformPixels=new Uint8ClampedArray(4*n),invalidRays=[];
  const arrays=raw?Object.fromEntries(['outer','core','shell','attenuation','uniformAttenuation'].map(k=>[k,new Float64Array(n)])):{};
  for(let row=0,i=0;row<size;row++)for(let col=0;col<size;col++,i++){
    const x=(col+.5-size/2)*camera.pixelMm,y=(size/2-row-.5)*camera.pixelMm;
    const detector=camera.centre.map((v,k)=>v+x*camera.right[k]+y*camera.up[k]);
    const result=integrateRay(outer,core,camera.source,detector);
    const uniformAttenuation=result.valid?MU_UNIFORM*result.outer:NaN;
    if(raw){for(const k of ['outer','core','shell','attenuation'])arrays[k][i]=result[k];arrays.uniformAttenuation[i]=uniformAttenuation;}
    if(result.valid){
      const layered=Math.round(255*(1-Math.exp(-result.attenuation))),uniform=Math.round(255*(1-Math.exp(-uniformAttenuation)));
      pixels[4*i]=pixels[4*i+1]=pixels[4*i+2]=layered;
      uniformPixels[4*i]=uniformPixels[4*i+1]=uniformPixels[4*i+2]=uniform;
    }else{
      invalidRays.push({row,col,...result});
      for(const p of [pixels,uniformPixels]){p[4*i]=255;p[4*i+1]=0;p[4*i+2]=255;}
    }
    pixels[4*i+3]=uniformPixels[4*i+3]=255;
  }
  return {pose:normalized,camera,width:size,height:size,pixels,uniformPixels,invalidCount:invalidRays.length,invalidRays,...arrays};
}
