import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const demo=process.env.FTV_DEMO?pathToFileURL(process.env.FTV_DEMO.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
test('comment 7: remove only the guided intro disclaimer and retain the lesson prompt',()=>{
  const html=readFileSync(new URL('guided.html',demo),'utf8');
  const intro=html.match(/<header class="intro page-intro">[\s\S]*?<\/header>/)[0];
  assert.doesNotMatch(intro,/Synthetic education only|Not for clinical use/);
  assert.match(intro,/id="question"/);
  assert.match(intro,/id="prompt"/);
  assert.match(html,/<footer class="project-footer">[\s\S]*?href="licences.html"/);
});
