/* MyTrip caches only public app files. Firebase data, tokens, receipts and avatars are never cached here. */
const CACHE = 'mytrip-shell-5a5ddbe54538-download-fix';
const ASSETS = ["./", "./assets/apple-touch-icon.png", "./assets/chart.js", "./assets/fa-brands-400.woff2", "./assets/fa-regular-400.woff2", "./assets/fa-solid-900.woff2", "./assets/firebase-client.js", "./assets/fontawesome.css", "./assets/google.svg", "./assets/html2canvas.js", "./assets/html5-qrcode.js", "./assets/icon-192.png", "./assets/icon-512.png", "./assets/icon-maskable-512.png", "./assets/pwa.js", "./assets/qrcode.js", "./assets/tailwind.css", "./assets/xlsx.js", "./index.html", "./manifest.webmanifest"];
const SCOPE = new URL(self.registration.scope);
const SHELL = new URL('./index.html', SCOPE).href;
const assetUrls = new Set(ASSETS.map(path=>new URL(path,SCOPE).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('mytrip-shell-') && key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  // No interception of auth, database, receipt, Google API or other private network requests.
  if(url.origin!==SCOPE.origin) return;
  if(request.mode==='navigate' && (url.pathname===SCOPE.pathname || url.pathname===new URL('./index.html',SCOPE).pathname)) {
    event.respondWith((async()=>{
      try {
        // Keep one coherent release: serve the installed shell until an update is accepted.
        const cached=await caches.match(SHELL,{cacheName:CACHE});
        if(cached) return cached;
        return await fetch(request);
      } catch(error) {
        return new Response('MyTrip is not cached yet. Connect to the internet and open the app once.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }
  if(assetUrls.has(url.href)) {
    event.respondWith(caches.match(url.href,{cacheName:CACHE}).then(cached=>cached || fetch(request)));
  }
});
