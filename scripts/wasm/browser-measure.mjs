// Serial browser evidence: actual worker timing, separate raw parity, separate tree-memory runs.
import {createServer} from 'node:http';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {staticPath} from './static-path.mjs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE);
const [output,mode='compare',order='forward']=process.argv.slice(2);assert.ok(['compare','memory-js','memory-wasm'].includes(mode));
const root=fileURLToPath(new URL('../../',import.meta.url)),html='<!doctype html><title>Isolated renderer measurement</title><canvas width="320" height="320"></canvas>';
const server=createServer(async(req,res)=>{try{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'");res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 if(!path.startsWith('/demo/')&&!path.startsWith('/scripts/wasm/'))throw Error('allowlist');
 const p=staticPath(root,path);if(!p||await realpath(p)!==p)throw Error('unsafe path');
 res.setHeader('Content-Type',({'.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm'})[extname(p)]||'application/octet-stream');res.end(await readFile(p));
}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const report={mode,order,physicalDevice:false,errors:[],memory:{checkpoints:[],sampledTreePeakRSSBytes:0},limitations:'Local Chromium under fixed resource caps; tree RSS sums shared pages and sampled peak is a lower bound; double-rAF is a presentation proxy, not photon latency or physical-phone evidence.'};
const cg=readFileSync('/proc/self/cgroup','utf8').trim().split('::')[1];
function tree(){let rss=0,count=0;for(const pid of readFileSync('/sys/fs/cgroup'+cg+'/cgroup.procs','utf8').trim().split(/\s+/)){try{if(!/^chrome/.test(readFileSync('/proc/'+pid+'/comm','utf8')))continue;const status=readFileSync('/proc/'+pid+'/status','utf8');rss+=Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1]||0)*1024;count++;}catch{}}return {rssBytes:rss,processes:count};}
let browser,timer;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM,headless:true,args:['--renderer-process-limit=2','--num-raster-threads=1','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});report.browser=browser.version();
 timer=setInterval(()=>{report.memory.sampledTreePeakRSSBytes=Math.max(report.memory.sampledTreePeakRSSBytes,tree().rssBytes);},100);
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.exposeFunction('memoryCheckpoint',name=>{const sample={name,...tree()};report.memory.checkpoints.push(sample);return sample;});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 report.result=await page.evaluate(async({mode,order})=>{
  const {compareFrames}=await import('/scripts/wasm/compare-frames.mjs');
  const lesson=await (await fetch('/demo/guidewire-fracture/lesson.json')).json();
  let id=0;const workers=new Set(),samples=[],parity=[],canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
  const hash=async p=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',p))].map(v=>v.toString(16).padStart(2,'0')).join('');
  function worker(engine,raw=false){const w=new Worker(raw?'/demo/tests/guidewire-parity-worker.mjs?engine='+engine:'/demo/guidewire-fracture/worker.mjs?engine='+engine,{type:'module'});workers.add(w);return w;}
  function stop(w){w.terminate();workers.delete(w);}
  async function render(w,engine,c,pose,phase,raw=false){
   const request={type:'render',id:++id,caseId:c.id,pose,size:320},start=performance.now();
   const reply=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('worker timeout')),90000);w.onmessage=({data})=>{if(data.id===request.id){clearTimeout(timeout);data.type==='error'?reject(Error(data.error)):resolve(data);}};w.onerror=e=>{clearTimeout(timeout);reject(Error(e.message));};w.postMessage(request);});
   if(raw)return reply;
   const arrival=performance.now(),f=reply.frame;if(f.engine.active!==engine)throw Error('Unexpected fallback '+JSON.stringify(f.engine));
   ctx.putImageData(new ImageData(f.pixels,320,320),0,0);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const presented=performance.now();
   samples.push({engine,phase,caseId:c.id,pose,roundtripMs:arrival-start,presentationProxyMs:presented-start,calculationMs:f.elapsedMs,info:f.engine,pixelSHA256:await hash(f.pixels)});return reply;
  }
  const inputs=lesson.cases.flatMap(c=>[{orbit:0,angulation:0},{orbit:30,angulation:0},{orbit:90,angulation:0},{orbit:45,angulation:20}].map(pose=>({c,pose})));
  try{
   await window.memoryCheckpoint('beforeWorkers');
   if(mode.startsWith('memory-')){
    const engine=mode.slice(7),w=worker(engine);await render(w,engine,inputs[0].c,inputs[0].pose,'first');await window.memoryCheckpoint('initialized');
    for(const {c,pose} of inputs)await render(w,engine,c,pose,'warm');await window.memoryCheckpoint('afterFrames');stop(w);await new Promise(r=>setTimeout(r,300));await window.memoryCheckpoint('terminated');
   }else{
    const engines=order==='reverse'?['wasm','js']:['js','wasm'];
    for(let round=0;round<2;round++)for(const engine of round%2?[...engines].reverse():engines){const w=worker(engine);await render(w,engine,inputs[0].c,inputs[0].pose,'first');stop(w);}
    const pair={js:worker('js'),wasm:worker('wasm')};for(const engine of engines)await render(pair[engine],engine,inputs[0].c,inputs[0].pose,'warmup');
    for(let round=0;round<2;round++)for(const [i,{c,pose}] of (round%2?[...inputs].reverse():inputs).entries())for(const engine of (i+round)%2?[...engines].reverse():engines)await render(pair[engine],engine,c,pose,'warm');
    stop(pair.js);stop(pair.wasm);await window.memoryCheckpoint('timingWorkersTerminated');
    const raw={js:worker('js',true),wasm:worker('wasm',true)};
    for(const {c,pose} of inputs){const a=await render(raw.js,'js',c,pose,'parity',true),b=await render(raw.wasm,'wasm',c,pose,'parity',true),comparison=compareFrames(a,b);if(!comparison.ok)throw Error(JSON.stringify(comparison));if(JSON.stringify(a.invalidRays)!==JSON.stringify(b.invalidRays))throw Error('diagnostics differ');parity.push({caseId:c.id,pose,...comparison});}
   }
  }finally{for(const w of workers)stop(w);}
  return {samples,parity};
 },{mode,order});
 assert.equal(report.errors.length,0);report.ok=true;
}catch(error){report.ok=false;report.failure=String(error);process.exitCode=1;}
finally{clearInterval(timer);if(browser)await browser.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await writeFile(resolve(output),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({ok:report.ok,failure:report.failure,mode,memory:report.memory,samples:report.result?.samples.length,parity:report.result?.parity.length}));}
