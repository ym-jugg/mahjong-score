/* 自動卓（AMOS系）点数表示の7セグ読み取り。端末内で完結。 */
const SegOCR=(function(){
  const PATTERNS={'1110111':0,'0010010':1,'1011101':2,'1011011':3,'0111010':4,'1101011':5,'1101111':6,'1010010':7,'1110010':7,'1111111':8,'1111011':9,'1101111x':6};
  // 並び: a(上) f(左上) b(右上) g(中) e(左下) c(右下) d(下)
  const REG={a:[.35,.65,.02,.14],f:[.02,.22,.2,.38],b:[.78,.98,.2,.38],g:[.35,.65,.44,.56],e:[.02,.22,.62,.8],c:[.78,.98,.62,.8],d:[.35,.65,.86,.98]};
  const ORDER=['a','f','b','g','e','c','d'];

  function toCanvas(img){
    let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
    let sc=1; if(w>1600) sc=1600/w; if(w<900) sc=900/w;
    const cv=document.createElement('canvas'); cv.width=Math.round(w*sc); cv.height=Math.round(h*sc);
    const cx=cv.getContext('2d',{willReadFrequently:true}); cx.imageSmoothingQuality='high'; cx.drawImage(img,0,0,cv.width,cv.height);
    return cv;
  }
  // 白っぽく光る数字（露出オーバーや、赤い枠の上に明るい数字が出る表示）用
  function brightMask(data,W,H){
    const m=new Uint8Array(W*H);
    for(let i=0,p=0;i<m.length;i++,p+=4){
      const r=data[p],g=data[p+1],b=data[p+2];
      if(r>=190&&g>=r*.45&&r>=b&&r+g>=330) m[i]=1;
    }
    return m;
  }
  function redMask(data,W,H){
    const m=new Uint8Array(W*H);
    for(let i=0,p=0;i<m.length;i++,p+=4){
      const r=data[p],g=data[p+1],b=data[p+2];
      if(r>=110&&r-g>=60&&g<=r*.5&&b<=r*.6) m[i]=1;
      else if(r>=235&&g<=r*.75&&b<=r*.75&&r-g>=60) m[i]=1; // 光って白っぽくなった部分
    }
    return m;
  }
  function dilate(m,W,H,rad){
    if(rad<1) return m;
    const t=new Uint8Array(W*H), o=new Uint8Array(W*H);
    for(let y=0;y<H;y++){ let run=-1e9; for(let x=0;x<W;x++){ if(m[y*W+x]) run=x; if(x-run<=rad) t[y*W+x]=1; } run=1e9; for(let x=W-1;x>=0;x--){ if(m[y*W+x]) run=x; if(run-x<=rad) t[y*W+x]=1; } }
    for(let x=0;x<W;x++){ let run=-1e9; for(let y=0;y<H;y++){ if(t[y*W+x]) run=y; if(y-run<=rad) o[y*W+x]=1; } run=1e9; for(let y=H-1;y>=0;y--){ if(t[y*W+x]) run=y; if(run-y<=rad) o[y*W+x]=1; } }
    return o;
  }
  // 細い線（表示の枠線など）を消して、太い数字の線だけ残す
  function openMask(m,W,H,rad){
    const inv=new Uint8Array(W*H); for(let i=0;i<inv.length;i++) inv[i]=m[i]?0:1;
    const er=dilate(inv,W,H,rad); for(let i=0;i<er.length;i++) er[i]=er[i]?0:1;
    return dilate(er,W,H,rad);
  }
  function components(m,W,H,orig){
    const lab=new Int32Array(W*H), out=[], st=[];
    let id=0;
    for(let i=0;i<W*H;i++){
      if(!m[i]||lab[i]) continue;
      id++; let x0=1e9,y0=1e9,x1=-1,y1=-1,area=0; st.push(i); lab[i]=id;
      while(st.length){ const k=st.pop(), x=k%W, y=(k-x)/W;
        if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; if(orig[k]) area++;
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue; const q=ny*W+nx; if(m[q]&&!lab[q]){ lab[q]=id; st.push(q);} } }
      out.push({x0,y0,x1:x1+1,y1:y1+1,area});
    }
    return out;
  }
  const bw=b=>b.x1-b.x0, bh=b=>b.y1-b.y0, bcy=b=>(b.y0+b.y1)/2, bcx=b=>(b.x0+b.x1)/2;
  function mergePieces(bs){
    let changed=true;
    while(changed){ changed=false;
      outer: for(let i=0;i<bs.length;i++) for(let j=i+1;j<bs.length;j++){
        const A=bs[i],B=bs[j], maxH=Math.max(bh(A),bh(B));
        const xo=Math.min(A.x1,B.x1)-Math.max(A.x0,B.x0), yo=Math.min(A.y1,B.y1)-Math.max(A.y0,B.y0);
        const vg=Math.max(A.y0,B.y0)-Math.min(A.y1,B.y1), hg=Math.max(A.x0,B.x0)-Math.min(A.x1,B.x1);
        const vert=xo>=.3*Math.min(bw(A),bw(B))&&vg<=.2*maxH;
        const horz=yo>=.3*Math.min(bh(A),bh(B))&&hg<=.12*maxH;
        if(vert||horz){ bs[i]={x0:Math.min(A.x0,B.x0),y0:Math.min(A.y0,B.y0),x1:Math.max(A.x1,B.x1),y1:Math.max(A.y1,B.y1),area:A.area+B.area}; bs.splice(j,1); changed=true; break outer; }
      }
    }
    return bs;
  }
  const median=a=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?s[s.length>>1]:0; };

  function fill(m,W,H,x0,y0,gW,gH,sh,r){ // m: 明るさ配列＋閾値 {v,T}
    let on=0,n=0;
    for(let iy=0;iy<6;iy++) for(let ix=0;ix<6;ix++){
      const u=r[0]+(r[1]-r[0])*(ix+.5)/6, v=r[2]+(r[3]-r[2])*(iy+.5)/6;
      const x=Math.round(x0+(1-v)*sh+u*(gW-sh)), y=Math.round(y0+v*gH);
      if(x<0||y<0||x>=W||y>=H) continue; n++; if(m.v[y*W+x]>m.T) on++;
    }
    return n?on/n:0;
  }
  function decodeGroup(g,red,W,H){
    // 点灯と消灯（うっすら光る）を分けるため、表示ごとに明るさの閾値を決める
    const vals=[]; for(const d of g.digits) for(let y=d.y0;y<d.y1;y+=1) for(let x=d.x0;x<d.x1;x+=1) vals.push(red[y*W+x]);
    vals.sort((a,b)=>a-b); const hi=vals[Math.floor(vals.length*.97)]||255;
    const m={v:red,T:hi*.7};
    const full=g.digits.filter(d=>bw(d)>=.5*bh(d));
    const gH=median(g.digits.map(bh)), gTop=median(g.digits.map(d=>d.y0));
    const gW=full.length?median(full.map(bw)):gH*.6;
    // 桁は等間隔に並ぶので、ピッチと左端から各桁の枠を決める（斜体の5・6などで枠がずれないように）
    const ds=g.digits, k=ds.length, diffs=[];
    for(let i=1;i<k;i++){ diffs.push(ds[i].x0-ds[i-1].x0, ds[i].x1-ds[i-1].x1); }
    const P=k>1?median(diffs):gW*1.2;
    const wide=ds.map((d,i)=>[d,i]).filter(([d])=>bw(d)>=.85*gW);
    const X0=wide.length?median(wide.map(([d,i])=>d.x0-i*P)):median(ds.map((d,i)=>d.x1-gW-i*P));
    const TPL=[[1,1,1,0,1,1,1],[0,0,1,0,0,1,0],[1,0,1,1,1,0,1],[1,0,1,1,0,1,1],[0,1,1,1,0,1,0],[1,1,0,1,0,1,1],[1,1,0,1,1,1,1],[1,0,1,0,0,1,0],[1,1,1,1,1,1,1],[1,1,1,1,0,1,1],[0,0,0,1,0,0,0]];
    let best=null;
    for(const s of [0,.05,.1,.15,.2,.25]){
      const sh=s*gH; if(sh>gW*.6) continue;
      // 桁の枠：十分な幅があればその桁自身の枠（遠近で右ほど大きく写る場合に対応）、細い桁は等間隔の位置から
      const Fs=ds.map((d,i)=>{ const own=bw(d)>=.8*gW&&bh(d)>=.85*gH;
        const cx0=own?d.x0:X0+i*P, cw=own?bw(d):gW, cy0=own?d.y0:gTop, ch=own?bh(d):gH, csh=s*ch;
        return ORDER.map(k=>fill(m,W,H,cx0,cy0,cw,ch,Math.min(csh,cw*.6),REG[k])); });
      const all=Fs.flat().sort((x,y)=>x-y);
      const lo=all[Math.floor(all.length*.1)], hi=Math.max(all[Math.floor(all.length*.9)],lo+.2);
      let total=0; const chars=[], cands=[];
      Fs.forEach((F,pos)=>{
        const f=F.map(v=>Math.min(1,Math.max(0,(v-lo)/(hi-lo))));
        const errs=TPL.map((t,n)=>n===10&&pos>0?99:t.reduce((e,tv,j)=>e+(f[j]-tv)**2,0));
        const order=errs.map((e,n)=>[e,n]).sort((x,y)=>x[0]-y[0]);
        const [e1,n1]=order[0], e2=order[1][0];
        total+=e1;
        cands.push(order.slice(0,3).map(([e,n])=>({d:n===10?'-':String(n),e})));
        chars.push(e1<1.2&&e2-e1>.25?(n1===10?'-':String(n1)):'?');
      });
      if(!best||total<best.total) best={total,chars,cands};
    }
    return best;
  }

  const quality=g=>g.chars.filter(ch=>/\d/.test(ch)).length*10+(g.value!=null?50:0)+g.digits.length;
  // 読み方を変えた複数の結果を、表示の位置ごとにまとめて一番よく読めたものを残す
  function runAll(cv){
    const base=Math.max(1,Math.round(Math.min(cv.width,cv.height)/450));
    const out=[];
    [['red',0],['bright',base],['bright',Math.round(base*1.5)+1]].forEach(([mode,rad])=>{
      analyze(cv,mode,rad).forEach(g=>{
        const i=out.findIndex(o=>{ const xo=Math.min(o.x1,g.x1)-Math.max(o.x0,g.x0); return xo>.5*Math.min(o.x1-o.x0,g.x1-g.x0)&&Math.abs(o.cy-g.cy)<.5*Math.max(o.h,g.h); });
        if(i<0) out.push(g); else if(quality(g)>quality(out[i])) out[i]=g;
      });
    });
    return out;
  }
  function pickRoles(gs){
    gs=gs.slice().sort((a,b)=>quality(b)-quality(a)||b.h-a.h).slice(0,4);
    const roles={};
    const cand=gs.filter(g=>g.digits.length>=3); const pool=cand.length?cand:gs;
    if(pool.length){
      const self=pool.reduce((a,b)=>b.h>a.h?b:a); roles.self=self;
      gs.filter(g=>g!==self).forEach(g=>{
        const dx=g.cx-self.cx, dy=g.cy-self.cy, sw=self.x1-self.x0;
        const role=(Math.abs(dx)<sw*.6&&dy<0)?'toimen':(dx<0?'kamicha':'shimocha');
        if(!roles[role]||quality(g)>quality(roles[role])) roles[role]=g;
      });
    }
    return {groups:gs,roles};
  }
  const score=r=>Object.values(r.roles).reduce((a,g)=>a+quality(g),0);
  function read(img){
    const cv=toCanvas(img);
    let r=Object.assign({canvas:cv},pickRoles(runAll(cv)));
    const self=r.roles.self;
    if(self&&self.digits.length>=3){
      // 自分の表示の数字の並びから傾きを求めて補正
      const pts=self.digits.map(d=>[bcx(d),d.y1]), n=pts.length, mx=pts.reduce((a,p)=>a+p[0],0)/n, my=pts.reduce((a,p)=>a+p[1],0)/n;
      const k=pts.reduce((a,p)=>a+(p[0]-mx)*(p[1]-my),0)/pts.reduce((a,p)=>a+(p[0]-mx)**2,0);
      const ang=Math.atan(k);
      if(Math.abs(ang)>.015){
        const rc=document.createElement('canvas'); rc.width=cv.width; rc.height=cv.height;
        const c=rc.getContext('2d',{willReadFrequently:true}); c.fillStyle='#000'; c.fillRect(0,0,rc.width,rc.height);
        c.translate(rc.width/2,rc.height/2); c.rotate(-ang); c.drawImage(cv,-cv.width/2,-cv.height/2);
        const r2=Object.assign({canvas:rc},pickRoles(runAll(rc)));
        if(score(r2)>=score(r)) r=r2;
      }
    }
    return r;
  }
  function analyze(cv,mode,rad){
    const W=cv.width, H=cv.height;
    const data=cv.getContext('2d').getImageData(0,0,W,H).data;
    let m=mode==='bright'?brightMask(data,W,H):redMask(data,W,H);
    if(mode==='bright') m=openMask(m,W,H,rad);
    // 点灯判定に使う明るさ：赤い数字は「赤さ」、白っぽい数字は「赤＋緑の明るさ」
    const red=new Float32Array(W*H);
    for(let i=0,p=0;i<red.length;i++,p+=4) red[i]=mode==='bright'?data[p]+data[p+1]:data[p]-(data[p+1]+data[p+2])/2;
    const dm=dilate(m,W,H,Math.max(1,Math.round(Math.min(W,H)/400)));
    let bs=components(dm,W,H,m).filter(b=>b.area>=6&&bh(b)<H*.5&&bw(b)<W*.3);
    bs=mergePieces(bs);
    const tall=bs.filter(b=>bh(b)>=4&&bh(b)>=bw(b)*1.1);
    const Hm=median(tall.map(bh));
    // 数字候補とマイナス候補
    const digits=tall.filter(b=>bh(b)>=Hm*.6).sort((a,b)=>a.x0-b.x0);
    const dashes=bs.filter(b=>bw(b)>=bh(b)*1.6&&bh(b)<Hm*.45&&bw(b)<Hm*1.2);
    const groups=[];
    for(const d of digits){
      let g=groups.find(g=>{ const l=g.digits[g.digits.length-1]; const h=bh(l);
        return Math.abs(bcy(l)-bcy(d))<.3*h&&Math.abs(bh(d)-h)<.3*h&&d.x0-l.x1<1.1*h&&d.x0-l.x1>-.2*h; });
      if(g) g.digits.push(d); else groups.push({digits:[d]});
    }
    let gs=groups.filter(g=>g.digits.length>=2);
    gs.forEach(g=>{ const ds=g.digits; g.x0=Math.min(...ds.map(d=>d.x0)); g.x1=Math.max(...ds.map(d=>d.x1)); g.y0=median(ds.map(d=>d.y0)); g.y1=median(ds.map(d=>d.y1)); g.h=g.y1-g.y0; g.cx=(g.x0+g.x1)/2; g.cy=(g.y0+g.y1)/2; g.score=ds.length*g.h; });
    gs.sort((a,b)=>b.score-a.score); gs=gs.slice(0,4);
    gs.forEach(g=>{
      g.neg=dashes.some(s=>Math.abs(bcy(s)-g.cy)<.25*g.h&&s.x1<=g.x0+.2*g.h&&s.x0>=g.x0-1.6*g.h);
      g.digits=g.digits.slice(-4);
      const dec=decodeGroup(g,red,W,H); g.chars=dec.chars; g.cands=dec.cands;
      let txt=g.chars.join('');
      if(txt.startsWith('-')){ g.neg=true; txt=txt.replace(/^-+/,''); }
      g.text=(g.neg?'-':'')+txt;
      g.value=/^\d+$/.test(txt)?(g.neg?-1:1)*parseInt(txt,10):null; // 百点単位
    });
    return gs;
  }
  // 全員の合計が決まっている（配給原点×人数）ことを使って、怪しい桁を候補から選び直す。
  // 答えが1通りに絞れないとき・桁数がおかしいときは補正しない（間違った数字で合計だけ合うのを防ぐ）
  function solve(roles,keys,targetPts){
    const clean=g=>g&&g.cands&&g.digits.length>=3&&g.chars.every(ch=>/[\d-]/.test(ch));
    const opts=keys.map(k=>{ const g=roles[k]; if(!g||!g.cands||g.digits.length<3) return null;
      let list=[{v:'',cost:0}];
      g.cands.forEach(c=>{
        if(c[0].d==='-') return;
        const ds=c.filter(x=>/\d/.test(x.d)); if(!ds.length) return;
        const top=ds[0].e, pick=g.chars.includes('?')?ds:ds.filter(x=>x.e<=top+.6);
        const nx=[]; list.forEach(a=>pick.forEach(x=>nx.push({v:a.v+x.d,cost:a.cost+x.e-top}))); nx.sort((a,b)=>a.cost-b.cost); list=nx.slice(0,20);
      });
      const sg=g.neg?-1:1;
      return list.map(a=>({n:sg*parseInt(a.v,10),cost:a.cost})).filter(a=>!isNaN(a.n));
    });
    const sols=[];
    [100,10].forEach(unit=>{
      const T=targetPts/unit;
      const known=opts.map((o,i)=>o&&o.length?i:-1).filter(i=>i>=0), miss=opts.map((o,i)=>o&&o.length?-1:i).filter(i=>i>=0);
      if(miss.length>1) return;
      if(miss.length===1&&!known.every(i=>clean(roles[keys[i]]))) return; // 1人を合計から出すのは、他の3人がきれいに読めたときだけ
      const ok=v=>Number.isInteger(v)&&(v*unit)%100===0&&Math.abs(v*unit)<=targetPts*1.5;
      const rec=(i,sum,cost,pick)=>{
        if(i===known.length){
          const vals=pick.slice();
          if(miss.length) vals[miss[0]]=T-sum; else if(sum!==T) return;
          if(!vals.every(ok)) return;
          sols.push({cost,unit,vals,filled:miss.length?miss[0]:-1}); return;
        }
        const o=miss.length?opts[known[i]].slice(0,1):opts[known[i]];
        for(const a of o){ pick[known[i]]=a.n; rec(i+1,sum+a.n,cost+a.cost,pick); }
      };
      rec(0,0,0,[]);
    });
    if(!sols.length) return null;
    sols.sort((a,b)=>a.cost-b.cost);
    const best=sols[0], key=x=>x.vals.map(v=>v*x.unit).join(',');
    const rival=sols.find(x=>key(x)!==key(best));
    if(rival&&rival.cost-best.cost<.5) return null; // 候補が複数ありうる
    const out={};
    keys.forEach((k,i)=>{ out[k]={value:best.vals[i]*best.unit/100,filled:i===best.filled}; });
    return out;
  }
  return {read,solve};
})();
