import {fragmentSpec,wireParts,requireCommit} from './reveal-geometry.mjs';
export async function createReveal({state,host,positions,wire,signal,onError}){
 requireCommit(state);
 const THREE=await import('./vendor/three-r186/three.module.js');
 signal?.throwIfAborted();requireCommit(state);
 const scene=new THREE.Scene();scene.background=new THREE.Color(getComputedStyle(host).getPropertyValue('--estate-night-panel').trim());
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.localClippingEnabled=true;
 const camera=new THREE.PerspectiveCamera(36,1,1,2000);
 const geometries=[],materials=[];
 const material=options=>{const m=new THREE.MeshPhongMaterial(options);materials.push(m);return m;};
 const add=(g,m,position)=>{geometries.push(g);const mesh=new THREE.Mesh(g,m);if(position)mesh.position.fromArray(position);scene.add(mesh);return mesh;};
 for(const key of ['outer','canal']){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions[key],3));g.computeVertexNormals();
  for(const f of fragmentSpec()){
   const plane=new THREE.Plane(new THREE.Vector3(...f.normal),f.constant);
   const m=material({color:key==='outer'?0xcde2d8:0xf08b75,transparent:true,opacity:key==='outer'?.19:.30,side:THREE.DoubleSide,depthWrite:false,clippingPlanes:[plane],shininess:15});
   add(g,m,f.translation);
  }
 }
 const metal=material({color:0xfff4c8,shininess:65});const parts=wireParts(wire);
 // Opaque overlapping primitives depict the union boundary: no translucent internal seams.
 for(const s of parts.segments){const a=new THREE.Vector3(...s.start),b=new THREE.Vector3(...s.end),delta=b.clone().sub(a);const g=new THREE.CylinderGeometry(s.radius,s.radius,delta.length(),24,1,false);const mesh=add(g,metal);mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());}
 for(const s of [...parts.joints,parts.olive])add(new THREE.SphereGeometry(s.radius,24,16),metal,s.center);
 scene.add(new THREE.AmbientLight(0xffffff,1.8));const light=new THREE.DirectionalLight(0xffffff,2.2);light.position.set(80,100,160);scene.add(light);
 let observer={yaw:0,elevation:0,zoom:1},disposed=false;
 function draw(){if(disposed)return;const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;const yaw=observer.yaw*Math.PI/180,e=observer.elevation*Math.PI/180;const distance=240/observer.zoom;camera.position.set(distance*Math.sin(yaw)*Math.cos(e),distance*Math.sin(e),distance*Math.cos(yaw)*Math.cos(e));camera.up.set(0,1,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.render(scene,camera);}
 renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Focused 3D fracture detail with transparent cortex, coral canal and pale local guidewire segment');host.replaceChildren(renderer.domElement);
 const lost=event=>{event.preventDefault();if(!disposed)onError?.(new Error('WebGL context lost. Retry the 3D reveal.'));};
 renderer.domElement.addEventListener('webglcontextlost',lost);
 const resize=new ResizeObserver(draw);resize.observe(host);draw();
 return {setObserver(value){observer={...value};draw();},dispose(){disposed=true;resize.disconnect();renderer.domElement.removeEventListener('webglcontextlost',lost);for(const g of new Set(geometries))g.dispose();for(const m of materials)m.dispose();renderer.dispose();renderer.domElement.remove();}};
}
