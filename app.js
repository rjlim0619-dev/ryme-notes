const COLORS=['purple','blue','yellow','pink','green','slate'];
const HEX={purple:'#a678f5',blue:'#6f8ff5',yellow:'#fbb43a',pink:'#f472c8',green:'#4fc68a',slate:'#7a829c'};
const COLS=[['todo','To Do'],['doing','In Progress'],['review','Review'],['done','Done']];
const KEY='rymeNotes.v1';
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);

function seed(){
  const nb=[
    {id:'n1',name:'HIS 007',desc:'Philippine History notes & reports',color:'purple'},
    {id:'n2',name:'ITE 289',desc:'Information Management, SQL & APIs',color:'blue'},
    {id:'n3',name:'Roblox Games',desc:'Ideas for FIND IT!, GTL & more',color:'yellow'},
    {id:'n4',name:'YouTube / Ryme',desc:'Video ideas, scripts and uploads',color:'pink'},
  ];
  const now=Date.now();
  return {notebooks:nb,
    notes:[
      {id:uid(),nb:'n1',title:'Welcome to Ryme Notes 👋',body:'This is your notes app. Everything saves automatically on this computer.\n\n• Make notebooks for each class or project (left sidebar or the colored cards).\n• Use the Task Board for to-dos and drag them to Done.\n• Use the Planner for your weekly schedule.\n• Use Backup / Restore to save a copy of everything.',pinned:true,updated:now},
      {id:uid(),nb:'n2',title:'SQL JOIN cheat sheet',body:'INNER JOIN – only matching rows\nLEFT JOIN – all from left + matches\nRIGHT JOIN – all from right + matches\nFULL OUTER JOIN – everything from both',pinned:false,updated:now-3600e3},
      {id:uid(),nb:'n3',title:'Next game update',body:'New biome ideas, more hidden items, rebirth rewards.',pinned:false,updated:now-7200e3},
    ],
    tasks:[
      {id:uid(),title:'Read Module 13',col:'todo',nb:'n1'},
      {id:uid(),title:'Finish API join endpoints',col:'doing',nb:'n2'},
      {id:uid(),title:'Edit next Roblox short',col:'review',nb:'n4'},
      {id:uid(),title:'Set up Ryme Notes',col:'done',nb:'n3'},
    ],
    events:[]};
}
/* ---------- encrypted storage + login (security layer) ---------- */
const EKEY='rymeNotes.enc.v1',GKEY='rymeNotes.guard',ITER=600000;
let S=null,CK=null,saveT=null,SALT=null,CUR_IT=ITER;
const te=new TextEncoder(),td=new TextDecoder();
const b64=u=>{let s='';const a=new Uint8Array(u);for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));return btoa(s)};
const ub64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pw,salt,it){const base=await crypto.subtle.importKey('raw',te.encode(pw),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:it||ITER,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
const OWNER_HASH='34979204a66d448b264b669988f676f20a1bcc36c6ca401523eb0a6cfa0d7289';
const normEmail=e=>e.trim().toLowerCase();
async function emailOk(e){const h=await crypto.subtle.digest('SHA-256',te.encode(normEmail(e)));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')===OWNER_HASH}
const blobIter=d=>d.v>=4?d.it:310000;
async function makeBlob(){const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},CK,te.encode(JSON.stringify(S)));
  return {app:'ryme-notes',v:4,it:CUR_IT,salt:b64(SALT),iv:b64(iv),ct:b64(ct)}}
async function writeEnc(){if(!CK||!S)return;const blob=await makeBlob();
  try{localStorage.setItem(EKEY,JSON.stringify(blob))}catch(e){toast('Could not save!')}}
function save(){clearTimeout(saveT);saveT=setTimeout(writeEnc,250)}
window.addEventListener('beforeunload',()=>{if(saveT){clearTimeout(saveT);writeEnc()}});
const readEnc=()=>{try{return JSON.parse(localStorage.getItem(EKEY))}catch(e){return null}};
async function openBlob(d,pw){const salt=ub64(d.salt),it=blobIter(d);const k=await deriveKey(pw,salt,it);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:ub64(d.iv)},k,ub64(d.ct));return {data:JSON.parse(td.decode(pt)),key:k,salt,it}}

