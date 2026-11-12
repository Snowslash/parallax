// Disposable loopback preview only. Production _headers is never rewritten.
import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,relative,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const defaultRoot=fileURLToPath(new URL('../../demo/',import.meta.url));
export async function startPreview({root=defaultRoot,allowWasm=false,port=0}={}){
 root=await realpath(root);
 const policies=(await readFile(resolve(root,'_headers'),'utf8')).split('\n').filter(s=>s.trim().startsWith('Content-Security-Policy:')).map(s=>s.split('Content-Security-Policy:')[1].trim());
 if(policies.length!==2)throw Error('Expected the pinned two-route CSP');
 const within=p=>{const r=relative(root,p);return r!==''&&!r.startsWith('..'+sep)&&r!=='..'&&!r.startsWith(sep);};
 const server=createServer(async(req,res)=>{
  try{
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(path.includes('\0')||path.includes('\\')||path.split('/').some(s=>s==='..'||s.startsWith('.'))){res.writeHead(403);res.end();return;}
   let p=resolve(root,'.'+path);if(p!==root&&!within(p)){res.writeHead(403);res.end();return;}
   if((await stat(p)).isDirectory())p=resolve(p,'index.html');
   p=await realpath(p);if(!within(p)){res.writeHead(403);res.end();return;}
   let csp=policies[path.startsWith('/guidewire-fracture/')?1:0];
   if(allowWasm&&path.startsWith('/guidewire-fracture/'))csp=csp.replace("script-src 'self'","script-src 'self' 'wasm-unsafe-eval'");
   res.setHeader('Content-Security-Policy',csp);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
   res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(p)]||'application/octet-stream');
   const data=await readFile(p);res.writeHead(200);res.end(req.method==='HEAD'?undefined:data);
  }catch(error){res.writeHead(error instanceof URIError?400:404);res.end('Not found');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {url:`http://127.0.0.1:${server.address().port}/`,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const allowed=new Set(['--wasm-csp']);for(const arg of process.argv.slice(2))if(!allowed.has(arg))throw Error('Use only --wasm-csp to enable the isolated local policy');
 const preview=await startPreview({allowWasm:process.argv.includes('--wasm-csp')});
 console.log(`Local preview: ${preview.url}guidewire-fracture/?engine=wasm`);
 console.log('JavaScript remains default without ?engine=wasm; Ctrl-C stops this disposable server.');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void preview.close());
}
