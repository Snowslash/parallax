import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';

const demo=process.env.FTV_DEMO?pathToFileURL(process.env.FTV_DEMO.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,demo),'utf8');
const pages=['index.html','lab.html','guided.html','beam3d.html','mesh-spike.html','licences.html'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

// Small source/adapter tests. Rendered geometry, interaction, contrast and motion
// are separate real-browser checks, not claims made by these assertions.
test('every page uses the pinned estate chrome and named layout, not a copied palette',()=>{
  for(const name of pages){
    const html=read(name);
    assert.match(html,/data-estate-ui="2\.0\.0-alpha\.7"/,name);
    assert.match(html,/class="estate-site-header"/,name);
    assert.match(html,/data-estate-layout="(?:landing|wide-app)"/,name);
    assert.ok(html.indexOf('class="estate-site-header"')<html.indexOf('class="estate-shell'),name);
    assert.match(html,/href="https:\/\/sangeev.me"/,name);
    assert.match(html,/class="estate-theme-toggle"/,name);
    assert.ok(html.indexOf('src="estate-theme.js')<html.indexOf('href="vendor/estate-ui/src/contract.css'),name);
    assert.doesNotMatch(html,/class="[^"]*(?:eyebrow|micro|kicker|edition|private-mark)/,name);
    assert.match(html,/href="licences.html">About &amp; licences/,name);
  }
});
test('vendored estate CSS, fonts, licences and source match the exact artifact manifest',()=>{
  const manifest=JSON.parse(read('vendor/estate-ui/provenance.json'));
  assert.equal(manifest.version,'2.0.0-alpha.7');
  assert.equal(manifest.archive_sha256,'d062371402bb538c008888255597349d5cf7425d5bb51e399f7b3cf97b69ef76');
  for(const [name,expected] of Object.entries(manifest.files))assert.equal(hash(readFileSync(new URL('vendor/estate-ui/'+name,demo))),expected,name);
  for(const name of ['src/contract.css','assets/fonts/Literata-Variable.ttf','assets/fonts/AtkinsonHyperlegibleNext-Variable.ttf','LICENSE','LICENSES/OFL-Literata.txt','LICENSES/OFL-Atkinson-Hyperlegible-Next.txt'])assert.ok(manifest.files[name],name);
  const css=read('publication.css');
  assert.doesNotMatch(css,/(?:^|[;{]\s*)--(?:estate-[\w-]+|background|foreground|primary|card|border)\s*:/m);
  assert.doesNotMatch(css,/\.estate-(?:site-header|wordmark|theme-toggle|shell--|page-title--)[^{]*\{/);
});
test('framework-free bootstrap is mechanically extracted from the pinned theme implementation',()=>{
  const source=read('vendor/estate-ui/src/index.js');
  const canonical=source.slice(source.indexOf('export const ESTATE_UI_VERSION'),source.indexOf('export function useEstateTheme')).replaceAll('export ','');
  assert.ok(read('estate-theme.js').includes(canonical));
  const html=read('licences.html');
  for(const name of ['LICENSES/OFL-Literata.txt','LICENSES/OFL-Atkinson-Hyperlegible-Next.txt','LICENSE'])assert.ok(html.includes('vendor/estate-ui/'+name));
});
function environment({cookie='',storage=null,denied=false,hostname='localhost',protocol='http:'}={}){
  const writes=[];
  const document={cookie,documentElement:{dataset:{},style:{},classList:{toggle:(...args)=>writes.push(args)}},querySelector:()=>null,addEventListener:()=>{}};
  const localStorage={getItem:()=>{if(denied)throw Error('blocked');return storage;},setItem:(k,v)=>{if(denied)throw Error('blocked');writes.push([k,v]);}};
  const context=vm.createContext({document,window:{localStorage,location:{hostname,protocol}},console});
  vm.runInContext(read('estate-theme.js'),context);
  return {context,document,writes};
}
test('theme defaults dark, honours cookie precedence and survives malformed or denied storage',()=>{
  assert.equal(environment().document.documentElement.dataset.theme,'dark');
  assert.equal(environment({storage:'light'}).document.documentElement.dataset.theme,'light');
  assert.equal(environment({cookie:'sangeevSiteTheme=dark',storage:'light'}).document.documentElement.dataset.theme,'dark');
  assert.equal(environment({cookie:'sangeevSiteTheme=%ZZ',storage:'light'}).document.documentElement.dataset.theme,'light');
  assert.equal(environment({denied:true}).document.documentElement.dataset.theme,'dark');
});
test('theme persists only a preference with the estate domain on the actual estate',()=>{
  const e=environment({hostname:'lab.sangeev.me',protocol:'https:'});
  vm.runInContext("applyEstateTheme('light')",e.context);
  assert.equal(e.document.documentElement.dataset.theme,'light');
  assert.match(e.document.cookie,/Domain=\.sangeev.me/);assert.match(e.document.cookie,/SameSite=Lax/);assert.match(e.document.cookie,/Secure/);
  const local=environment();vm.runInContext("applyEstateTheme('light')",local.context);
  assert.doesNotMatch(local.document.cookie,/Domain=/);
});
test('motion is bounded UI feedback, reduced-motion aware and never applied to projections',()=>{
  const css=read('publication.css');
  assert.match(css,/@keyframes/);assert.match(css,/prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css,/infinite|transition:\s*all|(?:linear|radial)-gradient|backdrop-filter/);
  const imageRules=css.match(/[^{}]*(?:canvas|\.projection|\.image-surface)[^{]*\{[^}]*\}/g)||[];
  for(const rule of imageRules)assert.doesNotMatch(rule,/(?:animation|transition|filter|opacity)\s*:/);
});
test('model limitations are retained on the linked about page without detail panels',()=>{
  const about=read('licences.html');
  assert.match(about,/authored inner core/);assert.match(about,/not a recovered tissue segmentation/);assert.match(about,/not anatomically validated/i);
  assert.match(about,/Not for clinical use/i);
  for(const name of ['guided.html','beam3d.html','mesh-spike.html'])assert.doesNotMatch(read(name),/<details[\s>]/);
});
test('a failed lesson load disables lab controls without disabling the estate theme button',async()=>{
  const theme={disabled:false},lab={disabled:false},status={textContent:'',classList:{add:()=>{}}};
  const document={getElementById:()=>status,querySelectorAll:selector=>selector==='button,input'?[theme,lab]:[lab]};
  const source=read('guided.mjs').replace(/^import .*;\n/gm,'');
  vm.runInNewContext(source,{document,fetch:async()=>{throw Error('test asset unavailable');},console:{error:()=>{}}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(lab.disabled,true);assert.equal(theme.disabled,false);
  assert.match(status.textContent,/Lesson unavailable/);
});
test('the provided first view has a real source before lesson JavaScript runs',()=>{
  const html=read('guided.html');
  for(const id of ['reference-image','projection']){
    const tag=html.match(new RegExp(`<img[^>]+id="${id}"[^>]*>`))[0];
    assert.match(tag,/src="assets\/v2\/c1-000.png"/);
  }
});
