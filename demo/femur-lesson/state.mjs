// Lesson evidence is separate from observer controls and pending acquisitions.
const axes=['orbit','tilt','x','y','z'];
const samePose=(a,b)=>a&&b&&axes.every(k=>a[k]===b[k]);
export class LessonController{
  constructor({render,onChange,caseIds,classifyFrame}){
    this.render=render;this.onChange=onChange;this.caseIds=new Set(caseIds);this.classifyFrame=classifyFrame;
    this.sequence=0;this.busy=false;this.disposed=false;
    this.state={caseId:null,requested:null,frame:null,pending:false,error:null,captures:{},choice:null,reason:'',revealed:false};
  }
  publish(patch){this.state={...this.state,...patch};this.onChange(this.state);}
  selectCase(caseId,pose){
    if(!this.caseIds.has(caseId))throw new RangeError('Unknown lesson case');
    this.validatePose(pose);
    this.state={...this.state,caseId,frame:null,captures:{},choice:null,reason:'',revealed:false,error:null};
    this.stage(pose);
  }
  validatePose(pose){if(!pose||!axes.every(k=>typeof pose[k]==='number'&&Number.isFinite(pose[k])))throw new TypeError('Finite full pose required');}
  stage(pose,size=256){
    this.validatePose(pose);
    if(![128,256].includes(size))throw new RangeError('Supported sizes: 128 or 256');
    if(!this.state.caseId||this.disposed)return;
    this.wanted={id:++this.sequence,caseId:this.state.caseId,pose:{...pose},size};
    this.publish({requested:this.wanted,pending:true,error:null});
    if(!this.scheduled){this.scheduled=true;queueMicrotask(()=>{this.scheduled=false;this.pump();});}
  }
  async pump(){
    if(this.busy||!this.state.pending||this.disposed)return;
    const job=this.wanted;this.busy=true;
    try{
      const frame=await this.render(job);
      if(frame.caseId!==job.caseId||!samePose(frame.pose,job.pose))throw new Error('Rendered case or pose mismatch');
      if(frame.width!==job.size||frame.height!==job.size||frame.pixels?.length!==job.size*job.size*4)throw new Error('Rendered size mismatch');
      if(frame.invalidCount!==0)throw new Error('Projection rejected: unresolved rays');
      if(this.wanted.id===job.id&&!this.disposed)this.publish({frame:{...frame,id:job.id},pending:false,error:null});
    }catch(error){if(this.wanted.id===job.id&&!this.disposed)this.publish({pending:false,error:error.message});}
    finally{this.busy=false;if(this.state.pending&&this.wanted.id!==job.id)this.pump();}
  }
  capture(){
    const s=this.state;
    if(s.pending||s.error||!s.frame||s.revealed||s.frame.caseId!==s.caseId)return null;
    const kind=this.classifyFrame(s.frame);
    if(!['ap','lateral'].includes(kind))return null;
    const saved={...s.frame,pose:{...s.frame.pose},pixels:s.frame.pixels.slice()};
    this.publish({captures:{...s.captures,[kind]:saved}});return kind;
  }
  choose(choice){
    if(![null,'meets','does-not-meet','insufficient'].includes(choice))throw new RangeError('Unknown judgement');
    if(!this.state.revealed)this.publish({choice});
  }
  reason(reason){if(!this.state.revealed)this.publish({reason:String(reason).slice(0,2000)});}
  canCommit(){const s=this.state;return Boolean(!s.revealed&&s.captures.ap&&s.captures.lateral&&s.choice&&s.reason.trim());}
  commit(){if(!this.canCommit())throw new Error('Acquire AP and lateral, choose an answer and give a reason');this.publish({revealed:true});}
  retry(){if(this.wanted)this.stage(this.wanted.pose,this.wanted.size);}
  dispose(){this.disposed=true;}
}
