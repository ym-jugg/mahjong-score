(function(){
const KEY='jansou-scorebook-v1';
const WINDS=['東','南','西','北'];
const RANKK=['一','二','三','四'];
const UMA={
  4:{none:[0,0,0,0],'5-10':[10,5,-5,-10],'10-20':[20,10,-10,-20],'10-30':[30,10,-10,-30],'20-30':[30,20,-20,-30]},
  3:{none:[0,0,0],'10':[10,0,-10],'20':[20,0,-20],'10-20':[20,10,-30]}
};
const UMA_LBL={none:'なし','5-10':'5-10','10-20':'10-20','10-30':'10-30','20-30':'20-30','10':'±10','20':'±20',custom:'自由入力'};
const UMA_LBL3={'10-20':'+20/+10/-30'};
const TIE_LBL={kicha:'起家優先',kamicha:'上家取り',split:'分け合い'};
const TIE_HINT={
  kicha:'同点なら起家に近い席（東→南→西→北）の人が上位になります。',
  kamicha:'同点の2人が隣り合う席なら、上家（先にツモる側）が上位。例：東と北が同点なら北が上位。対面同士や3人以上の同点は起家に近い人が上位です。',
  split:'同点の人で、その順位のウマを等分します。トップ同点ならオカもトップ分を等分します。'
};

function defaults(n){
  return {players:n,rate:'1',start:n===4?25000:35000,ret:n===4?30000:40000,round:'gosha',tie:'kicha',
    uma:n===4?'10-30':'10',umaCustom:n===4?[30,10,-10,-30]:[15,0,-15],
    chipInit:20,chipPt:2,tobi:false,tobiPt:10,tobiAt:'neg',kuitan:true,atozuke:true};
}
const idSeat=n=>[...Array(n).keys()];
function sample(){
  return {sample:true,rules:defaults(4),names:['たろう','はなこ','けんじ','みさき'],chips:[23,18,21,18],view:'game',draft:{},
    seat:[2,3,0,1],
    games:[
      {id:1,seat:[0,1,2,3],pts:[41200,28900,18600,11300],t:Date.now()-5400000},
      {id:2,seat:[1,3,2,0],pts:[22300,-3400,47900,33200],t:Date.now()-2700000}
    ]};
}
// ---- 保存場所：この端末だけのデータ（KEY）と、共有の卓ごとのキャッシュ（KEY:t:卓ID）----
const ACTIVE=KEY+':active', tKey=id=>KEY+':t:'+id;
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k,v); }catch(e){} }
function loadJSON(k){ try{ return JSON.parse(lsGet(k)); }catch(e){ return null; } }
function blankTable(id,name){ return {rules:defaults(4),names:[],chips:[],members:4,view:'game',draft:{},games:[],cloud:{id,name:name||''}}; }
const params=new URLSearchParams(location.search);
const VIEW_TOKEN=params.get('view');           // 閲覧専用リンク
const RO=!!VIEW_TOKEN;
let S;
function normalize(){
  if(!S||!S.rules) S=sample();
  S.draft=S.draft||{}; S.games=S.games||[]; S.fee=S.fee||{total:0,mode:'equal'};
  S.archives=S.archives||[];
  // ゴミ箱（この端末だけのデータ用）：30日を過ぎたものは消す
  S.trash=(S.trash||[]).filter(x=>Date.now()-x.at<30*864e5); S.names=S.names||[]; S.chips=S.chips||[];
  S.rules.tie=S.rules.tie||'kicha';
  if(S.rules.tobi==null){ S.rules.tobi=false; S.rules.tobiPt=10; S.rules.tobiAt='neg'; }
  // 旧形式（起家だけ保存）からの移行
  S.games.forEach(g=>{ if(!g.seat){ const n=g.pts.length,d=g.dealer||0; g.seat=g.pts.map((_,p)=>(p-d+n)%n); delete g.dealer; } });
  // メンバーは卓の人数〜6人。卓に入らない人は席が -1（抜け番）
  S.members=Math.min(6,Math.max(S.rules.players,S.members||S.names.filter(x=>x).length||S.rules.players));
  while(S.names.length<6) S.names.push('');
  if(!validSeat(S.seat)) S.seat=defaultSeat();
  // 持ち点の入力は点数そのまま（25000）。以前の百点単位の入力途中データは消す
  if(S.draftV!==2&&S.draftV!==3){ S.draft={}; S.draftV=2; }
  // 符号を別に持っていた入力途中データを、符号つきの値にまとめる
  if(S.draftV===2){ Object.keys(S.draft).forEach(k=>{ const m=/^p(\d+)$/.exec(k); if(m&&S.draft['s'+m[1]]&&S.draft[k]!=='') S.draft[k]='-'+S.draft[k]; });
    Object.keys(S.draft).forEach(k=>{ if(/^s\d+$/.test(k)) delete S.draft[k]; }); S.draftV=3; }
}
function defaultSeat(){ return idSeat(S.members).map(i=>i<S.rules.players?i:-1); }
function validSeat(a){ if(!Array.isArray(a)||a.length!==S.members) return false; const n=S.rules.players;
  return a.every(w=>w===-1||(w>=0&&w<n))&&idSeat(n).every(w=>a.filter(x=>x===w).length<=1); }
if(RO){ S=blankTable('',''); S.view='total'; }
else {
  const act=Cloud.configured?lsGet(ACTIVE):null;
  S=act?(loadJSON(tKey(act))||blankTable(act)):loadJSON(KEY);
  if(act&&S&&!S.cloud) S.cloud={id:act,name:''};
}
normalize();
function save(){
  if(RO) return;
  lsSet(S.cloud?tKey(S.cloud.id):KEY,JSON.stringify(S));
  if(S.cloud) Sync.pushState();
}

const $=id=>document.getElementById(id);
const N=()=>S.rules.players;
const M=()=>S.members;
const names=()=>S.names.slice(0,M());
const seated=()=>idSeat(M()).filter(p=>S.seat[p]>=0);
const seatOK=()=>idSeat(N()).every(w=>S.seat.filter(x=>x===w).length===1);
const rate=()=>Number(S.rules.rate)||0;
const RATE_PRESETS=['0.5','0.75','1','2'];
const rateYen=()=>Math.round(rate()*1000)/10;   // 1000点あたりの円（0.75→75）
const umaArr=()=>S.rules.uma==='custom'?S.rules.umaCustom.slice(0,N()).map(Number):UMA[N()][S.rules.uma]||UMA[N()].none;
const oka=()=>(S.rules.ret-S.rules.start)*N()/1000;

function toPt(diff){
  const r=S.rules.round, sg=diff<0?-1:1, a=Math.abs(diff);
  if(r==='none') return sg*a/1000;
  const k=Math.floor(a/1000), rem=a-k*1000;
  let v=k;
  if(r==='gosha'&&rem>=600) v=k+1;
  if(r==='shisha'&&rem>=500) v=k+1;
  return sg*v;
}
const fix=v=>Math.round(v*10)/10;
const tobiPt=()=>S.rules.tobi?(Number(S.rules.tobiPt)||0):0;
const isBust=v=>S.rules.tobiAt==='zero'?v<=0:v<0;

/* 1半荘の計算：順位・同点処理・ウマ・オカ */
function calc(g){
  // その半荘に入っていた人だけで計算（抜け番は対象外）
  const L=g.pts.length, seat=g.seat, P=idSeat(L).filter(i=>seat[i]!=null&&seat[i]>=0&&g.pts[i]!=null);
  const n=P.length, u=umaArr(), tie=S.rules.tie;
  let order=P.slice().sort((a,b)=>g.pts[b]-g.pts[a]||seat[a]-seat[b]);
  // 同点グループ
  const groups=[]; order.forEach(p=>{ const last=groups[groups.length-1]; if(last&&g.pts[last[0]]===g.pts[p]) last.push(p); else groups.push([p]); });
  if(tie==='kamicha'){
    groups.forEach(gr=>{ if(gr.length===2){ const [a,b]=gr;
      if((seat[b]+1)%n===seat[a]&&(seat[a]+1)%n!==seat[b]){ gr[0]=b; gr[1]=a; } } });
    order=groups.flat();
  }
  const rank=Array(L).fill(null), score=Array(L).fill(null), tied=new Set();
  let idx=0; const shared=[];
  groups.forEach(gr=>{
    if(gr.length>1) gr.forEach(p=>tied.add(p));
    if(tie==='split'){
      const avg=u.slice(idx,idx+gr.length).reduce((a,b)=>a+b,0)/gr.length;
      gr.forEach(p=>{ rank[p]=idx; shared[p]=avg; });
    } else gr.forEach((p,k)=>{ rank[p]=idx+k; shared[p]=u[idx+k]; });
    idx+=gr.length;
  });
  const topGroup=(tie==='split')?groups[0]:[order[0]];
  let others=0;
  order.forEach(p=>{ if(topGroup.includes(p)) return; score[p]=fix(toPt(g.pts[p]-S.rules.ret)+shared[p]); others+=score[p]; });
  const topTotal=-others; let given=0;
  topGroup.forEach((p,k)=>{ score[p]=k<topGroup.length-1?fix(topTotal/topGroup.length):fix(topTotal-given); given+=score[p]; });
  // 飛び賞：飛んだ人から飛ばした人へ
  const T=tobiPt(), tobi=[];
  if(T&&g.tobi) Object.entries(g.tobi).forEach(([p,b])=>{ p=Number(p); if(b==null||b==='none') return; b=Number(b);
    score[p]=fix(score[p]-T); score[b]=fix(score[b]+T); tobi.push([p,b]); });
  return {rank,score,order,tied,tobi,out:idSeat(L).filter(i=>!P.includes(i))};
}
const fmtPt=v=>{ v=fix(v); const s=Number.isInteger(v)?String(Math.abs(v)):Math.abs(v).toFixed(1); return (v>0?'+':v<0?'−':'±')+s; };
const cls=v=>v>0?'pos':v<0?'neg':'';
const yen=pt=>Math.round(pt*rate()*100);
const fmtYen=v=>(v>0?'+':v<0?'−':'±')+Math.abs(v).toLocaleString('ja-JP')+'円';
const fmtPts=v=>(v<0?'−':'')+Math.abs(v).toLocaleString('ja-JP');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nameOf=i=>S.names[i]&&S.names[i].trim()?S.names[i].trim():'メンバー'+(i+1);
const blur=()=>{ if(document.activeElement&&document.activeElement!==document.body) document.activeElement.blur(); };

function unsample(){ if(S.sample){ S.sample=false; $('sampleBanner').hidden=true; } }

