import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const demo=process.env.FTV_DEMO?pathToFileURL(process.env.FTV_DEMO.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,demo),'utf8');
const lesson=JSON.parse(read('assets/v2/lesson.json'));
const {initialState,viewExplanation,judgementFeedback}=await import(new URL('lesson-model.mjs',demo));
const editorial=/authored|synthetic fixture|finite-thickness geometric bound|universally best|justified observation|reassuring appearance/i;

test('all three working pages omit model-detail disclosures',()=>{
  for(const name of ['guided.html','beam3d.html','mesh-spike.html']){
    assert.doesNotMatch(read(name),/<details\b|<summary\b|model details/i,name);
    assert.match(read(name),/href="licences.html"/,name);
  }
});
test('internal mesh diagnostics stay available without adding visible UI',()=>{
  const html=read('mesh-spike.html');
  for(const id of ['load-metrics','diagnostics'])assert.match(html,new RegExp(`<pre id="${id}" hidden>`));
  assert.match(html,/<p id="mesh-status"[^>]*role="status"/);
  assert.match(html,/<button id="retry"/);
});

test('working pages link to one about page instead of repeating disclaimers',()=>{
  for(const name of ['index.html','lab.html','guided.html','beam3d.html','mesh-spike.html']){
    const html=read(name);
    assert.doesNotMatch(html,/Not for clinical use|Synthetic education only|not anatomically validated|clinical.safety|competence claim|clinical accuracy claim|PARTIAL/i,name);
    assert.match(html,/href="licences.html">About &amp; licences/,name);
  }
  const about=read('licences.html');
  assert.equal((about.match(/Not for clinical use/gi)||[]).length,1);
  assert.match(about,/not anatomically validated/i);
  assert.match(about,/PARTIAL/);assert.match(about,/250 ms/);
});
test('all challenge prompts and takeaways are short and concrete',()=>{
  for(const c of lesson.cases){
    for(const key of ['title','brief','revealTitle','takeaway'])assert.doesNotMatch(c[key],editorial,c.id+': '+key);
    assert.ok(c.brief.length<=140,c.id+': brief');
    assert.ok(c.takeaway.length<=240,c.id+': takeaway');
  }
});
test('every angle explanation is concise, angle-specific and still gated by reveal',()=>{
  for(const [index,c] of lesson.cases.entries())for(const frame of c.frames){
    const state={...initialState(lesson,index),viewed:frame.angle};
    assert.equal(viewExplanation(state,lesson),'');
    const text=viewExplanation({...state,revealed:true},lesson);
    assert.ok(text.includes(frame.angle+'°'));assert.ok(text.length<=180,text);
    assert.doesNotMatch(text,editorial);
    if(frame.evidence==='beyond')assert.match(text,/outside|beyond/);
    else assert.match(text,/overlap|outline/);
  }
});
test('feedback stays concise for matching, differing and uncertain judgements',()=>{
  for(const index of [0,1,2])for(const judgement of ['contained','breached','insufficient']){
    const state={...initialState(lesson,index),judgement};
    assert.equal(judgementFeedback(state,lesson),'');
    const text=judgementFeedback({...state,revealed:true},lesson);
    assert.ok(text.length>0&&text.length<=150,text);assert.doesNotMatch(text,editorial);
  }
});
test('loading, completion and render status do not repeat engineering commentary',()=>{
  for(const name of ['guided.html','beam3d.html','mesh-spike.html','guided.mjs','beam3d.mjs','mesh-spike/app.mjs']){
    assert.doesNotMatch(read(name),/Loading the authored|Sequence explored\. No score|This is not end-to-end latency or FPS|not end-to-end latency or FPS|The displayed image still belongs to its old label/);
  }
});
