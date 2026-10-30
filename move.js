/* アドレスの引っ越し（github.io → 新しいアドレス）
   古いアドレスを開いたら、この端末に保存された記録をURLの#に入れて新しいアドレスへ移動する。
   新しいアドレス側では#の記録を受け取って保存し、#を消して読み込み直す。 */
(function(){
  var FROM_HOST='ym-jugg.github.io';
  var MOVE_TO='https://janshot.vercel.app';
  var PREFIX='jansou-scorebook-v1', TAG='#mj-move=';
  function cover(t){ var d=document.createElement('div'); d.textContent=t;
    d.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#EDF1EE;color:#15221E;font:16px sans-serif';
    (document.body||document.documentElement).appendChild(d); }
  function b64(u8){ var s=''; for(var i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function unb64(s){ s=s.replace(/-/g,'+').replace(/_/g,'/'); var b=atob(s), u=new Uint8Array(b.length); for(var i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; }
  async function pipe(u8,Stream){ return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new Stream('gzip'))).arrayBuffer()); }
  // 古いアドレス：記録を持って移動
  if(MOVE_TO&&location.hostname===FROM_HOST){
    window.__moving=true;
    (async function(){
      var url=MOVE_TO+'/'+location.search, data={};
      try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k&&k.indexOf(PREFIX)===0) data[k]=localStorage.getItem(k); } }catch(e){}
      if(Object.keys(data).length){
        try{ var raw=new TextEncoder().encode(JSON.stringify(data)), z=window.CompressionStream?await pipe(raw,CompressionStream):null;
          var enc=z?'z'+b64(z):'p'+b64(raw); if(enc.length<1500000) url+=TAG+enc; }catch(e){}
      }
      location.replace(url);
    })();
    document.addEventListener('DOMContentLoaded',function(){ cover('新しいアドレスに移動しています…'); });
    return;
  }
  // 新しいアドレス：受け取った記録を保存（すでにある記録は上書きしない）
  if(location.hash.indexOf(TAG)===0){
    window.__moving=true;
    (async function(){
      try{ var enc=location.hash.slice(TAG.length), u=unb64(enc.slice(1));
        if(enc[0]==='z') u=await pipe(u,DecompressionStream);
        var data=JSON.parse(new TextDecoder().decode(u));
        Object.keys(data).forEach(function(k){ if(k.indexOf(PREFIX)===0&&localStorage.getItem(k)==null) localStorage.setItem(k,data[k]); });
      }catch(e){}
      location.replace(location.pathname+location.search);
    })();
    document.addEventListener('DOMContentLoaded',function(){ cover('記録を引き継いでいます…'); });
  }
})();
