import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {startPreview} from '../../scripts/wasm/preview.mjs';
for(const allowWasm of [false,true])test(`loopback preview serves verified app with explicit narrow policy ${allowWasm}`,async t=>{
 const server=await startPreview({allowWasm});t.after(()=>server.close());
 const url=new URL(server.url);assert.equal(url.hostname,'127.0.0.1');
 const response=await fetch(new URL('guidewire-fracture/wasm/renderer.wasm',url));
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/wasm');
 const expected=await readFile(new URL('../guidewire-fracture/wasm/renderer.wasm',import.meta.url)),bytes=new Uint8Array(await response.arrayBuffer());
 assert.equal(bytes.length,expected.length);assert.ok(bytes.every((v,i)=>v===expected[i]));
 const csp=response.headers.get('content-security-policy');assert.ok(csp.includes("script-src 'self'"));assert.equal(csp.includes("'wasm-unsafe-eval'"),allowWasm);assert.equal(csp.includes("'unsafe-eval'"),false);
 assert.equal((await fetch(new URL('guidewire-fracture/',url))).status,200);
 assert.equal((await fetch(new URL('femur-lesson.html',url))).status,200);
 assert.equal((await fetch(new URL('missing',url))).status,404);
 assert.equal((await fetch(new URL('%2e%2e%2fREADME.md',url))).status,403);
 assert.equal((await fetch(new URL('index.html',url),{method:'POST'})).status,405);
});
