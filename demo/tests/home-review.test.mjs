import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const demo=process.env.FTV_DEMO?pathToFileURL(process.env.FTV_DEMO.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
const html=readFileSync(new URL('index.html',demo),'utf8');
const femurRow=html.match(/<article class="mode-row">[\s\S]*?<\/article>/g).find(row=>row.includes('href="mesh-spike.html"'));

test('homepage group 1: femur description is one short sentence without the performance report',()=>{
  assert.match(femurRow,/<div><p>A model femur\.<\/p><\/div>/);
  assert.doesNotMatch(femurRow,/PARTIAL|250 ms|frozen synthetic|anatomically validated/);
});
test('homepage group 2: the femur link is renamed without changing its destination',()=>{
  assert.match(femurRow,/<a href="mesh-spike.html">Femur <span class="action-arrow" aria-hidden="true">↗<\/span><\/a>/);
});
test('homepage group 3: remove the privacy paragraph and footer warning, retain provenance access',()=>{
  assert.doesNotMatch(html,/class="privacy-note"|Responses reset when/);
  const footer=html.match(/<footer[\s\S]*?<\/footer>/)[0];
  assert.match(footer,/href="licences.html"/);
  assert.doesNotMatch(footer,/Synthetic education only|Not for clinical use/);
});
test('homepage group 4: remove the hero clinical disclaimer, retain the lesson action',()=>{
  const intro=html.match(/<section class="home-intro"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(intro,/clinical-boundary|Synthetic education only|Not for clinical use/);
  assert.match(intro,/id="start"[^>]*href="guided.html"/);
});
