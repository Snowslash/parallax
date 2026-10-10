import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),asset=new URL('demo/mesh-spike/bp3d-cortex-v001/',root);
const read=path=>readFileSync(new URL(path,root),'utf8');

test('demo-only anatomy distribution retains current attribution and historical notice',()=>{
  const licence=new URL('LICENSE.md',asset),provenance=new URL('PROVENANCE.json',asset);
  assert.ok(existsSync(licence),'served anatomy licence missing');
  assert.ok(existsSync(provenance),'served anatomy provenance missing');
  assert.equal(readFileSync(licence,'utf8'),read('docs/BODYPARTS3D-LICENCE.md'));
  assert.equal(readFileSync(provenance,'utf8'),read('docs/model-provenance.json'));
  const text=readFileSync(licence,'utf8');
  assert.match(text,/BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International/);
  assert.match(text,/Attribution-Share Alike 2.1 Japan/);
  assert.match(text,/authored inward-offset core/);
});

test('current and historical model provenance bind different exact licensed assets',()=>{
  for(const [name,licence]of [['model-provenance.json','CC BY 4.0'],['legacy-model-provenance.json','MIT']]){
    const record=JSON.parse(read('docs/'+name));assert.equal(record.licence,licence);
    for(const [path,hash]of Object.entries(record.assets))assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),hash);
  }
});