/* never trust stored/restored data: clean every field before it reaches the screen */
const safeId=v=>String(v??'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40)||uid();
const safeStr=(v,n)=>String(v??'').slice(0,n);
function sanitize(d){
  const o={notebooks:[],notes:[],tasks:[],events:[],settings:{}};
  (Array.isArray(d.notebooks)?d.notebooks:[]).slice(0,200).forEach(n=>o.notebooks.push({id:safeId(n.id),name:safeStr(n.name,40)||'Notebook',desc:safeStr(n.desc,80),color:COLORS.includes(n.color)?n.color:'slate'}));
  if(!o.notebooks.length)o.notebooks.push({id:uid(),name:'General',desc:'',color:'purple'});
  const nbIds=new Set(o.notebooks.map(n=>n.id)),fb=o.notebooks[0].id,nb=v=>nbIds.has(safeId(v))?safeId(v):fb;
  (Array.isArray(d.notes)?d.notes:[]).slice(0,20000).forEach(n=>o.notes.push({id:safeId(n.id),nb:nb(n.nb),title:safeStr(n.title,300),body:safeStr(n.body,200000),pinned:!!n.pinned,updated:+n.updated||Date.now()}));
  const cols=COLS.map(c=>c[0]);
  (Array.isArray(d.tasks)?d.tasks:[]).slice(0,20000).forEach(t=>o.tasks.push({id:safeId(t.id),title:safeStr(t.title,300),col:cols.includes(t.col)?t.col:'todo',nb:nb(t.nb)}));
  (Array.isArray(d.events)?d.events:[]).slice(0,20000).forEach(e=>{const st=Math.min(Math.max(+e.start||9,0),24),en=Math.min(Math.max(+e.end||st+1,st+.5),24);
    if(/^\d{4}-\d{2}-\d{2}$/.test(e.day))o.events.push({id:safeId(e.id),title:safeStr(e.title,200),day:e.day,start:st,end:en,color:COLORS.includes(e.color)?e.color:'purple'})});
  const st=d.settings||{};o.settings={autolock:[1,5,15,30,60].includes(+st.autolock)?+st.autolock:15,lockHidden:st.lockHidden!==false};
  return o}

/* brute-force guard: growing wait time after wrong passwords */
const getGuard=()=>{try{return JSON.parse(localStorage.getItem(GKEY))||{fails:0,until:0,since:0}}catch(e){return {fails:0,until:0,since:0}}};
const setGuard=g=>{try{localStorage.setItem(GKEY,JSON.stringify(g))}catch(e){}};
function waitLeft(){return Math.max(0,Math.ceil((getGuard().until-Date.now())/1000))}
function registerFail(){const g=getGuard();g.fails++;g.since++;if(g.fails>=5){g.until=Date.now()+Math.min(30*2**(g.fails-5),3600)*1000}setGuard(g);return g}
let cdT;function countdown(){clearInterval(cdT);const tick=()=>{const w=waitLeft(),b=$('#lockForm .primary');if(!b)return clearInterval(cdT);
  if(w>0){b.disabled=true;b.style.opacity=.5;$('#lerr').textContent=`Too many wrong tries. Wait ${w>=60?Math.floor(w/60)+'m '+(w%60)+'s':w+'s'}.`}
  else{b.disabled=false;b.style.opacity=1;if(/Too many/.test($('#lerr').textContent))$('#lerr').textContent='';clearInterval(cdT)}};tick();cdT=setInterval(tick,1000)}

/* password rules */
const COMMON=['password','12345678','123456789','qwerty123','password1','iloveyou','11111111','abc12345','admin123','welcome1','letmein1','00000000','asdfghjk'];
function pwScore(p){let s=0;if(p.length>=8)s++;if(p.length>=12)s++;if(/[a-z]/.test(p)&&/[A-Z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;
  if(COMMON.includes(p.toLowerCase())||/^(.)\1+$/.test(p))s=0;return Math.min(s,4)}
function pwProblem(p){if(p.length<8)return'Use at least 8 characters.';if(!/[A-Za-z]/.test(p)||!/\d/.test(p))return'Use both letters and numbers.';
  if(COMMON.includes(p.toLowerCase()))return'That password is too common.';return''}
const meterHTML=id=>`<div class="meter" id="${id}"><i></i><i></i><i></i><i></i></div><div class="mtxt" id="${id}t"></div>`;
function bindMeter(input,id){const upd=()=>{const sc=input.value?pwScore(input.value):-1,el=$('#'+id);if(!el)return;
  el.querySelectorAll('i').forEach((x,i)=>x.style.background=i<sc?['#e5546e','#fb9a2c','#fdc54a','#4fc68a'][sc-1]:'');
  $('#'+id+'t').textContent=sc<0?'':['Very weak','Weak','Okay','Good','Strong'][sc]};input.addEventListener('input',upd);upd()}
const eye=id=>`<button type="button" class="eye" data-eye="${id}" title="Show / hide">👁</button>`;
document.addEventListener('click',e=>{const b=e.target.closest('[data-eye]');if(b){const i=document.getElementById(b.dataset.eye);i.type=i.type==='password'?'text':'password'}});

function lockUI(mode,msg){
  const f=$('#lockForm');$('#lock').classList.remove('hide');
  const head='<div class="orb"></div>';
  if(mode==='create')f.innerHTML=head+`<h2>Create your password</h2><p>Only someone with this password can open Ryme Notes on this computer. Your notes get encrypted with it.</p>
    <div class="pwrap"><input type="password" id="pw1" placeholder="New password" autocomplete="new-password">${eye('pw1')}</div>${meterHTML('m1')}
    <input type="password" id="pw2" placeholder="Type it again" autocomplete="new-password">
    <p style="font-size:11.5px;margin-top:-2px">At least 8 characters with letters and numbers. Don't reuse your Gmail password.</p>
    <div class="err" id="lerr">${msg||''}</div><button class="primary" type="submit">Set password</button>
    <p style="font-size:11.5px">There is no "forgot password". If you forget it, your notes can't be recovered.</p>`;
  else if(mode==='unlock')f.innerHTML=head+`<h2>Ryme Notes</h2><div class="who"><span class="avatar" style="width:26px;height:26px;font-size:10px">RJ</span>Ryan James Lim</div>
    ${(readEnc()||{}).v===2?'<input type="email" id="em" placeholder="Gmail (one last time)">':''}
    <div class="pwrap"><input type="password" id="pw1" placeholder="Password" autocomplete="current-password">${eye('pw1')}</div>
    <div class="err" id="lerr">${msg||''}</div><button class="primary" type="submit">Unlock</button>
    <div class="shield">🛡️ Encrypted · AES-256</div>
    <button class="link" type="button" id="forgot">Forgot password?</button>`;
  else if(mode==='reset')f.innerHTML=head+`<h2>Erase and start over?</h2><p>Without the password your notes can't be opened. This deletes everything saved in Ryme Notes on this computer and lets you set a new password.</p>
    <input id="pw1" placeholder='Type ERASE to confirm'><div class="err" id="lerr"></div>
    <button class="primary" type="submit" style="background:#e5546e">Erase everything</button><button class="link" type="button" id="back">Go back</button>`;
  f.dataset.mode=mode;setTimeout(()=>($('#em')||$('#pw1'))?.focus(),30);
  if(mode==='create')bindMeter($('#pw1'),'m1');
  if(mode==='unlock')countdown();
  $('#forgot')&&($('#forgot').onclick=()=>lockUI('reset'));$('#back')&&($('#back').onclick=()=>lockUI('unlock'));
}
function fail(m){$('#lerr').textContent=m;const f=$('#lockForm');f.classList.remove('shake');void f.offsetWidth;f.classList.add('shake')}
let busy=false;
$('#lockForm').onsubmit=async e=>{e.preventDefault();if(busy)return;const mode=e.target.dataset.mode,pw=$('#pw1').value;
  const em=$('#em')?$('#em').value:'';
  if(mode==='unlock'&&waitLeft()>0)return countdown();
  if($('#em')&&!(await emailOk(em))){registerFail();return fail('This Gmail is not allowed.')}
  busy=true;try{
  if(mode==='create'){
    const bad=pwProblem(pw);if(bad)return fail(bad);if(pw!==$('#pw2').value)return fail("Passwords don't match.");
    let old=null;try{old=JSON.parse(localStorage.getItem(KEY))}catch(_){}
    S=sanitize((old&&old.notebooks)?old:seed());SALT=crypto.getRandomValues(new Uint8Array(16));CUR_IT=ITER;$('#lerr').textContent='Securing…';CK=await deriveKey(pw,SALT,ITER);
    await writeEnc();try{localStorage.removeItem(KEY)}catch(_){}setGuard({fails:0,until:0,since:0,last:Date.now()});unlocked();toast('Password set 🔒');
  }else if(mode==='unlock'){
    const d=readEnc();$('#lerr').textContent='Checking…';
    try{const r=await openBlob(d,d.v===2?normEmail(em)+'|'+pw:pw);S=sanitize(r.data);SALT=r.salt;
      if(d.v<4){CUR_IT=ITER;CK=await deriveKey(pw,SALT,ITER);await writeEnc()}else{CK=r.key;CUR_IT=r.it}
      const g=getGuard();const missed=g.since;setGuard({fails:0,until:0,since:0,last:Date.now()});unlocked();
      if(missed)setTimeout(()=>toast(`⚠️ ${missed} wrong password ${missed===1?'try':'tries'} since your last login`),400)}
    catch(_){const g=registerFail();fail(g.fails>=5?'':'Wrong password.'+(g.fails>=3?` ${5-g.fails} more before a wait.`:''));$('#pw1').value='';$('#pw1').focus();if(g.fails>=5)countdown()}
  }else if(mode==='reset'){
    if(pw.trim().toUpperCase()!=='ERASE')return fail('Type ERASE to confirm.');
    try{localStorage.removeItem(EKEY);localStorage.removeItem(KEY);localStorage.removeItem(GKEY)}catch(_){}lockUI('create');
  }}finally{busy=false}};
function unlocked(){$('#lock').classList.add('hide');$('#lockForm').innerHTML='';view='home';selNote=null;filterNb=null;go('home');bumpIdle()}
function lockNow(){if(!CK)return;if(saveT){clearTimeout(saveT);writeEnc().then(()=>{S=null;CK=null})}else{S=null;CK=null}closeModal();
  $('#search').value='';query='';
  document.querySelectorAll('#nbCards,#stats,#taskList,#todayList,#todayLine,#recent,#noteList,#editor,#boardFull,#gridFull,#nbNav').forEach(x=>x.innerHTML='');lockUI('unlock')}
/* auto-lock: after N idle minutes, and (optionally) after 1 minute away from the window */
let idleT,hidT;function bumpIdle(){clearTimeout(idleT);if(CK&&S)idleT=setTimeout(lockNow,(S.settings?.autolock||15)*60*1000)}
document.addEventListener('visibilitychange',()=>{clearTimeout(hidT);if(document.hidden&&CK&&S&&S.settings?.lockHidden)hidT=setTimeout(lockNow,60*1000)});
['mousemove','keydown','click','scroll'].forEach(ev=>document.addEventListener(ev,bumpIdle,{passive:true}));

let view='home',selNote=null,filterNb=null,weekOffset=0,query='';
const nbById=id=>S.notebooks.find(n=>n.id===id);
const nbColor=id=>(nbById(id)||{color:'slate'}).color;
const initials=s=>(s||'?').replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'•';

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1800)}

function go(v){view=v;document.querySelectorAll('.nav[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v&&!(v==='notes'&&filterNb)));
  document.querySelectorAll('.view').forEach(s=>s.classList.toggle('on',s.id==='v-'+v));
  $('#pageTitle').textContent={home:greet()+', Ryan 👋',notes:filterNb?(nbById(filterNb)?.name||'Notes'):'Notes',board:'Task Board',planner:'Planner'}[v];
  render()}

/* ---------- sidebar & cards ---------- */
function renderSide(){
  $('#noteCount').textContent=S.notes.length;
  $('#nbNav').innerHTML=S.notebooks.map(n=>`<button class="nav nbnav ${filterNb===n.id&&view==='notes'?'active':''}" data-nb="${n.id}"><span class="dot" style="background:${HEX[n.color]}"></span><span class="lbl">${esc(n.name)}</span><span class="count">${S.notes.filter(x=>x.nb===n.id).length}</span></button>`).join('')+
  `<button class="nav" id="addNbSide"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span class="lbl">New notebook</span></button>`;
}
function renderCards(){
  $('#nbCards').innerHTML=S.notebooks.map(n=>{
    const notes=S.notes.filter(x=>x.nb===n.id).length;
    const t=S.tasks.filter(x=>x.nb===n.id);const pct=t.length?Math.round(t.filter(x=>x.col==='done').length/t.length*100):0;
    return `<div class="nb c-${n.color}" data-nb="${n.id}">
      <div class="meta"><span class="pill">${notes} note${notes===1?'':'s'}</span>${t.length?`<span>${t.filter(x=>x.col==='done').length}/${t.length} tasks done</span>`:''}</div>
      <b>${esc(n.name)}</b><small>${esc(n.desc||'')}</small>
      <button class="menu" data-editnb="${n.id}" title="Edit notebook">⋮</button>
      <div class="bar"><i style="width:${Math.max(pct,8)}%"></i></div></div>`}).join('')+
    `<div class="nb add" id="addNbCard">+ New notebook</div>`;
}

/* ---------- board ---------- */
function taskRow(t){
  const c=HEX[nbColor(t.nb)];
  return `<div class="task" draggable="true" data-task="${t.id}">
    <span class="badge" style="background:${c}">${initials(nbById(t.nb)?.name)}</span>
    <span class="t" title="${esc(t.title)}">${esc(t.title)}</span>
    ${t.col==='done'?'<span class="ok"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>':''}
    <button class="x" data-deltask="${t.id}" title="Delete">×</button></div>`}
function renderBoard(el,mini){
  el.innerHTML=COLS.map(([k,l])=>{
    let ts=S.tasks.filter(t=>t.col===k);const total=ts.length;
    if(mini)ts=ts.slice(-3);
    return `<div class="col" data-col="${k}"><div class="colhead"><span>${l}</span><em>${total}</em></div>
      ${ts.map(taskRow).join('')||'<p class="hint" style="padding:6px 4px">Nothing here yet</p>'}
      ${mini?`<div class="colfoot">${total>3?`+${total-3} more`:''}<span class="star">★</span></div>`:
      `<div class="addtask"><input data-addcol="${k}" placeholder="+ Add a task"></div>`}</div>`}).join('');
}

/* ---------- notes ---------- */
function filteredNotes(){
  const q=query.toLowerCase();
  return S.notes.filter(n=>(!filterNb||n.nb===filterNb)&&(!q||(n.title+' '+n.body).toLowerCase().includes(q)))
    .sort((a,b)=>(b.pinned-a.pinned)||(b.updated-a.updated));
}
const ago=t=>{const d=(Date.now()-t)/1000;if(d<60)return'just now';if(d<3600)return Math.floor(d/60)+'m ago';if(d<86400)return Math.floor(d/3600)+'h ago';return new Date(t).toLocaleDateString()};
function renderNotes(){
  const list=filteredNotes();
  $('#noteList').innerHTML=list.map(n=>`<div class="noteitem ${n.id===selNote?'sel':''}" data-note="${n.id}" style="border-left-color:${HEX[nbColor(n.nb)]}">
    <b>${n.pinned?'★ ':''}${esc(n.title||'Untitled')}</b><p>${esc(n.body.split('\n')[0]||'No content')}</p><div class="d">${esc(nbById(n.nb)?.name||'')} · ${ago(n.updated)}</div></div>`).join('')||'<div class="empty" style="padding:30px">No notes found</div>';
  const n=S.notes.find(x=>x.id===selNote);
  if(!n){$('#editor').innerHTML='<div class="empty"><div>Pick a note on the left<br>or press <b>+ New note</b>.</div></div>';return}
  $('#editor').innerHTML=`<input class="title" id="edTitle" placeholder="Title" value="${esc(n.title)}">
    <div class="row"><select id="edNb">${S.notebooks.map(b=>`<option value="${b.id}" ${b.id===n.nb?'selected':''}>${esc(b.name)}</option>`).join('')}</select>
    <button class="pinbtn ${n.pinned?'on':''}" id="edPin" title="Pin">★</button><span id="edSaved">Saved ${ago(n.updated)}</span>
    <button class="del" id="edDel">Delete note</button></div>
    <textarea id="edBody" placeholder="Start writing…">${esc(n.body)}</textarea>`;
  const touch=()=>{n.updated=Date.now();save();$('#edSaved').textContent='Saved just now';
    const it=document.querySelector(`.noteitem[data-note="${n.id}"]`);if(it){it.querySelector('b').innerHTML=(n.pinned?'★ ':'')+esc(n.title||'Untitled');it.querySelector('p').textContent=n.body.split('\n')[0]||'No content'}};
  $('#edTitle').oninput=e=>{n.title=e.target.value;touch()};
  $('#edBody').oninput=e=>{n.body=e.target.value;touch()};
  $('#edNb').onchange=e=>{n.nb=e.target.value;touch();render()};
  $('#edPin').onclick=()=>{n.pinned=!n.pinned;touch();render()};
  $('#edDel').onclick=()=>confirmBox('Delete this note?',()=>{S.notes=S.notes.filter(x=>x!==n);selNote=null;save();render();toast('Note deleted')});
}
const STLBL={todo:'To Do',doing:'In Progress',review:'Review'};
function greet(){const h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening'}
function renderDash(){
  const today=iso(new Date()),nowH=new Date().getHours()+new Date().getMinutes()/60;
  const open=S.tasks.filter(t=>t.col!=='done'),done=S.tasks.filter(t=>t.col==='done').length;
  const todays=S.events.filter(e=>e.day===today).sort((a,b)=>a.start-b.start);
  const next=todays.find(e=>e.end>nowH);
  $('#todayLine').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+
    (next?` · Next: ${next.title} at ${fmtH(next.start)}`:'');
  const ic={notes:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7"/>',todo:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
    done:'<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'};
  const tile=(go,c,svg,n,l)=>`<button class="stat" data-go="${go}"><span class="ic" style="background:${c}"><svg viewBox="0 0 24 24">${svg}</svg></span><span><b>${n}</b><span>${l}</span></span></button>`;
  $('#stats').innerHTML=tile('notes','linear-gradient(135deg,#b98cfa,#8e5cf0)',ic.notes,S.notes.length,'Notes')+
    tile('board','linear-gradient(135deg,#94b0fa,#4a7cf0)',ic.todo,open.length,'Tasks to do')+
    tile('board','linear-gradient(135deg,#7fdcab,#2fa86c)',ic.done,done,'Tasks done')+
    tile('planner','linear-gradient(135deg,#fdd060,#fb9a2c)',ic.cal,todays.length,"Today's events");
  const ord={doing:0,review:1,todo:2};
  $('#taskList').innerHTML=open.sort((a,b)=>ord[a.col]-ord[b.col]).slice(0,7).map(t=>`<div class="trow">
      <span class="chk" data-donetask="${t.id}" title="Mark as done"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>
      <span class="tt" title="${esc(t.title)}">${esc(t.title)}</span>
      <span class="ndot" title="${esc(nbById(t.nb)?.name||'')}" style="background:${HEX[nbColor(t.nb)]}"></span>
      <span class="chip ${t.col}">${STLBL[t.col]}</span></div>`).join('')+(open.length>7?`<p class="hint" style="padding:4px 8px">+${open.length-7} more on the board</p>`:'')
    ||'<div class="emptyp">🎉 All caught up! Add a task below.</div>';
  $('#todayList').innerHTML=todays.map(e=>`<div class="erow ${e.end<=nowH?'past':e.start<=nowH?'now':''}" data-ev="${e.id}">
      <span class="bar2" style="background:${HEX[e.color]}"></span><span class="tm">${fmtH(e.start)} – ${fmtH(e.end)}</span>
      <span class="tt" style="flex:1">${esc(e.title)}</span>${e.start<=nowH&&e.end>nowH?'<span class="chip todo">Now</span>':''}</div>`).join('')
    ||'<div class="emptyp">Nothing scheduled today.</div>';
}
function renderRecent(){
  const r=[...S.notes].sort((a,b)=>(b.pinned-a.pinned)||(b.updated-a.updated)).slice(0,5);
  $('#recent').innerHTML=r.map(n=>`<div class="nrow" data-note="${n.id}"><span class="ndot" style="background:${HEX[nbColor(n.nb)]};width:10px;height:10px"></span>
    <div class="nt"><b>${n.pinned?'★ ':''}${esc(n.title||'Untitled')}</b><p>${esc(n.body.replace(/\s+/g,' ').trim()||'Empty note')}</p></div>
    <span class="nm">${esc(nbById(n.nb)?.name||'')}<br>${ago(n.updated)}</span></div>`).join('')||'<div class="emptyp">No notes yet. Press <b>+ New note</b> to write one.</div>';
}

/* ---------- planner ---------- */
const HOURS=[];for(let h=7;h<=21;h++)HOURS.push(h);
function weekDays(off){const d=new Date();d.setHours(0,0,0,0);const dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow+off*7);
  return [...Array(7)].map((_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);return x})}
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const fmtH=h=>{const hh=Math.floor(h),mm=Math.round((h-hh)*60);return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0')};
function renderGrid(el,off,mini){
  const days=weekDays(off),today=iso(new Date());
  const hours=mini?(()=>{const n=new Date().getHours();const s=Math.min(Math.max(n-1,7),17);return HOURS.filter(h=>h>=s&&h<s+5)})():HOURS;
  const H=56;
  let h='<div></div>'+days.map(d=>`<div class="dayh ${iso(d)===today?'today':''}">${d.toLocaleDateString('en-US',{weekday:'long'})}<br>${d.toLocaleDateString('en-GB').replace(/\//g,'.')}</div>`).join('');
  hours.forEach(hr=>{h+=`<div class="time">${fmtH(hr)}</div>`+days.map(d=>`<div class="cell ${iso(d)===today?'todaycol':''}" data-day="${iso(d)}" data-hour="${hr}"></div>`).join('')});
  el.innerHTML=h;
  // events
  const first=hours[0],last=hours[hours.length-1]+1;
  requestAnimationFrame(()=>{
    S.events.forEach(ev=>{
      const di=days.findIndex(d=>iso(d)===ev.day);if(di<0)return;
      const s=Math.max(ev.start,first),e=Math.min(ev.end,last);if(e<=s)return;
      const cell=el.querySelector(`.cell[data-day="${ev.day}"][data-hour="${Math.floor(s)}"]`);if(!cell)return;
      const div=document.createElement('div');div.className='ev c-'+ev.color;div.dataset.ev=ev.id;
      div.style.top=(cell.offsetTop+(s-Math.floor(s))*H+3)+'px';div.style.height=((e-s)*H-6)+'px';
      div.style.left=(cell.offsetLeft+4)+'px';div.style.width=(cell.offsetWidth-8)+'px';div.style.right='auto';
      div.innerHTML=`<div class="h">${fmtH(ev.start)}–${fmtH(ev.end)}</div><div>${esc(ev.title)}</div><div class="bar"><i style="background:rgba(0,0,0,.12)"></i></div>`;
      el.appendChild(div)});
    if(off===0){const n=new Date(),hr=n.getHours()+n.getMinutes()/60;
      if(hr>=first&&hr<last){const c=el.querySelector(`.cell[data-hour="${Math.floor(hr)}"]`);
        const line=document.createElement('div');line.className='nowline';line.style.top=(c.offsetTop+(hr-Math.floor(hr))*H)+'px';el.appendChild(line)}}
  });
  if(!mini){const a=days[0],b=days[6];$('#weekLabel').textContent=a.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' – '+b.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
}

/* ---------- modals ---------- */
function openModal(html){$('#sheet').innerHTML=html;$('#modal').classList.add('open');const f=$('#sheet').querySelector('input,textarea');f&&setTimeout(()=>f.focus(),30)}
function closeModal(){$('#modal').classList.remove('open')}
$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
function confirmBox(msg,yes){openModal(`<h3>${esc(msg)}</h3><div class="btns"><button class="ghost" id="cNo">Cancel</button><button class="primary" id="cYes" style="background:#e5546e">Delete</button></div>`);
  $('#cNo').onclick=closeModal;$('#cYes').onclick=()=>{closeModal();yes()}}
function swatches(cur){return `<div class="swatches">${COLORS.map(c=>`<span class="sw ${c===cur?'on':''}" data-c="${c}" style="background:${HEX[c]}"></span>`).join('')}</div>`}
function bindSw(){let c=$('#sheet .sw.on').dataset.c;$('#sheet').querySelectorAll('.sw').forEach(s=>s.onclick=()=>{$('#sheet').querySelectorAll('.sw').forEach(x=>x.classList.remove('on'));s.classList.add('on');c=s.dataset.c});return()=>c}
function notebookModal(id){
  const n=id?nbById(id):{name:'',desc:'',color:COLORS[S.notebooks.length%4]};
  openModal(`<h3>${id?'Edit':'New'} notebook</h3><label>Name<input id="mName" value="${esc(n.name)}" maxlength="40"></label>
    <label>Description<input id="mDesc" value="${esc(n.desc)}" maxlength="80"></label><label>Color${swatches(n.color)}</label>
    <div class="btns">${id&&S.notebooks.length>1?'<button class="danger" id="mDel">Delete</button>':''}<button class="ghost" id="mCancel">Cancel</button><button class="primary" id="mSave">Save</button></div>`);
  const getC=bindSw();$('#mCancel').onclick=closeModal;
  $('#mSave').onclick=()=>{const name=$('#mName').value.trim();if(!name){$('#mName').focus();return}
    if(id){Object.assign(n,{name,desc:$('#mDesc').value.trim(),color:getC()})}else S.notebooks.push({id:uid(),name,desc:$('#mDesc').value.trim(),color:getC()});
    save();closeModal();render()};
  $('#mName').onkeydown=e=>{if(e.key==='Enter')$('#mSave').click()};
  if($('#mDel'))$('#mDel').onclick=()=>confirmBox(`Delete "${n.name}"? Its notes and tasks move to "${S.notebooks.find(x=>x.id!==id).name}".`,()=>{
    const to=S.notebooks.find(x=>x.id!==id).id;S.notes.forEach(x=>{if(x.nb===id)x.nb=to});S.tasks.forEach(x=>{if(x.nb===id)x.nb=to});
    S.notebooks=S.notebooks.filter(x=>x.id!==id);if(filterNb===id)filterNb=null;save();render()});
}
function eventModal(ev,day,hour){
  const isNew=!ev;ev=ev||{title:'',day,start:hour,end:hour+1,color:'purple'};
  const opts=v=>{let o='';for(let h=6;h<=23.5;h+=.5)o+=`<option value="${h}" ${h===v?'selected':''}>${fmtH(h)}</option>`;return o};
  openModal(`<h3>${isNew?'Add':'Edit'} schedule block</h3><label>What<input id="eT" value="${esc(ev.title)}" placeholder="e.g. HIS 007 class"></label>
    <label>Day<input type="date" id="eD" value="${ev.day}"></label>
    <div class="two"><label>Start<select id="eS">${opts(ev.start)}</select></label><label>End<select id="eE">${opts(ev.end)}</select></label></div>
    <label>Color${swatches(ev.color)}</label>
    <div class="btns">${isNew?'':'<button class="danger" id="eDel">Delete</button>'}<button class="ghost" id="eC">Cancel</button><button class="primary" id="eOk">Save</button></div>`);
  const getC=bindSw();$('#eC').onclick=closeModal;
  $('#eOk').onclick=()=>{const t=$('#eT').value.trim();if(!t){$('#eT').focus();return}
    let s=+$('#eS').value,e=+$('#eE').value;if(e<=s)e=s+.5;
    Object.assign(ev,{title:t,day:$('#eD').value||day,start:s,end:e,color:getC()});if(isNew){ev.id=uid();S.events.push(ev)}
    save();closeModal();render()};
  $('#eT').onkeydown=e=>{if(e.key==='Enter')$('#eOk').click()};
  if($('#eDel'))$('#eDel').onclick=()=>{S.events=S.events.filter(x=>x!==ev);save();closeModal();render()};
}
function backupModal(){
  openModal(`<h3>Backup / Restore</h3><p class="hint">Backups are <b>encrypted with your password</b>, so the file is useless to anyone else. Keep one somewhere safe in case you clear your browser or change computers.</p>
    <button class="primary" id="bDown">Download encrypted backup</button><button class="ghost" id="bCopy">Copy encrypted backup as text</button>
    <label>Restore from a backup file<input type="file" id="bFile" accept=".json,.rnb,application/json"></label>
    <label>…or paste backup text<textarea id="bText" rows="3" placeholder="Paste here, then press Restore"></textarea></label>
    <div class="btns"><button class="ghost" id="bClose">Close</button><button class="primary" id="bRestore">Restore</button></div>`);
  const data=async()=>JSON.stringify(await makeBlob());
  $('#bClose').onclick=closeModal;
  $('#bDown').onclick=async()=>{try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([await data()],{type:'application/json'}));a.download='ryme-notes-backup-'+iso(new Date())+'.json';document.body.appendChild(a);a.click();a.remove();toast('Encrypted backup downloaded')}catch(e){toast('Download blocked here – use Copy instead')}};
  $('#bCopy').onclick=async()=>{const d=await data();try{await navigator.clipboard.writeText(d);toast('Backup copied')}catch(e){$('#bText').value=d;$('#bText').select();toast('Select-all and copy the text box')}};
  const apply=d=>{S=sanitize(d);save();closeModal();selNote=null;filterNb=null;render();toast('Restored!')};
  const restore=txt=>{let d;try{d=JSON.parse(txt)}catch(e){return toast('That backup could not be read')}
    if(d&&d.ct&&d.salt){openModal(`<h3>Backup password</h3><p class="hint">Type the password you used when this backup was made.</p>
      <div class="pwrap"><input type="password" id="rPw">${eye('rPw')}</div><div class="err" id="rErr" style="color:#e5546e;font-size:12px"></div>
      <div class="btns"><button class="ghost" id="rC">Cancel</button><button class="primary" id="rOk">Restore</button></div>`);
      $('#rC').onclick=closeModal;const go2=async()=>{$('#rErr').textContent='Checking…';try{const r=await openBlob(d,$('#rPw').value);apply(r.data)}catch(e){$('#rErr').textContent='Wrong password for this backup.'}};
      $('#rOk').onclick=go2;$('#rPw').onkeydown=e=>{if(e.key==='Enter')go2()};}
    else if(d&&d.notebooks&&d.notes)apply(d);else toast('That backup could not be read')};
  $('#bFile').onchange=e=>{const f=e.target.files[0];if(f&&f.size<50e6)f.text().then(restore)};
  $('#bRestore').onclick=()=>{if($('#bText').value.trim())restore($('#bText').value)};
}
function securityModal(){
  const st=S.settings,g=getGuard();
  openModal(`<h3>🛡️ Security</h3>
    <div class="secrow"><span>Encryption</span><b>AES-256-GCM · PBKDF2 ${(CUR_IT/1000)|0}k</b></div>
    <div class="secrow"><span>Last login</span><b>${g.last?new Date(g.last).toLocaleString():'—'}</b></div>
    <label>Auto-lock when idle<select id="sAuto">${[1,5,15,30,60].map(m=>`<option value="${m}" ${m===st.autolock?'selected':''}>after ${m} minute${m>1?'s':''}</option>`).join('')}</select></label>
    <label class="chkrow"><input type="checkbox" id="sHid" ${st.lockHidden?'checked':''}> Lock when I'm away from the window for 1 minute</label>
    <h3 style="font-size:15px;margin-top:6px">Change password</h3>
    <div class="pwrap"><input type="password" id="cOld" placeholder="Current password" autocomplete="current-password">${eye('cOld')}</div>
    <div class="pwrap"><input type="password" id="cNew" placeholder="New password" autocomplete="new-password">${eye('cNew')}</div>${meterHTML('m2')}
    <input type="password" id="cNew2" placeholder="Type new password again" autocomplete="new-password">
    <div class="err" id="cErr" style="color:#e5546e;font-size:12px;min-height:14px"></div>
    <div class="btns"><button class="ghost" id="sClose">Close</button><button class="primary" id="cOk">Change password</button></div>`);
  bindMeter($('#cNew'),'m2');
  $('#sAuto').onchange=e=>{S.settings.autolock=+e.target.value;save();bumpIdle();toast('Auto-lock updated')};
  $('#sHid').onchange=e=>{S.settings.lockHidden=e.target.checked;save()};
  $('#sClose').onclick=closeModal;
  $('#cOk').onclick=async()=>{const o=$('#cOld').value,n=$('#cNew').value,err=m=>$('#cErr').textContent=m;
    const bad=pwProblem(n);if(bad)return err(bad);if(n!==$('#cNew2').value)return err("New passwords don't match.");if(n===o)return err('Pick a different password.');
    err('Checking…');if(saveT){clearTimeout(saveT);await writeEnc()}
    try{await openBlob(readEnc(),o)}catch(e){registerFail();return err('Current password is wrong.')}
    SALT=crypto.getRandomValues(new Uint8Array(16));CUR_IT=ITER;CK=await deriveKey(n,SALT,ITER);await writeEnc();closeModal();toast('Password changed 🔒')};
}
/* ---------- actions ---------- */
function newNote(){const nb=filterNb||S.notebooks[0].id;const n={id:uid(),nb,title:'',body:'',pinned:false,updated:Date.now()};S.notes.push(n);selNote=n.id;query='';$('#search').value='';save();go('notes');setTimeout(()=>$('#edTitle')?.focus(),20)}
$('#newNoteBtn').onclick=newNote;
$('#search').oninput=e=>{query=e.target.value;if(view!=='notes')go('notes');else renderNotes()};
$('#backupBtn').onclick=backupModal;
$('#lockBtn').onclick=lockNow;
$('#secBtn').onclick=securityModal;
$('#quickTask').onkeydown=e=>{if(e.key==='Enter'&&e.target.value.trim()){S.tasks.push({id:uid(),title:e.target.value.trim(),col:'todo',nb:S.notebooks[0].id});e.target.value='';save();render();$('#quickTask').focus()}};
$('#quickEvent').onclick=()=>{const h=Math.min(Math.max(new Date().getHours()+1,7),22);eventModal(null,iso(new Date()),h)};
$('#themeBtn').onclick=()=>{const r=document.documentElement,t=r.dataset.theme==='dark'?'light':'dark';r.dataset.theme=t;
  try{localStorage.setItem('rymeNotes.theme2',t)}catch(e){}document.querySelector('meta[name=theme-color]').content=t==='dark'?'#050b1d':'#6c5ce7';render()};
$('#prevWk').onclick=()=>{weekOffset--;render()};$('#nextWk').onclick=()=>{weekOffset++;render()};$('#thisWk').onclick=()=>{weekOffset=0;render()};

document.addEventListener('click',e=>{
  const t=e.target;let el;
  if(el=t.closest('[data-editnb]')){e.stopPropagation();notebookModal(el.dataset.editnb);return}
  if(el=t.closest('[data-donetask]')){const tk=S.tasks.find(x=>x.id===el.dataset.donetask);if(tk){S.tasks=S.tasks.filter(x=>x!==tk);tk.col='done';S.tasks.push(tk);save();render();toast('Nice! Task done ✓')}return}
  if(el=t.closest('[data-deltask]')){S.tasks=S.tasks.filter(x=>x.id!==el.dataset.deltask);save();render();return}
  if(el=t.closest('.nav[data-view]')){filterNb=null;go(el.dataset.view);return}
  if(el=t.closest('[data-go]')){filterNb=null;go(el.dataset.go);return}
  if(el=t.closest('[data-nb]')){filterNb=el.dataset.nb;selNote=null;go('notes');return}
  if(t.closest('#addNbSide,#addNbCard')){notebookModal();return}
  if(el=t.closest('[data-note]')){selNote=el.dataset.note;if(view!=='notes'){filterNb=null;go('notes')}else renderNotes();return}
  if(el=t.closest('.ev')){eventModal(S.events.find(x=>x.id===el.dataset.ev));return}
  if(el=t.closest('.cell')){eventModal(null,el.dataset.day,+el.dataset.hour);return}
});
document.addEventListener('keydown',e=>{
  const i=e.target;if(i.dataset&&i.dataset.addcol&&e.key==='Enter'&&i.value.trim()){
    const nb=filterNb||S.notebooks[0].id;S.tasks.push({id:uid(),title:i.value.trim(),col:i.dataset.addcol,nb});save();const k=i.dataset.addcol;render();
    document.querySelector(`[data-addcol="${k}"]`)?.focus()}
  if(S&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'&&!$('#modal').classList.contains('open')){e.preventDefault();newNote()}
});
/* drag & drop */
let dragId=null;
document.addEventListener('dragstart',e=>{const t=e.target.closest?.('.task');if(t){dragId=t.dataset.task;t.classList.add('dragging');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragId)}catch(_){}}});
document.addEventListener('dragend',e=>{document.querySelectorAll('.dragging,.over').forEach(x=>x.classList.remove('dragging','over'))});
document.addEventListener('dragover',e=>{const c=e.target.closest?.('.col');if(c&&dragId){e.preventDefault();document.querySelectorAll('.over').forEach(x=>x!==c&&x.classList.remove('over'));c.classList.add('over')}});
document.addEventListener('drop',e=>{const c=e.target.closest?.('.col');if(c&&dragId){e.preventDefault();const t=S.tasks.find(x=>x.id===dragId);
  if(t){S.tasks=S.tasks.filter(x=>x!==t);t.col=c.dataset.col;S.tasks.push(t);save();render();if(t.col==='done')toast('Nice! Task done ✓')}}dragId=null});

function purgeEmpty(){const keep=view==='notes'?selNote:null;const before=S.notes.length;
  S.notes=S.notes.filter(n=>n.id===keep||n.title.trim()||n.body.trim());if(S.notes.length!==before)save()}
function render(){if(!S)return;purgeEmpty();renderSide();
  if(view==='home'){renderDash();renderCards();renderRecent()}
  if(view==='notes')renderNotes();
  if(view==='board')renderBoard($('#boardFull'),false);
  if(view==='planner')renderGrid($('#gridFull'),weekOffset,false);
}
window.addEventListener('resize',()=>{if(view==='home'||view==='planner')render()});
setInterval(()=>{if(view==='home'||view==='planner')render()},60000);
lockUI(readEnc()?'unlock':'create');

/* desktop install (works when hosted on https, e.g. GitHub Pages) */
if('serviceWorker' in navigator&&location.protocol==='https:'&&!/claude/.test(location.hostname)){try{navigator.serviceWorker.register('sw.js').catch(()=>{})}catch(e){}}