/* ---------- header ---------- */
function renderHeader(){
  const r=S.rules, u=umaArr();
  $('modeLbl').textContent=(N()===4?'4人':'3人')+(M()>N()?`（${M()}人回し）`:'')+'・'+S.games.length+'半荘';
  const umaTxt=r.uma==='none'?'なし':(r.uma==='custom'?u.map(x=>x>0?'+'+x:x).join('/'):(UMA_LBL3[r.uma]&&N()===3?UMA_LBL3[r.uma]:UMA_LBL[r.uma]));
  $('ruleChips').innerHTML=[
    `<span class="chip">レート <b>${r.rate}</b></span>`,
    `<span class="chip"><b>${(r.start/1000)}</b>持ち<b>${(r.ret/1000)}</b>返し</span>`,
    `<span class="chip">ウマ <b>${esc(umaTxt)}</b></span>`,
    `<span class="chip">同点 <b>${TIE_LBL[r.tie]}</b></span>`,
    `<span class="chip">チップ <b>${r.chipInit}</b>枚・1枚<b>${r.chipPt}</b>pt</span>`,
    r.tobi?`<span class="chip">飛び賞 <b>${r.tobiPt}</b>pt</span>`:`<span class="chip off">飛び賞</span>`,
    `<span class="chip ${r.kuitan?'on':'off'}">喰いタン</span>`,
    `<span class="chip ${r.atozuke?'on':'off'}">後付け</span>`
  ].join('');
  $('sampleBanner').hidden=!S.sample||RO;
  const cs=$('cloudState');
  if(RO){ cs.hidden=false; cs.className='cloudbar ro'; cs.innerHTML=`<b>閲覧専用</b>${S.viewName?`「${esc(S.viewName)}」`:''}・自動で更新されます${S.viewErr?`<span class="err">${esc(S.viewErr)}</span>`:''}`; }
  else if(S.cloud){ const p=Sync.pendingCount(); cs.hidden=false; cs.className='cloudbar'+(p?' warn':'');
    cs.innerHTML=`<b>共有中</b>「${esc(S.cloud.name||'卓')}」・${p?`未送信${p}件（通信が戻ると送ります）`:(Sync.online()?'同期しています':'オフライン')}`; }
  else cs.hidden=true;
}

/* ---------- rules ---------- */
function setSeg(el,v){ el.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===String(v)))); }
function renderRules(){
  const r=S.rules;
  setSeg($('segPlayers'),r.players); setSeg($('segRate'),r.rateCustom||!RATE_PRESETS.includes(String(r.rate))?'custom':String(r.rate));
  $('rateCustomRow').hidden=!(r.rateCustom||!RATE_PRESETS.includes(String(r.rate)));
  if(document.activeElement!==$('inRateYen')) $('inRateYen').value=rateYen(); setSeg($('segRound'),r.round); setSeg($('segTie'),r.tie);
  $('tieHint').textContent=TIE_HINT[r.tie];
  $('rateHint').textContent=`1000点＝${rateYen().toLocaleString('ja-JP')}円（1pt＝${rateYen().toLocaleString('ja-JP')}円）。例：+50ptなら${fmtYen(yen(50))}`;
  if(document.activeElement!==$('inStart')) $('inStart').value=r.start;
  if(document.activeElement!==$('inRet')) $('inRet').value=r.ret;
  $('okaHint').textContent=oka()>0?`オカ：トップに +${fix(oka())}pt（${fmtYen(yen(oka()))}）`:oka()<0?'返し点が持ち点より低い設定です':'オカなし';
  const keys=[...Object.keys(UMA[N()]),'custom'];
  $('segUma').innerHTML=keys.map(k=>`<button type="button" data-v="${k}">${N()===3&&UMA_LBL3[k]?UMA_LBL3[k]:UMA_LBL[k]}</button>`).join('');
  setSeg($('segUma'),r.uma);
  $('umaCustom').hidden=r.uma!=='custom';
  $('umaFields').className=N()===4?'grid4':'grid3';
  if(!$('umaFields').contains(document.activeElement)){
    $('umaFields').innerHTML=r.umaCustom.slice(0,N()).map((v,i)=>`<div><div class="mini">${i+1}着</div><label class="field"><input id="uma${i}" data-i="${i}" inputmode="numeric" value="${v}" aria-label="${i+1}着のウマ"><span class="unit">pt</span></label></div>`).join('');
  }
  const us=r.umaCustom.slice(0,N()).reduce((a,b)=>a+Number(b||0),0);
  $('umaWarn').hidden=us===0; $('umaWarn').textContent=`合計が${us>0?'+':''}${us}ptです。0になるように入力してください（ずれはトップで調整されます）。`;
  $('umaHint').textContent=umaArr().map((x,i)=>`${i+1}着 ${x>0?'+':''}${x}`).join('　');
  if(document.activeElement!==$('inChipInit')) $('inChipInit').value=r.chipInit;
  if(document.activeElement!==$('inChipPt')) $('inChipPt').value=r.chipPt;
  $('chipHint').textContent=`1枚＝${fix(r.chipPt)}pt＝${(yen(Number(r.chipPt)||0)).toLocaleString('ja-JP')}円`;
  $('swTobi').setAttribute('aria-checked',String(!!r.tobi));
  $('tobiPtRow').hidden=!r.tobi; $('tobiAtRow').hidden=!r.tobi;
  if(document.activeElement!==$('inTobiPt')) $('inTobiPt').value=r.tobiPt;
  setSeg($('segTobiAt'),r.tobiAt);
  $('tobiHint').textContent=`飛んだ人が−${fix(Number(r.tobiPt)||0)}pt（${fmtYen(-yen(Number(r.tobiPt)||0))}）、飛ばした人が+${fix(Number(r.tobiPt)||0)}pt。`;
  $('swKuitan').setAttribute('aria-checked',String(r.kuitan));
  $('swAto').setAttribute('aria-checked',String(r.atozuke));
}
function bindSeg(el,fn){ el.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b){ fn(b.dataset.v); update(); } }); }
bindSeg($('segPlayers'),v=>{
  v=Number(v); if(v===N()) return;
  const k=S.rules; S.rules=Object.assign(defaults(v),{rate:k.rate,round:k.round,tie:k.tie,chipInit:k.chipInit,chipPt:k.chipPt,kuitan:k.kuitan,atozuke:k.atozuke});
  S.members=Math.max(v,S.members); S.games=[]; S.chips=[]; S.draft={}; S.seat=defaultSeat(); unsample();
});
bindSeg($('segRate'),v=>{ if(v==='custom'){ S.rules.rateCustom=true; setTimeout(()=>$('inRateYen').focus(),0); } else { S.rules.rateCustom=false; S.rules.rate=v; } });
$('inRateYen').addEventListener('input',e=>{ const v=parseFloat(e.target.value.replace(/[^0-9.]/g,'')); if(v>0){ S.rules.rate=String(Math.round(v*10)/1000); update(); } });
bindSeg($('segRound'),v=>{S.rules.round=v;});
bindSeg($('segTie'),v=>{S.rules.tie=v;});
bindSeg($('segUma'),v=>{S.rules.uma=v;});
function numIn(id,key,isFloat){ $(id).addEventListener('input',e=>{ const v=isFloat?parseFloat(e.target.value):parseInt(e.target.value,10); if(!isNaN(v)){ S.rules[key]=v; update(); } }); }
numIn('inStart','start'); numIn('inRet','ret'); numIn('inChipInit','chipInit'); numIn('inChipPt','chipPt',true);
$('umaFields').addEventListener('input',e=>{ const i=e.target.dataset.i; if(i==null) return; const v=parseInt(e.target.value.replace('−','-'),10); S.rules.umaCustom[i]=isNaN(v)?0:v; update(); });
$('swTobi').addEventListener('click',()=>{S.rules.tobi=!S.rules.tobi;update();});
numIn('inTobiPt','tobiPt',true);
bindSeg($('segTobiAt'),v=>{S.rules.tobiAt=v;});
$('swKuitan').addEventListener('click',()=>{S.rules.kuitan=!S.rules.kuitan;update();});
$('swAto').addEventListener('click',()=>{S.rules.atozuke=!S.rules.atozuke;update();});

/* ---------- players ---------- */
function usedMembers(){ return S.games.reduce((m,g)=>{ g.seat.forEach((w,i)=>{ if(w>=0) m=Math.max(m,i+1); }); return m; },0); }
function renderPlayers(){
  const used=usedMembers();
  $('segMembers').innerHTML=[3,4,5,6].filter(k=>k>=N()).map(k=>`<button type="button" data-v="${k}" ${k<used?'disabled':''}>${k}人</button>`).join('');
  setSeg($('segMembers'),M());
  $('memHint').textContent=(M()>N()?`${N()}人で打ち、毎回${M()-N()}人が抜け番になります。抜け番は半荘ごとに対局画面で選びます。`:'全員が毎回卓に入ります。')
    +(used>N()?`（記録に${used}人目まで入っているので、それより少なくはできません）`:'');
  if($('seatList').contains(document.activeElement)) return;
  $('seatList').innerHTML=names().map((nm,i)=>`<div class="seat"><span class="num-b">${i+1}</span><label class="field"><input class="txt" id="name${i}" data-i="${i}" value="${esc(nm)}" placeholder="メンバー${i+1}の名前" maxlength="12" aria-label="メンバー${i+1}の名前"></label>${meButton(i)}</div>`).join('');
  $('meMsg').textContent=meMsg;
}
// 「自分」の欄：共有の卓はアカウントごと、この端末だけのデータは端末に保存
let meMsg='';
function claimMap(){ const m={}; if(S.cloud) (Sync.members||[]).forEach(x=>{ if(x.slot!=null) m[x.slot]={mine:Sync.user&&x.user_id===Sync.user.id,name:x.display_name||'ほかの人'}; }); return m; }
function meButton(i){
  if(S.cloud){ const c=claimMap()[i];
    if(c&&!c.mine) return `<span class="claimed" title="${esc(c.name)}さんが「自分」に選んでいます">${esc(c.name)}</span>`;
    return `<button type="button" class="mebtn" data-me="${i}" aria-pressed="${!!(c&&c.mine)}" ${Sync.user?'':'disabled'}>自分</button>`; }
  return `<button type="button" class="mebtn" data-me="${i}" aria-pressed="${S.me===i}">自分</button>`;
}
$('seatList').addEventListener('click',async e=>{
  const b=e.target.closest('[data-me]'); if(!b) return; const i=Number(b.dataset.me); blur(); meMsg='';
  if(!S.cloud){ S.me=S.me===i?null:i; save(); statsData=null; renderPlayers(); return; }
  const mine=b.getAttribute('aria-pressed')==='true'; b.disabled=true;
  try{ await Cloud.claimSlot(S.cloud.id,mine?null:i); await Sync.reloadMembers(); statsData=null; }
  catch(err){ meMsg=err.message; }
  renderPlayers();
});
$('segMembers').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b||b.disabled) return;
  const k=Number(b.dataset.v); if(k===M()) return;
  S.members=k;
  const ns=S.seat.slice(0,k); while(ns.length<k) ns.push(-1);
  S.seat=validSeat(ns)?ns:defaultSeat();
  S.chips=[]; unsample(); update(); });
$('seatList').addEventListener('input',e=>{ const i=e.target.dataset.i; if(i==null) return; S.names[i]=e.target.value; unsample(); renderHeader(); save(); });

