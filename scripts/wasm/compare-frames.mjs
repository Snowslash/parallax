const CHANNELS=['outer','core','shell','bone','metal','attenuation'];
export function compareFrames(reference,candidate){
 const r={ok:false,pixelDifferences:0,rawMismatches:0,nonfiniteMismatches:0,rawValuesCompared:0,maxRawAbsolute:0,maxByChannel:{},errors:[]};
 if(reference.width!==candidate.width||reference.height!==candidate.height)r.errors.push('shape');
 if(reference.invalidCount!==candidate.invalidCount)r.errors.push('invalid count');
 const coords=f=>JSON.stringify((f.invalidRays||[]).map(x=>[x.row,x.col]));
 if(coords(reference)!==coords(candidate))r.errors.push('invalid coordinates');
 const a=reference.rgba,b=candidate.rgba;
 if(!a||!b||a.length!==b.length)r.errors.push('pixel length');else for(let i=0;i<a.length;i++)if(a[i]!==b[i])r.pixelDifferences++;
 for(const k of CHANNELS){
  const x=reference.arrays?.[k],y=candidate.arrays?.[k];let max=0;
  if(!x||!y||x.length!==y.length||x.length!==reference.width*reference.height){r.errors.push('raw channel '+k);continue;}
  for(let i=0;i<x.length;i++){
   r.rawValuesCompared++;
   if(!Number.isFinite(x[i])||!Number.isFinite(y[i])){if(!(Number.isNaN(x[i])&&Number.isNaN(y[i]))&&x[i]!==y[i])r.nonfiniteMismatches++;continue;}
   const d=Math.abs(x[i]-y[i]);max=Math.max(max,d);if(d>1e-9+1e-12*Math.abs(x[i]))r.rawMismatches++;
  }
  r.maxByChannel[k]=max;r.maxRawAbsolute=Math.max(r.maxRawAbsolute,max);
 }
 r.ok=!r.errors.length&&!r.pixelDifferences&&!r.rawMismatches&&!r.nonfiniteMismatches;return r;
}
