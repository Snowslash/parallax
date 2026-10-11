// The 3D reveal is explanatory; it never changes acquired pixels.
export function wireDescriptor(wire,revealed){
  if(!revealed)return null;
  if(!wire||![wire.start,wire.tip].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))||!Number.isFinite(wire.radius)||wire.radius<=0)throw new TypeError('Invalid wire geometry');
  const delta=wire.tip.map((v,i)=>v-wire.start[i]),length=Math.hypot(...delta);
  if(length<=0)throw new RangeError('Wire must have a finite length');
  return {centre:wire.tip.map((v,i)=>(v+wire.start[i])/2),direction:delta.map(v=>v/length),length,radius:wire.radius,tip:[...wire.tip]};
}
