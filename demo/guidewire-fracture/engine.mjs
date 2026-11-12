import {renderPose} from './render-core.mjs';
import {createRustRenderer as rustFactory} from './wasm/adapter.mjs';
// Worker-owned engine seam. The JS kernel remains unchanged and is the default.
export async function createEngine({engine='js',loadMeshes,loadWasm,renderJS=renderPose,createRustRenderer=rustFactory}){
 if(!['js','wasm'].includes(engine))throw Error('Unknown renderer');
 const start=performance.now();let meshes=null,rust=null,disposed=false,fallbackReason=null,fallback=null;
 const setup={meshPrepareMs:0,wasmLoadMs:0,instantiateMs:0,serializationMs:0};
 async function prepare(){const t=performance.now(),m=await loadMeshes();setup.meshPrepareMs+=performance.now()-t;return m;}
 if(engine==='wasm'){
  try{
   const t=performance.now(),wasmBytes=await loadWasm();setup.wasmLoadMs=performance.now()-t;
   meshes=await prepare();rust=await createRustRenderer({wasmBytes,meshes});Object.assign(setup,rust.setup);meshes=null;
  }catch(error){fallbackReason=String(error.message||error);}
 }
 if(!rust)meshes??=await prepare();setup.totalMs=performance.now()-start;
 function active(){if(disposed)throw Error('Renderer disposed');}
 async function useJS(error){
  fallbackReason=String(error.message||error);rust?.dispose();rust=null;
  fallback??=prepare().then(m=>{active();meshes=m;});await fallback;active();
 }
 return {
  async renderPose(...args){
   active();if(fallback)await fallback;active();
   if(rust){try{return rust.renderPose(...args);}catch(error){await useJS(error);}}
   active();return renderJS(meshes,...args);
  },
  info(){return {requested:engine,active:rust?'wasm':'js',fallbackReason,retainedJSGeometry:meshes!==null,wasmMemoryBytes:rust?.memoryBytes()??0,setup:{...setup}};},
  dispose(){if(disposed)return;disposed=true;rust?.dispose();rust=null;meshes=null;}
 };
}
