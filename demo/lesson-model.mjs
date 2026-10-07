export const PREDICTIONS=Object.freeze(['separate','overlap','unsure']);
export const JUDGEMENTS=Object.freeze(['contained','breached','insufficient']);
export const caseFor=(state,lesson)=>lesson.cases[state.index];
export const frameFor=(state,lesson,angle=state.viewed)=>caseFor(state,lesson).frames.find(frame=>frame.angle===angle);
export function initialState(lesson,index=0,completed=[]) {
  const current=lesson.cases[index], captured=[...current.initialAngles];
  return {index,caseId:current.id,captured,reference:captured[0],viewed:captured.at(-1),selected:captured.at(-1),
    prediction:null,predictions:{},judgement:null,revealed:false,completed:[...completed],finished:false,
    yaw:35,elevation:22,showRay:true,showSection:true};
}
export const canAcquire=state=>!state.captured.includes(state.selected)&&(state.revealed||PREDICTIONS.includes(state.prediction));
export const canCommit=(state,lesson)=>!state.revealed&&state.captured.length>caseFor(state,lesson).initialAngles.length&&JUDGEMENTS.includes(state.judgement);
export function reduce(state,action,lesson) {
  switch(action.type){
    case 'select': return lesson.angles.includes(action.angle)&&action.angle!==state.selected?{...state,selected:action.angle,prediction:null}:state;
    case 'predict': return !state.revealed&&!state.captured.includes(state.selected)&&PREDICTIONS.includes(action.value)?{...state,prediction:action.value}:state;
    case 'acquire': return canAcquire(state)?{...state,captured:[...state.captured,state.selected],viewed:state.selected,
      predictions:{...state.predictions,[state.selected]:state.prediction},prediction:null,judgement:state.revealed?state.judgement:null}:state;
    case 'view': return state.captured.includes(action.angle)?{...state,viewed:action.angle,selected:action.angle,prediction:null}:state;
    case 'pin': return state.captured.includes(action.angle)?{...state,reference:action.angle}:state;
    case 'judge': return !state.revealed&&state.captured.length>caseFor(state,lesson).initialAngles.length&&JUDGEMENTS.includes(action.value)?{...state,judgement:action.value}:state;
    case 'commit': return canCommit(state,lesson)?{...state,revealed:true,selected:state.viewed,prediction:null,completed:[...new Set([...state.completed,state.caseId])]}:state;
    case 'orbit': return state.revealed&&Number.isFinite(action.yaw)&&Number.isFinite(action.elevation)?{...state,yaw:Math.max(-180,Math.min(180,action.yaw)),elevation:Math.max(5,Math.min(75,action.elevation))}:state;
    case 'toggle': return state.revealed&&['showRay','showSection'].includes(action.key)&&typeof action.value==='boolean'?{...state,[action.key]:action.value}:state;
    case 'replay': return initialState(lesson,state.index,state.completed);
    case 'next': return !state.revealed?state:state.index<lesson.cases.length-1?initialState(lesson,state.index+1,state.completed):{...state,finished:true};
    case 'chapter': return Number.isInteger(action.index)&&action.index>=0&&action.index<lesson.cases.length&&
      (action.index===state.index||state.completed.includes(lesson.cases[action.index].id))?initialState(lesson,action.index,state.completed):state;
    case 'restart': return initialState(lesson);
    default:return state;
  }
}
export function scenePayload(state,lesson){
  return {camera:lesson.geometry.cameras.find(c=>c.angle_deg===state.viewed),
    rigCamera:lesson.geometry.cameras.find(c=>c.angle_deg===state.selected),
    tip:state.revealed?caseFor(state,lesson).tip:null,wireVisible:state.revealed,
    yaw:state.yaw,elevation:state.elevation,showRay:state.revealed&&state.showRay,
    sectionZ:state.revealed&&state.showSection?caseFor(state,lesson).tip[2]-1:null};
}
export function viewExplanation(state,lesson){
  if(!state.revealed)return '';
  const evidence=frameFor(state,lesson).evidence;
  if(evidence==='beyond')return `At ${state.viewed}°, the wire end projects beyond the cylinder outline. This view shows the breach.`;
  if(evidence==='borderline')return `At ${state.viewed}°, the wire end is close to the outline. The edge is unclear; try another view.`;
  return `At ${state.viewed}°, the wire end overlaps the cylinder outline. This view alone cannot tell you whether it is contained.`;
}
export function judgementFeedback(state,lesson){
  if(!state.revealed)return '';
  if(state.judgement==='insufficient')return 'Compare the views with the reveal. What would you need to see before deciding?';
  return state.judgement===caseFor(state,lesson).truth?
    'Your answer matches the model. Which view supports it?':
    'Your answer differs from the model. Check the wire end against the wall in the cross-section.';
}
