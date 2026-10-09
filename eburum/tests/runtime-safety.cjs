const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),{JSDOM}=require('jsdom');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');

const scripts=fs.readdirSync(root).filter(f=>/^app-.*\.js$/.test(f));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function app(t){
 const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only',url:'https://eburum.vercel.app'}),w=dom.window,run=code=>vm.runInContext(code,dom.getInternalVMContext());
 t.after(()=>w.close());w.CONFIG={supabaseUrl:'demo',supabaseAnonKey:'demo',season:'2026/27'};w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 run(fs.readFileSync(path.join(__dirname,'fixtures/team-ui.js'),'utf8'));
 await require('./load-app.cjs').loadApp(dom);
 run('state.user=fixtureUser');return {w,run,$:s=>w.document.querySelector(s)};
}

test('a late team context cannot restore an obsolete role',async t=>{
 const {w,run,$}=await app(t);w.contexts=[];run("db.rpc=()=>new Promise(resolve=>window.contexts.push(resolve))");
 const older=run('refresh()'),latest=run('refresh()');
 w.contexts[1]({data:{owner_id:'demo-user',role:'secretary'}});assert.equal(await latest,true);
 w.contexts[0]({data:{owner_id:'demo-user',role:'admin'}});assert.equal(await older,false);
 assert.equal(run('teamRole()'),'secretary');assert.equal($('#users'),null);
});

test('an older data response cannot overwrite newer team data',async t=>{
 const {w,run}=await app(t);await run('refresh()');w.playersLoads=[];
 run("const originalFrom=db.from;db.from=table=>{const query=originalFrom(table);if(table==='players')query.range=()=>new Promise(resolve=>window.playersLoads.push(resolve));return query}");
 const older=run('refresh()');await tick();const latest=run('refresh()');await tick();
 w.playersLoads[1]({data:[{...w.fixtureData.players[0],surname:'Aggiornato'}]});await latest;
 w.playersLoads[0]({data:[{...w.fixtureData.players[0],surname:'Obsoleto'}]});assert.equal(await older,false);
 assert.equal(run('state.players[0].surname'),'Aggiornato');
});

test('logout clears every team dataset and rejects pending loads',async t=>{
 const {w,run,$}=await app(t);await run('refresh()');w.contexts=[];run('db.rpc=()=>new Promise(resolve=>window.contexts.push(resolve))');
 const pending=run('refresh()');run('renderLogin()');w.contexts[0]({data:{owner_id:'demo-user',role:'admin'}});assert.equal(await pending,false);
 assert.equal(run('TEAM_ARRAYS.every(key=>state[key].length===0)'),true);assert.equal(run('state.loadedActor'),null);assert.ok($('#loginForm'));assert.equal($('#users'),null);
});

test('a pending Auth lookup cannot restore a signed-out session',async t=>{
 const {w,run,$}=await app(t);w.authLookup=null;run('db.auth.getUser=()=>new Promise(resolve=>window.authLookup=resolve)');
 const pending=run('syncSession(fixtureUser)');await run('syncSession(null)');w.authLookup({data:{user:w.fixtureUser}});await pending;
 assert.equal(run('state.user'),null);assert.ok($('#loginForm'));assert.equal(run('state.players.length'),0);
});

test('a temporary Auth network error offers retry without inventing a logout',async t=>{
 const {run,$}=await app(t);run("db.auth.getUser=async()=>({data:null,error:{status:0,message:'Connessione non disponibile'}})");
 await run('syncSession(fixtureUser)');assert.equal(run('state.user.id'),'demo-user');assert.ok($('#retryTeam'));assert.equal($('#loginForm'),null);
});

test('an event saved after logout stays out of client state',async t=>{
 const {w,run,$}=await app(t);await run('refresh()');w.saved=0;w.eventGate=new Promise(resolve=>w.releaseEvent=resolve);
 run("const originalResult=FixtureQuery.prototype.result;FixtureQuery.prototype.result=async function(){if(this.table==='match_events'&&this.action==='insert')await window.eventGate;return originalResult.call(this)};eventModal('match-1',{},()=>window.saved++)");
 const form=$('#eventForm'),pending=form.onsubmit({preventDefault(){},target:form});await tick();run('renderLogin()');w.releaseEvent();await pending;
 assert.equal(run('state.events.length'),0);assert.equal(w.saved,0);assert.ok($('#loginForm'));assert.equal(w.fixtureData.match_events.length,2,'the server result does not imply an active client session');
});

test('event deletion recovers from a rejected request',async t=>{
 const {w,run,$}=await app(t);await run('refresh()');w.rejectDelete=true;
 run("const originalResult=FixtureQuery.prototype.result;FixtureQuery.prototype.result=async function(){if(this.table==='match_events'&&this.action==='delete'&&window.rejectDelete)throw Error('Connessione interrotta');return originalResult.call(this)};eventModal('match-1',state.events[0])");
 await $('#deleteEvent').onclick();assert.match($('#eventFeedback').textContent,/Connessione interrotta/);assert.equal($('#deleteEvent').disabled,false);assert.equal($('#eventMinute').disabled,false);assert.equal(run('state.events.length'),1);
 w.rejectDelete=false;await $('#deleteEvent').onclick();assert.equal(run('state.events.length'),0);assert.equal($('#eventForm'),null);
});

