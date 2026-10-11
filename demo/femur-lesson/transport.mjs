// Isolated worker; one outstanding request. Disposal also invalidates late callbacks.
export function createLessonRenderer({WorkerClass=globalThis.Worker,timeoutMs=30000,onReady=()=>{}}={}){
  let worker=null,active=null;
  function stop(message){if(worker){worker.onmessage=worker.onerror=worker.onmessageerror=null;worker.terminate();worker=null;}if(active){clearTimeout(active.timer);const reject=active.reject;active=null;reject(new Error(message));}}
  function render(job){if(active)return Promise.reject(new Error('Worker already busy'));return new Promise((resolve,reject)=>{try{worker??=new WorkerClass(new URL('./worker.mjs',import.meta.url),{type:'module'});}catch(error){reject(error);return;}const current=worker;active={resolve,reject,timer:setTimeout(()=>stop('Lesson worker timed out. Retry rendering.'),timeoutMs)};
    worker.onerror=event=>{if(worker!==current)return;event.preventDefault?.();stop(event.message||'Lesson worker crashed');};worker.onmessageerror=()=>{if(worker===current)stop('Lesson worker response unreadable');};
    worker.onmessage=({data})=>{if(worker!==current||!active)return;if(data?.type==='ready'){try{onReady(data);}catch(error){stop('Scene initialisation failed: '+error.message);}return;}if(!data||data.id!==job.id){stop('Worker response ID mismatch');return;}clearTimeout(active.timer);active=null;if(data.error){const error=new Error(data.error);error.diagnostics=data.diagnostics;reject(error);}else if(!data.frame)reject(new Error('Missing lesson frame'));else resolve(data.frame);};
    try{worker.postMessage(job);}catch(error){stop(error.message);}
  });}
  return {render,dispose:()=>stop('Worker disposed')};
}
