const CACHE='eburum-team-manager-v15';
const ASSETS=['./','./index.html','./app.css','./config.js','./manifest.webmanifest','./icon.svg','./app-dialogs.js','./app-part1.js','./app-part2.js','./app-part3.js','./app-part4.js','./app-part5.js','./app-admin.js','./app-team.js','./app-operations.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.some(p=>new URL(p,self.location.href).pathname===url.pathname))return;e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});
