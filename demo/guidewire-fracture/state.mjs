// Pose geometry is injected so state tests do not depend on the renderer package.
const copy=x=>x===null?null:structuredClone(x);
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const same=(a,b)=>a?.orbit===b?.orbit&&a?.angulation===b?.angulation;
const valid=f=>f&&Number.isInteger(f.width)&&f.width>0&&f.width<=8192&&Number.isInteger(f.height)&&f.height>0&&f.height<=8192&&f.pixels instanceof Uint8ClampedArray&&f.pixels.length===f.width*f.height*4&&f.invalidCount===0&&typeof f.framing?.oliveInFrame==='boolean';
export function createState({normalizePose,isAdditionalPose}){
 let generation=0,sequence=0,serial=0,s,active=null,settled=false,displayed=null,ap=null,captured=null;
 function reset(caseId='case-a'){
  if(!['case-a','case-b'].includes(caseId))throw Error('Invalid case');
  generation++;active=null;settled=false;displayed=ap=captured=null;
  s={caseId,ready:false,pending:true,error:'',requestedPose:{orbit:0,angulation:0},committed:false,revealed:false,wireVisible:false,answer:null,displayRotationDeg:90,observer:{yaw:-35,elevation:22,zoom:1}};
 }
 const matching=()=>s.ready&&!s.pending&&!s.error&&displayed&&same(s.requestedPose,displayed.pose);
 const canCapture=()=>Boolean(matching()&&!s.committed&&displayed.framing.oliveInFrame&&isAdditionalPose(displayed.pose));
 const canCommit=()=>Boolean(matching()&&captured&&!s.committed);
 reset();
 return {
  reset,
  snapshot(){return freeze({...copy(s),generation,requestSequence:sequence,activeRequestId:active?.id??null,displayedPose:copy(displayed?.pose??null),capturedPose:copy(captured?.pose??null),displayedFrameId:displayed?.id??null,capturedFrameId:captured?.id??null,capturedCaseId:captured?.caseId??null,capturedRotationDeg:captured?.displayRotationDeg??null,apSha256:ap?.sha256??null,canCapture:canCapture(),canCommit:canCommit(),framed:displayed?.framing.oliveInFrame??false});},
  evidence(kind){return copy(({ap,displayed,captured})[kind]??null);},
  acceptAP(g,frame,sha256){if(g!==generation||s.ready)return false;if(!valid(frame))throw Error('Invalid AP pixels');ap={...copy(frame),id:`ap-${generation}`,caseId:s.caseId,pose:{orbit:0,angulation:0},sha256,displayRotationDeg:0};displayed=copy(ap);s.ready=true;s.pending=false;s.error='';return true;},
  stage(pose){if(!s.ready||s.committed)return false;const p=normalizePose(pose);sequence++;s.requestedPose=p;s.pending=true;s.error='';settled=false;return true;},
  settle(){settled=true;},
  nextRequest(){if(active||!settled||!s.ready||!s.pending||s.error||s.committed)return null;active={type:'render',id:`${generation}-${++serial}`,caseId:s.caseId,pose:copy(s.requestedPose),size:320,sequence};return {type:active.type,id:active.id,caseId:active.caseId,pose:copy(active.pose),size:active.size};},
  receive(message){
   if(!active||message.id!==active.id)return false;
   const a=active;active=null;
   if(a.sequence!==sequence)return false;
   if(message.caseId!==s.caseId||!same(message.pose,a.pose)){s.error='Projection reply did not match the requested case and pose';s.pending=false;return false;}
   if(message.type!=='frame'||!valid(message.frame)){s.error=String(message.error||'Invalid projection pixels');s.pending=false;return false;}
   displayed={...copy(message.frame),id:a.id,caseId:s.caseId,pose:copy(a.pose)};s.pending=false;s.error='';return true;
  },
  workerFailed(error){active=null;s.pending=false;s.error=String(error);},
  retry(){if(s.committed)return;s.error='';s.pending=true;sequence++;settled=false;},
  setRotation(checked){s.displayRotationDeg=checked?90:0;},
  setObserver(o){if(!['yaw','elevation','zoom'].every(k=>Number.isFinite(o[k])))throw Error('Invalid observer');s.observer={yaw:Math.max(-180,Math.min(180,o.yaw)),elevation:Math.max(-80,Math.min(80,o.elevation)),zoom:Math.max(.7,Math.min(3,o.zoom))};},
  capture(){if(!canCapture())throw Error('Wait for a matching, framed additional projection');captured={...copy(displayed),displayRotationDeg:s.displayRotationDeg};return copy(captured);},
  commit(answer){if(!['entered','missed','uncertain'].includes(answer))throw Error('Invalid answer');if(!canCommit())throw Error('Save an additional view and wait for the current projection');s.answer=answer;s.committed=true;},
  reveal(){if(!s.committed)throw Error('Commit before reveal');s.revealed=s.wireVisible=true;},
  hideReveal(){s.revealed=s.wireVisible=false;}
 };
}
export function feedback(answer,truth){return answer==='uncertain'?'You chose Uncertain.':answer===truth?'Your answer matches this case.':'Your answer differs from this case.';}
// Learner-facing explanations only; model identities and truth are unchanged.
export function caseFeedback(truth){return truth==='entered'?'In this case, the guidewire has entered the distal canal. Its rounded tip and the segment beyond the fracture lie inside the canal shown in the model.':'In this case, the wire misses the distal canal. It passes through the fracture gap and lies anterior to the distal fragment; it has not pierced intact cortex.';}
