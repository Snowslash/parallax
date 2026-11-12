//! Dependency-free f64 transliteration of the frozen strict JS renderer.
use std::cell::RefCell;
type V = [f64; 3];
type I = [f64; 2];
const PLANE:f64=1e-9;
const EVENT:f64=1e-7;
const EDGE:f64=32.0*f64::EPSILON;
#[repr(C)]
#[derive(Clone,Default)]
struct Triangle { a:V,b:V,c:V,normal:V,area:f64,lo:V,hi:V }
#[repr(C)]
#[derive(Clone,Default)]
struct Node { lo:V,hi:V,left:usize,right:usize,start:usize,count:usize }
#[derive(Default)]
struct Mesh { triangles:Vec<Triangle>,nodes:Vec<Node>,ids:Vec<usize> }
struct Wire { points:Vec<V>,r:f64,olive:f64 }
#[derive(Default)]
struct State { meshes:Vec<Mesh>,raw:Vec<f64>,rgba:Vec<u8>,codes:Vec<u32>,probe:Vec<f64> }
thread_local! { static STATE:RefCell<State>=RefCell::new(State::default()); }
fn v(a:&[f64],i:usize)->V { [a[i],a[i+1],a[i+2]] }
fn sub(a:V,b:V)->V { [a[0]-b[0],a[1]-b[1],a[2]-b[2]] }
fn dot(a:V,b:V)->f64 { ((0.0+a[0]*b[0])+a[1]*b[1])+a[2]*b[2] }
// Math.hypot's scaled compensated summation, including the initial zero.
fn hypot(a:V)->f64 {
 let aa=[a[0].abs(),a[1].abs(),a[2].abs()];
 let max=aa[0].max(aa[1]).max(aa[2]);
 if max==0.0{return 0.0;} if max.is_infinite(){return max;}
 let mut sum=0.0;let mut compensation=0.0;
 for x in aa {let n=x/max;let summand=n*n-compensation;let next=sum+summand;compensation=(next-sum)-summand;sum=next;}
 sum.sqrt()*max
}
fn box_hit(lo:V,hi:V,s:V,d:V)->bool {
 let mut low=f64::NEG_INFINITY;let mut high=f64::INFINITY;
 for k in 0..3 {if d[k]==0.0 {if s[k]<lo[k]-PLANE||s[k]>hi[k]+PLANE{return false;}}
 else {let a=(lo[k]-PLANE-s[k])/d[k];let b=(hi[k]+PLANE-s[k])/d[k];low=low.max(a.min(b));high=high.min(a.max(b));if high<low{return false;}}}true
}
#[derive(Clone)]
struct Hit { t:f64,sign:i32,boundary:bool }
// Codes 1..8 are the exact reference failure branches; 9 nesting, 10 shell.
fn mesh_intervals(mesh:&Mesh,s:V,d:V,max_t:f64)->Result<Vec<I>,u32> {
 let mut hits:Vec<Hit>=Vec::new();let mut stack=vec![0usize];let mut kz=0;
 if d[1].abs()>d[kz].abs(){kz=1;}if d[2].abs()>d[kz].abs(){kz=2;}
 let mut kx=(kz+1)%3;let mut ky=(kx+1)%3;if d[kz]<0.0{std::mem::swap(&mut kx,&mut ky);}
 let sx=d[kx]/d[kz];let sy=d[ky]/d[kz];let sz=1.0/d[kz];
 while let Some(idx)=stack.pop(){let node=&mesh.nodes[idx];if !box_hit(node.lo,node.hi,s,d){continue;}
 if node.count==0{stack.push(node.left);stack.push(node.right);continue;}
 for &id in &mesh.ids[node.start..node.start+node.count] {let t=&mesh.triangles[id];if !box_hit(t.lo,t.hi,s,d){continue;}
 let nd=t.normal[0]*d[0]+t.normal[1]*d[1]+t.normal[2]*d[2];
 if nd.abs()<=1e-14*t.area {let dist=dot(t.normal,sub(s,t.a))/t.area;if dist.abs()<=PLANE{return Err(1);}continue;}
 let az=t.a[kz]-s[kz];let bz=t.b[kz]-s[kz];let cz=t.c[kz]-s[kz];
 let ax=t.a[kx]-s[kx]-sx*az;let ay=t.a[ky]-s[ky]-sy*az;
 let bx=t.b[kx]-s[kx]-sx*bz;let by=t.b[ky]-s[ky]-sy*bz;
 let cx=t.c[kx]-s[kx]-sx*cz;let cy=t.c[ky]-s[ky]-sy*cz;
 let u=cx*by-cy*bx;let vv=ax*cy-ay*cx;let w=bx*ay-by*ax;
 let err=EDGE*( (cx*by).abs()+(cy*bx).abs() ).max((ax*cy).abs()+(ay*cx).abs()).max((bx*ay).abs()+(by*ax).abs());
 if (u < -err||vv < -err||w < -err)&&(u>err||vv>err||w>err){continue;}
 let det=u+vv+w;if det.abs()<=3.0*err{return Err(2);}
 let distance=(u*az+vv*bz+w*cz)*sz/det;
 hits.push(Hit{t:distance,sign:if nd<0.0{1}else{-1},boundary:u.abs().min(vv.abs()).min(w.abs())<=err});
 }}
 // Stable sort: equal distances retain right-first BVH traversal order.
 hits.sort_by(|a,b|a.t.partial_cmp(&b.t).unwrap_or(std::cmp::Ordering::Equal));
 let mut intervals=Vec::new();let mut inside=false;let mut entry=0.0;let mut i=0;
 while i<hits.len(){let h=&hits[i];let mut j=i+1;while j<hits.len()&&(hits[j].t-h.t).abs()<=EVENT{j+=1;}
 if hits[i..j].iter().any(|x|x.sign!=h.sign){return Err(3);}
 if j-i>1&&hits[i..j].iter().filter(|x|!x.boundary).count()>1{return Err(4);}
 if h.sign==1 {if inside{return Err(5);}inside=true;entry=h.t;}
 else {if !inside{return Err(6);}inside=false;let lo=0.0_f64.max(entry);let hi=max_t.min(h.t);if hi>lo{intervals.push([lo,hi]);}}
 i=j;
 }if inside{return Err(7);}Ok(intervals)
}
fn clip(intervals:Vec<I>,lo:f64,hi:f64)->Vec<I>{intervals.into_iter().map(|p|[p[0].max(lo),p[1].min(hi)]).filter(|p|p[1]>p[0]).collect()}
fn union(mut intervals:Vec<I>)->Vec<I>{
 intervals.retain(|p|p[1]>p[0]);intervals.sort_by(|a,b|a[0].partial_cmp(&b[0]).unwrap_or(std::cmp::Ordering::Equal));let mut result:Vec<I>=Vec::new();
 for p in intervals {if let Some(last)=result.last_mut(){if p[0]<=last[1]{last[1]=last[1].max(p[1]);continue;}}result.push(p);}result
}
fn length(intervals:&[I])->f64{intervals.iter().fold(0.0,|sum,p|sum+p[1]-p[0])}
fn quadratic(a:f64,b:f64,c:f64)->Vec<I>{
 if a==0.0{return if c<=0.0{vec![[f64::NEG_INFINITY,f64::INFINITY]]}else{vec![]};}
 let disc=b*b-4.0*a*c;if disc<=0.0{return vec![];}let root=disc.sqrt();let q=-0.5*(b+if b<0.0{-root}else{root});let x=q/a;let y=c/q;vec![[x.min(y),x.max(y)]]
}
fn sphere(s:V,d:V,p:V,r:f64)->Vec<I>{let q=sub(s,p);quadratic(dot(d,d),2.0*dot(q,d),dot(q,q)-r*r)}
fn wire_intervals(s:V,d:V,max_t:f64,w:&Wire)->Vec<I>{
 let mut intervals=Vec::new();for &p in &w.points{intervals.extend(sphere(s,d,p,w.r));}
 for pair in w.points.windows(2){let a=pair[0];let ab=sub(pair[1],a);let h=hypot(ab);if h==0.0{continue;}
 let axis=ab.map(|x|x/h);let q=sub(s,a);let qd=dot(q,axis);let dd=dot(d,axis);
 let pq=[q[0]-qd*axis[0],q[1]-qd*axis[1],q[2]-qd*axis[2]];
 let pd=[d[0]-dd*axis[0],d[1]-dd*axis[1],d[2]-dd*axis[2]];
 let mut radial=quadratic(dot(pd,pd),2.0*dot(pq,pd),dot(pq,pq)-w.r*w.r);
 if dd==0.0{if qd<0.0||qd>h{radial.clear();}}else{let u=-qd/dd;let vv=(h-qd)/dd;radial=clip(radial,u.min(vv),u.max(vv));}intervals.extend(radial);
 }intervals.extend(sphere(s,d,*w.points.last().unwrap(),w.olive));union(clip(intervals,0.0,max_t))
}
fn halfspace(intervals:Vec<I>,s:V,d:V,proximal:bool)->Vec<I>{
 let boundary=if proximal{8.0}else{-8.0};if d[1]==0.0{return if if proximal{s[1]>=boundary}else{s[1]<=boundary}{intervals}else{vec![]};}
 let t=(boundary-s[1])/d[1];let lower=if proximal{d[1]>0.0}else{d[1]<0.0};clip(intervals,if lower{t}else{f64::NEG_INFINITY},if lower{f64::INFINITY}else{t})
}
fn integrate(meshes:&[Mesh],source:V,detector:V,wire:&Wire)->Result<[f64;6],u32>{
 let delta=sub(detector,source);let max_t=hypot(delta);let d=delta.map(|x|x/max_t);let mut outer=Vec::new();let mut core=Vec::new();
 for proximal in [true,false]{let s=if proximal{source}else{[source[0]-0.0,source[1]-0.0,source[2]-(-10.0)]};
 let o=mesh_intervals(&meshes[0],s,d,max_t);let c=mesh_intervals(&meshes[1],s,d,max_t);
 let offset=if proximal{0}else{32};let o=o.map_err(|code|code+offset)?;let c=c.map_err(|code|code+16+offset)?;
 for p in &c {if !o.iter().any(|q|p[0]>=q[0]-EVENT&&p[1]<=q[1]+EVENT){return Err(9+offset);}}
 outer.extend(halfspace(o,s,d,proximal));core.extend(halfspace(c,s,d,proximal));
 }let outer_length=length(&union(outer));let core_length=length(&union(core));let shell=outer_length-core_length;if shell<0.0{return Err(10);}
 let metal=length(&wire_intervals(source,d,max_t,wire));let bone=0.04*shell+0.008*core_length;
 Ok([outer_length,core_length,shell,bone,metal,bone+0.65*metal])
}
// wasm32-only ABI: fill final repr(C) storage directly, with no serialized staging copy.
#[no_mangle]pub extern "C" fn allocate_mesh(slot:usize,triangles:usize,nodes:usize,ids:usize)->*mut f64{
 assert!(slot<2);assert_eq!(std::mem::size_of::<Triangle>(),19*8);assert_eq!(std::mem::size_of::<Node>(),64);
 STATE.with(|s|{let mut state=s.borrow_mut();state.meshes.resize_with(2,Mesh::default);
 state.meshes[slot]=Mesh{triangles:vec![Triangle::default();triangles],nodes:vec![Node::default();nodes],ids:vec![0;ids]};state.meshes[slot].triangles.as_mut_ptr() as *mut f64})
}
#[no_mangle]pub extern "C" fn nodes_ptr(slot:usize)->*const u8{STATE.with(|s|s.borrow().meshes[slot].nodes.as_ptr() as *const u8)}
#[no_mangle]pub extern "C" fn ids_ptr(slot:usize)->*const usize{STATE.with(|s|s.borrow().meshes[slot].ids.as_ptr())}
fn read_wire(a:&[f64],i:usize)->Wire{let n=a[i] as usize;Wire{points:(0..n).map(|k|v(a,i+3+3*k)).collect(),r:a[i+1],olive:a[i+2]}}
#[no_mangle]pub extern "C" fn alloc(n:usize)->*mut f64{Box::into_raw(vec![0.0;n].into_boxed_slice()) as *mut f64}
#[no_mangle]pub unsafe extern "C" fn dealloc(ptr:*mut f64,n:usize){drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr,n)));}

