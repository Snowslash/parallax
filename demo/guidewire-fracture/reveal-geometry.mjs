export function fragmentSpec(){return [{id:'proximal',normal:[0,1,0],constant:-8,translation:[0,0,0]},{id:'distal',normal:[0,-1,0],constant:-8,translation:[0,0,-10]}];}
// Three local clipping retains nonnegative signed distance, in world space.
export function keptByPlane(point,fragment){return point.reduce((sum,n,i)=>sum+n*fragment.normal[i],fragment.constant)>=0;}
export function requireCommit(state){if(state.committed!==true)throw new Error('Commit before constructing any 3D scene or wire');}
export function wireParts(wire){return {segments:wire.points.slice(1).map((end,i)=>({start:[...wire.points[i]],end:[...end],radius:wire.radiusMm})),joints:wire.points.map(center=>({center:[...center],radius:wire.radiusMm})),olive:{center:[...wire.points.at(-1)],radius:wire.oliveRadiusMm}};}
