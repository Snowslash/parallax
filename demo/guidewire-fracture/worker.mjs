import {LESSON_SHA256} from './identity.mjs';
import {createWorkerHandler} from './worker-core.mjs';
const handle=createWorkerHandler({lessonSHA256:LESSON_SHA256,baseURL:new URL('./',import.meta.url)});
self.onmessage=event=>{void handle(event.data,(message,transfer)=>self.postMessage(message,transfer));};
