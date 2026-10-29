import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const demo=process.env.FTV_DEMO?pathToFileURL(process.env.FTV_DEMO.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
const html=readFileSync(new URL('lab.html',demo),'utf8');
const explore=readFileSync(new URL('explore.html',demo),'utf8');
const femurRow=explore.match(/<article\b[^>]*data-experience="femur"[\s\S]*?<\/article>/)[0];

test('femur catalogue description explains the current experience without a performance report',()=>{
  assert.match(femurRow,/Move the beam around the femur/);
  assert.match(femurRow,/bone without a wire/);
  assert.doesNotMatch(femurRow,/PARTIAL|250 ms|frozen synthetic|anatomically validated/);
});
test('archived femur explorer does not imply a shared model with the current lesson',()=>{
  assert.match(femurRow,/href="mesh-spike.html"/);
  assert.doesNotMatch(femurRow,/href="femur-lesson.html"/);
  assert.match(femurRow,/different model/);
});
test('homepage group 3: remove the privacy paragraph and footer warning, retain provenance access',()=>{
  assert.doesNotMatch(html,/class="privacy-note"|Responses reset when/);
  const footer=html.match(/<footer[\s\S]*?<\/footer>/)[0];
  assert.match(footer,/href="licences.html"/);
  assert.doesNotMatch(footer,/Synthetic education only|Not for clinical use/);
});
test('legacy lab introduction stays concise and its lesson action remains available',()=>{
  const intro=html.match(/<header class="page-intro"[\s\S]*?<\/header>/)[0];
  assert.doesNotMatch(intro,/clinical-boundary|Synthetic education only|Not for clinical use/);
  assert.match(html,/href="lessons.html"/);
});
