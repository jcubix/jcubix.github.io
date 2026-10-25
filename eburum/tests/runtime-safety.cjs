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

test('styled confirmations escape content, cancel by default and restore nested dialog isolation',async t=>{
 const {w,run,$}=await app(t);await run('refresh()');run('setConfirmationPresenter(null);communicationsModal()');
 const outer=$('.communications-panel').parentElement,trigger=$('#newCommunication');trigger.focus();
 const pending=run('confirmDialog')({message:'<img src=x onerror=alert(1)>',danger:true,confirmLabel:'Elimina'});
 await tick();
 assert.equal($('.confirm-modal img'),null);assert.match($('#confirmBody').textContent,/<img/);
 assert.equal(w.document.activeElement,$('.confirm-actions [data-confirm-cancel]'));
 assert.ok(outer.hasAttribute('inert'));assert.ok($('#app').hasAttribute('inert'));
 assert.equal(await run('confirmDialog')({message:'Seconda operazione'}),false);
 $('.confirm-modal').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(await pending,false);await tick();assert.equal($('.confirm-modal'),null);assert.equal(outer.hasAttribute('inert'),false);assert.equal(w.document.activeElement,trigger);
 const accepted=run('confirmDialog')({message:'Conferma'});await tick();$('[data-confirm-accept]').click();assert.equal(await accepted,true);await tick();
 const removed=run('confirmDialog')({message:'Accesso cambiato'});await tick();$('.confirm-back').remove();assert.equal(await removed,false);await tick();assert.equal(outer.hasAttribute('inert'),false);
});

test('event confirmation prevents duplicate deletion and refuses an obsolete team session',async t=>{
 const {w,run,$}=await app(t);await run('refresh()');let release;
 run('setConfirmationPresenter')(()=>new Promise(resolve=>release=resolve));
 run("eventModal('match-1',state.events[0])");
 const first=$('#deleteEvent').onclick();await $('#deleteEvent').onclick();assert.equal(w.fixtureData.match_events.length,1);assert.equal($('#deleteEvent').disabled,true);
 run('state.user=null');release(true);await first;assert.equal(w.fixtureData.match_events.length,1);assert.equal($('#deleteEvent').disabled,false);
});

test('presentation port preserves the React root during loading, render and logout',async t=>{
 const {run,$}=await app(t);const root=$('#app');root.innerHTML='<section id="react-owned">React root</section>';let ready=0,loading=0,login=0;
 run('setPresentationAdapter')({render:()=>ready++,loading:()=>loading++,login:()=>login++,error:()=>{}});
 await run('refresh()');assert.equal(ready,1);assert.ok(loading>=1);assert.ok($('#react-owned'));
 run('renderLogin()');assert.equal(login,1);assert.ok($('#react-owned'));assert.equal(run('state.players.length'),0);
});

test('a late team context cannot restore an obsolete role',async t=>{
 const {w,run,$}=await app(t);w.contexts=[];run("const originalRpc=db.rpc;db.rpc=(name,...args)=>name==='team_context'?new Promise(resolve=>window.contexts.push(resolve)):originalRpc(name,...args)");
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
 const {w,run,$}=await app(t);await run('refresh()');w.contexts=[];run("const originalRpc=db.rpc;db.rpc=(name,...args)=>name==='team_context'?new Promise(resolve=>window.contexts.push(resolve)):originalRpc(name,...args)");
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
 assert.deepEqual([...$('.player-kpis').querySelectorAll('b')].map(el=>el.textContent),['1','45','1']);
 run("state.team.role='coach';state.page='players';render()");assert.equal($('#addPlayer'),null);assert.equal($('[data-edit]'),null);assert.ok($('[data-player-sheet]'));assert.ok($('[data-page="players"][aria-current="page"]'));
});

