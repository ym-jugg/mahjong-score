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
let S;
try{ S=JSON.parse(localStorage.getItem(KEY)); }catch(e){ S=null; }
if(!S||!S.rules) S=sample();
S.draft=S.draft||{};
S.rules.tie=S.rules.tie||'kicha';
if(S.rules.tobi==null){ S.rules.tobi=false; S.rules.tobiPt=10; S.rules.tobiAt='neg'; }
// 旧形式（起家だけ保存）からの移行
S.games.forEach(g=>{ if(!g.seat){ const n=g.pts.length,d=g.dealer||0; g.seat=g.pts.map((_,p)=>(p-d+n)%n); delete g.dealer; } });
// メンバーは卓の人数〜6人。卓に入らない人は席が -1（抜け番）
S.members=Math.min(6,Math.max(S.rules.players,S.members||S.names.filter(x=>x!=null).length||S.rules.players));
while(S.names.length<6) S.names.push('');
function defaultSeat(){ return idSeat(S.members).map(i=>i<S.rules.players?i:-1); }
function validSeat(a){ if(!Array.isArray(a)||a.length!==S.members) return false; const n=S.rules.players;
  return a.every(w=>w===-1||(w>=0&&w<n))&&idSeat(n).every(w=>a.filter(x=>x===w).length<=1); }
if(!validSeat(S.seat)) S.seat=defaultSeat();
// 持ち点の入力は点数そのまま（25000）。以前の百点単位の入力途中データは消す
if(S.draftV!==2){ S.draft={}; S.draftV=2; }
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(e){} }

const $=id=>document.getElementById(id);
const N=()=>S.rules.players;
const M=()=>S.members;
const names=()=>S.names.slice(0,M());
const seated=()=>idSeat(M()).filter(p=>S.seat[p]>=0);
const seatOK=()=>idSeat(N()).every(w=>S.seat.filter(x=>x===w).length===1);
const rate=()=>Number(S.rules.rate);
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
  $('sampleBanner').hidden=!S.sample;
}

/* ---------- rules ---------- */
function setSeg(el,v){ el.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===String(v)))); }
function renderRules(){
  const r=S.rules;
  setSeg($('segPlayers'),r.players); setSeg($('segRate'),r.rate); setSeg($('segRound'),r.round); setSeg($('segTie'),r.tie);
  $('tieHint').textContent=TIE_HINT[r.tie];
  $('rateHint').textContent=`1000点＝${rate()*100}円（1pt＝${rate()*100}円）`;
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
bindSeg($('segRate'),v=>{S.rules.rate=v;});
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
  $('seatList').innerHTML=names().map((nm,i)=>`<div class="seat"><span class="num-b">${i+1}</span><label class="field"><input class="txt" id="name${i}" data-i="${i}" value="${esc(nm)}" placeholder="メンバー${i+1}の名前" maxlength="12" aria-label="メンバー${i+1}の名前"></label></div>`).join('');
}
$('segMembers').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b||b.disabled) return;
  const k=Number(b.dataset.v); if(k===M()) return;
  S.members=k;
  const ns=S.seat.slice(0,k); while(ns.length<k) ns.push(-1);
  S.seat=validSeat(ns)?ns:defaultSeat();
  S.chips=[]; unsample(); update(); });
$('seatList').addEventListener('input',e=>{ const i=e.target.dataset.i; if(i==null) return; S.names[i]=e.target.value; unsample(); renderHeader(); save(); });

