import * as THREE from '../vendor/three-r186/three.module.js';
import {MeshView} from '../mesh-spike/view.mjs?bp3d-cortex-v001';
import {wireDescriptor} from './presentation.mjs';
export class LessonView extends MeshView{
  setWire(wire,revealed){
    if(this.wire){
      this.scene.remove(this.wire);
      this.wire.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
      this.wire=null;
    }
    const descriptor=wireDescriptor(wire,revealed);
    this.canvas.dataset.wireVisible=String(Boolean(descriptor));
    if(!descriptor){this.schedule();return;}
    this.wire=new THREE.Group();
    const material=new THREE.MeshBasicMaterial({color:0xe6b96b,depthTest:false});
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(descriptor.radius,descriptor.radius,descriptor.length,16),material);
    shaft.position.set(...descriptor.centre);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...descriptor.direction));
    shaft.renderOrder=10;this.wire.add(shaft);
    const tip=new THREE.Mesh(new THREE.SphereGeometry(descriptor.radius*1.8,12,8),new THREE.MeshBasicMaterial({color:0xff7a66,depthTest:false}));
    tip.position.set(...descriptor.tip);tip.renderOrder=11;this.wire.add(tip);
    this.scene.add(this.wire);this.schedule();
  }
  dispose(){this.setWire(null,false);super.dispose();}
}
