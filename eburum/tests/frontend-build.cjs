const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../dist');
test('built authored style rules stay inside the declared cascade layers',()=>{
 const postcss=require('postcss'),outside=[];
 for(const file of fs.readdirSync(path.join(root,'assets')).filter(file=>file.endsWith('.css'))){
  const css=postcss.parse(fs.readFileSync(path.join(root,'assets',file),'utf8'));
  css.walkRules(rule=>{let parent=rule.parent;while(parent&&!(parent.type==='atrule'&&(parent.name==='layer'||/keyframes$/.test(parent.name))))parent=parent.parent;if(!parent)outside.push(file+': '+rule.selector)});
 }
 assert.deepEqual(outside,[],'Unlayered selectors bypass the approved component cascade');
});
test('built PWA precaches every published asset and resolves its manifest icons',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 const assets=JSON.parse(worker.match(/const ASSETS\s*=\s*(\[[\s\S]*?\]);/)[1]);
 for(const asset of assets)assert.ok(fs.existsSync(path.join(root,asset==='./'?'index.html':asset)),asset);
 assert.match(html,/assets\/index-[\w-]+\.js/);assert.doesNotMatch(html,/\/src\/|app-main\.js|cdn\.jsdelivr/);
 const excel=fs.readdirSync(path.join(root,'assets')).filter(name=>/^exceljs.*\.js$/.test(name));assert.equal(excel.length,1);assert.ok(assets.includes('./assets/'+excel[0]),'Excel must remain available in the offline cache');assert.ok(!html.includes(excel[0]),'Excel must not be preloaded with the initial page');
 const published=fs.readdirSync(path.join(root,'assets'));for(const file of published)assert.ok(assets.includes('./assets/'+file),'Missing from PWA cache: '+file);
 for(const name of ['finance-page','whiteboard-page','reports','register']){const chunk=published.find(file=>file.startsWith(name+'-')&&file.endsWith('.js'));assert.ok(chunk,'Missing lazy route '+name);assert.ok(!html.includes(chunk),'Route must not be preloaded: '+name)}
 const entry=html.match(/src="([^"]+assets\/index-[^"]+\.js)"/)[1];assert.ok(fs.statSync(path.join(root,entry.replace(/^\//,''))).size<400000,'Initial application code must stay below 400 KB');
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

test('built entry starts login without a pre-injected legacy client',()=>{
 const {execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),entry=html.match(/src="([^"]+assets\/index-[^"]+\.js)"/)[1];
 const script=`
  import assert from 'node:assert/strict';
  import {JSDOM} from ${JSON.stringify(pathToFileURL(require.resolve('jsdom')).href)};
  const dom=new JSDOM('<div id="app"></div>',{url:'https://eburum.test/#/dashboard',pretendToBeVisual:true});
  for(const key of ['window','document','location','MutationObserver','HTMLElement','Element','Node','localStorage'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
  Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
  globalThis.getComputedStyle=dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  window.CONFIG={supabaseUrl:'https://eburum.test',supabaseAnonKey:'test-key',season:'2026/2027'};
  globalThis.fetch=async request=>{if(String(request).includes('/assets/'))return new Response('');throw Error('Unexpected network during anonymous startup: '+request)};
  for(const key of ['fetch','Headers','Request','Response'])window[key]=globalThis[key];
  assert.equal(window.supabase,undefined);
  await import(${JSON.stringify(pathToFileURL(path.join(root,entry.replace(/^\//,''))).href)});
  const deadline=Date.now()+3000;
  while(![...document.querySelectorAll('button')].some(b=>b.textContent==='Accedi')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
  assert.equal(window.supabase,undefined,'production must not expose the old client global');
  assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='Accedi'),'real built entry must reach login');
  dom.window.close();process.exit(0);
 `;
 execFileSync(process.execPath,['--input-type=module','-e',script],{timeout:10000,stdio:'pipe'});
});
