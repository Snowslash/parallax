import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const load = p => readFile(new URL('../guidewire-fracture/'+p,import.meta.url));
const hash = b => createHash('sha256').update(b).digest('hex');
test('lesson identity and every model/frame identity are pinned',async()=>{
 const bytes=await load('lesson.json');
 assert.equal(hash(bytes),'5cba880c1daabf8aa6a48d12a382a57d96b1dd8c7f0045bae0f07f01de518a6d');
 const lesson=JSON.parse(bytes);
 for(const asset of [...Object.values(lesson.models),...lesson.cases.flatMap(c=>Object.values(c.frames))])assert.equal(hash(await load(asset.url)),asset.sha256);
});
test('public navigation, source notice and retained strict script policy',async()=>{
 const index=String(await load('index.html')),about=String(await load('about.html'));
 assert.match(index,/href="\.\.\/lessons.html"/);
 assert.match(about,/href="index.html"/);
 assert.doesNotMatch(about,/private teaching prototype/);
 for(const path of ['model/LICENSE.md','model/PROVENANCE.json']){assert.ok(about.includes(path));assert.ok((await load(path)).length);}
 for(const html of [index,about]){assert.ok(html.includes("script-src 'self'"));assert.ok(html.includes("img-src 'self' blob:"));assert.ok(!html.includes('unsafe-inline'));assert.match(html,/<link rel="icon" href="favicon.ico">/);}
 assert.match(String(await load('model/LICENSE.md')),/CC BY 4.0/);
 for(const path of ['vendor/three-r186/LICENSE','vendor/estate-ui/LICENSE','vendor/estate-ui/LICENSES/OFL-Literata.txt','vendor/estate-ui/LICENSES/OFL-Atkinson-Hyperlegible-Next.txt'])assert.ok((await load(path)).length);
});
