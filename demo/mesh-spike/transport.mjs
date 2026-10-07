// One transport job at a time. A timeout/crash destroys only this experiment's worker.
export function createWorkerRenderer({WorkerClass=globalThis.Worker,timeoutMs=30000,onReady=()=>{}}={}){
  let worker=null,active=null;
  function stop(message){
    worker?.terminate();worker=null;
    if(active){clearTimeout(active.timer);const reject=active.reject;active=null;reject(new Error(message));}
  }
  function render(job){
    if(active)return Promise.reject(new Error('Worker already busy'));
    return new Promise((resolve,reject)=>{
      try{worker??=new WorkerClass(new URL('./worker.mjs',import.meta.url),{type:'module'});}catch(error){reject(error);return;}
      active={resolve,reject,timer:setTimeout(()=>stop('Mesh worker timed out. Retry rendering.'),timeoutMs)};
      worker.onerror=event=>{event.preventDefault?.();stop(event.message||'Mesh worker crashed');};
      worker.onmessageerror=()=>stop('Mesh worker response unreadable');
      worker.onmessage=({data})=>{
        if(data.type==='ready'){try{onReady(data);}catch(error){stop('Scene initialisation failed: '+error.message);}return;}
        if(!active)return;
        if(data.id!==job.id){stop('Worker response ID mismatch');return;}
        clearTimeout(active.timer);active=null;
        if(data.error){const error=new Error(data.error);error.diagnostics=data.diagnostics;reject(error);}else resolve(data.frame);
      };
      try{worker.postMessage(job);}catch(error){stop(error.message);}
    });
  }
  return {render,dispose:()=>stop('Worker disposed')};
}
