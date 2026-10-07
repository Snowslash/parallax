// World coordinates: right-handed millimetres, cylinder axis +Z.
// Acquisition projection and observer-only orthographic scene are intentionally separate.
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/Math.hypot(...a));
const TAU=2*Math.PI, AMBER='#e6b96b', INK='#e5dfd2';

/** Intersection of the source→point ray with the actual detector plane (mm). */
export function detectorPoint(camera,point) {
  const ray=sub(point,camera.source_mm), denominator=dot(ray,camera.forward);
  if(!Number.isFinite(denominator)||Math.abs(denominator)<1e-12)throw new RangeError('Ray is parallel to detector plane');
  const distance=dot(sub(camera.detector_centre_mm,camera.source_mm),camera.forward);
  return add(camera.source_mm,mul(ray,distance/denominator));
}
/** Native PNG coordinates: integer pixel centres; u right and v down. */
export function projectPoint(camera,point) {
  const relative=sub(detectorPoint(camera,point),camera.detector_centre_mm);
  const centre=(camera.size-1)/2;
  return [centre+dot(relative,camera.detector_right)/camera.pixel_mm,
    centre-dot(relative,camera.detector_up)/camera.pixel_mm];
}

/** Closed finite cylinder, indexed triangles; endpoints and radius remain in mm. */
export function cylinderMesh(a,b,radius,segments=48) {
  if(!(radius>0)||!Number.isFinite(radius)||!Number.isInteger(segments)||segments<3||
    ![...a,...b].every(Number.isFinite)||Math.hypot(...sub(b,a))<1e-12)throw new RangeError('Invalid cylinder dimensions');
  const axis=unit(sub(b,a));
  const u=unit(cross(axis,Math.abs(axis[2])<0.9?[0,0,1]:[0,1,0])),v=cross(axis,u);
  const vertices=[],faces=[];
  for(const end of [a,b])for(let i=0;i<segments;i++) {
    const angle=TAU*i/segments;
    vertices.push(add(end,add(mul(u,radius*Math.cos(angle)),mul(v,radius*Math.sin(angle)))));
  }
  vertices.push([...a],[...b]);
  for(let i=0;i<segments;i++) {
    const j=(i+1)%segments,n=segments;
    faces.push([i,j,n+j],[i,n+j,n+i],[2*n,j,i],[2*n+1,n+i,n+j]);
  }
  return {vertices,faces};
}

function prepare(canvas) {
  if(!canvas)return null;
  const {width:w,height:h}=canvas.getBoundingClientRect();
  if(!(w>0&&h>0))return null;
  const dpr=globalThis.devicePixelRatio||1;
  const width=Math.max(1,Math.round(w*dpr)),height=Math.max(1,Math.round(h*dpr));
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  // Clear integer backing pixels, not a fractional CSS rectangle: otherwise
  // edge alpha accumulates across identical redraws at fractional layout sizes.
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#171a1a';ctx.fillRect(0,0,width,height);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.lineJoin='round';ctx.lineCap='round';ctx.font='11px system-ui, sans-serif';
  return {ctx,w,h};
}
function path(ctx,points,close=false) {
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
  if(close)ctx.closePath();
}
function line(ctx,points,colour,width=1) {path(ctx,points);ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.stroke();}
function ring(radius,z,n=64) {return Array.from({length:n},(_,i)=>[radius*Math.cos(TAU*i/n),radius*Math.sin(TAU*i/n),z]);}
function shell(fixture) {
  const n=64,h=fixture.half_length_mm,vertices=[],faces=[];
  for(const radius of [fixture.outer_radius_mm,fixture.inner_radius_mm])for(const z of [-h,h])vertices.push(...ring(radius,z,n));
  for(let i=0;i<n;i++) {
    const j=(i+1)%n;
    // Outer and inner side walls, then annular end faces: never a solid end disk.
    for(const [a,b,c,d] of [[i,j,n+j,n+i],[2*n+j,2*n+i,3*n+i,3*n+j],[j,i,2*n+i,2*n+j],[n+i,n+j,3*n+j,3*n+i]])faces.push([a,b,c],[a,c,d]);
  }
  return {vertices,faces};
}
// Clip the physical source→tip segment against the closeup's world box.
function clipRay(a,b,bounds) {
  const d=sub(b,a);let lo=0,hi=1;
  for(let i=0;i<3;i++) {
    if(Math.abs(d[i])<1e-12){if(Math.abs(a[i])>bounds[i])return null;continue;}
    let t0=(-bounds[i]-a[i])/d[i],t1=(bounds[i]-a[i])/d[i];
    if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);
    if(lo>hi)return null;
  }
  return [add(a,mul(d,lo)),add(a,mul(d,hi))];
}

/** Immediate-mode Canvas2D explanatory view. Call render again after layout/resize.
 * No listeners, animation loops, acquisition edits, external resources or hidden state.
 */
