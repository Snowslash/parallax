import * as THREE from '../vendor/three-r186/three.module.js';
import {meshCamera} from './geometry.mjs';
const V=a=>new THREE.Vector3(...a),rad=d=>d*Math.PI/180;
function line(points,color,opacity=1){return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(V)),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));}
function label(text,color){
  const c=document.createElement('canvas');c.width=256;c.height=48;const g=c.getContext('2d');g.font='24px sans-serif';g.fillStyle=color;g.textAlign='center';g.fillText(text,128,32);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false}));sprite.scale.set(130,24,1);return sprite;
}
export class MeshView{
  constructor(canvas,vertices,faces,onError){
    this.canvas=canvas;this.observer={yaw:-35,elevation:22,zoom:1};
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x101b20);
    this.scene.add(new THREE.HemisphereLight(0xf2f5e5,0x35516b,2.7));const light=new THREE.DirectionalLight(0xffe8c8,2);light.position.set(-200,-400,500);this.scene.add(light);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(new THREE.BufferAttribute(faces,1));geometry.computeVertexNormals();
    this.bone=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xdfd6b8,roughness:.85}));this.scene.add(this.bone);
    this.rig=new THREE.Group();this.rig.matrixAutoUpdate=false;this.scene.add(this.rig);
    const source=new THREE.Mesh(new THREE.SphereGeometry(16,12,8),new THREE.MeshBasicMaterial({color:0xe5b879}));source.position.set(0,-800,0);this.rig.add(source);
    const detector=new THREE.Mesh(new THREE.PlaneGeometry(320,320),new THREE.MeshBasicMaterial({color:0x6cc2d0,side:THREE.DoubleSide,transparent:true,opacity:.18,depthWrite:false}));detector.rotation.x=Math.PI/2;detector.position.y=400;this.rig.add(detector);
    const corners=[[-160,400,-160],[160,400,-160],[160,400,160],[-160,400,160]];
    this.rig.add(line([...corners,corners[0]],0x6cc2d0));for(const p of corners)this.rig.add(line([[0,-800,0],p],0xd3aa72,.28));
    this.rig.add(line([[0,-800,0],[0,400,0]],0xedd6a1,.65));
    for(const [text,position,color] of [['SOURCE',[0,-855,0],'#edc588'],['DETECTOR',[0,465,0],'#8ecfdc']]){const s=label(text,color);s.position.copy(V(position));this.rig.add(s);}
    for(const [text,point,color] of [['+X lateral',[110,0,0],0xe59b93],['+Y posterior',[0,110,0],0xa7ca8a],['+Z superior',[0,0,110],0x94bcea]]){
      this.scene.add(line([[0,0,0],point],color,.65));const s=label(text,'#b9d0d0');s.position.copy(V(point));s.scale.set(70,13,1);this.scene.add(s);
    }
    this.camera=new THREE.PerspectiveCamera(45,1,1,7000);this.camera.up.set(0,0,1);
    this.closeCamera=new THREE.PerspectiveCamera(45,1,1,7000);this.closeCamera.up.set(0,0,1);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onError('3D context lost; projections remain independent. Reload to restore scene.');});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.resize();
  }
  resize(){const r=this.canvas.parentElement.getBoundingClientRect();this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();this.schedule();}
  setPose(pose){const c=meshCamera(pose);this.rig.matrix.makeBasis(V(c.right),V(c.forward),V(c.up));this.rig.matrix.setPosition(V(c.pivot));this.schedule();}
  setObserver(observer){this.observer={...observer};this.schedule();}
  schedule(){if(this.scheduled)return;this.scheduled=true;requestAnimationFrame(()=>{this.scheduled=false;this.draw();});}
  draw(){
    if(!this.width||!this.height)return;
    const {yaw,elevation,zoom}=this.observer,a=rad(yaw),e=rad(elevation),d=V([Math.sin(a)*Math.cos(e),-Math.cos(a)*Math.cos(e),Math.sin(e)]);
    const target=V([24,7,-68]);this.camera.position.copy(d.clone().multiplyScalar(2000/(zoom*Math.min(1,this.camera.aspect)))).add(target);this.camera.lookAt(target);
    this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,this.width,this.height);this.renderer.render(this.scene,this.camera);
    // Explicit observer-only inset. The numerical asset and acquisition are unchanged.
    const size=Math.min(175,this.width*.43);this.closeCamera.position.copy(d.multiplyScalar(320)).add(target);this.closeCamera.lookAt(target);
    this.renderer.setScissorTest(true);this.renderer.setScissor(this.width-size-4,20,size,size);this.renderer.setViewport(this.width-size-4,20,size,size);this.renderer.clearDepth();this.renderer.render(this.scene,this.closeCamera);this.renderer.setScissorTest(false);
  }
  dispose(){this.resizeObserver.disconnect();this.renderer.dispose();}
}
