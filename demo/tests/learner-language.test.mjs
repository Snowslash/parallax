import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const demo=process.env.FTV_DEMO?pathToFileURL(process.env.FTV_DEMO.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,demo),'utf8');
const working=['index.html','lab.html','explore.html','lessons.html','guided.html','beam3d.html','mesh-spike.html','femur-lesson.html'];
const m=await import(new URL('femur-lesson/model.mjs',demo));
const jargon=/synthetic|authored|centrality band|model-defined|model-corrected|model’s criteria|paired tip-to-landmark proxy|endpoint.*correction/i;
test('About explains image generation without confusing projections with the observer view',()=>{
 const html=read('licences.html');
 const section=html.match(/<h2 id="xray-images"[^>]*>[\s\S]*?(?=<h2\b)/)?.[0];
 assert.ok(section,'A dedicated X-ray explanation precedes the femur lesson notes');
 for(const meaning of [/source.*detector/,/pixel/,/brighter/,/cortex.*core/,/same brightness scale/,/in your browser/,/calculated in advance/,/Looking around.*does not change/,/soft tissue.*scatter.*noise/])assert.match(section,meaning);
 assert.match(html,/not clinical TAD/);
 assert.match(html,/BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International/);
});
test('femur lesson uses the requested tip apex distance title',()=>{
 const html=read('femur-lesson.html');
 assert.match(html,/<h1[^>]*>Femur: tip apex distance<\/h1>/);
 assert.match(html,/<title>Femur: tip apex distance — Parallax<\/title>/);
 assert.match(html,/href="licences.html#femur-lesson"/);
});
test('femur lesson criteria link to the original Baumgaertner study without leaving the lesson',()=>{
 const criteria=read('femur-lesson.html').match(/<details class="lesson-criteria">[\s\S]*?<\/details>/)?.[0];
 assert.ok(criteria,'The initial lesson includes the criteria disclosure');
 assert.match(criteria,/<summary>What should I look for\?<\/summary>/);
 assert.match(criteria,/<a href="https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/7608228\/" target="_blank" rel="noopener noreferrer">Baumgaertner et al\. \(1995\)<\/a>/);
 assert.match(criteria,/new tab/);
 assert.match(criteria,/href="licences.html#femur-lesson"/);
});
test('current working pages explain the task without repeated modelling disclaimers',()=>{
 for(const name of working){assert.doesNotMatch(read(name),jargon,name);assert.match(read(name),/href="licences.html"/);}
});
test('decorative pre-heading text is removed without dropping status and answer hooks',()=>{
 const home=read('index.html'),guided=read('guided.html'),femur=read('femur-lesson.html'),explorer=read('mesh-spike.html');
 assert.doesNotMatch(home,/class="back-link"/);
 assert.ok(guided.indexOf('id="status"')>guided.indexOf('id="question"'));
 assert.ok(guided.indexOf('id="your-choice"')>guided.indexOf('<h2 id="feedback-title"'));
 assert.doesNotMatch(explorer,/<p class="readout">Requested pose<\/p>/);
 assert.equal((femur.match(/id="case-brief"/g)||[]).length,1);
 assert.match(femur,/<header class="page-intro">[\s\S]*?id="case-brief"[\s\S]*?<\/header>/);
});
test('femur criteria remain explicit and link to the clinical-TAD distinction once',()=>{
 const html=read('femur-lesson.html'),about=read('licences.html');
 assert.match(html,/25 mm/);assert.match(html,/8 mm/);assert.match(html,/screw tip/);
 assert.match(html,/href="licences.html#femur-lesson"[^>]*>[^<]*clinical TAD/);
 assert.equal((html.match(/clinical TAD/g)||[]).length,1);
 assert.match(about,/not clinical TAD/);assert.match(about,/depth/);assert.match(about,/not calibrated/);
 assert.match(about,/not anatomically validated/);
});
test('all preset outcomes use plain observations while preserving their different meanings',()=>{
 const frame=(c,view)=>({caseId:c.id,pose:m.REFERENCE_POSES[view],width:64,height:64,invalidCount:0,pixels:new Uint8ClampedArray(64*64*4)});
 for(const c of m.CASES){
  const result=m.assessCaptures(c.id,{ap:frame(c,'ap'),lateral:frame(c,'lateral')});
  assert.equal(result.valid,true);assert.doesNotMatch(result.feedback,jargon);assert.doesNotMatch(result.measurementLabel,jargon);
  assert.match(result.measurementLabel,/tip.*marker.*distance/i);
  if(c.id==='shallow')assert.match(result.feedback,/shallow.*25 mm/i);
  else if(c.id==='eccentric-lateral')assert.match(result.feedback,/lateral.*(centre|central).*small/i);
  else assert.match(result.feedback,/centred.*lateral/i);
 }
});
test('femur reveal and caliper instructions omit engineering commentary and automatic praise',()=>{
 const app=read('femur-lesson/app.mjs'),html=read('femur-lesson.html');
 assert.doesNotMatch(app,/kept your uncertainty explicit|model’s criteria|model-corrected|Each endpoint is corrected|known model depth/);
 assert.match(app,/result\.measurementLabel/);
 assert.doesNotMatch(html,/Both endpoints|known model depth/);
 assert.match(html,/wire tip followed by the gold dot/);assert.match(html,/arrow keys and Enter/);
});
test('explorer keeps requested acquisition labels without a separate eyebrow or render benchmark',()=>{
 const app=read('mesh-spike/app.mjs');
 assert.match(app,/'Requested: '\+poseLabel/);
 assert.doesNotMatch(app,/Image up to date · render time/);
 assert.match(app,/dataset\.renderMs/);
});
