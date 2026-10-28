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
 assert.equal(run('TEAM_ARRAYS.every(key=>state[key].length===0)'),true);assert.equal(run('state.loadedActor'),null);assert.equal($('#users'),null);
});
test('a pending Auth lookup cannot restore a signed-out session',async t=>{
 const {w,run,$}=await app(t);w.authLookup=null;run('db.auth.getUser=()=>new Promise(resolve=>window.authLookup=resolve)');
 const pending=run('syncSession(fixtureUser)');await run('syncSession(null)');w.authLookup({data:{user:w.fixtureUser}});await pending;
 assert.equal(run('state.user'),null);assert.equal(run('state.players.length'),0);
});
test('a temporary Auth network error offers retry without inventing a logout',async t=>{
 const {run,$}=await app(t);let failures=0;run('setPresentationAdapter')({error:()=>failures++});run("db.auth.getUser=async()=>({data:null,error:{status:0,message:'Connessione non disponibile'}})");
 await run('syncSession(fixtureUser)');assert.equal(run('state.user.id'),'demo-user');assert.equal(failures,1);assert.equal($('#loginForm'),null);
});


test('targeted player and administration reloads leave sport and messages untouched',async t=>{
 const {w,run}=await app(t);await run('refresh()');w.fixtureQueries=[];
 w.fixtureData.players[0].surname='Aggiornato';
 await run('refreshAffected({kind:"players"})');
 assert.equal(run('state.players[0].surname'),'Aggiornato');
 assert.deepEqual([...new Set(w.fixtureQueries.map(q=>q.table))],['players']);
 w.fixtureQueries=[];w.fixtureData.player_administration.push({player_id:'player-1',user_id:'demo-user',registration_status:'In regola'});
 await run('refreshAffected({kind:"administration"})');
 assert.equal(run('state.administration[0].registration_status'),'In regola');
 assert.deepEqual([...new Set(w.fixtureQueries.map(q=>q.table))],['player_administration']);
});

test('targeted attendance reload reconciles session, linked activity and season without loading unrelated data',async t=>{
 const {w,run}=await app(t);await run('refresh()');w.fixtureQueries=[];
 const activity={id:'training-target',user_id:'demo-user',activity_type:'Allenamento',activity_date:'2026-10-06'};w.fixtureData.activities.push(activity);
 Object.assign(activity,{session_id:'session-1',status:'Concluso',revision:9});
 w.fixtureData.attendance[0].status='Infortunato';
 await run('refreshAffected({kind:"session",id:"session-1",activityId:'+JSON.stringify(activity.id)+'})');
 assert.equal(run('state.attendance.find(r=>r.player_id==="player-1").status'),'Infortunato');
 assert.equal(run('state.activities.find(a=>a.session_id==="session-1").revision'),9);
 assert.ok(!w.fixtureQueries.some(q=>['players','player_administration','staff_communications','communication_receipts','disciplinary_clearances'].includes(q.table)));
 assert.ok(w.fixtureQueries.filter(q=>q.table==='matches').length<=1,'Only the oldest-date metadata query may read matches');
 // A corrected date outside the selected season must leave that season's register.
 w.fixtureData.sessions[0].session_date='2025-06-12';
 await run('refreshAffected({kind:"session",id:"session-1"})');
 assert.equal(run('state.sessions.some(s=>s.id==="session-1")'),false);
 assert.equal(run('state.attendance.some(a=>a.session_id==="session-1")'),false);
 assert.equal(run('state.earliestSport'),'2025-06-12');
});

test('targeted match timeline also updates technical notes and removes deleted children',async t=>{
 const {w,run}=await app(t);await run('refresh()');w.fixtureQueries=[];
 const a=w.fixtureData.activities.find(a=>a.match_id==='match-1');
 w.fixtureData.activity_technical.push({activity_id:a.id,user_id:'demo-user',formation:'4-3-3',note:'Aggiornata'});
 w.fixtureData.match_events=[];w.fixtureData.matches[0].goals_for=3;
 await run('refreshMatchTimeline("match-1")');
 assert.equal(run('state.matches[0].goals_for'),3);
 assert.equal(run('state.events.length'),0);
 assert.equal(run('state.technical[0].note'),'Aggiornata');
 assert.equal(w.fixtureQueries.filter(q=>q.table==='matches').length,1,'Result edits do not repeat oldest-date metadata reads');
 assert.ok(!w.fixtureQueries.some(q=>q.table==='disciplinary_clearances'),'Existing matches do not reload unrelated served-match confirmations');
 assert.ok(!w.fixtureQueries.some(q=>['players','player_administration','staff_communications','communication_receipts'].includes(q.table)));
});

