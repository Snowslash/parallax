// Acquisition only. Deliberately no observer or pinned-image state.
const axes=['orbit','tilt','x','y','z'];
const key=p=>JSON.stringify(axes.map(k=>p[k]));
export class MeshController {
  constructor(render,onChange){
    this.render=render;this.onChange=onChange;this.sequence=0;this.busy=false;this.wanted=null;
    this.state={requested:null,frame:null,pending:false,error:null,diagnostics:null};
  }
  publish(patch){this.state={...this.state,...patch};this.onChange(this.state);}
  stage(pose,size=256){
    if(![128,256].includes(size))throw new RangeError('Supported sizes: 128 or 256');
    if(!pose||!axes.every(k=>typeof pose[k]==='number'&&Number.isFinite(pose[k])))throw new TypeError('Finite full pose required');
    if(!this.state.pending&&!this.state.error&&this.state.frame?.width===size&&key(pose)===key(this.state.frame.pose))return;
    this.wanted=Object.freeze({id:++this.sequence,pose:Object.freeze({...pose}),size});
    this.publish({requested:this.wanted,pending:true,error:null,diagnostics:null});
    // Coalesce synchronous multi-axis input before starting any worker work.
    if(!this.scheduled){this.scheduled=true;queueMicrotask(()=>{this.scheduled=false;this.pump();});}
  }
  async pump(){
    if(this.busy||!this.state.pending)return;
    const job=this.wanted;this.busy=true;
    try{
      const result=await this.render(job);
      if(!result.pose||key(result.pose)!==key(job.pose))throw new Error('Rendered pose mismatch');
      if(result.width!==job.size||result.height!==job.size||result.pixels?.length!==job.size*job.size*4)throw new Error('Rendered size mismatch');
      if(result.invalidCount!==0){
        const error=new Error(`Projection rejected: ${result.invalidCount??'unknown'} unresolved rays`);
        error.diagnostics={invalidCount:result.invalidCount,invalidRays:result.invalidRays};throw error;
      }
      if(this.wanted.id===job.id)this.publish({frame:{...result,pose:job.pose,id:job.id},pending:false,error:null,diagnostics:null});
    }catch(error){
      if(this.wanted.id===job.id)this.publish({pending:false,error:error.message,diagnostics:error.diagnostics??null});
    }finally{
      this.busy=false;if(this.state.pending&&this.wanted.id!==job.id)this.pump();
    }
  }
  retry(){if(this.wanted){this.publish({pending:true,error:null,diagnostics:null});this.pump();}}
}
