// Scoped rendered UI checks. Not an accessibility certification or device test.
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function audit(doc=document){
  const w=doc.defaultView,$=s=>doc.querySelector(s),checks=[];
  const check=(name,pass,detail)=>checks.push({name,pass:Boolean(pass),...(detail===undefined?{}:{detail})});
  await doc.fonts.ready;await pause(400);
  const end=Date.now()+30000;
  while(doc.body.dataset.pending==='true'&&Date.now()<end)await pause(20);
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const styles=e=>w.getComputedStyle(e);
  const visible=e=>e.getClientRects().length>0&&styles(e).visibility!=='hidden';
  check('no horizontal overflow',doc.documentElement.scrollWidth<=w.innerWidth);
  const header=$('.estate-site-header'),inner=$('.estate-site-header__inner'),shell=$('.estate-shell');
  const hr=rect(header),ir=rect(inner),sr=rect(shell),mobile=w.innerWidth<=760;
  // CSS percentages exclude a classic scrollbar; innerWidth does not.
  const available=doc.documentElement.clientWidth;
  const expectedRail=Math.min(mobile?680:1180,available-(mobile?28:40));
  const expectedShell=Math.min(mobile?680:shell.dataset.estateLayout==='wide-app'?1480:1180,available-(mobile?28:40));
  check('header is outside the app shell and full bleed',header.parentElement===doc.body&&hr.x===0&&Math.abs(hr.width-available)<1,{header:hr,rail:ir});
  check('canonical rail and named shell widths',Math.abs(ir.width-expectedRail)<1&&Math.abs(sr.width-expectedShell)<1,{rail:ir.width,shell:sr.width});
  check('local estate fonts loaded',styles(doc.body).fontFamily.includes('Atkinson')&&styles($('h1')).fontFamily.includes('Literata')&&doc.fonts.check('16px Atkinson')&&doc.fonts.check('16px Literata'));
  check('one visible primary heading',[...doc.querySelectorAll('h1')].filter(visible).length===1);
  check('no decorative eyebrows',!doc.querySelector('.eyebrow,.micro,.publication-kicker,.edition,.private-mark'));
  check('same-origin runtime resources',w.performance.getEntriesByType('resource').every(r=>new URL(r.name).origin===w.location.origin));
  const theme=doc.documentElement.dataset.theme;
  check('theme state, label and preference agree',['dark','light'].includes(theme)&&$('.estate-theme-toggle').getAttribute('aria-label')===`Switch to ${theme==='dark'?'light':'dark'} mode`&&w.localStorage.getItem('sangeevSiteTheme')===theme&&doc.cookie.includes('sangeevSiteTheme='+theme));
  if($('#start'))check('homepage copy is trimmed without removing provenance access',!$('.clinical-boundary,.privacy-note')&&!$('.project-footer').textContent.includes('Not for clinical use')&&!!$('.project-footer a[href="licences.html"]'));
  else check('about page is linked without repeated disclaimers',$('.project-footer a[href="licences.html"]')&&!$('.project-footer').textContent.includes('Not for clinical use'));
  check('all visible images decoded',[...doc.images].filter(visible).every(i=>i.complete&&i.naturalWidth>0));
  const tiny=[...doc.querySelectorAll('button,input,select,summary')].filter(visible).filter(e=>!e.disabled&&!['checkbox','radio'].includes(e.type)&& (rect(e).width<43.9||rect(e).height<43.9)).map(e=>({id:e.id,tag:e.tagName,text:e.textContent.slice(0,50),rect:rect(e)}));
  check('active controls meet 44px target floor',tiny.length===0,tiny);
  if($('#angle-controls')&&doc.body.dataset.page==='guided'){
    const parent=rect($('#angle-controls')),buttons=[...$('#angle-controls').children].map(rect);
    check('angle buttons stay inside their control grid without overlap',buttons.every(r=>r.x>=parent.x-.1&&r.right<=parent.right+.1)&&buttons.every((a,i)=>buttons.slice(i+1).every(b=>a.right<=b.x+.1||b.right<=a.x+.1||a.bottom<=b.y+.1||b.bottom<=a.y+.1)),buttons);
    if(w.innerWidth<=780)check('initial guided projections precede geometry and fit first screen',rect($('#projection')).bottom<=w.innerHeight&&rect($('.evidence-panel')).y<rect($('.geometry-panel')).y,{projection:rect($('#projection')),geometry:rect($('.geometry-panel'))});
  }
  if($('#start'))check('primary lesson action is in first viewport',rect($('#start')).bottom<=w.innerHeight,rect($('#start')));
  if($('#open-lab')){
    const action=$('#open-lab'),source=$('.project-actions [aria-label="Source on GitHub"]');
    check('project page opens Explore and Lessons',action.getAttribute('href')==='explore.html'&&Boolean($('.project-actions a[href="lessons.html"]'))&&!$('canvas'));
    check('project actions are visible and meet the target floor',[action,source].every(e=>e&&rect(e).width>=44&&rect(e).height>=44)&&rect(action).bottom<=w.innerHeight);
    check('project page retains the pinned source icon',source?.querySelector('svg.estate-github-mark')&&source.href==='https://github.com/Snowslash/parallax');
  }
  if($('#mesh-projection'))check('femur hides internal diagnostics while keeping status visible',!$('details')&&$('#diagnostics')&&$('#load-metrics')&&!visible($('#diagnostics'))&&!visible($('#load-metrics'))&&visible($('#mesh-status'))&&$('.project-footer a[href="licences.html"]'));
  const parser=doc.createElement('canvas');parser.width=parser.height=1;const ctx=parser.getContext('2d');
  function rgba(value){ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);}
  function composite(f,b){const a=f[3]+b[3]*(1-f[3]);return [0,1,2].map(i=>(f[i]*f[3]+b[i]*b[3]*(1-f[3]))/a).concat(a);}
  function background(e){const chain=[];for(let p=e;p;p=p.parentElement)chain.unshift(p);return chain.reduce((bg,p)=>composite(rgba(styles(p).backgroundColor),bg),[255,255,255,1]);}
  const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  check('colour parser handles CSS Color 4',rgba('color(srgb 1 0 0)')[0]===255);
  const text=[];const walker=doc.createTreeWalker(doc.body,w.NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode,e=node.parentElement;
    if(!node.textContent.trim()||!e||e.closest('script,style,noscript,svg,button:disabled')||!visible(e)||Number(styles(e).opacity)<1)continue;
    const s=styles(e),bg=background(e),fg=composite(rgba(s.color),bg),ratio=contrast(fg,bg);
    const size=parseFloat(s.fontSize),required=size>=24||(size>=18.66&&parseFloat(s.fontWeight)>=700)?3:4.5;
    text.push({text:node.textContent.trim().slice(0,100),id:e.id,ratio,required});
  }
  const failures=text.filter(v=>v.ratio+.01<v.required);
  check('scoped rendered text contrast meets AA thresholds',failures.length===0,{sampled:text.length,minimum:Math.min(...text.map(t=>t.ratio)),failures});
  const active=doc.activeElement;
  if(active&&active.matches(':focus-visible')){
    const s=styles(active),bg=background(active.parentElement),outline=rgba(s.outlineColor),ratio=contrast(outline,bg);
    check('rendered keyboard focus is one opaque 2px outline',s.outlineStyle==='solid'&&parseFloat(s.outlineWidth)===2&&outline[3]===1&&s.boxShadow==='none'&&ratio>=3,{ratio,outline:s.outlineColor,width:s.outlineWidth,shadow:s.boxShadow});
  }
  const motion=[...doc.getAnimations()].map(a=>a.effect?.getComputedTiming().duration||0);
  if(w.matchMedia('(prefers-reduced-motion: reduce)').matches)check('reduced motion has no animation over 0.01ms',motion.every(t=>t<=.01)&&[...doc.querySelectorAll('.home-copy,.page-intro,.explanation-panel')].every(e=>styles(e).animationName==='none'),motion);
  const imageRules=[...doc.querySelectorAll('canvas,.projection-stage,.projection-surface,.image-surface')].map(e=>({id:e.id,animation:styles(e).animationName,transition:styles(e).transitionProperty,filter:styles(e).filter}));
  check('projection and acquisition surfaces have no animation or filters',imageRules.every(s=>s.animation==='none'&&s.filter==='none'));
  return {viewport:[w.innerWidth,w.innerHeight],theme,reducedMotion:w.matchMedia('(prefers-reduced-motion: reduce)').matches,passed:checks.filter(c=>c.pass).length,total:checks.length,checks};
}
