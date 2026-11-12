// Lesson-local lifecycle only. State owns frame acceptance; the app owns the DOM.
export function createTransport({state,createWorker,setTimeout=globalThis.setTimeout,clearTimeout=globalThis.clearTimeout,onChange=()=>{},settleMs=180,timeoutMs=120000}){
 let worker=null,debounce=null,timeout=null,disposed=false;
 function stop(){clearTimeout(timeout);timeout=null;const old=worker;worker=null;old?.terminate();}
 function cancel(){clearTimeout(debounce);debounce=null;stop();}
 function fail(error){stop();state.workerFailed(error);onChange();}
 function pump(){
  if(disposed)return;const request=state.nextRequest();if(!request)return;
  try{
   if(!worker){worker=createWorker();const current=worker;
    worker.onmessage=event=>{
     if(disposed||worker!==current||event.data?.id!==state.snapshot().activeRequestId)return;
     clearTimeout(timeout);timeout=null;state.receive(event.data);onChange();pump();
    };
    worker.onerror=event=>{if(!disposed&&worker===current){event.preventDefault();fail(event.message||'Worker stopped unexpectedly');}};
    worker.onmessageerror=()=>{if(!disposed&&worker===current)fail('Could not read projection reply');};
   }
   const current=worker;
   timeout=setTimeout(()=>{if(!disposed&&worker===current)fail('Projection timed out');},timeoutMs);
   worker.postMessage(request);
  }catch(error){fail(error.message);}
 }
 return {
  pump,cancel,
  stage(pose){if(disposed||!state.stage(pose))return;clearTimeout(debounce);onChange();debounce=setTimeout(()=>{debounce=null;if(disposed)return;state.settle();pump();},settleMs);},
  retry(){if(disposed)return;cancel();state.retry();state.settle();onChange();pump();},
  dispose(){if(disposed)return;disposed=true;cancel();}
 };
}