#[no_mangle]pub unsafe extern "C" fn render_frame(ptr:*const f64,n:usize,size:usize)->*const f64{
 let a=std::slice::from_raw_parts(ptr,n);let source=v(a,0);let centre=v(a,3);let right=v(a,6);let up=v(a,9);let pixel=a[12];let wire=read_wire(a,13);let count=size*size;
 STATE.with(|cell|{let mut state=cell.borrow_mut();let state=&mut *state;state.raw.resize(6*count,0.0);state.rgba.resize(4*count,0);state.codes.resize(count,0);
 for row in 0..size{for col in 0..size{let i=row*size+col;let u=(col as f64+0.5-size as f64/2.0)*pixel;let vv=(size as f64/2.0-row as f64-0.5)*pixel;
 let detector=[centre[0]+u*right[0]+vv*up[0],centre[1]+u*right[1]+vv*up[1],centre[2]+u*right[2]+vv*up[2]];
 match integrate(&state.meshes,source,detector,&wire){Ok(values)=>{for k in 0..6{state.raw[k*count+i]=values[k];}let grey=(255.0*(1.0-(-values[5]).exp())+0.5).floor() as u8;state.rgba[4*i..4*i+3].fill(grey);state.codes[i]=0;},Err(code)=>{for k in 0..6{state.raw[k*count+i]=f64::NAN;}state.rgba[4*i..4*i+3].copy_from_slice(&[255,0,255]);state.codes[i]=code;}}
 state.rgba[4*i+3]=255;
 }}state.raw.as_ptr()})
}
#[no_mangle]pub extern "C" fn rgba_ptr()->*const u8{STATE.with(|s|s.borrow().rgba.as_ptr())}
#[no_mangle]pub extern "C" fn codes_ptr()->*const u32{STATE.with(|s|s.borrow().codes.as_ptr())}
#[no_mangle]pub unsafe extern "C" fn probe(ptr:*const f64,n:usize,kind:u32)->*const f64{
 let a=std::slice::from_raw_parts(ptr,n);let source=v(a,0);let d=v(a,3);let max_t=a[6];
 STATE.with(|cell|{let mut state=cell.borrow_mut();state.probe=match kind{0=>match integrate(&state.meshes,source,d,&read_wire(a,7)){Ok(values)=>[vec![0.0],values.to_vec()].concat(),Err(code)=>[vec![code as f64],vec![f64::NAN;6]].concat()},_=>{let result=if kind==1{mesh_intervals(&state.meshes[0],source,d,max_t)}else{Ok(wire_intervals(source,d,max_t,&read_wire(a,7)))};match result{Ok(intervals)=>{let mut out=vec![0.0,intervals.len() as f64];for p in intervals{out.extend(p);}out},Err(code)=>vec![code as f64,0.0]}}};state.probe.as_ptr()})
}
#[no_mangle]pub extern "C" fn dispose(){STATE.with(|s|*s.borrow_mut()=State::default());}
