// Offline evidence only; never imported by the browser or used as a cached image bank.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {parseOBJ,buildMesh,integrateRay,renderMeshProjection,DEFAULT_MESH_POSE,FOV_MM,MU_SHELL,MU_CORE,NUMERICS} from '../../demo/mesh-spike/geometry.mjs';
import {boxOBJ,OUTER,CORE,POSES,referenceCamera,materialReference,TOLERANCES} from './fixtures.mjs';
export function encodePNG(width,height,pixels){
  const chunk=(type,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);let crc=0xffffffff;for(const byte of b.subarray(4,-4)){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}b.writeUInt32BE((crc^0xffffffff)>>>0,b.length-4);return b;};
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const raw=Buffer.alloc(height*(1+width*4));for(let row=0;row<height;row++)Buffer.from(pixels.buffer,pixels.byteOffset+row*width*4,width*4).copy(raw,row*(1+width*4)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
export function analyticEvidence(){
  const outer=buildMesh(parseOBJ(boxOBJ(OUTER))),core=buildMesh(parseOBJ(boxOBJ(CORE))),refined=[OUTER,CORE].map(b=>buildMesh(parseOBJ(boxOBJ(b,true))));
  let rays=0,invalidCount=0,maxLengthErrorMm=0,maxAttenuationError=0,maxLengthDeltaMm=0;
  const records=[];
  for(const pose of POSES){const cam=referenceCamera(pose,43);for(let row=0;row<43;row++)for(let col=0;col<43;col++){
    const detector=cam.detector(row,col),candidate=integrateRay(outer,core,cam.source,detector),reference=materialReference(cam.source,detector),subdivided=integrateRay(...refined,cam.source,detector);
    rays++;if(!candidate.valid||!subdivided.valid){invalidCount++;continue;}
    for(const k of ['outer','core','shell']){maxLengthErrorMm=Math.max(maxLengthErrorMm,Math.abs(candidate[k]-reference[k]));maxLengthDeltaMm=Math.max(maxLengthDeltaMm,Math.abs(candidate[k]-subdivided[k]));}
    maxAttenuationError=Math.max(maxAttenuationError,Math.abs(candidate.attenuation-reference.attenuation));
    if(candidate.outer>0&&records.length<12)records.push({pose,row,col,source:cam.source,detector,candidate,reference});
  }}
  const resolutions=[64,128,256],integrals=resolutions.map(size=>{const f=renderMeshProjection(outer,core,POSES[0],{size,raw:true});if(f.invalidCount)invalidCount+=f.invalidCount;return f.attenuation.reduce((s,x)=>s+x,0)*(FOV_MM/size)**2;});
  const relativeChange=Math.abs(integrals[2]-integrals[1])/integrals[2],pass=invalidCount===0&&maxLengthErrorMm<=TOLERANCES.lengthMm&&maxAttenuationError<=TOLERANCES.attenuation&&maxLengthDeltaMm<=TOLERANCES.tessellationMm&&relativeChange<=TOLERANCES.samplingRelative;
  return {method:'asymmetric nested boxes; independent slab half-space integration and matrix camera; same production integrator',tolerances:TOLERANCES,rays,invalidCount,maxLengthErrorMm,maxAttenuationError,pass,tessellation:{method:'same planar geometry, every triangle subdivided into four, not smoothing the model',maxLengthDeltaMm,pass:maxLengthDeltaMm<=TOLERANCES.tessellationMm},sampling:{method:'pixel-centre attenuation detector integral; not pixelwise equality across resolutions',resolutions,integrals,relativeChange,pass:relativeChange<=TOLERANCES.samplingRelative},records};
}
const json=(path,value)=>writeFileSync(path,JSON.stringify(value,(_,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v,2)+'\n');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function exportEvidence(){
  const out=fileURLToPath(new URL('./outputs/',import.meta.url));mkdirSync(out,{recursive:true});
  const meshes={},assets={},buildTimings={};
  for(const name of ['outer','core']){const bytes=readFileSync(new URL(`../../demo/mesh-spike/assets/${name}.obj`,import.meta.url));assets[name]={sha256:hash(bytes),bytes:bytes.length};const begin=performance.now(),parsed=parseOBJ(bytes.toString('utf8')),parsedAt=performance.now();meshes[name]=buildMesh(parsed);buildTimings[name]={parseMs:parsedAt-begin,buildMs:performance.now()-parsedAt};}
  const expected={outer:'1367defee70c21312f504b42d07d2e2208e0ec2d2aa309bcb0ed3eace32fda4d',core:'05a504a797ef08d37aef092dba0de1c187b9a7a43d94c808489e35bb9abc8a99'};
  for(const k of Object.keys(expected))if(assets[k].sha256!==expected[k])throw new Error(`Frozen ${k} hash mismatch`);
  const common={candidate:'ftv-proximal-femur-left-v001',assets,units:'mm',assetToWorld:'identity',axes:{x:'subject left/lateral',y:'posterior',z:'superior'},FOV_MM,MU_SHELL,MU_CORE,mapping:'round(255*(1-exp(-attenuation)))',sourcePivotMm:800,sddMm:1200,rawFormat:'row-major Float64 little-endian; row increases down, column right; pixel centres',invalidPolicy:'NaN raw values, magenta RGBA, full invalidRays list; no invalid frame acceptance',numerics:NUMERICS};
  const frames=[],rays=[];
  const poses=[DEFAULT_MESH_POSE,...POSES,{orbit:41.3,tilt:53.1,x:44,y:12,z:-120}];
  for(let index=0;index<poses.length;index++)for(const size of [128,256]){
    const begin=performance.now(),frame=renderMeshProjection(meshes.outer,meshes.core,poses[index],{size,raw:true}),durationMs=performance.now()-begin,prefix=`pose-${index}-${size}`;
    const files={};for(const k of ['outer','core','shell','attenuation']){const bytes=Buffer.alloc(frame[k].length*8);frame[k].forEach((v,i)=>bytes.writeDoubleLE(v,8*i));const file=`${prefix}-${k}.f64le`;writeFileSync(out+file,bytes);files[k]={file,sha256:hash(bytes),bytes:bytes.length};}
    const png=encodePNG(size,size,frame.pixels);writeFileSync(out+`${prefix}.png`,png);files.image={file:`${prefix}.png`,sha256:hash(png)};
    const attenuationIntegral=frame.attenuation.reduce((s,x)=>s+x,0)*(FOV_MM/size)**2,foreground=Array.from(frame.outer.entries()).filter(([,x])=>x>0).map(([i])=>i);
    const config={...common,pose:frame.pose,camera:frame.camera,size,durationMs,invalidCount:frame.invalidCount,invalidRays:frame.invalidRays,attenuationIntegral,foregroundPixels:foreground.length,files};json(out+`${prefix}.json`,config);frames.push({prefix,pose:frame.pose,size,durationMs,invalidCount:frame.invalidCount,attenuationIntegral,foregroundPixels:foreground.length});
    if(size===128){const cam=frame.camera;const indices=[0,size*size-1,...Array.from({length:32},(_,j)=>foreground[Math.floor(j*(foreground.length-1)/31)])];for(const i of new Set(indices)){if(i===undefined)continue;const row=Math.floor(i/size),col=i%size,x=(col+.5-size/2)*cam.pixelMm,y=(size/2-row-.5)*cam.pixelMm,detector=cam.centre.map((v,k)=>v+x*cam.right[k]+y*cam.up[k]);rays.push({name:`${prefix}-${row}-${col}`,source:cam.source,detector,expected:'ordinary valid',candidate:integrateRay(meshes.outer,meshes.core,cam.source,detector)});}}
  }
  const outer=meshes.outer,ids=Array.from(outer.faces.slice(13960*3,13961*3)),vertices=ids.map(i=>Array.from(outer.vertices.slice(i*3,i*3+3))),centre=[0,1,2].map(k=>vertices.reduce((s,v)=>s+v[k]/3,0));
  const capRays=[{name:'sliver-centroid-axial',source:[centre[0],centre[1],-300],detector:[centre[0],centre[1],100]},...vertices.map((v,i)=>({name:`sliver-vertex-${i}`,source:[v[0],v[1],-300],detector:[v[0],v[1],100]})),{name:'sliver-centroid-near-parallel',source:[centre[0]-100,centre[1],-160-1e-6],detector:[centre[0]+100,centre[1],-160+1e-6]},{name:'sliver-coplanar-explicit-invalid',source:[centre[0]-100,centre[1],-160],detector:[centre[0]+100,centre[1],-160]},{name:'cap-finite-short-shell',source:[44,12,-161],detector:[44,12,-159]},{name:'cap-finite-inside-core',source:[44,12,-155],detector:[44,12,-150]}];
  for(const ray of capRays)rays.push({...ray,expected:ray.name.includes('explicit-invalid')?'explicit invalid':'diagnostic, validity measured',candidate:integrateRay(meshes.outer,meshes.core,ray.source,ray.detector)});
  json(out+'actual-ray-samples.json',{...common,sliver:{face:13960,vertices,centre},rays});
  const sampling=poses.map((pose,i)=>{const f=frames.filter(f=>f.prefix.startsWith(`pose-${i}-`)),relativeChange=Math.abs(f[1].attenuationIntegral-f[0].attenuationIntegral)/f[1].attenuationIntegral;return {pose,relativeChange,tolerance:TOLERANCES.samplingRelative,pass:relativeChange<=TOLERANCES.samplingRelative};});
  const report={...common,runtime:{node:process.version,platform:process.platform,arch:process.arch},timingScope:'single Node offline runs, not worker/browser latency; no performance gate judged here',buildTimings,analytic:analyticEvidence(),frames,sampling,diagnosticRays:capRays.map(r=>({name:r.name,...rays.find(v=>v.name===r.name).candidate})),limitations:['Independent analytic boxes validate actual triangle integrator, not anatomical truth','Actual geometry independent ray verification is in independent-reference.json, separately executed','Boundary-coplanar and mixed-sign tangent rays explicitly fail; no jitter or geometry repair','No complete mesh self-intersection re-audit','Sampling change is detector-integral convergence, not a per-pixel error bound','No smoothing/refinement of frozen v001 asset; planar control tessellation only']};
  json(out+'numerical-report.json',report);console.log(JSON.stringify({analytic:report.analytic,frames,sampling,diagnosticRays:report.diagnosticRays,buildTimings},null,2));return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url))exportEvidence();
