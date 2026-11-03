const CACHE='lagoinha-cafe-v3.14';
const FILES=['./','./index.html','./v2.css','./app-v2.js','./config.js','./manifest.webmanifest','./assets/icon.svg','./assets/hero-cup.svg','./assets/logo-cafe.svg','./assets/logo-vertical.svg','./assets/qr-code.svg','./assets/cartaz-qr.svg'];
self.addEventListener('install', event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==location.origin)return;event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return res}).catch(()=>caches.match(event.request).then(x=>x||caches.match('./index.html'))))});
