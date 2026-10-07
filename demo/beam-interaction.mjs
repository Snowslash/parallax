export function angleDelta(start,end){return ((end-start+540)%360+360)%360-180;}
export function poseLabel(pose){
  if(!pose)return 'No rendered image';
  const n=v=>Number(v).toFixed(1);
  return `Orbit ${n(pose.orbit)}° · tilt ${n(pose.tilt)}° | X ${n(pose.x)}, Y ${n(pose.y)}, Z ${n(pose.z)} mm`;
}
export function stepControl(value,key,coarse=false){
  const step=coarse?10:1;
  if(key==='Home')return 0;
  if(['ArrowRight','ArrowUp'].includes(key))return value+step;
  if(['ArrowLeft','ArrowDown'].includes(key))return value-step;
  return null;
}
