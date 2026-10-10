const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../dist');
test('built PWA precaches every published asset and resolves its manifest icons',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 const assets=JSON.parse(worker.match(/const ASSETS\s*=\s*(\[[\s\S]*?\]);/)[1]);
 for(const asset of assets)assert.ok(fs.existsSync(path.join(root,asset==='./'?'index.html':asset)),asset);
 assert.match(html,/assets\/index-[\w-]+\.js/);assert.doesNotMatch(html,/\/src\/|app-main\.js|cdn\.jsdelivr/);
 const manifestPath=html.match(/rel="manifest" href="([^"]+)"/)[1],manifest=JSON.parse(fs.readFileSync(path.join(root,manifestPath),'utf8'));
 assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');
 for(const icon of manifest.icons){assert.ok(icon.src.startsWith('/'));assert.ok(fs.existsSync(path.join(root,icon.src)))}
 assert.equal(manifest.icons.find(icon=>icon.purpose==='maskable').sizes,'512x512');
 assert.ok(!fs.existsSync(path.join(root,'tests')));assert.ok(!fs.existsSync(path.join(root,'src')));
});
test('built worker caches static assets only, preserves other apps and waits for explicit activation',async()=>{
 const handlers={},puts=[],deletes=[];let skip=0,offline=false;
 const cache={addAll:async()=>{},put:async request=>puts.push(request.url)};
 const context={URL,Request,Response,Set,Promise,self:{location:new URL('https://eburum.test/sw.js'),addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>skip++,clients:{claim:async()=>{}}},caches:{open:async()=>cache,keys:async()=>['eburum-team-manager-v30','eburum-react-old','other-app'],delete:async key=>deletes.push(key),match:async()=>undefined},fetch:async()=>{if(offline)throw Error('offline');return new Response('<html>fallback</html>',{headers:{'content-type':'text/html'}})}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
 assert.equal(skip,0);handlers.message({data:'ACTIVATE_UPDATE'});assert.equal(skip,1);
 let activating;handlers.activate({waitUntil:p=>activating=p});await activating;assert.deepEqual(deletes,['eburum-team-manager-v30','eburum-react-old']);
 for(const url of ['https://supabase.test/rest/v1/players','https://eburum.test/rest/v1/players']){let intercepted=false;handlers.fetch({request:new Request(url),respondWith:()=>intercepted=true});assert.equal(intercepted,false)}
 const file=fs.readdirSync(path.join(root,'assets')).find(name=>name.endsWith('.js'));let result;
 handlers.fetch({request:new Request('https://eburum.test/assets/'+file),respondWith:p=>result=p});await result;assert.equal(puts.length,0,'HTML must never poison a JavaScript asset');
 offline=true;handlers.fetch({request:new Request('https://eburum.test/assets/'+file),respondWith:p=>result=p});assert.equal((await result).status,503);
});
