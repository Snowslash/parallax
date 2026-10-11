export function pixelAt(rect,x,y,size){
  if(!(rect.width>0&&rect.height>0&&size>0))throw new RangeError('Image dimensions required');
  return [(x-rect.left)/rect.width*size-.5,(y-rect.top)/rect.height*size-.5].map(v=>Math.max(0,Math.min(size-1,v)));
}
export function markPoint(points,point){return [...(points.length===2?[]:points.map(p=>[...p])),[...point]];}
export function measuredDistance(points,pixelMm,{tip,apex,centre}={}){
  if(!Number.isFinite(pixelMm)||pixelMm<=0||![tip,apex].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(centre)||!points.every(p=>p.length===2&&p.every(Number.isFinite)))throw new TypeError('Finite marks and positive calibration required');
  if(points.length!==2)return null;
  const delta=points[1].map((v,i)=>(v-centre)/apex-(points[0][i]-centre)/tip);
  return Math.hypot(...delta)*pixelMm;
}
