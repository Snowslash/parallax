// Offline numeric evidence only; no dense cache or browser performance claim.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {renderProjection,projectPoint} from '../../demo/beam-geometry.mjs';
const {cases,fiducials}=JSON.parse(readFileSync(0,'utf8'));
const out=new URL('./results/',import.meta.url);mkdirSync(out,{recursive:true});
const records=[];
for(const {id,pose,size} of cases){
  const start=performance.now(),r=renderProjection(pose,{size,raw:true}),nodeMs=performance.now()-start;
  for(const key of ['total','shell','wire']){
    // Explicit little endian for portable NumPy import.
    const buffer=Buffer.alloc(r[key].length*8);
    r[key].forEach((value,i)=>buffer.writeDoubleLE(value,i*8));
    writeFileSync(new URL(`${id}-${key}.f64`,out),buffer);
  }
  writeFileSync(new URL(`${id}.rgba`,out),r.pixels);
  records.push({id,pose:r.pose,size,camera:r.camera,nodeMs,fiducialPixels:fiducials.map(p=>projectPoint(r.camera,p))});
}
writeFileSync(new URL('js-metadata.json',out),JSON.stringify({node:process.version,records},null,2)+'\n');
console.log(JSON.stringify({frames:records.length}));
