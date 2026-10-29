// ネット優先・オフライン時はキャッシュ。更新は次にアプリを開いたときに反映されます。
const CACHE='jansou-v38';
const ASSETS=['./','./index.html','./style.css','./app.js','./ocr.js','./cloud.js','./config.js','./lib/supabase.js','./lib/qrcode.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||!req.url.startsWith(self.location.origin)) return;
  // ブラウザのHTTPキャッシュを使わず毎回サーバーに確認（古いCSS/JSが混ざらないように）
  e.respondWith(fetch(new Request(req.url,{cache:'no-cache'})).then(res=>{
    if(res.ok){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); }
    return res;
  }).catch(()=>caches.match(req,{ignoreSearch:true}).then(hit=>hit||caches.match('./index.html'))));
});
