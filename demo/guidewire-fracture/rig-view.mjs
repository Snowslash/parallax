import * as THREE from './vendor/three-r186/three.module.js';
import {cameraForPose} from './camera.mjs';
import {fragmentSpec} from './reveal-geometry.mjs';
const V=a=>new THREE.Vector3(...a);
// Only the outer surface enters this viewer. The focused reveal owns metal.
export function createRig({host,positions,onError}){
 const scene=new THREE.Scene();scene.background=new THREE.Color(getComputedStyle(host).getPropertyValue('--estate-night-panel').trim());
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.localClippingEnabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
 const camera=new THREE.PerspectiveCamera(42,1,1,9000);camera.up.set(0,1,0);
 const geometries=[],materials=[];
 const mesh=(g,m,parent=scene)=>{geometries.push(g);materials.push(m);const obj=new THREE.Mesh(g,m);parent.add(obj);return obj;};
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions.outer,3));g.computeVertexNormals();
 for(const f of fragmentSpec()){
  const m=new THREE.MeshPhongMaterial({color:0xd9e1cf,side:THREE.DoubleSide,clippingPlanes:[new THREE.Plane(V(f.normal),f.constant)]});mesh(g,m).position.fromArray(f.translation);
 }
 scene.add(new THREE.AmbientLight(0xffffff,1.8));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(300,500,800);scene.add(light);
 const rig=new THREE.Group();rig.matrixAutoUpdate=false;scene.add(rig);
 const source=mesh(new THREE.SphereGeometry(24,20,16),new THREE.MeshPhongMaterial({color:0xe5b879}),rig);
 const detector=mesh(new THREE.PlaneGeometry(210,210),new THREE.MeshBasicMaterial({color:0x6cc2d0,side:THREE.DoubleSide,transparent:true,opacity:.45}),rig);
 const points=[];for(let i=0;i<=80;i++){const a=Math.PI*i/80;points.push(new THREE.Vector3(600*Math.sin(a),0,600*Math.cos(a)));}
 const arm=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),80,12,10,false),new THREE.MeshPhongMaterial({color:0x97a9aa}),rig);arm.position.z=200;
 const beamGeometry=new THREE.BufferGeometry().setFromPoints([V([0,0,800]),V([0,0,-400])]);geometries.push(beamGeometry);const beamMaterial=new THREE.LineBasicMaterial({color:0xe5b879,transparent:true,opacity:.45});materials.push(beamMaterial);rig.add(new THREE.Line(beamGeometry,beamMaterial));
 let observer={yaw:-35,elevation:22,zoom:1},disposed=false;
 function draw(){if(disposed)return;const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;const yaw=observer.yaw*Math.PI/180,e=observer.elevation*Math.PI/180,d=1900/(observer.zoom*Math.min(1,camera.aspect));camera.position.set(d*Math.sin(yaw)*Math.cos(e),d*Math.sin(e),d*Math.cos(yaw)*Math.cos(e));camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.render(scene,camera);}
 function setPose(pose){const c=cameraForPose(pose);const backwards=V(c.forward).negate();rig.matrix.makeBasis(V(c.right),V(c.up),backwards);rig.matrix.setPosition(0,0,0);const inverse=rig.matrix.clone().invert();source.position.copy(V(c.source).applyMatrix4(inverse));detector.position.copy(V(c.source).addScaledVector(V(c.forward),c.sdd).applyMatrix4(inverse));host.dataset.pose=JSON.stringify(c.pose);draw();}
 renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Outer bone and C-arm: gold source, blue detector. No wire shown.');host.replaceChildren(renderer.domElement);
 const lost=e=>{e.preventDefault();onError?.(new Error('3D context lost. Restart the case to restore the C-arm.'));};renderer.domElement.addEventListener('webglcontextlost',lost);
 const resize=new ResizeObserver(draw);resize.observe(host);setPose({orbit:0,angulation:0});
 return {setPose,setObserver(value){observer={...value};draw();},dispose(){disposed=true;resize.disconnect();renderer.domElement.removeEventListener('webglcontextlost',lost);for(const g of new Set(geometries))g.dispose();for(const m of new Set(materials))m.dispose();renderer.dispose();renderer.domElement.remove();}};
}
