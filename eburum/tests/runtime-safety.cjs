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
