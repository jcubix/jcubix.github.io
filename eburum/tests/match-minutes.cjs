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
test('match settings use the atomic RPC and preserve edits on failure',async t=>{
 const {run,w,$}=await app(t);run("state.page='matches';render()");$('[data-match="match-1"]').click();await tick();
 assert.equal($('[data-activity-panel="results"]').hidden,false);assert.equal($('.activity-tabs').firstElementChild.dataset.activityTab,'results');
 $('#matchDuration').value='95';$('#matchDuration').dispatchEvent(new w.Event('input',{bubbles:true}));
 run("window.fixtureSaveError={message:'Conflitto simulato'}");$('#saveMatchResult').click();await tick();
 assert.match($('#matchResultStatus').textContent,/Conflitto/);assert.equal($('#matchDuration').value,'95');assert.equal($('#saveMatchResult').disabled,false);
 run('window.fixtureSaveError=null');$('#saveMatchResult').click();await tick();await tick();
 const call=w.fixtureTeamCalls.at(-1);assert.equal(call.p_id,'match-1');assert.equal(call.p_values.duration_minutes,95);assert.equal(call.p_values.minutes_auto,false);
 assert.equal(w.fixtureData.matches[0].duration_minutes,95);assert.ok($('#matchMinutesList'));
});
test('substitution preview and readonly automatic minutes are visible',async t=>{
 const {run,w,$}=await app(t);
 w.fixtureData.matches[0].minutes_auto=true;w.fixtureData.matches[0].duration_minutes=90;
 w.fixtureData.match_events=[];w.fixtureData.activity_roster=roster.slice(0,2).map((r,i)=>({...r,player_id:'player-'+(i+1),id:'r'+i,activity_id:'activity-1',user_id:'demo-user',availability:'Disponibile',minutes_played:0}));
 await run('refresh()');await run("openActivity('activity-1','results')");$('#addSubstitution').click();
 assert.equal($('[data-event-type="Sostituzione"]').getAttribute('aria-pressed'),'true');
 $('#eventPlayer').value='player-2';$('#eventOutgoing').value='player-1';$('#eventMinute').value='65';$('#eventMinute').dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.match($('#substitutionMinutesPreview').textContent,/65′.*25′/);
 // Simulate the committed server response; SQL tests verify its real calculation.
 run("const rawFixtureResult=FixtureQuery.prototype.result;FixtureQuery.prototype.result=async function(){const result=await rawFixtureResult.call(this);if(this.table==='match_events'&&this.action==='insert'){fixtureData.activity_roster[0].minutes_played=65;fixtureData.activity_roster[1].minutes_played=25;fixtureData.activities[0].revision++}return result}");
 $('#eventForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
 assert.equal($('#eventForm'),null);assert.match($('#matchMinutesList').textContent,/65′.*25′/);assert.match($('#matchResultStatus').textContent,/aggiornat/);
 assert.equal(run("state.roster.find(r=>r.player_id==='player-1').minutes_played"),65);
 $('[data-activity-tab="roster"]').click();$('[data-roster-edit="player-1"]').click();assert.equal($('#minutesPlayed').disabled,true);assert.equal($('#minutesPlayed').value,'65');
});
