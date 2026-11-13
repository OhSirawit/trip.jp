/* Firebase receives DATA-ONLY pushes. Session checks happen before any notification is displayed. */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
const PUSH_DB='mytrip-push-v1:'+self.registration.scope;
let pushDatabase;
let pushWorkQueue=Promise.resolve();
function serializePushWork(task){const result=pushWorkQueue.then(task,task);pushWorkQueue=result.catch(()=>{});return result;}
function openPushDatabase(){
 if(pushDatabase)return pushDatabase;
 pushDatabase=new Promise((resolve,reject)=>{
  const request=indexedDB.open(PUSH_DB,1);
  request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('state');db.createObjectStore('seen');};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 return pushDatabase;
}
async function readPushSession(){
 const db=await openPushDatabase();
 return await new Promise((resolve,reject)=>{const request=db.transaction('state').objectStore('state').get('current');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
async function writePushSession(session){
 const db=await openPushDatabase();
 await new Promise((resolve,reject)=>{const transaction=db.transaction('state','readwrite');transaction.objectStore('state').put(session,'current');transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});
}
async function claimPushEvent(key){
 const db=await openPushDatabase();
 return await new Promise((resolve,reject)=>{
  const transaction=db.transaction('seen','readwrite'),store=transaction.objectStore('seen');
  let claimed=false;const request=store.get(key);
  request.onsuccess=()=>{if(!request.result){store.put(Date.now(),key);claimed=true;}};
  transaction.oncomplete=()=>resolve(claimed);transaction.onerror=()=>reject(transaction.error);
 });
}
async function forgetPushEvent(key){
 const db=await openPushDatabase();
 await new Promise((resolve,reject)=>{const transaction=db.transaction('seen','readwrite');transaction.objectStore('seen').delete(key);transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});
}
async function prunePushEvents(){
 const db=await openPushDatabase();
 await new Promise((resolve,reject)=>{
  const transaction=db.transaction('seen','readwrite'),store=transaction.objectStore('seen');
  const request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(cursor.value<Date.now()-7*86400000)cursor.delete();cursor.continue();};
  transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);
 });
}
async function displayTripPush(data){
 if(data?.app!=='mytrip'||!/^[a-f0-9]{64}$/.test(data.eventId||'')||!/^[A-Za-z0-9_-]{1,128}$/.test(data.tripId||''))return;
 const session=await readPushSession();
 // The server checks live membership. Do not use a cached trip list here: a newly shared trip must notify even while this device is closed.
 if(!session?.enabled||session.uid!==data.targetUid)return;
 const key=session.uid+':'+data.eventId;
 if(!await claimPushEvent(key))return;
 try{
  await self.registration.showNotification(String(data.title||'MyTrip').slice(0,150),{
   body:String(data.body||'').slice(0,600),icon:new URL('./assets/icon-192.png',self.registration.scope).href,
   badge:new URL('./assets/icon-192.png',self.registration.scope).href,
   tag:'mytrip-'+data.eventId,renotify:false,
   data:{mytrip:true,uid:session.uid,tripId:data.tripId,eventId:data.eventId}
  });
  await prunePushEvents();
 }catch(error){await forgetPushEvent(key);throw error;}
}
// Register before Firebase installs its default click handler.
self.addEventListener('notificationclick',event=>{
 const data=event.notification.data;
 if(!data?.mytrip)return;
 event.stopImmediatePropagation();event.notification.close();
 event.waitUntil(serializePushWork(async()=>{
  const session=await readPushSession();
  if(!session?.enabled||session.uid!==data.uid)return;
  const scope=new URL(self.registration.scope);
  const target=new URL('./',scope);target.searchParams.set('trip',data.tripId);target.searchParams.set('notification',data.eventId);
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const client=clients.find(client=>{const url=new URL(client.url);return url.origin===scope.origin&&url.pathname.startsWith(scope.pathname);});
  if(client){await client.focus();client.postMessage({type:'OPEN_NOTIFICATION_TRIP',uid:data.uid,tripId:data.tripId});}
  else await self.clients.openWindow(target.href);
 }));
});
self.addEventListener('message',event=>{
 if(!['SET_PUSH_SESSION','DISPLAY_TRIP_PUSH'].includes(event.data?.type))return;
 const source=event.source?.url;
 if(!source||!source.startsWith(self.registration.scope))return;
 event.waitUntil(serializePushWork(async()=>{
  if(event.data.type==='SET_PUSH_SESSION'){
   const previous=await readPushSession();
   const session={uid:typeof event.data.uid==='string'?event.data.uid:null,enabled:event.data.enabled===true,tripIds:Array.isArray(event.data.tripIds)?event.data.tripIds.filter(id=>typeof id==='string').slice(0,1000):[]};
   await writePushSession(session);
   if(!session.enabled||previous?.uid!==session.uid){
    const notifications=await self.registration.getNotifications();for(const notification of notifications)if(notification.data?.mytrip)notification.close();
   }
   event.ports?.[0]?.postMessage({ok:true});
  }else await displayTripPush(event.data.data);
 }).catch(()=>{event.ports?.[0]?.postMessage({ok:false});}));
});
firebase.initializeApp({apiKey:'AIzaSyBcMPhGW506qBvPIkqSffxjVWjoZ5jQWh0',authDomain:'jp-oh-59f31.firebaseapp.com',projectId:'jp-oh-59f31',messagingSenderId:'162859226528',appId:'1:162859226528:web:543c217b319dc16e3c80c5'});
firebase.messaging().onBackgroundMessage(payload=>serializePushWork(()=>displayTripPush(payload.data)));

/* MyTrip caches only public app files. Firebase data, tokens, receipts and avatars are never cached here. */
const CACHE = 'mytrip-shell-cloudflare-push-20261113';
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