test('a failed targeted read is atomic and does not poison the next reload',async t=>{
 const {w,run}=await app(t);await run('refresh()');const before=run('JSON.stringify(state.activities)');
 const a=w.fixtureData.activities[0];a.title='Nuovo titolo';
 run('const from=db.from;db.from=table=>{const q=from(table);if(table==="activity_roster")q.range=async()=>({error:{message:"offline"},data:null});return q}');
 await assert.rejects(run('refreshAffected({kind:"activity",id:'+JSON.stringify(a.id)+'})'));
 assert.equal(run('JSON.stringify(state.activities)'),before);
 run('db.from=from');assert.equal(await run('refreshAffected({kind:"activity",id:'+JSON.stringify(a.id)+'})'),true);
 assert.equal(run('state.activities.find(a=>a.id==='+JSON.stringify(a.id)+').title'),'Nuovo titolo');
});

test('concurrent targeted saves are serialized and both datasets survive',async t=>{
 const {w,run}=await app(t);await run('refresh()');w.playersLoads=[];w.fixtureQueries=[];
 run('const from=db.from;db.from=table=>{const q=from(table);if(table==="players")q.range=()=>new Promise(resolve=>window.playersLoads.push(resolve));return q}');
 const first=run('refreshAffected({kind:"players"})'),second=run('refreshAffected({kind:"administration"})');await tick();
 assert.equal(w.playersLoads.length,1);assert.ok(!w.fixtureQueries.some(q=>q.table==='player_administration'));
 w.playersLoads[0]({data:[{...w.fixtureData.players[0],surname:'Aggiornato'}],error:null});
 assert.equal(await first,true);assert.equal(await second,true);
 assert.equal(run('state.players[0].surname'),'Aggiornato');assert.ok(w.fixtureQueries.some(q=>q.table==='player_administration'));
});

test('logout, season changes and a newer full reload reject late targeted patches',async t=>{
 const {w,run}=await app(t);await run('refresh()');w.contexts=[];
 run('const rpc=db.rpc;db.rpc=(name,...args)=>name==="team_context"?new Promise(resolve=>window.contexts.push(resolve)):rpc(name,...args)');
 const pending=run('refreshAffected({kind:"players"})');await tick();run('state.seasonYear=2025');
 w.contexts.shift()({data:{owner_id:'demo-user',role:'admin'},error:null});assert.equal(await pending,false);
 const stale=run('refreshAffected({kind:"players"})');await tick();const full=run('refresh()');
 w.contexts[1]({data:{owner_id:'demo-user',role:'admin'},error:null});assert.equal(await full,true);
 const fresh=run('refreshAffected({kind:"players"})');await tick();
 assert.equal(w.contexts.length,3,'A full reload releases the queue held by an obsolete read');
 w.contexts[2]({data:{owner_id:'demo-user',role:'admin'},error:null});assert.equal(await fresh,true);
 w.contexts[0]({data:{owner_id:'demo-user',role:'admin'},error:null});assert.equal(await stale,false);
 w.contexts=[];const signedOut=run('refreshAffected({kind:"players"})');await tick();run('renderLogin()');
 w.contexts[0]({data:{owner_id:'demo-user',role:'admin'},error:null});assert.equal(await signedOut,false);
 assert.equal(run('state.players.length'),0);
});


test('a changed server role falls back to a full context reload instead of applying a targeted patch',async t=>{
 const {w,run}=await app(t);await run('refresh()');w.fixtureUser.app_metadata.role='president';
 assert.equal(await run('refreshAffected({kind:"players"})'),false);
 assert.equal(run('state.team.role'),'president');
 assert.equal(run('state.administration[0].needs_review'),true);
});