export class SceneView {
  constructor(canvas,rigCanvas,fixture) {
    this.canvas=canvas;this.rigCanvas=rigCanvas;this.fixture=fixture;
    this.phantom=shell(fixture);
  }
  render({camera,rigCamera=camera,tip,wireVisible=false,yaw=35,elevation=22,showRay=true,sectionZ=null}) {
    if(!this.canvas)return;
    const surface=prepare(this.canvas);
    if(surface)this.drawScene(surface,{camera,tip,wireVisible,yaw,elevation,showRay,sectionZ});
    const rig=prepare(this.rigCanvas);
    if(rig)this.drawRig(rig,rigCamera);
  }
  drawScene({ctx,w,h},{camera,tip,wireVisible,yaw,elevation,showRay=true,sectionZ=null}) {
    const f=this.fixture,y=yaw*Math.PI/180,e=elevation*Math.PI/180;
    const right=[Math.cos(y),Math.sin(y),0],up=[-Math.sin(y)*Math.sin(e),Math.cos(y)*Math.sin(e),Math.cos(e)],depth=cross(right,up);
    const scale=Math.min(w/(f.outer_radius_mm*7),h/(f.half_length_mm*2.7));
    const project=p=>[w/2+scale*dot(p,right),h/2-scale*dot(p,up),dot(p,depth)];
    ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    const floor=-f.half_length_mm-3,extent=f.outer_radius_mm*2;
    for(let i=-2;i<=2;i++) {
      const t=i*f.outer_radius_mm;
      line(ctx,[[t,-extent,floor],[t,extent,floor]].map(project),'rgba(148,169,175,0.10)');
      line(ctx,[[-extent,t,floor],[extent,t,floor]].map(project),'rgba(148,169,175,0.10)');
    }
    const triangles=[];
    const enqueue=(mesh,wire=false)=>{
      for(const face of mesh.faces) {
        const world=face.map(i=>mesh.vertices[i]);
        const pts=world.map(project),normal=unit(cross(sub(world[1],world[0]),sub(world[2],world[0])));
        const lighting=0.5+0.5*Math.abs(dot(normal,unit([1,-2,3])));
        triangles.push({pts,z:pts.reduce((s,p)=>s+p[2],0)/3,colour:wire?AMBER:`rgba(151,175,185,${0.045+lighting*0.045})`});
      }
    };
    enqueue(this.phantom);
    if(wireVisible&&tip)enqueue(cylinderMesh(f.wire_start_mm,tip,f.wire_radius_mm),true);
    triangles.sort((a,b)=>a.z-b.z);
    for(const triangle of triangles){path(ctx,triangle.pts,true);ctx.fillStyle=triangle.colour;ctx.fill();}
    for(const z of [-f.half_length_mm,f.half_length_mm])for(const r of [f.outer_radius_mm,f.inner_radius_mm]) {
      path(ctx,ring(r,z).map(project),true);ctx.strokeStyle='rgba(173,195,203,0.48)';ctx.lineWidth=1;ctx.stroke();
    }
    if(wireVisible&&tip) {
      if(Number.isFinite(sectionZ)) {
        // Explanatory axial plane, not an opaque anatomical surface.
        const r=f.outer_radius_mm*1.45;
        path(ctx,[[-r,-r,sectionZ],[r,-r,sectionZ],[r,r,sectionZ],[-r,r,sectionZ]].map(project),true);
        ctx.fillStyle='rgba(134,199,193,0.10)';ctx.fill();
        ctx.strokeStyle='#86c7c1';ctx.lineWidth=1;ctx.stroke();
      }
      const segment=showRay?clipRay(camera.source_mm,tip,[extent,extent,f.half_length_mm+4]):null;
      if(segment){ctx.setLineDash([5,5]);line(ctx,segment.map(project),AMBER,1.2);ctx.setLineDash([]);}
      const p=project(tip);ctx.beginPath();ctx.arc(p[0],p[1],3,0,TAU);ctx.fillStyle=AMBER;ctx.fill();
    }
    ctx.restore();
    if(wireVisible&&tip&&Number.isFinite(sectionZ)) {
      ctx.fillStyle='#86c7c1';ctx.fillText(`Axial section · z = ${sectionZ} mm`,16,h-32,Math.max(1,w-32));
    }
    ctx.fillStyle='#9ca9a9';ctx.fillText('Observer view · dimensions in mm',16,h-16);
  }
  drawRig({ctx,w,h},camera) {
    const half=camera.size*camera.pixel_mm/2;
    const a=add(camera.detector_centre_mm,mul(camera.detector_right,-half));
    const b=add(camera.detector_centre_mm,mul(camera.detector_right,half));
    const source=camera.source_mm,points=[source,a,b,[0,0,0]];
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
    const scale=Math.max(0.001,Math.min(Math.max(1,w-90)/Math.max(xmax-xmin,150),Math.max(1,h-42)/Math.max(ymax-ymin,150)));
    const cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
    const project=p=>[w/2+(p[0]-cx)*scale,h/2+8-(p[1]-cy)*scale];
    const s=project(source),d=project(camera.detector_centre_mm),o=project([0,0,0]);
    line(ctx,[s,d],'#667776');
    const direction=unit([d[0]-s[0],d[1]-s[1]]),at=[s[0]+(d[0]-s[0])*0.42,s[1]+(d[1]-s[1])*0.42];
    line(ctx,[[at[0]-direction[0]*7-direction[1]*3,at[1]-direction[1]*7+direction[0]*3],at,[at[0]-direction[0]*7+direction[1]*3,at[1]-direction[1]*7-direction[0]*3]],AMBER);
    line(ctx,[project(a),project(b)],'#a9bcc3',3);
    ctx.beginPath();ctx.arc(o[0],o[1],this.fixture.outer_radius_mm*scale,0,TAU);ctx.fillStyle='#9fb1b8';ctx.fill();
    ctx.fillStyle=AMBER;ctx.fillRect(s[0]-3,s[1]-3,6,6);
    ctx.fillStyle=INK;
    // Glyphs/text have screen-sized legibility; only world geometry is true scale.
    const label=(text,p,dy=0)=>ctx.fillText(text,Math.max(8,Math.min(w-text.length*6.5-8,p[0]+10)),Math.max(16,Math.min(h-9,p[1]+dy)));
    // Place the phantom label away from the detector, including the 135-degree view.
    label('source',s);label('detector',d);label('phantom',o,o[1]<d[1]?-14:14);
  }
  destroy() {this.canvas=null;this.rigCanvas=null;this.phantom=null;}
}
