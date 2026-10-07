// Explanatory axial geometry in right-handed world mm: +X right, +Y up.
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const TAU=2*Math.PI;

/** Axial intersection of a finite flat-capped cylinder.
 * Returns an ordered, inscribed polygon of [x,y,z] world-mm points, or [].
 * The ellipse is sampled before clipping by both actual perpendicular end caps.
 * Axis parallel to the axial plane is deliberately unsupported, not approximated.
 */
export function wireSection(fixture,tip,z,segments=128) {
  const a=fixture.wire_start_mm,r=fixture.wire_radius_mm;
  if(!Array.isArray(a)||a.length!==3||!Array.isArray(tip)||tip.length!==3||
    ![...a,...tip,z,r].every(Number.isFinite)||r<=0||!Number.isInteger(segments)||segments<3)
    throw new RangeError('Invalid wire section dimensions');
  const d=tip.map((v,i)=>v-a[i]),length=Math.hypot(...d);
  if(length<1e-12)throw new RangeError('Zero length wire');
  const u=d.map(v=>v/length);
  if(Math.abs(u[2])<1e-12)throw new RangeError('Wire axis parallel to axial section plane is unsupported');
  const t=(z-a[2])/u[2],centre=a.map((v,i)=>v+t*u[i]);
  const horizontal=Math.hypot(u[0],u[1]);
  const major=horizontal>1e-12?[u[0]/horizontal,u[1]/horizontal]:[1,0];
  const minor=[-major[1],major[0]];
  let polygon=Array.from({length:segments},(_,i)=>{
    const angle=TAU*i/segments;
    return [0,1].map(j=>centre[j]+r*Math.cos(angle)*major[j]/Math.abs(u[2])+r*Math.sin(angle)*minor[j]).concat(z);
  });
  const axial=p=>dot(p.map((v,i)=>v-a[i]),u);
  // Sutherland–Hodgman half-plane clipping, retaining the true flat cap edges.
  for(const distance of [p=>axial(p),p=>length-axial(p)]) {
    const output=[];
    for(let i=0;i<polygon.length;i++) {
      const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=distance(p),dq=distance(q);
      if(dp>=0)output.push(p);
      if((dp>=0)!==(dq>=0)) {
        const fraction=dp/(dp-dq);
        output.push([p[0]+fraction*(q[0]-p[0]),p[1]+fraction*(q[1]-p[1]),z]);
      }
    }
    polygon=output;
  }
  return polygon;
}

/** Immediate-mode explanatory section; no ray is drawn in this panel.
 * camera/showRay are accepted for the shared reveal API but intentionally unused:
 * a projected beam is not a ray lying in this section plane. See the 3D panel.
 */
export class SectionView {
  constructor(canvas,fixture){this.canvas=canvas;this.fixture=fixture;}
  render(options={}) {
    const canvas=this.canvas;if(!canvas)return;
    const {width:w,height:h}=canvas.getBoundingClientRect();if(!(w>0&&h>0))return;
    const dpr=globalThis.devicePixelRatio||1;
    const width=Math.max(1,Math.round(w*dpr)),height=Math.max(1,Math.round(h*dpr));
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);
    // Gate before reading any secret-dependent options (including the plane).
    if(!options.visible)return;
    const {tip,z}=options,f=this.fixture,polygon=wireSection(f,tip,z);
    ctx.fillStyle='#171a1a';ctx.fillRect(0,0,width,height);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const extent=Math.max(f.outer_radius_mm,...polygon.map(p=>Math.hypot(p[0],p[1])));
    // Labels occupy dedicated rows above the drawing. Axes have their own gutters.
    const scale=Math.max(0,Math.min((w-64)/(2*extent),(h-86)/(2*extent)));
    const cx=w/2,cy=52+(h-72)/2;
    const project=p=>[cx+p[0]*scale,cy-p[1]*scale];
    ctx.lineWidth=1;ctx.strokeStyle='#708286';
    const path=points=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));};
    if(Math.abs(z)<=f.half_length_mm) {
      ctx.beginPath();ctx.arc(cx,cy,f.outer_radius_mm*scale,0,TAU);
      ctx.moveTo(cx+f.inner_radius_mm*scale,cy);ctx.arc(cx,cy,f.inner_radius_mm*scale,0,TAU);
      ctx.fillStyle='rgba(151,175,185,0.28)';ctx.fill('evenodd');ctx.stroke();
    }
    const reach=extent*scale+8;
    path([[cx-reach,cy],[cx+reach,cy]]);ctx.stroke();
    path([[cx,cy+reach],[cx,cy-reach]]);ctx.stroke();
    if(polygon.length>=3){path(polygon.map(project));ctx.closePath();ctx.fillStyle='#e6b96b';ctx.fill();}
    ctx.font='11px system-ui, sans-serif';ctx.textAlign='left';ctx.fillStyle='#b6c4c5';
    ctx.fillText('+X',cx+reach+3,cy+4);ctx.fillText('+Y',cx+4,cy-reach-4);
    const number=v=>Number(v.toFixed(3)).toString();
    const offset=tip[2]-z;
    const labels=[`Axial z = ${number(z)} mm`,`${number(Math.abs(offset))} mm ${offset>=0?'proximal':'distal'} to tip`];
    for(let i=0;i<labels.length;i++) {
      // Fit text on narrow canvases without forcing geometry into the header.
      const font=Math.min(11,(w-16)/(labels[i].length*.6));ctx.font=`${font}px system-ui, sans-serif`;
      ctx.fillText(labels[i],8,17+i*16);
    }
  }
}