test('password updates reject double submits and restore fields for retry',async t=>{
 const {w,run,$}=await app(t);await run('refresh()');w.requests=[];
 w.invoke=(_,options)=>{w.requests.push(options.body);return new Promise(resolve=>w.passwordReply=resolve)};run("db.functions.invoke=window.invoke;userPasswordModal({id:'staff-2',email:'staff@example.test'})");
 $('#staffPassword').value='synthetic-password-123';$('#staffPasswordConfirm').value='synthetic-password-123';
 const form=$('#userPasswordForm'),event={preventDefault(){},target:form},pending=form.onsubmit(event);await form.onsubmit(event);
 assert.equal(w.requests.length,1);assert.equal($('#staffPassword').disabled,true);assert.equal($('#closePassword').disabled,true);
 w.passwordReply({data:{error:'Errore simulato'}});await pending;assert.match($('#passwordMessage').textContent,/Errore simulato/);assert.equal($('#staffPassword').disabled,false);assert.equal($('#staffPassword').value,'synthetic-password-123');
 const retry=form.onsubmit(event);w.passwordReply({data:{user:{id:'staff-2'}}});await retry;assert.equal($('#userPasswordForm'),null);assert.equal(form.querySelector('#staffPassword').value,'');
});

test('player sheet totals include matches only and exclude cancelled activities',async t=>{
 const {w,run,$}=await app(t);await run('refresh()');
 run("state.activities.push({id:'training',activity_type:'Allenamento'},{id:'cancelled',activity_type:'Partita',status:'Annullato'});state.roster=[{activity_id:'activity-1',player_id:'player-1',called:true,minutes_played:'45'},{activity_id:'training',player_id:'player-1',called:true,minutes_played:90},{activity_id:'cancelled',player_id:'player-1',called:true,minutes_played:90}];playerSheet('player-1')");
 assert.deepEqual([...$('.player-kpis').querySelectorAll('b')].map(el=>el.textContent),['1','45']);
 run("state.team.role='coach';state.page='players';render()");assert.equal($('#addPlayer'),null);assert.equal($('[data-edit]'),null);assert.ok($('[data-player-sheet]'));assert.ok($('[data-page="players"][aria-current="page"]'));
});

test('service worker preserves good assets and keeps API and other caches separate',async()=>{
 const listeners={},writes=[],deleted=[],installed=[],store=new Map(),tasks=[];
 const scope={self:{location:{origin:'https://eburum.vercel.app',href:'https://eburum.vercel.app/sw.js'},addEventListener:(name,callback)=>listeners[name]=callback,clients:{claim:async()=>{}}},URL,Response,fetch:async()=>new Response('Unavailable',{status:503}),caches:{open:async()=>({addAll:async assets=>installed.push(...assets),put:async(request,response)=>writes.push({request,response})}),match:async request=>store.get(typeof request==='string'?request:request.url),keys:async()=>['eburum-team-manager-v26','eburum-team-manager-v27','another-app'],delete:async name=>deleted.push(name)}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),scope);
 await listeners.install({waitUntil:promise=>tasks.push(promise)});await Promise.all(tasks);
 for(const file of [...scripts,'app.css','index.html']){assert.ok(fs.existsSync(path.join(root,file)));assert.ok(installed.includes('./'+file),file+' must be installed for offline use')}
 await new Promise((resolve,reject)=>listeners.activate({waitUntil:promise=>promise.then(resolve,reject)}));assert.deepEqual(deleted,['eburum-team-manager-v26']);
 async function request(url,mode='same-origin'){let promise;const background=[];listeners.fetch({request:{url,method:'GET',mode},respondWith:value=>promise=value,waitUntil:value=>background.push(value)});const response=await promise;await Promise.all(background);return response}
 assert.equal((await request('https://eburum.vercel.app/app-part1.js')).status,503);assert.equal(writes.length,0);
 scope.fetch=async()=>new Response('Valid asset');await request('https://eburum.vercel.app/app-part1.js');assert.equal(writes.length,1);
 scope.fetch=async()=>{throw Error('Offline')};store.set('./index.html',new Response('<main>Offline shell</main>'));
 assert.equal((await request('https://eburum.vercel.app/app-part1.js')).type,'error','missing JavaScript must not receive HTML');assert.match(await (await request('https://eburum.vercel.app/','navigate')).text(),/Offline shell/);
 assert.equal(await request('https://example.supabase.co/rest/v1/players'),undefined);assert.equal(await request('https://eburum.vercel.app/api/private'),undefined);
});