/* ---------- game entry ---------- */
// 持ち点：未入力の人は配給原点（25000など）のまま。入力した人だけ draft に値が入る
const touched=i=>{ const d=S.draft['p'+i]; return d!=null&&d!==''&&d!=='-'&&!isNaN(parseInt(d,10)); };
function parseDraft(i){ return touched(i)?parseInt(S.draft['p'+i],10):S.rules.start; }
/* −／＋で100点ずつ増減する入力欄（長押しで連続、続けると1000点ずつ） */
function stepperHTML(key,val,isDef,label,cmp){
  return `<div class="stp ${isDef?'def':''} ${cmp?'cmp':''}" data-k="${key}">
    <button type="button" class="stb" data-d="-100" aria-label="${label}を100点減らす">−</button>
    <div class="stv"><button type="button" class="sgn" data-sgn="1" aria-label="${label}のプラスとマイナスを切り替え">±</button><input id="${key.replace(':','_')}" inputmode="numeric" autocomplete="off" value="${val}" aria-label="${label}の持ち点"><span class="zz">点</span></div>
    <button type="button" class="stb" data-d="100" aria-label="${label}を100点増やす">＋</button></div>`;
}
let hold=null;
function stopHold(){ if(hold){ clearTimeout(hold.t); hold=null; } }
['pointerup','pointercancel','blur'].forEach(ev=>addEventListener(ev,stopHold));
function bindStepper(box,get,set){
  const apply=(stp,d)=>{ const k=stp.dataset.k, v=get(k)+d; set(k,v); const inp=stp.querySelector('input'); if(document.activeElement!==inp) inp.value=v; stp.classList.remove('def'); };
  // 押した瞬間には動かさない：指を離したタップで1回、指を止めて長押ししたときだけ連続。
  // スクロール（指が動いた）ときは何もしない
  let start=null, held=false;
  const cancel=()=>{ stopHold(); start=null; };
  box.addEventListener('pointerdown',e=>{
    const b=e.target.closest('.stb'); if(!b) return;
    cancel(); held=false; start={x:e.clientX,y:e.clientY};
    const stp=b.closest('.stp'), d=Number(b.dataset.d);
    let n=0; hold={t:setTimeout(function tick(){ held=true; n++; apply(stp,n>12?d*10:d); hold.t=setTimeout(tick,n>12?120:80); },500)};
  });
  box.addEventListener('pointermove',e=>{ if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8) cancel(); });
  box.addEventListener('pointerleave',e=>{ if(e.target.closest&&e.target.closest('.stb')) cancel(); },true);
  addEventListener('scroll',cancel,{passive:true,capture:true});
  box.addEventListener('contextmenu',e=>{ if(e.target.closest('.stb')) e.preventDefault(); });
  box.addEventListener('click',e=>{
    const b=e.target.closest('.stb');
    if(b){ start=null; if(held){ held=false; return; } blur(); apply(b.closest('.stp'),Number(b.dataset.d)); return; }
    const s=e.target.closest('[data-sgn]'); if(!s) return;
    const stp=s.closest('.stp'); apply(stp,-2*get(stp.dataset.k));
  });
  box.addEventListener('input',e=>{
    const stp=e.target.closest('.stp'); if(!stp) return;
    let t=e.target.value.replace(/[−ー－]/g,'-').replace(/[^0-9-]/g,''); t=(t.startsWith('-')?'-':'')+t.replace(/-/g,'');
    e.target.value=t; stp.classList.remove('def'); set(stp.dataset.k,t);
  });
}
function renderEntry(){
  $('nextTitle').textContent=`第${S.games.length+1}半荘の持ち点`;
  if($('entryList').contains(document.activeElement)) { checkSum(); return; }
  const n=N(), rot=M()>n;
  $('entryList').innerHTML=idSeat(M()).map(i=>{ const out=S.seat[i]<0;
    const winds=idSeat(n).map(w=>`<button type="button" class="wb ${w===0?'red':''}" data-p="${i}" data-w="${w}" aria-pressed="${S.seat[i]===w}" aria-label="${esc(nameOf(i))}を${WINDS[w]}家にする">${WINDS[w]}</button>`).join('')
      +(rot?`<button type="button" class="wb nuke" data-p="${i}" data-w="-1" aria-pressed="${out}" aria-label="${esc(nameOf(i))}を抜け番にする">抜</button>`:'');
    const pin=out?`<div class="pin outpin">抜け番</div>`
      :stepperHTML('pt:'+i,parseDraft(i),!touched(i),esc(nameOf(i)),true);
    return `<div class="entry ${out?'isout':''}"><div class="nm">${esc(nameOf(i))}</div><div class="winds">${winds}</div>${pin}</div>`;}).join('');
  checkSum();
}
function checkSum(){
  const n=N(), vals=seated().map(parseDraft), edited=seated().filter(touched).length;
  const target=S.rules.start*n, sum=vals.reduce((a,b)=>a+(b||0),0), diff=sum-target;
  const el=$('sumCheck');
  if(!seatOK()){ el.className='check ng'; el.innerHTML=`<span>席が決まっていません</span><span>${idSeat(n).map(w=>WINDS[w]).join('')}を1人ずつ選んでください</span>`; $('saveGame').disabled=true; $('autoFill').disabled=true; renderTobi(); return; }
  if(!edited){ el.className='check'; el.innerHTML=`<span>まだ入力されていません</span><span>−／＋か数字で入力</span>`; }
  else if(diff===0){ el.className='check ok'; el.innerHTML=`<span>合計 <span class="num">${fmtPts(sum)}</span>点</span><span>一致しています</span>`; }
  else { el.className='check ng'; el.innerHTML=`<span>合計 <span class="num">${fmtPts(sum)}</span>点</span><span>${diff>0?'':'あと'}<span class="num">${fmtPts(Math.abs(diff))}</span>点${diff>0?'多い':'足りない'}</span>`; }
  const tobiOk=renderTobi();
  $('saveGame').disabled=!(edited>0&&diff===0&&tobiOk);
  $('autoFill').disabled=edited!==n-1;
}
bindStepper($('entryList'),k=>parseDraft(Number(k.split(':')[1])),(k,v)=>{ S.draft['p'+k.split(':')[1]]=String(v); checkSum(); save(); });
$('entryList').addEventListener('click',e=>{
  const w=e.target.closest('[data-w]');
  if(w){ // 席を入れ替え：選んだ風の人と交換
    const p=Number(w.dataset.p), nw=Number(w.dataset.w);
    if(nw<0){ S.seat[p]=-1; }            // 抜け番にする（空いた風は別の人を選ぶ）
    else { const q=S.seat.indexOf(nw); if(q>=0&&q!==p) S.seat[q]=S.seat[p]; S.seat[p]=nw; }
    unsample(); blur(); renderEntry(); if(scan) renderScan(); save(); return;
  }
});
/* 飛び賞：飛んだ人ごとに「飛ばした人」を選ぶ。全員選び終わるまで記録できない */
function bustedInDraft(){ return S.rules.tobi?seated().filter(p=>touched(p)&&isBust(parseDraft(p))):[]; }
function renderTobi(){
  const busted=bustedInDraft(), box=$('tobiBox');
  S.draft.tobi=S.draft.tobi||{};
  Object.keys(S.draft.tobi).forEach(p=>{ if(!busted.includes(Number(p))) delete S.draft.tobi[p]; });
  box.hidden=!busted.length;
  if(!busted.length){ box.innerHTML=''; return true; }
  const T=fix(tobiPt());
  box.innerHTML=busted.map(p=>{ const sel=S.draft.tobi[p];
    const opts=seated().filter(q=>q!==p).map(q=>`<button type="button" data-tb="${p}" data-v="${q}" aria-pressed="${String(sel)===String(q)}">${esc(nameOf(q))}</button>`).join('')
      +`<button type="button" data-tb="${p}" data-v="none" aria-pressed="${sel==='none'}">なし</button>`;
    return `<div><div class="q"><b>${esc(nameOf(p))}</b>が飛び（−${T}pt）。飛ばしたのは？</div><div class="seg">${opts}</div></div>`; }).join('')
    +'<div class="hint">「なし」は流局の罰符などで飛んだとき用です（飛び賞は移動しません）。</div>';
  return busted.every(p=>S.draft.tobi[p]!=null);
}
$('tobiBox').addEventListener('click',e=>{ const b=e.target.closest('[data-tb]'); if(!b) return;
  S.draft.tobi=S.draft.tobi||{}; S.draft.tobi[b.dataset.tb]=b.dataset.v==='none'?'none':Number(b.dataset.v); checkSum(); save(); });
$('autoFill').addEventListener('click',()=>{
  const n=N(), ps=seated(), left=ps.filter(p=>!touched(p)); if(left.length!==1) return;
  const miss=left[0], rest=S.rules.start*n-ps.filter(p=>p!==miss).reduce((a,p)=>a+parseDraft(p),0);
  S.draft['p'+miss]=String(rest);
  blur(); renderEntry(); save();
});
$('clearEntry').addEventListener('click',()=>{ S.draft={}; blur(); renderEntry(); save(); });
let freshId=null;
$('saveGame').addEventListener('click',()=>{
  if(!seatOK()) return;
  const pts=idSeat(M()).map(p=>S.seat[p]>=0?parseDraft(p):null);
  if(!seated().some(touched)) return;
  unsample();
  const id=S.cloud?uuid():(S.games.reduce((m,g)=>Math.max(m,Number(g.id)||0),0))+1;
  const tobi={}; bustedInDraft().forEach(p=>{ tobi[p]=S.draft.tobi[p]; });
  const game={id,seat:S.seat.slice(),pts,t:Date.now(),...(Object.keys(tobi).length?{tobi}:{})};
  S.games.push(game);
  freshId=id; S.draft={};
  blur(); update();
  if(S.cloud) Sync.addGame(game);
});

/* ---------- history ---------- */
let confirmDel=null;
function renderGames(){
  $('gameCount').textContent=S.games.length?`${S.games.length}半荘`:'';
  if(!S.games.length){ $('gameList').innerHTML='<div class="panel empty">まだ記録がありません。上で席と持ち点を入れて記録してください。</div>'; return; }
  $('gameList').innerHTML=S.games.slice().reverse().map((g,ri)=>{
    const no=S.games.length-ri, c=calc(g), dealer=g.seat.indexOf(0);
    const rows=c.order.map(p=>`<div class="r"><span class="tile sm">${RANKK[c.rank[p]]}</span><span>${esc(nameOf(p))}<span class="wind">${WINDS[g.seat[p]]}</span>${c.tied.has(p)?'<span class="tieNote">同点</span>':''}${c.tobi.some(([x])=>x===p)?'<span class="tieNote">飛び</span>':''}</span><span class="raw">${fmtPts(g.pts[p])}</span><span class="pt ${cls(c.score[p])}">${fmtPt(c.score[p])}</span></div>`).join('');
    const tm=new Date(g.t); const hm=tm.getHours()+':'+String(tm.getMinutes()).padStart(2,'0');
    return `<article class="game ${String(g.id)===String(freshId)?'fresh':''}"><header><b>第${no}半荘</b><span class="hint">起家 ${esc(nameOf(dealer))}・${hm}　<button type="button" class="btn danger ro-hide" style="padding:2px 8px;font-size:11px" data-del="${g.id}">削除</button></span></header>
    <div class="res">${rows}</div>${c.out.length?`<div class="hint" style="margin-top:4px">抜け番：${c.out.map(i=>esc(nameOf(i))).join('、')}</div>`:''}${c.tobi.map(([p,b])=>`<div class="tobiLine">飛び賞：${esc(nameOf(p))} → ${esc(nameOf(b))}（${fix(tobiPt())}pt）</div>`).join('')}${c.tied.size?`<div class="hint" style="margin-top:4px">同点は「${TIE_LBL[S.rules.tie]}」で計算</div>`:''}${String(confirmDel)===String(g.id)?`<div class="confirm">この半荘を削除しますか？（30日間はゴミ箱から戻せます）<button type="button" class="btn danger" data-delyes="${g.id}">削除する</button><button type="button" class="btn ghost" data-delno="1">やめる</button></div>`:''}</article>`;
  }).join('');
  freshId=null;
}
$('gameList').addEventListener('click',e=>{
  const d=e.target.closest('[data-del]'), y=e.target.closest('[data-delyes]'), no=e.target.closest('[data-delno]');
  if(d){ confirmDel=d.dataset.del; renderGames(); }
  if(no){ confirmDel=null; renderGames(); }
  if(y){ const id=y.dataset.delyes, g=S.games.find(x=>String(x.id)===id);
    S.games=S.games.filter(x=>String(x.id)!==id); confirmDel=null;
    if(S.cloud) Sync.deleteGame(id); else if(g&&!S.sample) S.trash.unshift({g,at:Date.now()});
    unsample(); update(); if(!$('trashBox').hidden){ trashItems=null; renderTrash(); } }
});

