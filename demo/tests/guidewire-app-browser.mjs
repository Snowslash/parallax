// Real application smoke. No phone evidence is implied by a narrow viewport.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startPreview} from '../../scripts/wasm/preview.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE);
const output=resolve(process.argv[2]);await mkdir(output,{recursive:false});
const report={checks:[],physicalDevice:false,errors:[],engines:[]};
const check=(name,value)=>{report.checks.push({name,ok:!!value});assert.ok(value,name);};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM,headless:true,args:['--renderer-process-limit=2','--num-raster-threads=1','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let context,preview;
const save=()=>writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n');
try{
 report.browser=browser.version();
 for(const variant of ['wasm','strict','default']){
  preview=await startPreview({allowWasm:variant==='wasm'});
  context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(30000);
  const page=await Promise.race([context.newPage(),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('page creation timeout')),20000);t.unref();})]);
  page.on('pageerror',error=>report.errors.push(String(error)));
  await page.addInitScript(()=>{const Native=window.Worker;window.workerTrace=[];window.Worker=class extends Native{constructor(url,options){super(url,options);this.serial=window.workerTrace.length;window.lastProjectionWorker=this;window.workerTrace.push({url:String(url),terminated:false});}terminate(){window.workerTrace[this.serial].terminated=true;return super.terminate();}};});
  await page.goto(preview.url+'guidewire-fracture/'+(variant==='default'?'':'?engine=wasm'));
  const ready=()=>page.waitForFunction(()=>window.guidewireLesson?.getState().ready&&!window.guidewireLesson.getState().pending,null,{timeout:90000});await ready();
  const state=()=>page.evaluate(()=>window.guidewireLesson.getState());
  const input=(id,value)=>page.evaluate(({id,value})=>{const e=document.getElementById(id);e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));},{id,value});
  const canvasHash=selector=>page.evaluate(async selector=>{const c=document.querySelector(selector);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,c.width,c.height).data))].map(v=>v.toString(16).padStart(2,'0')).join('');},selector);
  check(variant+' AP gates',!(await state()).canCommit&&!(await state()).wireVisible);
  await input('orbit',90);await ready();let s=await state();check(variant+' no frame error',!s.error);
  report.engines.push({variant,engine:s.engine});
  check(variant+' effective engine',s.engine?.active===(variant==='wasm'?'wasm':'js'));
  check(variant+' requested engine',s.engine.requested===(variant==='default'?'js':'wasm'));
  if(variant==='strict')check('strict CSP fallback reason',/compile|Wasm|WebAssembly|Content Security Policy/i.test(s.engine.fallbackReason));
  await page.locator('#capture').click();const saved=await canvasHash('#additional-image canvas');
  const displayed=s.displayedFrameId;await input('observer-yaw',25);check(variant+' observer independent',(await state()).displayedFrameId===displayed);
  if(variant==='wasm'){
   // Synthetic crash signal; real worker replacement, integrity checks and rendering.
   const workerCount=await page.evaluate(()=>window.workerTrace.length);
   await page.evaluate(()=>window.lastProjectionWorker.onerror({preventDefault(){},message:'injected crash'}));
   s=await state();check('crash keeps last valid identity',s.displayedFrameId===displayed&&!!s.error&&!s.canCapture);
   check('crash keeps saved pixels',await canvasHash('#additional-image canvas')===saved);
   await page.locator('#retry-frame').click();await ready();
   check('Retry replaces actual worker',await page.evaluate(count=>window.workerTrace.length===count+1&&window.workerTrace[count-1].terminated,workerCount));
   check('Retry resumes Wasm',(await state()).engine.active==='wasm'&&!(await state()).error);
   await input('orbit',30);await page.locator('#restart').click();await ready();
   check('reset during pending clears saved frame',!(await state()).capturedFrameId);
   check('reset terminated old worker',await page.evaluate(()=>window.workerTrace[0].terminated));
   await input('orbit',90);await ready();await page.locator('#capture').click();
   check('replacement worker renders after reset',(await state()).engine.active==='wasm');
  }else check(variant+' saved image stable',await canvasHash('#additional-image canvas')===saved);
  await page.selectOption('#answer','uncertain');await page.locator('#commit').click();await page.waitForFunction(()=>window.guidewireLesson.getState().revealed);
  check(variant+' entire wire revealed after commit',(await state()).wireVisible);
  await page.screenshot({path:output+'/'+variant+'-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/'+variant+'-narrow.png',fullPage:true});
  check(variant+' narrow no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.selectOption('#case-select','case-b');await ready();await input('orbit',30);await ready();
  s=await state();check(variant+' case B identity',s.caseId==='case-b'&&s.displayedPose.orbit===30&&!s.wireVisible&&!s.capturedFrameId);
  await save();await context.close();context=null;await preview.close();preview=null;
 }
 check('no application exceptions',report.errors.length===0);report.ok=true;
}catch(error){report.ok=false;report.failure=String(error);process.exitCode=1;}
finally{await save();if(context)await context.close();if(preview)await preview.close();await browser.close();console.log(JSON.stringify(report));}