test('nested dialogs isolate the background and restore scrolling and focus',async t=>{
 const {w,run,$}=await app(t);await run('refresh()');
 w.document.body.style.overflow='scroll';const trigger=$('[data-communications]');trigger.focus();
 run('communicationsModal()');await tick();const outer=$('.communications-panel').parentElement;
 assert.equal(w.document.body.style.overflow,'hidden');assert.ok($('#app').hasAttribute('inert'));assert.equal(outer.hasAttribute('inert'),false);
 const newButton=$('#newCommunication');newButton.focus();newButton.click();const inner=$('.communication-compose').parentElement;
 assert.ok(outer.hasAttribute('inert'));assert.equal(inner.hasAttribute('inert'),false);
 $('#cancelCommunication').click();await tick();
 assert.equal(outer.hasAttribute('inert'),false);assert.ok($('#app').hasAttribute('inert'));assert.equal(w.document.body.style.overflow,'hidden');assert.equal(w.document.activeElement,newButton);
 outer.querySelector('.modal-head button').click();await tick();
 assert.equal($('#app').hasAttribute('inert'),false);assert.equal(w.document.body.style.overflow,'scroll');assert.equal(w.document.activeElement,trigger);
});

test('page navigation returns to the top and exposes an accessible content target',async t=>{
 const {w,run,$}=await app(t);await run('refresh()');const scrolls=[];w.scrollTo=options=>scrolls.push(options);
 assert.equal($('.skip-link').getAttribute('href'),'#mainContent');
 $('[data-page="players"]').click();
 assert.equal(scrolls.length,1);assert.equal(scrolls[0].top,0);assert.equal(w.document.activeElement,$('#mainContent'));assert.ok($('[aria-current="page"][data-page="players"]'));
 assert.equal($('#sportSeason').getAttribute('aria-describedby'),'seasonHelp');assert.ok($('#seasonHelp'));
});

for (const scenario of [
 {name:'player deactivation', setup:"state.page='players';render()", selector:'[data-remove]', table:'players'},
 {name:'discipline clearance removal', setup:"state.disciplinary_clearances=[{id:'clearance-1',user_id:fixtureUser.id,player_id:'player-1',season_start:sportSeason().from,threshold_event_id:'event-1',served_match_id:'match-1'}];fixtureData.disciplinary_clearances=state.disciplinary_clearances.map(c=>({...c}));disciplineModal()", selector:'[data-undo-clearance]', table:'disciplinary_clearances'},
 {name:'legacy communication deletion', setup:"fixtureData.staff_communications=[{id:'notice-1',user_id:fixtureUser.id,created_by:fixtureUser.id,title:'Avviso',body:'Test',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),retention_days:1}];state.staff_communications=fixtureData.staff_communications.map(m=>({...m}));communicationsModal()", selector:'[data-delete-communication]', table:'staff_communications'},
]) test(scenario.name+' confirms once and rejects an obsolete account',async t=>{
 const {w,run,$}=await app(t);await run('refresh()');run(scenario.setup);
 const button=$(scenario.selector);assert.ok(button);
 const before=JSON.stringify(w.fixtureData[scenario.table]);let release,count=0;
 run('setConfirmationPresenter')(()=>{count++;return new Promise(resolve=>release=resolve)});
 const cancelled=button.onclick();await button.onclick();assert.equal(count,1);assert.equal(button.disabled,true);
 release(false);await cancelled;assert.equal(button.disabled,false);assert.equal(JSON.stringify(w.fixtureData[scenario.table]),before);
 const stale=button.onclick();run('state.user=null');release(true);await stale;
 assert.equal(button.disabled,false);assert.equal(JSON.stringify(w.fixtureData[scenario.table]),before);
});


test('rapid feedback replaces the previous toast instead of covering another message',async t=>{
 const {run,$}=await app(t);run('toast("Primo messaggio");toast("Secondo messaggio")');assert.equal($('.toast').textContent,'Secondo messaggio');assert.equal(run('document.querySelectorAll(".toast").length'),1);
});