/* ---------- game entry ---------- */
function parseDraft(i){ const d=S.draft['p'+i]; if(d==null||d==='') return null; const n=parseInt(d,10); if(isNaN(n)) return null; return (S.draft['s'+i]?-1:1)*n; }
function renderEntry(){
  $('nextTitle').textContent=`第${S.games.length+1}半荘の持ち点`;
  if($('entryList').contains(document.activeElement)) { checkSum(); return; }
  const n=N(), rot=M()>n;
  $('entryList').innerHTML=idSeat(M()).map(i=>{ const neg=!!S.draft['s'+i], out=S.seat[i]<0;
    const winds=idSeat(n).map(w=>`<button type="button" class="wb ${w===0?'red':''}" data-p="${i}" data-w="${w}" aria-pressed="${S.seat[i]===w}" aria-label="${esc(nameOf(i))}を${WINDS[w]}家にする">${WINDS[w]}</button>`).join('')
      +(rot?`<button type="button" class="wb nuke" data-p="${i}" data-w="-1" aria-pressed="${out}" aria-label="${esc(nameOf(i))}を抜け番にする">抜</button>`:'');
    const pin=out?`<div class="pin outpin">抜け番</div>`
      :`<div class="pin"><button type="button" class="sign ${neg?'neg':''}" data-s="${i}" aria-label="プラスとマイナスを切り替え">${neg?'−':'+'}</button><input id="pt${i}" data-i="${i}" inputmode="numeric" placeholder="25000" value="${S.draft['p'+i]??''}" aria-label="${esc(nameOf(i))}の持ち点"><span class="zz">点</span></div>`;
    return `<div class="entry ${out?'isout':''}"><div class="nm">${esc(nameOf(i))}</div><div class="winds">${winds}</div>${pin}</div>`;}).join('');
  checkSum();
}
function checkSum(){
  const n=N(), vals=seated().map(parseDraft), filled=vals.filter(v=>v!=null).length;
  const target=S.rules.start*n, sum=vals.reduce((a,b)=>a+(b||0),0), diff=sum-target;
  const el=$('sumCheck');
  if(!seatOK()){ el.className='check ng'; el.innerHTML=`<span>席が決まっていません</span><span>${idSeat(n).map(w=>WINDS[w]).join('')}を1人ずつ選んでください</span>`; $('saveGame').disabled=true; $('autoFill').disabled=true; renderTobi(); return; }
  if(filled<n){ el.className='check'; el.innerHTML=`<span>合計 <span class="num">${fmtPts(sum)}</span> / ${fmtPts(target)}点</span><span>あと${n-filled}人</span>`; }
  else if(diff===0){ el.className='check ok'; el.innerHTML=`<span>合計 <span class="num">${fmtPts(sum)}</span>点</span><span>一致しています</span>`; }
  else { el.className='check ng'; el.innerHTML=`<span>合計 <span class="num">${fmtPts(sum)}</span>点</span><span>${diff>0?'':'あと'}<span class="num">${fmtPts(Math.abs(diff))}</span>点${diff>0?'多い':'足りない'}</span>`; }
  const tobiOk=renderTobi();
  $('saveGame').disabled=!(filled===n&&diff===0&&tobiOk);
  $('autoFill').disabled=filled!==n-1;
}
$('entryList').addEventListener('input',e=>{ const i=e.target.dataset.i; if(i==null) return; e.target.value=e.target.value.replace(/[^0-9]/g,''); S.draft['p'+i]=e.target.value; checkSum(); save(); });
$('entryList').addEventListener('click',e=>{
  const w=e.target.closest('[data-w]');
  if(w){ // 席を入れ替え：選んだ風の人と交換
    const p=Number(w.dataset.p), nw=Number(w.dataset.w);
    if(nw<0){ S.seat[p]=-1; }            // 抜け番にする（空いた風は別の人を選ぶ）
    else { const q=S.seat.indexOf(nw); if(q>=0&&q!==p) S.seat[q]=S.seat[p]; S.seat[p]=nw; }
    unsample(); blur(); renderEntry(); if(scan) renderScan(); save(); return;
  }
  const b=e.target.closest('[data-s]'); if(!b) return;
  const i=b.dataset.s; S.draft['s'+i]=!S.draft['s'+i]; b.classList.toggle('neg',S.draft['s'+i]); b.textContent=S.draft['s'+i]?'−':'+'; checkSum(); save();
});
/* 飛び賞：飛んだ人ごとに「飛ばした人」を選ぶ。全員選び終わるまで記録できない */
function bustedInDraft(){ return S.rules.tobi?seated().filter(p=>{ const v=parseDraft(p); return v!=null&&isBust(v); }):[]; }
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
  const n=N(), ps=seated(), vals=ps.map(parseDraft), mi=vals.indexOf(null); if(mi<0) return;
  const miss=ps[mi], rest=S.rules.start*n-vals.reduce((a,b)=>a+(b||0),0);
  S.draft['s'+miss]=rest<0; S.draft['p'+miss]=String(Math.abs(rest));
  blur(); renderEntry(); save();
});
$('clearEntry').addEventListener('click',()=>{ S.draft={}; blur(); renderEntry(); save(); });
let freshId=null;
$('saveGame').addEventListener('click',()=>{
  if(!seatOK()) return;
  const pts=idSeat(M()).map(p=>S.seat[p]>=0?parseDraft(p):null);
  if(seated().some(p=>pts[p]==null)) return;
  unsample();
  const id=(S.games.reduce((m,g)=>Math.max(m,g.id),0))+1;
  const tobi={}; bustedInDraft().forEach(p=>{ tobi[p]=S.draft.tobi[p]; });
  S.games.push({id,seat:S.seat.slice(),pts,t:Date.now(),...(Object.keys(tobi).length?{tobi}:{})});
  freshId=id; S.draft={};
  blur(); update();
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
    return `<article class="game ${g.id===freshId?'fresh':''}"><header><b>第${no}半荘</b><span class="hint">起家 ${esc(nameOf(dealer))}・${hm}　<button type="button" class="btn danger" style="padding:2px 8px;font-size:11px" data-del="${g.id}">削除</button></span></header>
    <div class="res">${rows}</div>${c.out.length?`<div class="hint" style="margin-top:4px">抜け番：${c.out.map(i=>esc(nameOf(i))).join('、')}</div>`:''}${c.tobi.map(([p,b])=>`<div class="tobiLine">飛び賞：${esc(nameOf(p))} → ${esc(nameOf(b))}（${fix(tobiPt())}pt）</div>`).join('')}${c.tied.size?`<div class="hint" style="margin-top:4px">同点は「${TIE_LBL[S.rules.tie]}」で計算</div>`:''}${confirmDel===g.id?`<div class="confirm">この半荘を削除しますか？<button type="button" class="btn danger" data-delyes="${g.id}">削除する</button><button type="button" class="btn ghost" data-delno="1">やめる</button></div>`:''}</article>`;
  }).join('');
  freshId=null;
}
$('gameList').addEventListener('click',e=>{
  const d=e.target.closest('[data-del]'), y=e.target.closest('[data-delyes]'), no=e.target.closest('[data-delno]');
  if(d){ confirmDel=Number(d.dataset.del); renderGames(); }
  if(no){ confirmDel=null; renderGames(); }
  if(y){ S.games=S.games.filter(g=>g.id!==Number(y.dataset.delyes)); confirmDel=null; unsample(); update(); }
});

