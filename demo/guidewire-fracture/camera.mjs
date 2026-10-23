// Right-handed world mm: X lateral, Y proximal, Z anterior; rows down.
export function normalizePose(pose){
 if(!pose||typeof pose!=='object'||Array.isArray(pose)||Object.keys(pose).some(k=>!['orbit','angulation'].includes(k))||!Number.isFinite(pose.orbit)||!Number.isFinite(pose.angulation)||Math.abs(pose.angulation)>60)throw Error('Invalid pose: finite orbit and angulation within ±60 only');
 const orbit=pose.orbit%360;return {orbit:orbit<0?(orbit+360)%360:orbit||0,angulation:pose.angulation||0};
}
export function cameraForPose(input,size=320,params={}){
 const pose=normalizePose(input),{pivot=[0,0,0],sourcePivot=800,sdd=1200,fieldMm=210}=params;
 if(!Number.isInteger(size)||size<1||!Array.isArray(pivot)||pivot.length!==3||!pivot.every(Number.isFinite)||![sourcePivot,sdd,fieldMm].every(Number.isFinite)||sourcePivot<=0||sdd<=sourcePivot||fieldMm<=0)throw Error('Invalid camera');
 const t=pose.orbit*Math.PI/180,a=pose.angulation*Math.PI/180,right=[Math.cos(t),0,-Math.sin(t)];
 // Preserve the original zero-angulation arithmetic (including signed zeros).
 const forward=pose.angulation===0?[-Math.sin(t),0,-Math.cos(t)]:[-Math.sin(t)*Math.cos(a),Math.sin(a),-Math.cos(t)*Math.cos(a)];
 const up=pose.angulation===0?[0,1,0]:[Math.sin(t)*Math.sin(a),Math.cos(a),Math.cos(t)*Math.sin(a)];
 return {angleDeg:pose.orbit,size,pivot,sourcePivot,sdd,fieldMm,pixelMm:fieldMm/size,forward,right,up,source:pivot.map((v,k)=>v-sourcePivot*forward[k]),centre:pivot.map((v,k)=>v+(sdd-sourcePivot)*forward[k]),pose};
}
export function isAdditionalPose(pose){return Math.abs(cameraForPose(pose).forward[2])<1-1e-6;}
