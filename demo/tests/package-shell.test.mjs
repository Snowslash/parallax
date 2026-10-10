import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const demo=new URL('../',import.meta.url),root=new URL('../../',import.meta.url);
const read=(path,base=demo)=>{const u=new URL(path,base);assert.ok(existsSync(u),`missing packaged file: ${path}`);return readFileSync(u,'utf8');};
const pages=['index.html','lab.html','guided.html','beam3d.html','mesh-spike.html'];

test('lab chooser prioritises guided study and links the separate labs',()=>{
  const html=read('lab.html');
  assert.doesNotMatch(html,/http-equiv="refresh"/i);
  for(const p of pages.slice(2))assert.ok(html.includes(`href="${p}"`));
  assert.match(html,/Start the guided lesson/);assert.match(html,/A model femur\./);
});
test('all three modes return home and have no links to omitted prototypes',()=>{
  for(const p of pages){const html=read(p);assert.doesNotMatch(html,/href="(?:explore\.html|baseline\/)/);assert.match(html,/Content-Security-Policy/);assert.match(html,/href="licences.html"/);if(p!=='index.html')assert.match(html,/href="index.html"/);}
  assert.equal(existsSync(new URL('baseline/',demo)),false);assert.equal(existsSync(new URL('explore.html',demo)),false);
});
test('HTML links, resources and local module imports resolve inside the package',()=>{
  function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(new URL(e.name+'/',dir)):[new URL(e.name,dir)]);}
  for(const u of files(demo)){
    if(!/\.(?:html|mjs|js)$/.test(u.pathname))continue;
    const text=readFileSync(u,'utf8');
    const refs=u.pathname.endsWith('.html')?[...text.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]):[...text.matchAll(/(?:from\s*|import\s*\(|new URL\s*\()\s*['"](\.[^'"`$]+)['"]/g)].map(m=>m[1]);
    for(const ref of refs){
      if(/^(?:data:|https?:|#)/.test(ref))continue;
      // Root-relative references resolve against the served demo, not the host filesystem.
      let target=new URL(ref.startsWith('/')?'./'+ref.slice(1):ref,ref.startsWith('/')?demo:u);
      target.search='';target.hash='';
      assert.ok(target.href.startsWith(root.href),ref);
      if(u.pathname.endsWith('.html')&&target.pathname.endsWith('/'))target=new URL('index.html',target);
      else if(!existsSync(target)&&u.pathname.endsWith('.html'))target=new URL(target.href+'.html');
      assert.ok(existsSync(target),`${u.pathname}: ${ref}`);
    }
  }
});
test('guided gates, equal image pair and unique IDs are retained',()=>{
  const html=read('guided.html');
  for(const id of ['scene','rig','section','reference-image','projection','prediction','acquire','commit','feedback','next','replay','restart','chapter-nav','status'])assert.ok(html.includes(`id="${id}"`),id);
  assert.match(html,/ENTIRE|entire/);assert.match(html,/href="licences.html"/);
  for(const p of pages){const ids=[...read(p).matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,p);}
});
test('3D tools and mesh worker safety remain distinct',()=>{
  const html=read('beam3d.html');for(const id of ['rig-scene','tool-angle','tool-position','tool-look','orbit','tilt','x','y','z','reset-beam','reset-observer','pin-current','projection','reference-image','render-status'])assert.ok(html.includes(`id="${id}"`),id);
  assert.match(html,/wire.*visible/i);assert.match(html,/worker-src 'self'/);
  const mesh=read('mesh-spike.html');assert.match(mesh,/href="licences.html"/);assert.match(read('licences.html'),/PARTIAL/);assert.match(read('licences.html'),/not anatomically validated/);assert.match(mesh,/worker-src 'self'/);assert.doesNotMatch(mesh,/id="commit"|id="pin-current"/);
});
test('locally pinned Three.js retains exact licence and module provenance',()=>{
  const base=new URL('vendor/three-r186/',demo),manifest=JSON.parse(read('provenance.json',base));assert.equal(manifest.version,'0.186.0');assert.equal(manifest.licence,'MIT');
  for(const [name,entry]of Object.entries(manifest.assets))assert.equal(createHash('sha256').update(readFileSync(new URL(name,base))).digest('hex'),entry.sha256);
  assert.match(read('LICENSE',root),/MIT License/);assert.match(read('licences.html'),/vendor\/three-r186\/LICENSE/);
});
test('frozen model identity and published cached frames are bound to provenance',()=>{
  const manifest=JSON.parse(read('model-provenance.json',new URL('docs/',root)));
  assert.equal(manifest.licence,'MIT');assert.equal(manifest.anatomically_validated,false);
  for(const [path,hash]of Object.entries(manifest.assets))assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),hash);
  const lesson=JSON.parse(read('assets/v2/lesson.json'));
  for(const c of lesson.cases)for(const f of c.frames)assert.equal(createHash('sha256').update(readFileSync(new URL(f.image,demo))).digest('hex'),f.sha256);
  const hashFiles=[[new URL('../../spikes/001-projection-geometry/',import.meta.url),lesson.provenance.source_sha256]];
  for(const [dir,entries]of hashFiles)for(const [p,h]of Object.entries(entries))assert.equal(createHash('sha256').update(readFileSync(new URL(p,dir))).digest('hex'),h);
  for(const [path,hash]of Object.entries({'raw.npz':lesson.provenance.raw_sha256,'geometry.json':lesson.provenance.geometry_sha256}))assert.equal(createHash('sha256').update(readFileSync(new URL('spikes/002-guided-lessons/outputs/'+path,root))).digest('hex'),hash);
});
