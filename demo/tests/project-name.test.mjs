import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const demo=process.env.FTV_DEMO?pathToFileURL(process.env.FTV_DEMO.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
const root=new URL('../',demo);
const read=path=>readFileSync(new URL(path,root),'utf8');
const retiredName=/find[ _-]+the[ _-]+view/i;
const pages=['index.html','lab.html','explore.html','lessons.html','guided.html','beam3d.html','mesh-spike.html','femur-lesson.html','licences.html'];

// Frozen input headers and the source-bound historical generator are evidence,
// not active branding. Existing provenance tests bind their unchanged hashes.
const historicalInputs=new Set([
  'spikes/005-mesh-projection/assets/outer.obj',
  'spikes/005-mesh-projection/assets/core.obj',
  'spikes/001-projection-geometry/run.py',
]);

test('every page title and project navigation uses Parallax',()=>{
  for(const page of pages){
    const html=read('demo/'+page);
    assert.match(html,/<title>[^<]*Parallax[^<]*<\/title>/,page);
    assert.doesNotMatch(html,retiredName,page);
    if(page==='index.html')assert.match(html,/<h1\b[^>]*>Parallax<\/h1>/);
    else assert.match(html,/<a href="index.html" class="project-name"(?: aria-current="page")?>Parallax<\/a>/);
  }
});

test('public README, safety and original-work notices use Parallax',()=>{
  assert.match(read('README.md'),/^# Parallax\n/);
  assert.match(read('docs/SAFETY.md'),/Parallax is a synthetic teaching prototype/);
  assert.match(read('LICENSE'),/Copyright \(c\) 2026 Parallax contributors/);
  assert.ok(read('demo/LICENSE.txt').endsWith(read('LICENSE')));
  assert.match(read('demo/LICENSE.txt'),/does not cover the BodyParts3D/);
});

test('the package has no stale project branding outside frozen historical inputs',()=>{
  const manifest=JSON.parse(read('MANIFEST.json'));
  for(const path of Object.keys(manifest.files)){
    assert.doesNotMatch(path,retiredName);
    if(historicalInputs.has(path)||/\.(?:png|ttf|npz)$/.test(path))continue;
    assert.doesNotMatch(read(path),retiredName,path);
  }
});