/* ---------- totals ---------- */
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
    $('chipFields').innerHTML=names().map((_,i)=>`<div><div class="mini">${esc(nameOf(i))}</div><label class="field"><input id="chip${i}" data-i="${i}" inputmode="numeric" value="${S.chips[i]??''}" aria-label="${esc(nameOf(i))}のチップ枚数"><span class="unit">枚</span></label></div>`).join('');
  }
  const cs=S.chips.reduce((a,b)=>a+(Number(b)||0),0), ct=r.chipInit*n, el=$('chipCheck');
  if(cs===ct){ el.className='check ok'; el.innerHTML=`<span>合計 <span class="num">${cs}</span>枚</span><span>一致しています</span>`; }
  else { el.className='check ng'; el.innerHTML=`<span>合計 <span class="num">${cs}</span> / ${ct}枚</span><span><span class="num">${Math.abs(cs-ct)}</span>枚${cs>ct?'多い':'足りない'}</span>`; }
  const ord=idSeat(n).sort((a,b)=>all[b]-all[a]);
  $('yenCards').className='big'+(n===3?' three':'');
  $('yenCards').innerHTML=ord.map(i=>`<div class="who"><div class="n">${esc(nameOf(i))}</div><div class="y ${cls(all[i])}">${fmtYen(yen(all[i]))}</div><div class="p">${fmtPt(all[i])}pt</div></div>`).join('');
  const head=`<tr><th>名前<small style="display:block;font-weight:500">着順</small></th><th>半荘</th><th>チップ</th><th>合計pt</th><th>金額</th></tr>`;
  const body=ord.map(i=>`<tr><td class="nm">${esc(nameOf(i))}<small>${rk[i].join('-')}${outs[i]?`・抜${outs[i]}`:''}</small></td><td class="${cls(tot[i])}">${fmtPt(tot[i])}</td><td class="${cls(chipPt[i])}">${fmtPt(chipPt[i])}</td><td class="${cls(all[i])}"><b>${fmtPt(all[i])}</b></td><td class="yen ${cls(all[i])}">${fmtYen(yen(all[i]))}</td></tr>`).join('');
  $('totalTable').innerHTML=`<thead>${head}</thead><tbody>${body}</tbody>`;
}
$('chipFields').addEventListener('input',e=>{ const i=e.target.dataset.i; if(i==null) return; e.target.value=e.target.value.replace(/[^0-9]/g,''); S.chips[i]=e.target.value===''?'':Number(e.target.value); unsample(); renderTotal(); save(); });
$('resetAll').addEventListener('click',()=>{ $('resetConfirm').hidden=false; });
$('resetNo').addEventListener('click',()=>{ $('resetConfirm').hidden=true; });
$('resetYes').addEventListener('click',()=>{ S.games=[]; S.chips=[]; S.draft={}; S.seat=defaultSeat(); $('resetConfirm').hidden=true; unsample(); update(); });
$('startFresh').addEventListener('click',()=>{ S.games=[]; S.chips=[]; S.draft={}; S.names=['','','','','','']; S.members=N(); S.seat=defaultSeat(); S.sample=false; show('players'); update(); setTimeout(()=>{const f=$('name0'); f&&f.focus();},50); });

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
        vals[k]={neg:v<0,v:String(Math.abs(v)*100)};
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
        vals[k]=ok?{neg:v<0,v:String(Math.abs(v)*100)}:{neg:!!(g&&g.neg),v:''}; });
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
function renderScan(redraw){
  if(!scan) return;
  $('segShooter').innerHTML=seated().map(i=>`<button type="button" data-v="${i}">${esc(nameOf(i))}</button>`).join('');
  setSeg($('segShooter'),scan.shooter);
  if(!$('scanRows').contains(document.activeElement)){
    $('scanRows').innerHTML=Object.keys(roleOffs()).map(k=>{ const p=playerFor(k), v=scan.vals[k], miss=v.v==='';
      return `<div class="entry ${miss?'miss':''}"><div class="nm">${esc(nameOf(p))}<small>${WINDS[S.seat[p]]}家</small></div>
      <div class="role">${ROLE_LBL[k]}${miss?`・<span class="raw">${scan.raw[k]?'読み取り「'+esc(scan.raw[k])+'」':'見つかりませんでした'}</span>`:(scan.note[k]?`・<span class="raw">${scan.note[k]}（読み取り「${esc(scan.raw[k]||'—')}」）</span>`:'')}</div>
      <div class="pin"><button type="button" class="sign ${v.neg?'neg':''}" data-rs="${k}" aria-label="プラスとマイナスを切り替え">${v.neg?'−':'+'}</button><input id="scan_${k}" data-r="${k}" inputmode="numeric" value="${v.v}" placeholder="?" aria-label="${esc(nameOf(p))}の持ち点"><span class="zz">点</span></div></div>`; }).join('');
  }
  if(redraw!==false) drawScan();
  const ks=Object.keys(roleOffs()), filled=ks.filter(k=>scan.vals[k].v!=='');
  const sum=ks.reduce((a,k)=>a+(scan.vals[k].v===''?0:(scan.vals[k].neg?-1:1)*Number(scan.vals[k].v)),0), target=S.rules.start*N(), el=$('scanCheck');
  if(filled.length<ks.length){ el.className='check ng'; el.innerHTML=`<span>読めなかった人が${ks.length-filled.length}人います</span><span>赤い欄を入力してください</span>`; }
  else if(sum===target){ el.className='check ok'; el.innerHTML=`<span>合計 <span class="num">${fmtPts(sum)}</span>点</span><span>一致しています</span>`; }
  else { el.className='check ng'; el.innerHTML=`<span>合計 <span class="num">${fmtPts(sum)}</span>点</span><span>${fmtPts(Math.abs(sum-target))}点${sum>target?'多い':'足りない'}・写真と見比べてください</span>`; }
}
$('camIn').addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const url=URL.createObjectURL(f); runScan(url); e.target.value=''; });
if($('demoScan')) $('demoScan').addEventListener('click',()=>{ if(window.SAMPLE_PHOTO) runScan(window.SAMPLE_PHOTO); });
$('segShooter').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; scan.shooter=Number(b.dataset.v); S.shooter=scan.shooter; save(); blur(); renderScan(); });
$('scanRows').addEventListener('input',e=>{ const k=e.target.dataset.r; if(!k) return; e.target.value=e.target.value.replace(/[^0-9]/g,''); scan.vals[k].v=e.target.value; e.target.closest('.entry').classList.toggle('miss',e.target.value===''); renderScan(false); });
$('scanRows').addEventListener('click',e=>{ const b=e.target.closest('[data-rs]'); if(!b) return; const v=scan.vals[b.dataset.rs]; v.neg=!v.neg; b.classList.toggle('neg',v.neg); b.textContent=v.neg?'−':'+'; renderScan(false); });
$('scanCancel').addEventListener('click',()=>{ scan=null; $('scanBox').hidden=true; });
$('scanApply').addEventListener('click',()=>{
  Object.keys(roleOffs()).forEach(k=>{ const p=playerFor(k), v=scan.vals[k]; if(v.v==='') return; S.draft['p'+p]=v.v; S.draft['s'+p]=v.neg; });
  scan=null; $('scanBox').hidden=true; unsample(); blur(); renderEntry(); save();
  $('entryList').scrollIntoView({behavior:'smooth',block:'start'});
});

/* ---------- nav ---------- */
function show(v){
  S.view=v;
  ['rules','players','game','total'].forEach(k=>$('v-'+k).hidden=k!==v);
  document.querySelectorAll('nav.tabs button').forEach(b=>{ if(b.dataset.view===v) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  save();
}
document.querySelector('nav.tabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; show(b.dataset.view); update(); window.scrollTo(0,0); });

function update(){ renderHeader(); renderRules(); renderPlayers(); renderEntry(); renderGames(); renderTotal(); save(); }
show(S.view||'game'); update();
})();
