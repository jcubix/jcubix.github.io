const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,30));
async function app(t){
 const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only',url:'https://eburum.vercel.app'}),w=dom.window,run=s=>vm.runInContext(s,dom.getInternalVMContext());t.after(()=>w.close());
 w.CONFIG={supabaseUrl:'demo',supabaseAnonKey:'demo',season:'2026/27'};w.scrollTo=()=>{};
 run(fs.readFileSync(path.join(__dirname,'fixtures/team-ui.js'),'utf8'));await require('./load-app.cjs').loadApp(dom);
 run('state.user=fixtureUser');await run('refresh()');return {w,run,$:s=>w.document.querySelector(s)};
}
const roster=[{player_id:'a',called:true,lineup:'Titolare'},{player_id:'b',called:true,lineup:'Panchina'},{player_id:'c',called:true,lineup:'Panchina'}];
const sub=(minute,incoming,outgoing)=>({event_type:'Sostituzione',minute,player_id:incoming,outgoing_player_id:outgoing});
test('minutes split, chained substitutions, red cards and boundary minutes',async t=>{
 const {run,w}=await app(t);w.rows=roster;w.events=[sub(65,'b','a')];
 assert.equal(run("calculateMatchMinutes(90,rows,events).get('a')"),65);assert.equal(run("calculateMatchMinutes(90,rows,events).get('b')"),25);
 w.events.push(sub(80,'c','b'));assert.equal(run("calculateMatchMinutes(90,rows,events).get('b')"),15);assert.equal(run("calculateMatchMinutes(90,rows,events).get('c')"),10);
 w.events=[sub(65,'b','a'),{event_type:'Espulsione',minute:80,player_id:'b'}];assert.equal(run("calculateMatchMinutes(95,rows,events).get('b')"),15);
 w.events=[sub(0,'b','a')];assert.equal(run("calculateMatchMinutes(90,rows,events).get('a')"),0);assert.equal(run("calculateMatchMinutes(90,rows,events).get('b')"),90);
 w.events=[sub(90,'b','a')];assert.equal(run("calculateMatchMinutes(90,rows,events).get('b')"),0);
 assert.equal(run("calculateMatchMinutes(90,rows,events,false).get('a')"),0);
});
test('invalid timeline cannot award minutes to an unavailable substitute',async t=>{
 const {run,w}=await app(t);w.rows=roster;
 for(const events of [[sub(65,'b','c')],[sub(91,'b','a')],[sub(65,'a','a')],[sub(65,'b','a'),sub(80,'a','b')],[{event_type:'Espulsione',minute:30,player_id:'b'},sub(65,'b','a')]]){w.events=events;assert.throws(()=>run('calculateMatchMinutes(90,rows,events)'))}
});
