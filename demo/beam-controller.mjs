// Latest-pose rendering, independent of scene camera and transport.
const poseKey=pose=>JSON.stringify([pose.orbit,pose.tilt,pose.x,pose.y,pose.z]);
const snapshot=frame=>({...frame,pose:Object.freeze({...frame.pose}),pixels:frame.pixels.slice()});

export class BeamController {
  constructor(render,onChange){
    this.render=render;this.onChange=onChange;this.sequence=0;this.busy=false;this.wanted=null;
    this.state={staged:null,frame:null,pinned:null,pending:false,error:null};
  }
  publish(patch){this.state={...this.state,...patch};this.onChange(this.state);}
  stage(pose,size=256){
    const frozen=Object.freeze({...pose});
    if(!this.state.pending&&this.state.frame?.width===size&&poseKey(frozen)===poseKey(this.state.frame.pose))return;
    this.wanted={id:++this.sequence,pose:frozen,size};
    this.publish({staged:frozen,pending:true,error:null});this.pump();
  }
  async pump(){
    if(this.busy||!this.state.pending)return;
    const job=this.wanted;this.busy=true;
    try{
      const result=await this.render(job);
      if(poseKey(result.pose)!==poseKey(job.pose))throw new Error('Rendered pose does not match request');
      if(result.width!==job.size||result.height!==job.size||result.pixels?.length!==job.size*job.size*4)throw new Error('Rendered image size does not match request');
      if(this.wanted.id===job.id){
        const frame={...result,pose:job.pose,id:job.id};
        this.publish({frame,pinned:this.state.pinned??snapshot(frame),pending:false,error:null});
      }
    }catch(error){
      if(this.wanted.id===job.id)this.publish({pending:false,error:error.message});
    }finally{
      this.busy=false;
      if(this.state.pending&&this.wanted.id!==job.id)this.pump();
    }
  }
  pin(){if(this.state.frame)this.publish({pinned:snapshot(this.state.frame)});}
  retry(){if(this.wanted){this.publish({pending:true,error:null});this.pump();}}
}
