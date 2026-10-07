import * as THREE from './vendor/three-r186/three.module.js';
import {cameraForPose,DEFAULT_POSE} from './beam-geometry.mjs';
import {angleDelta} from './beam-interaction.mjs';

const V=a=>new THREE.Vector3(...a),rad=n=>n*Math.PI/180;
const AXES={x:V([1,0,0]),y:V([0,1,0]),z:V([0,0,1])};
const COLORS={orbit:0xe6b96b,tilt:0x7ad3db,x:0xf59692,y:0xa8d397,z:0x91bfff};
const AXIS_HANDLE_LENGTH=360;
function line(points,color,opacity=1){return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(V)),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));}
function textSprite(text,color='#cadbd5'){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
  const c=canvas.getContext('2d');c.font='25px sans-serif';c.textAlign='center';c.fillStyle=color;c.fillText(text,128,41);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthTest:false}));sprite.scale.set(150,37.5,1);return sprite;
}

export class RigView {
  constructor(canvas,handles,onPose,onObserver,onMessage){
    this.canvas=canvas;this.handles=handles;this.onPose=onPose;this.onObserver=onObserver;this.onMessage=onMessage;
    this.pose={...DEFAULT_POSE};this.mode='angle';this.observer={yaw:35,elevation:25,zoom:1};this.drag=null;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x121719);
    this.camera=new THREE.PerspectiveCamera(48,1,1,7000);this.closeCamera=new THREE.PerspectiveCamera(48,1,.1,7000);
    this.scene.add(new THREE.HemisphereLight(0xeef7f3,0x364049,2));
    this.rig=new THREE.Group();this.scene.add(this.rig);this.rig.matrixAutoUpdate=false;
    this.buildRig();this.buildPhantom();
    this.orbitArc=line([],COLORS.orbit,.6);this.tiltArc=line([],COLORS.tilt,.75);this.scene.add(this.orbitArc,this.tiltArc);
    this.arrows={};
    for(const [axis,direction] of Object.entries(AXES)){
      const arrow=new THREE.ArrowHelper(direction,new THREE.Vector3(),AXIS_HANDLE_LENGTH,COLORS[axis],30,17);this.scene.add(arrow);this.arrows[axis]=arrow;
    }
    this.raycaster=new THREE.Raycaster();
    for(const [axis,handle] of Object.entries(handles)){
      handle.addEventListener('pointerdown',event=>this.beginHandle(event,axis));
      handle.addEventListener('pointermove',event=>this.moveHandle(event));
      handle.addEventListener('pointerup',event=>this.endDrag(event));
      handle.addEventListener('pointercancel',event=>this.endDrag(event));
      handle.addEventListener('lostpointercapture',()=>{this.drag=null;});
    }
    canvas.addEventListener('pointerdown',event=>{
      if(this.mode!=='look'||event.button!==0)return;
      event.preventDefault();canvas.focus({preventScroll:true});this.capture(canvas,event.pointerId);
      this.drag={kind:'look',id:event.pointerId,x:event.clientX,y:event.clientY,observer:{...this.observer}};
    });
    canvas.addEventListener('pointermove',event=>{
      if(this.drag?.kind!=='look'||event.pointerId!==this.drag.id)return;
      this.onObserver({yaw:this.drag.observer.yaw-(event.clientX-this.drag.x)*.4,elevation:this.drag.observer.elevation+(event.clientY-this.drag.y)*.3});
    });
    canvas.addEventListener('pointerup',event=>this.endDrag(event));canvas.addEventListener('pointercancel',event=>this.endDrag(event));
    canvas.addEventListener('lostpointercapture',()=>{this.drag=null;});
    canvas.addEventListener('wheel',event=>{
      if(this.mode!=='look')return;
      event.preventDefault();this.onObserver({zoom:this.observer.zoom*Math.exp(-event.deltaY*.001)});
    },{passive:false});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.onMessage('3D context lost. Analytic images still work; reload to restore the rig.');});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);
    this.resize();this.setPose(this.pose);
  }
  buildRig(){
    const source=new THREE.Mesh(new THREE.SphereGeometry(17,20,12),new THREE.MeshBasicMaterial({color:COLORS.orbit}));source.position.y=-800;this.rig.add(source);
    const detector=new THREE.Mesh(new THREE.PlaneGeometry(128,128),new THREE.MeshBasicMaterial({color:COLORS.tilt,side:THREE.DoubleSide,transparent:true,opacity:.23}));detector.rotation.x=Math.PI/2;detector.position.y=400;this.rig.add(detector);
    const corners=[[-64,400,-64],[64,400,-64],[64,400,64],[-64,400,64]];
    this.rig.add(line([...corners,corners[0]],COLORS.tilt));
    for(const p of corners)this.rig.add(line([[0,-800,0],p],COLORS.orbit,.18));
    this.rig.add(line([[0,-800,0],[0,400,0]],COLORS.orbit,.55));
    const points=Array.from({length:61},(_,i)=>{const a=-Math.PI/2+i*Math.PI/60;return V([-600*Math.cos(a),-200+600*Math.sin(a),0]);});
    const arm=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),60,7,6,false),new THREE.MeshBasicMaterial({color:0x6a7c7c}));this.rig.add(arm);
    const pivot=new THREE.Mesh(new THREE.SphereGeometry(5,12,8),new THREE.MeshBasicMaterial({color:COLORS.tilt}));this.rig.add(pivot);
    const label=textSprite('DETECTOR','#7ad3db');label.position.set(0,475,0);this.rig.add(label);
    const sourceLabel=textSprite('SOURCE','#e6b96b');sourceLabel.position.set(0,-875,0);this.rig.add(sourceLabel);
  }
  buildPhantom(){
    for(const [radius,opacity] of [[12,.28],[10,.12]]){
      const shell=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,60,48,1,true),new THREE.MeshBasicMaterial({color:0xb7cdb6,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));shell.rotation.x=Math.PI/2;this.scene.add(shell);
    }
    for(const z of [-30,30]){
      const cap=new THREE.Mesh(new THREE.RingGeometry(10,12,48),new THREE.MeshBasicMaterial({color:0xb7cdb6,side:THREE.DoubleSide,transparent:true,opacity:.55}));cap.position.z=z;this.scene.add(cap);
      for(const radius of [10,12])this.scene.add(line(Array.from({length:65},(_,i)=>[radius*Math.cos(i*Math.PI/32),radius*Math.sin(i*Math.PI/32),z]),0xa5bba2,.65));
    }
    const start=V([0,0,-18]),end=V([0,15,18]),direction=end.clone().sub(start);
    const wire=new THREE.Mesh(new THREE.CylinderGeometry(.65,.65,direction.length(),16),new THREE.MeshBasicMaterial({color:0xffd38c}));wire.position.copy(start.clone().add(end).multiplyScalar(.5));wire.quaternion.setFromUnitVectors(V([0,1,0]),direction.normalize());this.scene.add(wire);
    for(const [axis,v] of Object.entries(AXES))this.scene.add(line([v.clone().multiplyScalar(-42).toArray(),v.clone().multiplyScalar(55).toArray()],COLORS[axis],.24));
    this.scene.add(line([[-85,0,0],[85,0,0]],0x566468,.3));
  }
  resize(){
    const r=this.canvas.parentElement.getBoundingClientRect();this.width=r.width;this.height=r.height;
    this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();this.schedule();
  }
  setPose(pose){
    this.pose={...pose};const c=cameraForPose(pose);this.acquisition=c;
    this.rig.matrix.makeBasis(V(c.right),V(c.forward),V(c.up));this.rig.matrix.setPosition(V(c.pivot));
    const orbitPoints=Array.from({length:97},(_,i)=>{const a=i*Math.PI/48,r=800*Math.cos(rad(pose.tilt));return [pose.x+r*Math.sin(a),pose.y-r*Math.cos(a),pose.z-800*Math.sin(rad(pose.tilt))];});
    const tiltPoints=Array.from({length:65},(_,i)=>{const a=rad(-70+i*140/64),theta=rad(pose.orbit);return [pose.x+550*Math.sin(theta)*Math.sin(a),pose.y-550*Math.cos(theta)*Math.sin(a),pose.z+550*Math.cos(a)];});
    for(const [mesh,points] of [[this.orbitArc,orbitPoints],[this.tiltArc,tiltPoints]]){mesh.geometry.dispose();mesh.geometry=new THREE.BufferGeometry().setFromPoints(points.map(V));}
    for(const arrow of Object.values(this.arrows))arrow.position.copy(V(c.pivot));
    this.schedule();
  }
  setMode(mode){this.mode=mode;this.drag=null;this.canvas.style.cursor=mode==='look'?'grab':'default';this.schedule();}
  setObserver(observer){this.observer={...observer};this.schedule();}
  schedule(){if(this.scheduled)return;this.scheduled=true;requestAnimationFrame(()=>{this.scheduled=false;this.draw();});}
  handlePoint(axis){
    const c=this.acquisition;
    if(axis==='orbit')return V(c.source);
    if(axis==='tilt')return V(c.pivot).addScaledVector(V(c.up),550);
    return V(c.pivot).addScaledVector(AXES[axis],AXIS_HANDLE_LENGTH);
  }
  draw(){
    if(!this.width||!this.acquisition)return;
    const {yaw,elevation,zoom}=this.observer,az=rad(yaw),el=rad(elevation);
    const direction=V([Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)]);
    // Preserve overview framing on portrait canvases; this is observer distance,
    // never acquisition zoom or a change to the detector's physical field.
    this.camera.position.copy(direction.clone().multiplyScalar(3000/(zoom*Math.min(1,this.camera.aspect))));this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
    this.closeCamera.position.copy(direction.clone().multiplyScalar(150));this.closeCamera.lookAt(0,0,0);this.closeCamera.updateMatrixWorld();
    this.orbitArc.visible=this.mode==='angle';this.tiltArc.visible=this.mode==='angle';for(const arrow of Object.values(this.arrows))arrow.visible=this.mode==='position';
    this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,this.width,this.height);this.renderer.render(this.scene,this.camera);
    // Separate explanatory inset: fixed phantom-centred observer zoom, not acquisition recentering.
    const size=Math.min(this.width<400?135:170,this.width*.4);
    this.orbitArc.visible=this.tiltArc.visible=false;for(const arrow of Object.values(this.arrows))arrow.visible=false;
    this.renderer.setScissorTest(true);this.renderer.setScissor(this.width-size-6,22,size,size);this.renderer.setViewport(this.width-size-6,22,size,size);this.renderer.clearDepth();this.renderer.render(this.scene,this.closeCamera);this.renderer.setScissorTest(false);
    for(const [axis,handle] of Object.entries(this.handles)){
      const visible=this.mode===(['orbit','tilt'].includes(axis)?'angle':'position');handle.hidden=!visible;if(!visible)continue;
      const projected=this.handlePoint(axis).project(this.camera),x=(projected.x+1)*this.width/2,y=(1-projected.y)*this.height/2;
      // Preserve exact attachment: out-of-view handles hide rather than pretending to sit elsewhere.
      handle.hidden=projected.z>1||x<35||x>this.width-35||y<24||y>this.height-24;
      handle.style.left=x+'px';handle.style.top=y+'px';
    }
  }
  ray(event){
    const r=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),this.camera);return this.raycaster.ray;
  }
  capture(element,id){try{element.setPointerCapture(id);}catch(error){if(error.name!=='NotFoundError')throw error;}}
  beginHandle(event,axis){
    if(event.button!==0||this.mode!==(axis==='orbit'||axis==='tilt'?'angle':'position'))return;
    event.preventDefault();event.currentTarget.focus({preventScroll:true});
    const c=this.acquisition,pivot=V(c.pivot);let normal,origin=pivot;
    if(axis==='orbit'){normal=AXES.z;origin=V([this.pose.x,this.pose.y,c.source[2]]);}
    else if(axis==='tilt')normal=V(c.right);
    else{normal=this.camera.position.clone().sub(pivot).normalize();normal.addScaledVector(AXES[axis],-normal.dot(AXES[axis]));}
    if(normal.lengthSq()<.005){this.onMessage('That axis is edge-on. Use its slider or Look around.');return;}
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal.clone().normalize(),origin);
    const point=this.ray(event).intersectPlane(plane,new THREE.Vector3());
    if(!point||Math.abs(this.ray(event).direction.dot(plane.normal))<.03){this.onMessage('That handle is edge-on. Use its slider or Look around.');return;}
    this.capture(event.currentTarget,event.pointerId);
    this.drag={kind:'rig',id:event.pointerId,axis,plane,origin,startPoint:point,startPose:{...this.pose},previousAngle:this.pointAngle(axis,point,origin),accumulated:0};
  }
  pointAngle(axis,point,origin){
    const v=point.clone().sub(origin);
    if(axis==='orbit')return Math.atan2(v.x,-v.y)*180/Math.PI;
    if(axis==='tilt'){const t=rad(this.pose.orbit);return Math.atan2(-v.dot(V([-Math.sin(t),Math.cos(t),0])),v.z)*180/Math.PI;}
    return 0;
  }
  moveHandle(event){
    const d=this.drag;if(d?.kind!=='rig'||event.pointerId!==d.id)return;
    event.preventDefault();const point=this.ray(event).intersectPlane(d.plane,new THREE.Vector3());if(!point)return;
    let value;
    if(d.axis==='orbit'||d.axis==='tilt'){
      const angle=this.pointAngle(d.axis,point,d.origin);d.accumulated+=angleDelta(d.previousAngle,angle);d.previousAngle=angle;value=d.startPose[d.axis]+d.accumulated;
    }else value=d.startPose[d.axis]+point.sub(d.startPoint).dot(AXES[d.axis]);
    this.onPose({[d.axis]:value});
  }
  endDrag(event){if(this.drag?.id!==event.pointerId)return;this.drag=null;if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
}
