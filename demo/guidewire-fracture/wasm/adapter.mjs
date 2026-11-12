import {cameraForPose} from '../camera.mjs';
import {integrateRay,pixelRay} from '../render-core.mjs';
import {meshIntervals} from '../kernel/ct/integrator.mjs';
const keys=['outer','core','shell','bone','metal','attenuation'];
const reasons={1:'coplanar/near-parallel boundary unresolved',2:'ill-conditioned triangle intersection',3:'mixed-sign tangent/close crossings unresolved',4:'coincident interior crossings unresolved',5:'nonalternating entry',6:'exit without entry',7:'unclosed line interval',9:'core interval not contained/nested in outer',10:'negative shell length'};
function upload(e,mesh,slot){
 // Two bounded walks; no flattened JS array or Wasm staging allocation.
 let nodeCount=0,idCount=0;
 function count(node){nodeCount++;if(node.ids)idCount+=node.ids.length;else{count(node.left);count(node.right);}}
 count(mesh.bvh);
 const triangles=e.allocate_mesh(slot,mesh.triangles.length,nodeCount,idCount),nodes=e.nodes_ptr(slot),ids=e.ids_ptr(slot);
 const data=new Float64Array(e.memory.buffer,triangles,19*mesh.triangles.length);
 for(let i=0;i<mesh.triangles.length;i++){
  const t=mesh.triangles[i],p=19*i;data.set(t.a,p);data.set(t.b,p+3);data.set(t.c,p+6);data.set(t.normal,p+9);data[p+12]=t.area2;data.set(t.lo,p+13);data.set(t.hi,p+16);
 }
 const bounds=new Float64Array(e.memory.buffer,nodes,nodeCount*8),indices=new Uint32Array(e.memory.buffer,nodes,nodeCount*16),leafIds=new Uint32Array(e.memory.buffer,ids,idCount);
 let next=0,leaf=0;
 function write(node){
  const index=next++,p=index*16;bounds.set(node.lo,index*8);bounds.set(node.hi,index*8+3);
  if(node.ids){indices[p+14]=leaf;indices[p+15]=node.ids.length;leafIds.set(node.ids,leaf);leaf+=node.ids.length;}
  else{indices[p+12]=write(node.left);indices[p+13]=write(node.right);}return index;
 }
 write(mesh.bvh);return {triangles,nodes,ids,triangleCount:mesh.triangles.length,nodeCount,idCount};
}
// Exceptional invalid frames only: recover the exact reference diagnostics from
// final Wasm geometry, not a second retained JS mesh. No new BVH or geometry math.
function diagnosticMesh(e,m){
 const data=new Float64Array(e.memory.buffer,m.triangles,19*m.triangleCount),bounds=new Float64Array(e.memory.buffer,m.nodes,m.nodeCount*8),indices=new Uint32Array(e.memory.buffer,m.nodes,m.nodeCount*16),leaf=new Uint32Array(e.memory.buffer,m.ids,m.idCount);
 const xyz=(a,p)=>Array.from(a.subarray(p,p+3));
 const triangles=Array.from({length:m.triangleCount},(_,id)=>{const p=id*19;return {a:xyz(data,p),b:xyz(data,p+3),c:xyz(data,p+6),normal:xyz(data,p+9),area2:data[p+12],lo:xyz(data,p+13),hi:xyz(data,p+16),id};});
 function node(i){const p=i*16,n={lo:xyz(bounds,i*8),hi:xyz(bounds,i*8+3)},start=indices[p+14],count=indices[p+15];if(count)n.ids=Array.from(leaf.subarray(start,start+count));else{n.left=node(indices[p+12]);n.right=node(indices[p+13]);}return n;}
 return {triangles,bvh:node(0)};
}
function validateWire(w){if(!w?.points||w.points.length<2||!(w.radiusMm>0)||!(w.oliveRadiusMm>0)||!w.points.every(p=>p.length===3&&p.every(Number.isFinite)))throw Error('Invalid finite wire');}
const wireData=w=>[w.points.length,w.radiusMm,w.oliveRadiusMm,...w.points.flat()];
function assertDiagnostic(result,code){const k=(code%32)>=16?(code%32)-16:code%32;if(result.valid||result.reason!==reasons[k])throw Error('Wasm/reference invalid-ray disagreement');return result;}
export async function createRustRenderer({wasmBytes,meshes}){
 if(!(wasmBytes instanceof ArrayBuffer)&&!ArrayBuffer.isView(wasmBytes))throw TypeError('Wasm bytes required');
 const start=performance.now();let e=(await WebAssembly.instantiate(wasmBytes,{})).instance.exports;const instantiated=performance.now();
 let descriptors;
 try{descriptors=[upload(e,meshes.outer,0),upload(e,meshes.canal,1)];}catch(error){e.dispose();e=null;throw error;}
 meshes=null;wasmBytes=null;
 const setup=Object.freeze({instantiateMs:instantiated-start,serializationMs:performance.now()-instantiated,stagingBytes:0});
 function active(){if(!e)throw Error('Renderer disposed');}
 function diagnostics(){return {outer:diagnosticMesh(e,descriptors[0]),canal:diagnosticMesh(e,descriptors[1])};}
 function transfer(values,fn){const n=values.length,ptr=e.alloc(n);try{new Float64Array(e.memory.buffer,ptr,n).set(values);return fn(ptr,n);}finally{e.dealloc(ptr,n);}}
 function probe(source,d,maxT,w,kind){
  active();if(w)validateWire(w);if(![source,d].every(p=>p?.length===3&&p.every(Number.isFinite)))throw Error('Finite endpoints required');if(kind===0&&source.every((x,k)=>x===d[k]))throw Error('Zero ray');
  return transfer([...source,...d,maxT,...(w?wireData(w):[])],(p,n)=>{
   const ptr=e.probe(p,n,kind),header=new Float64Array(e.memory.buffer,ptr,2);
   if(header[0])return assertDiagnostic(kind===0?integrateRay(diagnostics(),source,d,w):meshIntervals(diagnosticMesh(e,descriptors[0]),source,d,maxT),header[0]);
   if(kind===0){const values=new Float64Array(e.memory.buffer,ptr,7);return {valid:true,...Object.fromEntries(keys.map((k,i)=>[k,values[i+1]]))};}
   const values=new Float64Array(e.memory.buffer,ptr+16,2*header[1]),intervals=Array.from({length:header[1]},(_,i)=>[values[2*i],values[2*i+1]]);
   return {valid:true,intervals};
  });
 }
 return {
  setup,
  renderPose(wire,pose,size=320,cameraParams={}){
   active();const camera=cameraForPose(pose,size,cameraParams);validateWire(wire);const n=size*size;
   return transfer([...camera.source,...camera.centre,...camera.right,...camera.up,camera.pixelMm,...wireData(wire)],(p,len)=>{
    const ptr=e.render_frame(p,len,size),raw=new Float64Array(e.memory.buffer,ptr,6*n),arrays=Object.fromEntries(keys.map((k,i)=>[k,raw.slice(i*n,(i+1)*n)])),rgba=new Uint8Array(e.memory.buffer,e.rgba_ptr(),4*n).slice(),codes=new Uint32Array(e.memory.buffer,e.codes_ptr(),n),invalidRays=[];
    let decoded;
    for(let i=0;i<n;i++)if(codes[i]){
     decoded??=diagnostics();const row=Math.floor(i/size),col=i%size,ray=pixelRay(camera,row,col),result=assertDiagnostic(integrateRay(decoded,ray.source,ray.detector,wire),codes[i]);
     invalidRays.push({row,col,...ray,...result});
    }
    return {width:size,height:size,camera,rgba,arrays,invalidCount:invalidRays.length,invalidRays};
   });
  },
  probeRay(source,detector,wire){return probe(source,detector,0,wire,0);},
  probeMesh(source,direction,maxT){return probe(source,direction,maxT,null,1);},
  probeWire(source,direction,maxT,wire){return probe(source,direction,maxT,wire,2).intervals;},
  memoryBytes(){active();return e.memory.buffer.byteLength;},
  dispose(){if(e){e.dispose();e=null;descriptors=null;}}
 };
}
