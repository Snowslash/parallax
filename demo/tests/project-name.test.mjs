import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const demo=process.env.FTV_DEMO?pathToFileURL(process.env.FTV_DEMO.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
const root=new URL('../',demo);
const read=path=>readFileSync(new URL(path,root),'utf8');
const retiredName=/find[ _-]+the[ _-]+view/i;
const pages=['index.html','lab.html','guided.html','beam3d.html','mesh-spike.html','licences.html'];

// Frozen input headers and the source-bound historical generator are evidence,
// not active branding. Existing provenance tests bind their unchanged hashes.
const historicalInputs=new Set([
  'demo/mesh-spike/assets/outer.obj',
  'demo/mesh-spike/assets/core.obj',
  'spikes/001-projection-geometry/run.py',
]);

test('every page title and project navigation uses Parallax',()=>{
  for(const page of pages){
    const html=read('demo/'+page);
    assert.match(html,/<title>[^<]*Parallax[^<]*<\/title>/,page);
    assert.doesNotMatch(html,retiredName,page);
    if(page==='index.html')assert.match(html,/<h1\b[^>]*>Parallax<\/h1>/);
    else assert.match(html,/<a href="index.html" class="project-name">Parallax<\/a>/);
  }
});

test('public README, safety and original-work notices use Parallax',()=>{
  assert.match(read('README.md'),/^# Parallax\n/);
  assert.match(read('docs/SAFETY.md'),/Parallax is a synthetic teaching prototype/);
  assert.match(read('LICENSE'),/Copyright \(c\) 2026 Parallax contributors/);
  assert.equal(read('LICENSE'),read('demo/LICENSE.txt'));
});

test('the package has no stale project branding outside frozen historical inputs',()=>{
  const manifest=JSON.parse(read('MANIFEST.json'));
  for(const path of Object.keys(manifest.files)){
    assert.doesNotMatch(path,retiredName);
    if(historicalInputs.has(path)||/\.(?:png|ttf|npz)$/.test(path))continue;
    assert.doesNotMatch(read(path),retiredName,path);
  }
});