/* ---------- ゴミ箱 ---------- */
let trashItems=null, trashMsg='';
async function loadTrash(){
  if(!S.cloud) return S.trash.map(x=>({g:x.g,at:x.at}));
  const rows=await Cloud.trash(S.cloud.id);
  return rows.map(r=>({g:Object.assign({},r.data,{id:r.id}),at:new Date(r.updated_at).getTime()}));
}
const fmtDT=t=>{ const d=new Date(t); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`; };
function gameLine(g){ const L=g.pts.length; return idSeat(L).filter(i=>g.seat&&g.seat[i]>=0&&g.pts[i]!=null).sort((a,b)=>g.pts[b]-g.pts[a]).map(i=>`${esc(nameOf(i))} ${fmtPts(g.pts[i])}`).join('　'); }
async function renderTrash(){
  const box=$('trashBox'); const first=box.hidden; box.hidden=false; $('trashToggle').textContent='ゴミ箱を閉じる';
  if(first) box.scrollIntoView({behavior:'smooth',block:'start'});
  if(trashItems==null){ box.innerHTML='<div class="hint">読み込み中…</div>';
    try{ trashItems=await loadTrash(); }catch(e){ trashItems=[]; trashMsg='ゴミ箱を読み込めませんでした（通信を確認してください）'; } }
  const msg=trashMsg?`<div class="check ng" style="margin:0 0 8px">${esc(trashMsg)}</div>`:'';
  box.innerHTML=msg+(trashItems.length?trashItems.map((x,i)=>`<div class="trow"><div><b>${fmtDT(x.g.t)}の半荘</b><div class="hint">${gameLine(x.g)}</div><div class="hint">${fmtDT(x.at)}に削除</div></div><button type="button" class="btn ghost" data-restore="${i}">戻す</button></div>`).join('')
    :'<div class="hint">ゴミ箱は空です。</div>')+'<div class="hint" style="margin-top:8px">削除した半荘は30日間ここに残り、「戻す」で記録に戻せます。</div>';
}
$('trashToggle').addEventListener('click',()=>{ if($('trashBox').hidden){ trashItems=null; trashMsg=''; renderTrash(); } else { $('trashBox').hidden=true; $('trashToggle').textContent='ゴミ箱'; } });
$('trashBox').addEventListener('click',async e=>{
  const b=e.target.closest('[data-restore]'); if(!b) return;
  const x=trashItems[Number(b.dataset.restore)]; if(!x) return;
  trashMsg=''; b.disabled=true;
  try{
    if(S.cloud){ const d=Object.assign({},x.g); delete d.id; delete d.archived; await Cloud.setGame(x.g.id,{deleted:false,data:d}); }
    else S.trash=S.trash.filter(t=>String(t.g.id)!==String(x.g.id));
    if(!S.games.some(g=>String(g.id)===String(x.g.id))){ const g=Object.assign({},x.g); delete g.archived; S.games.push(g); S.games.sort((a,b)=>(a.t||0)-(b.t||0)); }
    trashItems.splice(trashItems.indexOf(x),1); freshId=x.g.id; update();
  }catch(err){ trashMsg='戻せませんでした（通信を確認してください）'; }
  renderTrash();
});

/* ---------- totals ---------- */
function computeTotals(){
  const n=M(), r=S.rules;
  const tot=Array(n).fill(0), rk=[...Array(n)].map(()=>Array(N()).fill(0)), outs=Array(n).fill(0);
  S.games.forEach(g=>{ const c=calc(g); c.score.forEach((s,i)=>{ if(i>=n) return; if(s==null){ outs[i]++; return; } tot[i]+=s; if(c.rank[i]!=null) rk[i][c.rank[i]]++; }); });
  const chips=idSeat(n).map(i=>S.chips&&S.chips[i]!=null?S.chips[i]:r.chipInit);
  const chipsFilled=chips.every(v=>v!==''&&v!=null&&!isNaN(v));
  const chipPt=chips.map(c=>chipsFilled?fix((Number(c)-r.chipInit)*r.chipPt):0);
  const all=tot.map((t,i)=>fix(t+chipPt[i]));
  const played=idSeat(n).map(i=>S.games.filter(g=>g.seat&&g.seat[i]>=0&&g.pts[i]!=null).length);
  const feeTotal=Math.max(0,Number(S.fee.total)||0);
  const fee=allocate(feeTotal,S.fee.mode==='games'&&played.some(x=>x>0)?played:idSeat(n).map(()=>1));
  const fin=idSeat(n).map(i=>yen(all[i])-fee[i]);
  return {n,tot,rk,outs,chipPt,all,played,feeTotal,fee,fin};
}
function renderTotal(){
  const n=M(), r=S.rules;
  const tot=Array(n).fill(0), rk=[...Array(n)].map(()=>Array(N()).fill(0)), outs=Array(n).fill(0);
  S.games.forEach(g=>{ const c=calc(g); c.score.forEach((s,i)=>{ if(i>=n) return; if(s==null){ outs[i]++; return; } tot[i]+=s; if(c.rank[i]!=null) rk[i][c.rank[i]]++; }); });
  if(!S.chips||S.chips.length!==n) S.chips=idSeat(n).map(i=>S.chips&&S.chips[i]!=null?S.chips[i]:r.chipInit);
  const chipsFilled=S.chips.every(v=>v!==''&&v!=null&&!isNaN(v));
  const chipPt=S.chips.map(c=>chipsFilled?fix((Number(c)-r.chipInit)*r.chipPt):0);
  const all=tot.map((t,i)=>fix(t+chipPt[i]));
  if(!$('chipFields').contains(document.activeElement)){
    $('chipFields').className=n===3?'grid3':'grid4';
    $('chipFields').innerHTML=names().map((_,i)=>`<div><div class="mini">${esc(nameOf(i))}</div><label class="field"><input id="chip${i}" data-i="${i}" ${RO?'disabled':''} inputmode="numeric" value="${S.chips[i]??''}" aria-label="${esc(nameOf(i))}のチップ枚数"><span class="unit">枚</span></label></div>`).join('');
  }
  const cs=S.chips.reduce((a,b)=>a+(Number(b)||0),0), ct=r.chipInit*n, el=$('chipCheck');
  if(cs===ct){ el.className='check ok'; el.innerHTML=`<span>合計 <span class="num">${cs}</span>枚</span><span>一致しています</span>`; }
  else { el.className='check ng'; el.innerHTML=`<span>合計 <span class="num">${cs}</span> / ${ct}枚</span><span><span class="num">${Math.abs(cs-ct)}</span>枚${cs>ct?'多い':'足りない'}</span>`; }
  // 場代：全員で均等、または打った半荘数で按分して、金額から差し引く
  const played=idSeat(n).map(i=>S.games.filter(g=>g.seat&&g.seat[i]>=0&&g.pts[i]!=null).length);
  const feeTotal=Math.max(0,Number(S.fee.total)||0);
  const fee=allocate(feeTotal,S.fee.mode==='games'&&played.some(x=>x>0)?played:idSeat(n).map(()=>1));
  const fin=idSeat(n).map(i=>yen(all[i])-fee[i]);
  renderFee(fee,played,feeTotal);
  const ord=idSeat(n).sort((a,b)=>fin[b]-fin[a]||all[b]-all[a]);
  $('yenCards').className='big'+(n===3?' three':'');
  $('yenCards').innerHTML=ord.map(i=>`<div class="who"><div class="n">${esc(nameOf(i))}</div><div class="y ${cls(fin[i])}">${fmtYen(fin[i])}</div><div class="p">${fmtPt(all[i])}pt${fee[i]?`・場代 −${fee[i].toLocaleString('ja-JP')}円`:''}</div></div>`).join('');
  const head=`<tr><th>名前<small style="display:block;font-weight:500">着順</small></th><th>半荘</th><th>チップ</th><th>合計pt</th><th>金額${feeTotal?'<small style="display:block;font-weight:500">場代込み</small>':''}</th></tr>`;
  const body=ord.map(i=>`<tr><td class="nm">${esc(nameOf(i))}<small>${rk[i].join('-')}${outs[i]?`・抜${outs[i]}`:''}</small></td><td class="${cls(tot[i])}">${fmtPt(tot[i])}</td><td class="${cls(chipPt[i])}">${fmtPt(chipPt[i])}</td><td class="${cls(all[i])}"><b>${fmtPt(all[i])}</b></td><td class="yen ${cls(fin[i])}">${fmtYen(fin[i])}${fee[i]?`<small class="feeNote">場代 −${fee[i].toLocaleString('ja-JP')}</small>`:''}</td></tr>`).join('');
  $('totalTable').innerHTML=`<thead>${head}</thead><tbody>${body}</tbody>`;
}
// 合計をぴったり保ったまま、重みに応じて円単位で割り振る
function allocate(total,w){
  const W=w.reduce((a,b)=>a+b,0); if(!total||!W) return w.map(()=>0);
  const raw=w.map(x=>total*x/W), base=raw.map(Math.floor);
  let rest=total-base.reduce((a,b)=>a+b,0);
  raw.map((x,i)=>[x-base[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{ if(rest>0&&w[i]>0){ base[i]++; rest--; } });
  return base;
}
function renderFee(fee,played,total){
  if(document.activeElement!==$('inFee')) $('inFee').value=total?total:'';
  $('inFee').disabled=RO; $('segFee').querySelectorAll('button').forEach(b=>b.disabled=RO);
  setSeg($('segFee'),S.fee.mode);
  if(!total){ $('feeHint').textContent='入れた金額を、精算の金額から差し引きます。'; return; }
  $('feeHint').textContent=S.fee.mode==='games'
    ?idSeat(M()).map(i=>`${nameOf(i)} ${played[i]}半荘 ${fee[i].toLocaleString('ja-JP')}円`).join('　')
    :`1人あたり ${[...new Set(fee)].map(x=>x.toLocaleString('ja-JP')).join('〜')}円（${M()}人）`;
}
$('inFee').addEventListener('input',e=>{ e.target.value=e.target.value.replace(/[^0-9]/g,''); S.fee.total=Number(e.target.value)||0; unsample(); renderTotal(); save(); });
bindSeg($('segFee'),v=>{ S.fee.mode=v; });
$('chipFields').addEventListener('input',e=>{ const i=e.target.dataset.i; if(i==null) return; e.target.value=e.target.value.replace(/[^0-9]/g,''); S.chips[i]=e.target.value===''?'':Number(e.target.value); unsample(); renderTotal(); save(); });
/* ---------- 保存して新しく始める／過去の精算 ---------- */
let arcMsg='', arcOpen=null, arcConfirm=null;
const clone=o=>JSON.parse(JSON.stringify(o));
// 今の精算を「過去の精算」に保存する（記録が無ければ何もしない）
async function archiveCurrent(){
  if(!S.games.length) return null;
  const t=computeTotals(), id=uuid();
  const arc={id,at:Date.now(),games:S.games.length,feeTotal:t.feeTotal,
    rows:idSeat(t.n).map(i=>({name:nameOf(i),pt:t.all[i],fee:t.fee[i],fin:t.fin[i],ranks:t.rk[i].join('-')})).sort((a,b)=>b.fin-a.fin),
    snap:clone({rules:S.rules,names:S.names,members:S.members,chips:S.chips,fee:S.fee,seat:S.seat,games:S.games})};
  if(S.cloud){ // 共有の卓：記録は削除扱いにして「保存済み」の印をつける（ゴミ箱には出ない）
    await Promise.all(S.games.map(g=>{ const d=Object.assign({},g); delete d.id; d.archived=id; return Cloud.setGame(g.id,{deleted:true,data:d}); }));
  }
  S.archives.unshift(arc); if(S.archives.length>50) S.archives.length=50;
  return arc;
}
function clearCurrent(){ S.games=[]; S.chips=[]; S.draft={}; S.fee={total:0,mode:S.fee.mode}; }
$('resetAll').addEventListener('click',()=>{ $('resetConfirm').hidden=false; });
$('resetNo').addEventListener('click',()=>{ $('resetConfirm').hidden=true; });
$('resetYes').addEventListener('click',async()=>{
  arcMsg=''; $('resetYes').disabled=true;
  try{
    if(S.sample){ clearCurrent(); unsample(); }
    else { const a=await archiveCurrent(); clearCurrent(); arcMsg=a?`${fmtDT(a.at)}の精算を「過去の精算」に保存しました`:''; }
    $('resetConfirm').hidden=true; update();
  }catch(e){ arcMsg='保存できませんでした（通信を確認してください）。記録はそのまま残っています'; }
  $('resetYes').disabled=false; renderArchives();
});
function renderArchives(){
  const box=$('archiveList'); if(!box) return;
  const list=S.archives||[];
  const msg=arcMsg?`<div class="check ${/保存しました|戻しました/.test(arcMsg)?'ok':'ng'}" style="margin:0 0 10px">${esc(arcMsg)}</div>`:'';
  if(!list.length){ box.innerHTML=msg+'<div class="hint">まだありません。「保存して新しく始める」を押すと、ここに残ります。</div>'; return; }
  box.innerHTML=msg+list.map(a=>{ const top=a.rows[0];
    const open=arcOpen===a.id, conf=arcConfirm&&arcConfirm.id===a.id?arcConfirm.kind:null;
    return `<div class="arc"><div class="trow"><div><b>${fmtDT(a.at)}</b>　${a.games}半荘<div class="hint">1位 ${esc(top.name)} ${fmtYen(top.fin)}</div></div>
      <div class="actions" style="margin:0"><button type="button" class="btn ghost" data-arc-view="${a.id}">${open?'閉じる':'見る'}</button><button type="button" class="btn ghost ro-hide" data-arc-restore="${a.id}">戻す</button></div></div>
      ${open?`<div class="tw"><table><thead><tr><th>名前<small style="display:block;font-weight:500">着順</small></th><th>合計pt</th><th>金額${a.feeTotal?'<small style="display:block;font-weight:500">場代込み</small>':''}</th></tr></thead><tbody>${a.rows.map(r=>`<tr><td class="nm">${esc(r.name)}<small>${r.ranks}</small></td><td class="${cls(r.pt)}">${fmtPt(r.pt)}</td><td class="yen ${cls(r.fin)}">${fmtYen(r.fin)}${r.fee?`<small class="feeNote">場代 −${r.fee.toLocaleString('ja-JP')}</small>`:''}</td></tr>`).join('')}</tbody></table></div>
        <div class="ro-hide" style="margin-top:6px"><button type="button" class="btn danger" data-arc-del="${a.id}">この記録を完全に消す</button></div>`:''}
      ${conf==='restore'?`<div class="confirm">この精算を戻しますか？${S.games.length?'今の記録は「過去の精算」に保存してから戻します。':''}<button type="button" class="btn" style="width:auto" data-arc-restore-yes="${a.id}">戻す</button><button type="button" class="btn ghost" data-arc-no="1">やめる</button></div>`:''}
      ${conf==='del'?`<div class="confirm">完全に消すと戻せません。消しますか？<button type="button" class="btn danger" data-arc-del-yes="${a.id}">消す</button><button type="button" class="btn ghost" data-arc-no="1">やめる</button></div>`:''}
    </div>`; }).join('');
}
$('archiveList').addEventListener('click',async e=>{
  const t=e.target.closest('button'); if(!t) return; const d=t.dataset; arcMsg='';
  if(d.arcView){ arcOpen=arcOpen===d.arcView?null:d.arcView; arcConfirm=null; }
  if(d.arcRestore){ arcConfirm={id:d.arcRestore,kind:'restore'}; }
  if(d.arcDel){ arcConfirm={id:d.arcDel,kind:'del'}; }
  if(d.arcNo){ arcConfirm=null; }
  if(d.arcDelYes){ S.archives=S.archives.filter(a=>a.id!==d.arcDelYes); arcConfirm=null; arcOpen=null; save(); }
  if(d.arcRestoreYes){
    const a=S.archives.find(x=>x.id===d.arcRestoreYes); if(!a) return; t.disabled=true;
    try{
      if(S.games.length) await archiveCurrent();
      if(S.cloud) await Promise.all(a.snap.games.map(g=>{ const dd=Object.assign({},g); delete dd.id; delete dd.archived; return Cloud.setGame(g.id,{deleted:false,data:dd}); }));
      const s=clone(a.snap);
      Object.assign(S,{rules:s.rules,names:s.names,members:s.members,chips:s.chips,fee:s.fee,seat:s.seat,games:s.games,draft:{}});
      S.archives=S.archives.filter(x=>x.id!==a.id); normalize(); arcConfirm=null; arcOpen=null;
      arcMsg=`${fmtDT(a.at)}の精算を戻しました`; update();
    }catch(err){ arcMsg='戻せませんでした（通信を確認してください）'; }
  }
  renderArchives();
});
$('startFresh').addEventListener('click',()=>{ S.games=[]; S.chips=[]; S.draft={}; S.fee={total:0,mode:'equal'}; S.names=['','','','','','']; S.members=N(); S.seat=defaultSeat(); S.sample=false; show('rules'); update(); setTimeout(()=>{const f=$('name0'); if(f){ $('v-players').scrollIntoView({block:'start'}); f.focus({preventScroll:true}); }},50); });

/* ---------- 撮影読み取り ---------- */
const ROLE_LBL={self:'自分（中央）',shimocha:'下家（右）',toimen:'対面（上）',kamicha:'上家（左）'};
const roleOffs=()=>N()===4?{self:0,shimocha:1,toimen:2,kamicha:3}:{self:0,shimocha:1,kamicha:2};
let scan=null;
function playerFor(role){ const n=N(), off=roleOffs()[role], sh=scan.shooter; return S.seat.indexOf((S.seat[sh]+off)%n); }
async function runScan(src){
  $('scanBusy').hidden=false; $('scanBox').hidden=true;
  try{
    const img=new Image(); img.src=src; await img.decode();
    await new Promise(r=>setTimeout(r,30));
    const res=SegOCR.read(img);
    const vals={}, raw={}, note={}, ks=Object.keys(roleOffs()), target=S.rules.start*N();
    ks.forEach(k=>{ const g=res.roles[k]; raw[k]=g?g.text:''; });
    // 合計（配給原点×人数）が合う組み合わせを探す。百点単位・十点単位の両方を試す
    const sol=SegOCR.solve(res.roles,ks,target);
    if(sol){
      ks.forEach(k=>{ const v=sol[k].value, g=res.roles[k];
        vals[k]={v:String(v*100)};
        const readTxt=g&&g.value!=null?String(Math.abs(g.value)):'';
        if(sol[k].filled) note[k]='読めなかったため合計から計算';
        else if(!g||g.value==null||(Math.abs(g.value)!==Math.abs(v)&&Math.abs(g.value)!==Math.abs(v)*10)) note[k]='合計に合うように補正';
      });
    } else {
      // 合計で確かめられないときは、ありえる値（3桁以上・百点単位で整数・合計の1.5倍以内）だけ入れ、他は空欄にする
      const got=ks.map(k=>res.roles[k]&&res.roles[k].value).filter(v=>v!=null);
      const div=got.some(v=>Math.abs(v)>=1000)?10:1;
      ks.forEach(k=>{ const g=res.roles[k];
        const v=g&&g.value!=null&&g.digits.length>=(div===10?4:3)?g.value/div:null;
        const ok=v!=null&&Number.isInteger(v)&&Math.abs(v*100)<=target*1.5;
        vals[k]=ok?{v:String(v*100)}:{v:'',miss:true}; });
    }
    const st=seated(); scan={res,vals,raw,note,shooter:st.includes(S.shooter)?S.shooter:st[0]};
    $('scanBox').hidden=false; renderScan(true);
    $('scanBox').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){
    $('scanBusy').textContent='写真を読み込めませんでした。別の写真で試してください。'; return;
  }
  $('scanBusy').hidden=true;
}
function drawScan(){
  const {canvas:src,roles}=scan.res, cv=$('scanCv');
  cv.width=src.width; cv.height=src.height;
  const c=cv.getContext('2d'); c.drawImage(src,0,0);
  const lw=Math.max(2,src.width/300); c.lineWidth=lw; c.font=`700 ${Math.max(14,Math.min(src.width/24,src.height/5))}px sans-serif`;
  Object.entries(roles).forEach(([k,g])=>{ if(!(k in roleOffs())) return;
    const pad=g.h*.25; c.strokeStyle=k==='self'?'#3DDC97':'#FFD166';
    c.strokeRect(g.x0-pad-g.h*.6,g.y0-pad,(g.x1-g.x0)+pad*2+g.h*.6,g.h+pad*2);
    c.fillStyle=c.strokeStyle; c.fillText(nameOf(playerFor(k)),g.x0-g.h*.6,Math.max(14,g.y0-pad-lw*2)); });
}
function renderScan(redraw,rows){
  if(!scan) return;
  if(rows!==false){
  $('segShooter').innerHTML=seated().map(i=>`<button type="button" data-v="${i}">${esc(nameOf(i))}</button>`).join('');
  setSeg($('segShooter'),scan.shooter);
  if(!$('scanRows').contains(document.activeElement)){
    $('scanRows').innerHTML=Object.keys(roleOffs()).map(k=>{ const p=playerFor(k), v=scan.vals[k], miss=!!v.miss;
      return `<div class="entry ${miss?'miss':''}"><div class="nm">${esc(nameOf(p))}<small>${WINDS[S.seat[p]]}家</small></div>
      <div class="role">${ROLE_LBL[k]}${miss?`・<span class="raw">${scan.raw[k]?'読み取り「'+esc(scan.raw[k])+'」':'見つかりませんでした'}</span>`:(scan.note[k]?`・<span class="raw">${scan.note[k]}（読み取り「${esc(scan.raw[k]||'—')}」）</span>`:'')}</div>
      ${stepperHTML('scan:'+k,scanVal(k),v.v==='',esc(nameOf(p)))}</div>`; }).join('');
  }
  }
  if(redraw!==false) drawScan();
  const ks=Object.keys(roleOffs()), missing=ks.filter(k=>scan.vals[k].miss);
  const sum=ks.reduce((a,k)=>a+scanVal(k),0), target=S.rules.start*N(), el=$('scanCheck');
  if(missing.length){ el.className='check ng'; el.innerHTML=`<span>読めなかった人が${missing.length}人います（${fmtPts(S.rules.start)}点のまま）</span><span>赤い欄を−／＋で直してください</span>`; }
  else if(sum===target){ el.className='check ok'; el.innerHTML=`<span>合計 <span class="num">${fmtPts(sum)}</span>点</span><span>一致しています</span>`; }
  else { el.className='check ng'; el.innerHTML=`<span>合計 <span class="num">${fmtPts(sum)}</span>点</span><span>${fmtPts(Math.abs(sum-target))}点${sum>target?'多い':'足りない'}・写真と見比べてください</span>`; }
}
$('camIn').addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const url=URL.createObjectURL(f); runScan(url); e.target.value=''; });
if($('demoScan')) $('demoScan').addEventListener('click',()=>{ if(window.SAMPLE_PHOTO) runScan(window.SAMPLE_PHOTO); });
$('segShooter').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; scan.shooter=Number(b.dataset.v); S.shooter=scan.shooter; save(); blur(); renderScan(); });
function scanVal(k){ const v=scan.vals[k]; const n=parseInt(v.v,10); return isNaN(n)?S.rules.start:n; }
bindStepper($('scanRows'),k=>scanVal(k.split(':')[1]),(k,v)=>{ const r=k.split(':')[1]; scan.vals[r].v=String(v); scan.vals[r].miss=false;
  const row=$('scan_'+r)&&$('scan_'+r).closest('.entry'); if(row) row.classList.remove('miss'); renderScan(false,false); });
$('scanCancel').addEventListener('click',()=>{ scan=null; $('scanBox').hidden=true; });
$('scanApply').addEventListener('click',()=>{
  Object.keys(roleOffs()).forEach(k=>{ const p=playerFor(k), v=scan.vals[k]; if(v.v===''||v.v==='-') return; S.draft['p'+p]=String(parseInt(v.v,10)); });
  scan=null; $('scanBox').hidden=true; unsample(); blur(); renderEntry(); save();
  $('entryList').scrollIntoView({behavior:'smooth',block:'start'});
});

/* ---------- 共有（Googleログイン・卓の同期） ---------- */
function uuid(){ if(window.crypto&&crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{ const r=Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16); }); }
// キーの順番に左右されない比較用の文字列
function canon(v){ if(Array.isArray(v)) return '['+v.map(canon).join(',')+']';
  if(v&&typeof v==='object') return '{'+Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
  return JSON.stringify(v===undefined?null:v); }
const sharedOf=s=>({rules:s.rules,names:s.names,members:s.members,chips:s.chips,seat:s.seat,fee:s.fee,archives:s.archives||[]});
const Sync=(function(){
  let lastShared=null, timer=null, unsub=null, user=null, loaded=false, msg='', members=[], tables=null, busy=false;
  const pk=()=>tKey(S.cloud.id)+':pending';
  const pending=()=>S.cloud?(loadJSON(pk())||[]):[];
  const setPending=a=>{ lsSet(pk(),a.length?JSON.stringify(a):null); renderHeader(); };
  const gameData=g=>{ const d=Object.assign({},g); delete d.id; return d; };
  const displayName=()=>user?(user.user_metadata&&(user.user_metadata.full_name||user.user_metadata.name))||user.email:'';
  function pushState(){
    if(!S.cloud||RO||!user) return;
    if(canon(sharedOf(S))===lastShared) return;
    clearTimeout(timer);
    timer=setTimeout(async()=>{ const snap=sharedOf(S), c=canon(snap);
      try{ await Cloud.saveState(S.cloud.id,snap); lastShared=c; S.cloud.dirty=false; }catch(e){ S.cloud.dirty=true; }
      renderHeader(); },700);
  }
  async function flush(){
    if(!S.cloud||!user) return;
    const rest=[];
    for(const op of pending()){
      try{ if(op.op==='add') await Cloud.addGame(S.cloud.id,op.id,op.data,user.id); else await Cloud.deleteGame(op.id); }
      catch(e){ if(!/duplicate key/i.test(e.message)) rest.push(op); }
    }
    setPending(rest);
    if(S.cloud.dirty||canon(sharedOf(S))!==lastShared) pushState();
  }
  function addGame(g){ setPending(pending().concat({op:'add',id:g.id,data:gameData(g)})); flush(); }
  function deleteGame(id){ setPending(pending().filter(o=>!(o.op==='add'&&o.id===id)).concat({op:'del',id})); flush(); }
  function applyTable(row){
    if(!S.cloud||row.id!==S.cloud.id) return;
    Object.assign(S.cloud,{name:row.name,invite:row.invite_token,viewTok:row.view_token,owner:row.created_by});
    const st=row.state||{};
    if(st.rules&&canon(sharedOf(st))!==lastShared&&!S.cloud.dirty){
      Object.assign(S,{rules:st.rules,names:(st.names||[]).slice(),members:st.members,chips:(st.chips||[]).slice(),seat:st.seat,fee:st.fee||{total:0,mode:'equal'},archives:(st.archives||[]).slice()});
      normalize(); lastShared=canon(sharedOf(S));
    }
  }
  function applyGame(row){
    if(!S.cloud||row.table_id&&row.table_id!==S.cloud.id) return;
    const i=S.games.findIndex(g=>String(g.id)===String(row.id));
    if(row.deleted){ if(i>=0) S.games.splice(i,1); }
    else { const g=Object.assign({},row.data,{id:row.id}); if(i>=0) S.games[i]=g; else S.games.push(g); }
    S.games.sort((a,b)=>(a.t||0)-(b.t||0));
  }
  async function open(id){
    const r=await Cloud.fetchTable(id);
    if(!r.table){ msg='この卓は見つからないか、参加していません'; toLocal(); return; }
    if(S.cloud&&S.cloud.id!==id) return;
    const pend=pending();
    applyTable(Object.assign({},r.table,{state:(S.cloud.dirty?{}:r.table.state)}));
    S.games=r.games.map(x=>Object.assign({},x.data,{id:x.id}));
    // まだ送れていない自分の記録は残す
    pend.forEach(o=>{ if(o.op==='add'&&!S.games.some(g=>g.id===o.id)) S.games.push(Object.assign({},o.data,{id:o.id})); if(o.op==='del') S.games=S.games.filter(g=>g.id!==o.id); });
    S.games.sort((a,b)=>(a.t||0)-(b.t||0));
    members=r.members;
    if(unsub) unsub();
    unsub=Cloud.subscribe(id,row=>{ applyTable(row); update(); },row=>{ applyGame(row); update(); });
    update(); flush();
  }
  function switchTo(id,name){
    if(unsub){ unsub(); unsub=null; }
    lsSet(ACTIVE,id);
    S=loadJSON(tKey(id))||blankTable(id,name); if(!S.cloud) S.cloud={id,name:name||''};
    normalize(); lastShared=null; members=[];
    show('share'); update();
    return open(id).catch(e=>{ msg=e.message; renderShare(); });
  }
  function toLocal(){
    if(unsub){ unsub(); unsub=null; }
    lsSet(ACTIVE,null); S=loadJSON(KEY)||sample(); normalize(); lastShared=null; update();
  }
  async function refreshTables(){ try{ tables=await Cloud.listTables(); }catch(e){ tables=[]; msg=e.message; } renderShare(); }
  async function afterLogin(){
    const jt=lsGet(KEY+':join');
    if(jt){ lsSet(KEY+':join',null);
      try{ const tid=await Cloud.join(jt,displayName()); msg='卓に参加しました'; await switchTo(tid); }
      catch(e){ msg=e.message; }
    }
    if(S.cloud) open(S.cloud.id).catch(e=>{ msg=e.message; renderShare(); });
    refreshTables();
  }
  async function init(){
    if(!Cloud.configured||RO) return;
    document.body.classList.add('cloud-on');
    const need=S.cloud||lsGet(KEY+':join')||params.has('code');
    if(need) await start();
  }
  async function start(){
    if(loaded) return; loaded=true;
    try{
      await Cloud.load();
      const s=await Cloud.session(); user=s?s.user:null;
      if(params.has('code')||params.has('join')) history.replaceState(null,'',location.pathname);
      Cloud.onAuth(s=>{ const was=user&&user.id; user=s?s.user:null; if(user&&user.id!==was) afterLogin(); renderShare(); renderHeader(); });
      if(user) await afterLogin();
    }catch(e){ loaded=false; msg=e.message; }
    renderShare(); renderHeader();
  }
  addEventListener('online',()=>{ flush(); renderHeader(); });
  addEventListener('offline',()=>renderHeader());
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&S.cloud&&user) open(S.cloud.id).catch(()=>{}); });
  async function reloadMembers(){ if(S.cloud) members=await Cloud.members(S.cloud.id); }
  return {init,start,pushState,addGame,deleteGame,switchTo,toLocal,refreshTables,reloadMembers,
    pendingCount:()=>pending().length, online:()=>navigator.onLine!==false,
    get user(){return user}, get members(){return members}, get tables(){return tables}, get msg(){return msg}, set msg(v){msg=v},
    get busy(){return busy}, set busy(v){busy=v}, displayName};
})();
const baseUrl=()=>location.origin+location.pathname;
function copyText(txt,btn){
  const done=()=>{ const o=btn.textContent; btn.textContent='コピーしました'; setTimeout(()=>btn.textContent=o,1500); };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done,()=>selectFallback(btn));
  else selectFallback(btn);
}
function selectFallback(btn){ const inp=btn.parentElement.querySelector('input'); if(inp){ inp.focus(); inp.select(); } }
function renderShare(){
  const box=$('shareBox'); if(!box||$('v-share').hidden) return;
  const u=Sync.user, m=Sync.msg?`<div class="check ${/参加しました|作りました|作り直しました/.test(Sync.msg)?'ok':'ng'}" style="margin:0">${esc(Sync.msg)}</div>`:'';
  if(!Cloud.configured){ box.innerHTML='<div class="panel empty">共有機能はまだ設定されていません。</div>'; return; }
  if(!u){
    const jt=lsGet(KEY+':join');
    box.innerHTML=`${m}<div class="panel"><div class="row"><b>${jt?'招待された卓に参加するには、Googleでログインしてください。':'Googleでログインすると、卓のデータをメンバーで共有できます。'}</b>
      <span class="hint">ログインした人どうしで、ルール・メンバー・記録・チップが同期されます。誰が入力しても全員の画面にすぐ反映されます。</span></div>
      <div class="row"><button type="button" class="btn gbtn" data-act="login">Googleでログイン</button></div></div>`;
    Sync.start(); return;
  }
  const c=S.cloud, owner=c&&c.owner===u.id;
  const tables=Sync.tables;
  const list=tables==null?'<div class="hint">読み込み中…</div>':tables.length?tables.map(t=>`<div class="trow"><div><b>${esc(t.name)}</b><div class="hint">${new Date(t.updated_at).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}更新</div></div>${c&&c.id===t.id?'<span class="chip on">表示中</span>':`<button type="button" class="btn ghost" data-act="open" data-id="${t.id}">開く</button>`}</div>`).join(''):'<div class="hint">まだ参加している卓はありません。</div>';
  const cur=c?`<div class="panel">
      <div class="row"><span class="lbl">表示中の卓</span>
        <div class="grid2" style="grid-template-columns:minmax(0,1fr) auto;align-items:center"><label class="field"><input class="txt" id="tableName" value="${esc(c.name||'')}" maxlength="30" aria-label="卓の名前"></label><button type="button" class="btn ghost" data-act="rename">名前を保存</button></div>
        <span class="hint">参加者：${Sync.members.map(x=>esc(x.display_name||'名前なし')).join('、')||'—'}</span></div>
      <div class="row"><span class="lbl">招待リンク（ログインして一緒に入力できる）</span>
        <div class="linkrow"><input readonly value="${c.invite?esc(baseUrl()+'?join='+c.invite):''}" aria-label="招待リンク"><button type="button" class="btn ghost" data-act="copy">コピー</button></div></div>
      <div class="row"><span class="lbl">閲覧リンク（ログイン不要・見るだけ）</span>
        <div class="linkrow"><input readonly value="${c.viewTok?esc(baseUrl()+'?view='+c.viewTok):''}" aria-label="閲覧リンク"><button type="button" class="btn ghost" data-act="copy">コピー</button></div>
        <span class="hint">リンクを知っている人は誰でも開けます。広まってしまったときは作り直してください。</span></div>
      <div class="row actions" style="margin-top:0">
        ${owner?'<button type="button" class="btn ghost" data-act="reset">リンクを作り直す</button>':''}
        <button type="button" class="btn ghost" data-act="local">この端末だけのデータに切り替え</button>
        <button type="button" class="btn danger" data-act="leave">卓から抜ける</button></div>
      <div class="confirm" id="leaveConfirm" hidden><span>この卓から抜けます。もう一度入るには招待リンクが必要です。</span><button type="button" class="btn danger" data-act="leaveYes">抜ける</button><button type="button" class="btn ghost" data-act="leaveNo">やめる</button></div>
    </div>`
    :`<div class="panel"><div class="row"><b>今はこの端末だけのデータを使っています。</b>
        <span class="hint">今のルール・メンバー・記録をもとに共有の卓を作れます。この端末のデータはそのまま残ります。誰も招待しなければ、自分専用の保存場所として使えて、成績タブにも反映されます。${S.sample?'（サンプルの記録とメンバーは入れずに作ります）':''}</span></div>
      <div class="row"><div class="grid2" style="grid-template-columns:minmax(0,1fr) auto;align-items:center"><label class="field"><input class="txt" id="newTableName" placeholder="卓の名前（例：金曜の会）" maxlength="30" aria-label="新しい卓の名前"></label><button type="button" class="btn" style="width:auto" data-act="create" ${Sync.busy?'disabled':''}>共有の卓を作る</button></div></div></div>`;
  box.innerHTML=`${m}${cur}
    <div class="sec"><h2 style="margin-top:6px">参加している卓</h2><div class="panel">${list}</div></div>
    <div class="panel"><div class="toggle"><span class="hint">${esc(u.email||'')} でログイン中</span><button type="button" class="btn ghost" data-act="logout">ログアウト</button></div></div>`;
}
$('shareBox').addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]'); if(!b) return; const act=b.dataset.act;
  Sync.msg='';
  try{
    if(act==='login') await Cloud.signIn();
    if(act==='logout'){ await Cloud.signOut(); Sync.toLocal(); }
    if(act==='copy') copyText(b.parentElement.querySelector('input').value,b);
    if(act==='open') await Sync.switchTo(b.dataset.id);
    if(act==='local'){ Sync.toLocal(); show('share'); }
    if(act==='rename'){ const n=$('tableName').value.trim()||'麻雀卓'; await Cloud.rename(S.cloud.id,n); S.cloud.name=n; Sync.msg=''; Sync.refreshTables(); update(); }
    if(act==='reset'){ const t=await Cloud.resetLinks(S.cloud.id); Object.assign(S.cloud,{invite:t.invite_token,viewTok:t.view_token}); Sync.msg='リンクを作り直しました。前のリンクは使えなくなりました'; save(); }
    if(act==='leave'){ $('leaveConfirm').hidden=false; return; }
    if(act==='leaveNo'){ $('leaveConfirm').hidden=true; return; }
    if(act==='leaveYes'){ const id=S.cloud.id; await Cloud.leave(id,Sync.user.id); lsSet(tKey(id),null); Sync.toLocal(); Sync.refreshTables(); show('share'); }
    if(act==='create'){
      if(Sync.busy) return;
      const name=($('newTableName').value||'').trim()||'麻雀卓';
      Sync.busy=true; renderShare();
      const base=S.sample?Object.assign({},S,{names:['','','','','',''],chips:[],games:[]}):S;
      const games=base.games.map(g=>{ const d=Object.assign({},g); delete d.id; return {id:uuid(),data:d}; });
      const t=await Cloud.createTable(name,sharedOf(base),games,Sync.displayName());
      if(!S.sample&&S.me!=null){ try{ await Cloud.claimSlot(t.id,S.me); }catch(e){} }
      Sync.busy=false; Sync.msg='共有の卓を作りました。招待リンクをメンバーに送ってください';
      await Sync.switchTo(t.id,t.name); Sync.refreshTables();
    }
  }catch(err){ Sync.busy=false; Sync.msg=err.message; }
  renderShare(); renderHeader();
});

/* ---------- 閲覧専用リンク ---------- */
async function viewLoop(){
  try{
    const d=await Cloud.view(VIEW_TOKEN);
    if(!d){ S.viewErr='このリンクは無効になっています'; }
    else{
      const st=d.state||{};
      Object.assign(S,{rules:st.rules||S.rules,names:(st.names||[]).slice(),members:st.members,chips:(st.chips||[]).slice(),seat:st.seat,fee:st.fee||{total:0,mode:'equal'},archives:(st.archives||[]).slice(),
        games:(d.games||[]).map(x=>Object.assign({},x.data,{id:x.id})).sort((a,b)=>(a.t||0)-(b.t||0)),viewName:d.name,viewErr:''});
      normalize();
    }
  }catch(e){ S.viewErr='読み込めませんでした（通信を確認してください）'; }
  update();
  setTimeout(viewLoop,document.visibilityState==='visible'?15000:60000);
}

/* ---------- 成績 ---------- */
let statsData=null, statsErr='', statsLoading=false;
const statsF={period:'all',table:'all',players:4};
// ある精算（ルール・記録・チップ・場代）の中で、欄 slot の人の成績を計算する
function sessionEval(st,slot){
  const saved=S;
  S=Object.assign({rules:defaults(4),names:[],members:4,chips:[],fee:{total:0,mode:'equal'},games:[],seat:[],draft:{},archives:[],trash:[]},clone(st));
  S.rules=Object.assign(defaults(S.rules.players||4),S.rules);
  S.members=Math.max(S.members||0,S.rules.players,slot+1); S.fee=S.fee||{total:0,mode:'equal'};
  try{
    const games=S.games.map(g=>{ if(!(g.seat&&g.seat[slot]>=0&&g.pts[slot]!=null)) return null; const c=calc(g);
      return {fp:(g.t||0)+':'+g.pts.join(','),t:g.t||0,rank:c.rank[slot],n:c.order.length,pt:c.score[slot],raw:g.pts[slot],tobi:c.tobi.some(([p])=>p===slot)}; }).filter(Boolean);
    if(!games.length) return null;
    const t=computeTotals();
    return {games,pt:t.all[slot],fin:t.fin[slot],players:S.rules.players,name:(S.names[slot]||'').trim()};
  }finally{ S=saved; }
}
async function gatherSessions(){
  const out=[], push=(st,slot,table,key,at)=>{ const ev=sessionEval(st,slot); if(!ev) return; out.push(Object.assign(ev,{table,key,at:at||Math.max(...ev.games.map(g=>g.t))})); };
  const local=RO?null:loadJSON(KEY);
  if(local&&!local.sample&&local.me!=null){
    push(local,local.me,'この端末','local');
    (local.archives||[]).forEach(a=>push(a.snap,local.me,'この端末','local',a.at));
  }
  if(Cloud.configured&&!RO) await Sync.start();
  if(Cloud.configured&&Sync.user){
    const d=await Cloud.statsData();
    if(d) d.mem.forEach(m=>{ if(m.slot==null) return; const tb=d.tables.find(x=>x.id===m.table_id); if(!tb) return; const st=tb.state||{};
      push(Object.assign({},st,{games:d.games.filter(g=>g.table_id===tb.id).map(g=>g.data)}),m.slot,tb.name,tb.id);
      (st.archives||[]).forEach(a=>push(a.snap,m.slot,tb.name,tb.id,a.at)); });
  }
  // 共有の卓に保存したこの端末の記録は二重に数えない
  const inCloud=new Set(out.filter(s=>s.key!=='local').flatMap(s=>s.games.map(g=>g.fp)));
  return out.filter(s=>s.key!=='local'||!s.games.every(g=>inCloud.has(g.fp))).sort((a,b)=>a.at-b.at);
}
async function renderStats(force){
  const box=$('statsBox');
  if(statsData==null||force){
    if(statsLoading) return; statsLoading=true; box.innerHTML='<div class="panel empty">集計しています…</div>';
    try{ statsData=await gatherSessions(); statsErr=''; }catch(e){ statsData=[]; statsErr='共有の卓の記録を読み込めませんでした（通信を確認してください）'; }
    statsLoading=false;
  }
  const all=statsData;
  if(!all.length){
    box.innerHTML=(statsErr?`<div class="check ng" style="margin:0">${esc(statsErr)}</div>`:'')+`<div class="panel"><div class="row"><b>まだ成績がありません</b>
      <span class="hint">ルール画面で自分の名前の横にある「自分」を押すと、その卓の記録（過去の精算も含む）が自分の成績として集計されます。</span>
      ${Cloud.configured&&!Sync.user?'<span class="hint">Googleでログインすると、共有の卓の成績もまとめて見られます（メニューの「共有・ログイン」から）。</span>':''}</div></div>`;
    return;
  }
  const now=new Date(), y0=new Date(now.getFullYear(),0,1).getTime(), m0=new Date(now.getFullYear(),now.getMonth(),1).getTime();
  const tables=[...new Map(all.map(s=>[s.key,s.table])).entries()];
  const playersSet=[...new Set(all.map(s=>s.players))].sort((a,b)=>b-a);
  if(!playersSet.includes(statsF.players)) statsF.players=playersSet[0];
  if(statsF.table!=='all'&&!tables.some(([k])=>k===statsF.table)) statsF.table='all';
  const ss=all.filter(s=>s.players===statsF.players&&(statsF.table==='all'||s.key===statsF.table)&&(statsF.period==='all'||s.at>=(statsF.period==='year'?y0:m0)));
  const filters=`<div class="sfilters">
    <div class="seg" id="sfPeriod">${[['all','全部'],['year','今年'],['month','今月']].map(([v,l])=>`<button type="button" data-v="${v}" aria-pressed="${statsF.period===v}">${l}</button>`).join('')}</div>
    ${playersSet.length>1?`<div class="seg" id="sfPlayers">${playersSet.map(n=>`<button type="button" data-v="${n}" aria-pressed="${statsF.players===n}">${n}人麻雀</button>`).join('')}</div>`:''}
    ${tables.length>1?`<label class="field sfsel"><select id="sfTable" aria-label="卓で絞り込む"><option value="all">すべての卓</option>${tables.map(([k,n])=>`<option value="${esc(k)}" ${statsF.table===k?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`:''}
  </div>`;
  if(!ss.length){ box.innerHTML=filters+'<div class="panel empty">この条件の成績はありません。</div>'; return; }
  const gs=ss.flatMap(s=>s.games), n=gs.length, P=statsF.players;
  const cnt=idSeat(P).map(r=>gs.filter(g=>g.rank===r).length);
  const pct=x=>n?Math.round(x/n*1000)/10:0;
  const sumFin=ss.reduce((a,s)=>a+s.fin,0), sumPt=fix(ss.reduce((a,s)=>a+s.pt,0));
  const avgRank=gs.reduce((a,g)=>a+g.rank+1,0)/n, avgRaw=Math.round(gs.reduce((a,g)=>a+g.raw,0)/n);
  const tile=(l,v,sub,c)=>`<div class="stile"><div class="sl">${l}</div><div class="sv ${c||''}">${v}</div>${sub?`<div class="ss">${sub}</div>`:''}</div>`;
  const tiles=`<div class="stiles">
    ${tile('収支',fmtYen(sumFin),`${fmtPt(sumPt)}pt・${ss.length}回`,cls(sumFin))}
    ${tile('半荘数',n+'回',`平均着順 ${avgRank.toFixed(2)}`)}
    ${tile('トップ率',pct(cnt[0])+'%',`${cnt[0]}回`)}
    ${tile('連対率',pct(cnt[0]+cnt[1])+'%',`${P}人中2着以内`)}
    ${tile('ラス率',pct(cnt[P-1])+'%',`${cnt[P-1]}回`)}
    ${tile('飛び率',pct(gs.filter(g=>g.tobi).length)+'%',`平均素点 ${fmtPts(avgRaw)}`)}
  </div>`;
  box.innerHTML=filters+tiles
    +`<div class="sec"><h2>収支の推移<span class="sub">累計・円</span></h2><div class="panel">${trendSVG(ss)}<div class="hint" id="trendInfo">点をタップすると、その日の収支が出ます。</div></div></div>`
    +`<div class="sec"><h2>着順の割合<span class="sub">${n}半荘</span></h2><div class="panel">${rankBar(cnt,n)}</div></div>`
    +`<div class="sec"><h2>月ごとの収支</h2><div class="panel">${monthBars(ss)}</div></div>`
    +`<div class="sec"><h2>これまでの記録</h2><div class="panel"><div class="tw"><table><thead><tr><th>日付<small style="display:block;font-weight:500">卓</small></th><th>半荘</th><th>着順</th><th>pt</th><th>収支</th></tr></thead><tbody>${ss.slice().reverse().map(s=>{ const rc=idSeat(P).map(r=>s.games.filter(g=>g.rank===r).length).join('-');
      return `<tr><td class="nm">${fmtDT(s.at).split(' ')[0]}<small>${esc(s.table)}</small></td><td>${s.games.length}</td><td class="ranks">${rc}</td><td class="${cls(s.pt)}">${fmtPt(s.pt)}</td><td class="yen ${cls(s.fin)}">${fmtYen(s.fin)}</td></tr>`; }).join('')}</tbody></table></div></div></div>`
    +`<p class="hint">収支はチップと場代を含みます。今まだ精算中の記録も含めて集計しています。</p>`;
  window.__trend=ss;
}
// 収支の推移：累計の折れ線（1本なので凡例なし、終点にだけ値を表示）
function trendSVG(ss){
  const W=320,H=170,L=46,R=12,T=14,B=26;
  let acc=0; const pts=ss.map(s=>({s,v:(acc+=s.fin)}));
  const vals=[0,...pts.map(p=>p.v)], lo=Math.min(...vals), hi=Math.max(...vals);
  const step=niceStep((hi-lo)||1000), y0=Math.floor(lo/step)*step, y1=Math.ceil(hi/step)*step||step;
  const X=i=>pts.length===1?L+(W-L-R)/2:L+i*(W-L-R)/(pts.length-1), Y=v=>T+(y1-v)*(H-T-B)/((y1-y0)||1);
  const ticks=[]; for(let v=y0;v<=y1+1e-9;v+=step) ticks.push(v);
  const grid=ticks.map(v=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" class="${v===0?'zero':'grid'}"/><text x="${L-6}" y="${Y(v)+4}" class="ax" text-anchor="end">${shortYen(v)}</text>`).join('');
  const path=pts.map((p,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const last=pts[pts.length-1];
  const dots=pts.map((p,i)=>`<circle cx="${X(i)}" cy="${Y(p.v)}" r="4" class="dot ${p.v<0?'neg':''}"/><circle cx="${X(i)}" cy="${Y(p.v)}" r="14" class="hit" data-ti="${i}"><title>${fmtDT(p.s.at).split(' ')[0]} ${esc(p.s.table)} ${fmtYen(p.s.fin)}（累計 ${fmtYen(p.v)}）</title></circle>`).join('');
  const xl=`<text x="${X(0)}" y="${H-6}" class="ax" text-anchor="${pts.length===1?'middle':'start'}">${fmtDT(pts[0].s.at).split(' ')[0]}</text>`+(pts.length>1?`<text x="${X(pts.length-1)}" y="${H-6}" class="ax" text-anchor="end">${fmtDT(last.s.at).split(' ')[0]}</text>`:'');
  const lx=X(pts.length-1), anchor=lx>W-70?'end':'start';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="累計収支の推移。最新 ${fmtYen(last.v)}">${grid}<path d="${path}" class="line"/>${dots}${xl}<text x="${anchor==='end'?lx-8:lx+8}" y="${Y(last.v)-8}" class="lbl" text-anchor="${anchor}">${fmtYen(last.v)}</text></svg>`;
}
function niceStep(range){ const raw=range/4, p=Math.pow(10,Math.floor(Math.log10(raw))), f=raw/p; return (f<=1?1:f<=2?2:f<=5?5:10)*p; }
const shortYen=v=>{ const a=Math.abs(v); const s=a>=10000?(a/10000).toFixed(a%10000?1:0)+'万':a.toLocaleString('ja-JP'); return (v<0?'−':'')+s; };
// 着順の割合：100%の横棒（区切りは2pxの隙間）＋ラベル
function rankBar(cnt,n){
  const cols=['var(--r1)','var(--r2)','var(--r3)','var(--r4)']; const P=cnt.length;
  const colFor=r=>P===3?[cols[0],cols[1],cols[3]][r]:cols[r];
  const segs=cnt.map((c,r)=>c?`<div class="rseg" style="flex:${c};background:${colFor(r)}" title="${r+1}着 ${c}回"></div>`:'').join('');
  const legend=cnt.map((c,r)=>`<div class="rleg"><div class="rl"><i class="rsw" style="background:${colFor(r)}"></i>${r+1}着</div><b>${n?Math.round(c/n*100):0}%</b><small>${c}回</small></div>`).join('');
  return `<div class="rbar">${segs}</div><div class="rlegs">${legend}</div>`;
}
// 月ごとの収支：プラスは上、マイナスは下の棒
function monthBars(ss){
  const m=new Map(); ss.forEach(s=>{ const d=new Date(s.at), k=d.getFullYear()*100+d.getMonth(); m.set(k,(m.get(k)||0)+s.fin); });
  const rows=[...m.entries()].sort((a,b)=>a[0]-b[0]).slice(-12);
  const W=320,H=150,L=8,R=8,T=18,B=22, max=Math.max(1,...rows.map(r=>Math.abs(r[1])));
  const hasNeg=rows.some(r=>r[1]<0), hasPos=rows.some(r=>r[1]>0);
  const zeroY=hasNeg&&hasPos?T+(H-T-B)/2:hasNeg?T:H-B, scale=(hasNeg&&hasPos?(H-T-B)/2:(H-T-B))/max;
  const bw=Math.min(28,(W-L-R)/rows.length*.6), gap=(W-L-R)/rows.length;
  const bars=rows.map(([k,v],i)=>{ const x=L+gap*i+(gap-bw)/2, h=Math.max(2,Math.abs(v)*scale), y=v>=0?zeroY-h:zeroY;
    const lbl=rows.length<=6||i===rows.length-1?`<text x="${x+bw/2}" y="${v>=0?y-4:y+h+11}" class="lbl sm" text-anchor="middle">${shortYen(v)}</text>`:'';
    return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="3" class="bar ${v<0?'neg':''}"><title>${Math.floor(k/100)}年${k%100+1}月 ${fmtYen(v)}</title></rect>${lbl}<text x="${x+bw/2}" y="${H-6}" class="ax" text-anchor="middle">${k%100+1}月</text>`; }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="月ごとの収支"><line x1="${L}" x2="${W-R}" y1="${zeroY}" y2="${zeroY}" class="zero"/>${bars}</svg>`;
}
$('statsBox').addEventListener('click',e=>{
  const t=e.target.closest('[data-ti]');
  if(t){ const ss=window.__trend||[]; let acc=0; const i=Number(t.dataset.ti); ss.slice(0,i+1).forEach(s=>acc+=s.fin); const s=ss[i];
    $('trendInfo').innerHTML=`<b>${fmtDT(s.at).split(' ')[0]}</b> ${esc(s.table)}：${fmtYen(s.fin)}（${s.games.length}半荘）・累計 <b>${fmtYen(acc)}</b>`; return; }
  const b=e.target.closest('#sfPeriod button,#sfPlayers button'); if(!b) return;
  if(b.closest('#sfPeriod')) statsF.period=b.dataset.v; else statsF.players=Number(b.dataset.v);
  renderStats();
});
$('statsBox').addEventListener('change',e=>{ if(e.target.id==='sfTable'){ statsF.table=e.target.value; renderStats(); } });
$('statsReload').addEventListener('click',()=>renderStats(true));

/* ---------- nav ---------- */
function show(v){
  S.view=v;
  if(v==='players') v='rules';  // メンバーはルール画面の下にまとめた
  if(RO&&(v==='rules'||v==='share'||v==='stats')) v='total';
  S.view=v;
  ['rules','game','total','share','stats'].forEach(k=>$('v-'+k).hidden=k!==v);
  $('v-players').hidden=v!=='rules';
  $('menuBtn').classList.toggle('on',v==='stats'||v==='share');
  if(v==='share') renderShare();
  if(v==='stats') renderStats();
  if(v==='rules'&&S.cloud&&Sync.user) Sync.reloadMembers().then(renderPlayers).catch(()=>{});
  document.querySelectorAll('nav.tabs button').forEach(b=>{ if(b.dataset.view===v) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  save();
}
document.querySelector('nav.tabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; show(b.dataset.view); update(); window.scrollTo(0,0); });
// メニュー（成績・共有など、たまに使う画面）
const menu=$('menu');
$('menuBtn').addEventListener('click',()=>{ menu.querySelectorAll('[data-go]').forEach(b=>b.toggleAttribute('aria-current',b.dataset.go===S.view)); menu.showModal(); });
$('menuClose').addEventListener('click',()=>menu.close());
menu.addEventListener('click',e=>{
  if(e.target===menu){ menu.close(); return; }  // 外側（暗いところ）をタップで閉じる
  const b=e.target.closest('[data-go]'); if(!b) return;
  menu.close(); show(b.dataset.go); update(); window.scrollTo(0,0);
});

function update(){ renderHeader(); renderRules(); renderPlayers(); renderEntry(); renderGames(); renderTotal(); renderArchives(); if(!$('shareBox').contains(document.activeElement)) renderShare(); save(); }
if(RO){ document.body.classList.add('ro'); show('total'); update(); if(Cloud.configured) viewLoop(); else { S.viewErr='共有機能が設定されていません'; update(); } }
else {
  const jt=params.get('join'); if(jt&&Cloud.configured){ lsSet(KEY+':join',jt); S.view='share'; }
  show(S.view==='share'&&!Cloud.configured?'game':(S.view||'game')); update();
  Sync.init();
}
})();
