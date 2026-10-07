import {renderProjection} from './beam-geometry.mjs';
self.onmessage=({data:job})=>{
  try{
    const start=performance.now(),frame=renderProjection(job.pose,{size:job.size});
    frame.renderMs=performance.now()-start;
    self.postMessage({id:job.id,frame},[frame.pixels.buffer]);
  }catch(error){self.postMessage({id:job.id,error:error.message});}
};
