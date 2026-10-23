const need=(condition,message)=>{if(!condition)throw new Error(message);};
const text=x=>typeof x==='string'&&x.trim().length>0;
const vector=x=>Array.isArray(x)&&x.length===3&&x.every(Number.isFinite);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function validateLesson(m){
 need(m?.schemaVersion===1,'Unsupported lesson schema');
 need(m.fracture?.gapMm===16&&equal(m.fracture.distalTranslation,[0,0,-10]),'Invalid fracture');
 need(equal(m.camera?.pivot,[0,0,0])&&m.camera.sourcePivot===800&&m.camera.sdd===1200&&m.camera.fieldMm===210,'Invalid camera');
 need(Array.isArray(m.views)&&m.views.length===3,'Invalid views');
 for(const [id,angle] of [['ap',0],['oblique',30],['lateral',90]])need(m.views.filter(v=>v.id===id&&v.angleDeg===angle&&text(v.label)).length===1,'Invalid view');
 need(text(m.source?.title)&&text(m.source?.license)&&(text(m.source?.authors)||(Array.isArray(m.source?.authors)&&m.source.authors.length>0&&m.source.authors.every(text))),'Missing source attribution');
 need(text(m.source.url)&&/^https?:\/\//.test(m.source.url),'Invalid source URL');
 for(const id of ['outer','canal']){const a=m.models?.[id];need(a?.url===`model/${id}.stl`,'Invalid model path');validateAsset(a);}
 need(Array.isArray(m.cases)&&m.cases.length===2&&new Set(m.cases.map(c=>c.id)).size===2,'Invalid cases');
 for(const c of m.cases){need(['case-a','case-b'].includes(c.id)&&text(c.label)&&['entered','missed'].includes(c.truth)&&text(c.feedback),'Invalid case');
 const w=c.wire;need(w?.radiusMm===1.25&&w.oliveRadiusMm===2.25&&Array.isArray(w.points)&&w.points.length>=2&&w.points.length<=10000&&w.points.every(vector),'Invalid wire');
 need(w.points.slice(1).every((p,i)=>p.some((n,j)=>n!==w.points[i][j])),'Zero-length wire segment');
 need(c.frames&&Object.keys(c.frames).length===3,'Invalid frames');
 for(const viewId of ['ap','oblique','lateral']){const f=c.frames[viewId];need(f?.valid===true&&f.viewId===viewId&&f.url===`frames/${c.id}-${viewId}.png`,'Invalid frame');validateAsset(f);need(Number.isInteger(f.width)&&f.width>=1&&f.width<=8192&&f.height===f.width,'Invalid frame dimensions');}
 }
 return m;
}
export function validateAsset(a){need(a&&/^[a-f0-9]{64}$/.test(a.sha256),'Missing or invalid SHA-256');need(typeof a.url==='string'&&/^(model\/(outer|canal)\.stl|frames\/case-[ab]-(ap|oblique|lateral)\.png)$/.test(a.url),'Unsafe asset URL');}
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function loadVerified(asset,{signal,fetcher=fetch}={}){validateAsset(asset);signal?.throwIfAborted();const response=await fetcher(asset.url,{signal,cache:'no-store',redirect:'error',credentials:'same-origin'});need(response.ok&&!response.redirected,'Asset request failed or redirected');const bytes=await response.arrayBuffer();signal?.throwIfAborted();need(await sha256(bytes)===asset.sha256,'Asset hash mismatch');signal?.throwIfAborted();return bytes;}
export async function loadLesson({signal,fetcher=fetch}={}){const r=await fetcher('lesson.json',{signal,cache:'no-store',redirect:'error',credentials:'same-origin'});need(r.ok&&!r.redirected,'Lesson request failed or redirected');const bytes=await r.arrayBuffer();signal?.throwIfAborted();const digest=await sha256(bytes);const lesson=validateLesson(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));return {lesson,digest};}
export function validatePng(bytes,frame){need(bytes.byteLength>=33,'Truncated PNG');const a=new Uint8Array(bytes),v=new DataView(bytes);need([137,80,78,71,13,10,26,10].every((n,i)=>a[i]===n)&&v.getUint32(8)===13&&[73,72,68,82].every((n,i)=>a[12+i]===n),'Invalid PNG signature');need(v.getUint32(16)===frame.width&&v.getUint32(20)===frame.height,'PNG dimensions mismatch');}
export function parseStl(bytes){need(bytes.byteLength>=84,'Truncated STL');const v=new DataView(bytes),n=v.getUint32(80,true);need(n>0&&bytes.byteLength===84+50*n,'Invalid binary STL length');const positions=new Float32Array(n*9);for(let i=0;i<n;i++)for(let j=0;j<9;j++){const value=v.getFloat32(84+50*i+12+4*j,true);need(Number.isFinite(value),'Invalid STL coordinate');positions[i*9+j]=value;}return positions;}
