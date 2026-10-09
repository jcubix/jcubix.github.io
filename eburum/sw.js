const CACHE='eburum-team-manager-v27';
const ASSETS=["./","./index.html","./app.css","./config.js","./manifest.webmanifest","./icon.svg","./app-access.js","./app-admin.js","./app-communications.js","./app-data.js","./app-dialogs.js","./app-discipline.js","./app-hooks.js","./app-main.js","./app-operations.js","./app-part1.js","./app-part2.js","./app-part3.js","./app-part4.js","./app-part5.js","./app-realtime.js","./app-report-export.js","./app-team.js","./app-workflows.js","./vendor/jspdf.umd.min.js","./icon-180.png","./icon-192.png","./icon-512.png","./icon-maskable-512.png"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('eburum-team-manager-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.some(p=>new URL(p,self.location.href).pathname===url.pathname))return;
 e.respondWith(fetch(e.request).then(response=>{
  if(response.ok){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(cache=>cache.put(e.request,copy)).catch(()=>{}))}
  return response;
 }).catch(async()=>{
  const cached=await caches.match(e.request);if(cached)return cached;
  if(e.request.mode==='navigate'){const shell=await caches.match('./index.html');if(shell)return shell}
  return Response.error();
 }));
});
