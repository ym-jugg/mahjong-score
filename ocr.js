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
      const Fs=ds.map((d,i)=>ORDER.map(k=>fill(m,W,H,X0+i*P,gTop,gW,gH,sh,REG[k])));
      const all=Fs.flat().sort((x,y)=>x-y);
      const lo=all[Math.floor(all.length*.1)], hi=Math.max(all[Math.floor(all.length*.9)],lo+.2);
      let total=0; const chars=[];
      Fs.forEach((F,pos)=>{
        const f=F.map(v=>Math.min(1,Math.max(0,(v-lo)/(hi-lo))));
        const errs=TPL.map((t,n)=>n===10&&pos>0?99:t.reduce((e,tv,j)=>e+(f[j]-tv)**2,0));
        const order=errs.map((e,n)=>[e,n]).sort((x,y)=>x[0]-y[0]);
        const [e1,n1]=order[0], e2=order[1][0];
        total+=e1;
        chars.push(e1<1.2&&e2-e1>.25?(n1===10?'-':String(n1)):'?');
      });
      if(!best||total<best.total) best={total,chars};
    }
    return best.chars;
  }

  function read(img){
    const cv=toCanvas(img);
    let r=analyze(cv);
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
        const r2=analyze(rc);
        const cnt=x=>x.groups.reduce((a,g)=>a+g.chars.filter(ch=>ch!=='?').length,0);
        if(cnt(r2)>=cnt(r)) r=r2;
      }
    }
    return r;
  }
  function analyze(cv){
    const W=cv.width, H=cv.height;
    const data=cv.getContext('2d').getImageData(0,0,W,H).data;
    const m=redMask(data,W,H);
    const red=new Float32Array(W*H); for(let i=0,p=0;i<red.length;i++,p+=4) red[i]=data[p]-(data[p+1]+data[p+2])/2;
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
      g.chars=decodeGroup(g,red,W,H);
      let txt=g.chars.join('');
      if(txt.startsWith('-')){ g.neg=true; txt=txt.replace(/^-+/,''); }
      g.text=(g.neg?'-':'')+txt;
      g.value=/^\d+$/.test(txt)?(g.neg?-1:1)*parseInt(txt,10):null; // 百点単位
    });
    // 役割: 一番大きい=自分、上=対面、左=上家、右=下家
    const roles={};
    if(gs.length){
      const self=gs.reduce((a,b)=>b.h>a.h?b:a); roles.self=self;
      gs.filter(g=>g!==self).forEach(g=>{
        const dx=g.cx-self.cx, dy=g.cy-self.cy, sw=self.x1-self.x0;
        const role=(Math.abs(dx)<sw*.6&&dy<0)?'toimen':(dx<0?'kamicha':'shimocha');
        if(!roles[role]) roles[role]=g;
      });
    }
    return {canvas:cv,groups:gs,roles};
  }
  return {read};
})();
