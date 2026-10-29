const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
async function app(t){const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only',url:'https://eburum.test',beforeParse(w){const Base=w.Date;w.Date=class extends Base{constructor(...args){super(...(args.length?args:['2026-10-09T12:00:00+02:00']))}static now(){return new Base('2026-10-09T12:00:00+02:00').getTime()}}}}),w=dom.window,run=s=>vm.runInContext(s,dom.getInternalVMContext());t.after(()=>w.close());w.CONFIG={supabaseUrl:'demo',supabaseAnonKey:'demo',season:'2026/27'};w.scrollTo=()=>{};run(fs.readFileSync(__dirname+'/fixtures/team-ui.js','utf8'));await require('./load-app.cjs').loadApp(dom);run('state.user=fixtureUser');await run('refresh()');return {w,run};}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('Yellow cycles exclude future, cancelled, opponent and old-season cards and retain stale clearances for review',async t=>{
 const {run}=await app(t);run(`state.matches=[{id:'cards',match_date:'2026-10-01'},{id:'served',match_date:'2026-10-06'},{id:'future',match_date:'2026-10-11'},{id:'old',match_date:'2025-10-01'},{id:'cancel',match_date:'2026-10-02'}];state.activities=[{id:'cancelled',match_id:'cancel',status:'Annullato'}];state.events=Array.from({length:4},(_,i)=>({id:'yellow-'+i,match_id:'cards',player_id:'player-1',minute:i,event_type:'Ammonizione'}));for(const [id,match_id,player_id,event_type] of [['other','cards',null,'Ammonizione'],['future','future','player-1','Ammonizione'],['old','old','player-1','Ammonizione'],['cancel','cancel','player-1','Ammonizione'],['red','cards','player-1','Espulsione']])state.events.push({id,match_id,player_id,event_type});state.roster=[];`);
 assert.equal(run("playerDiscipline('player-1').total"),4);assert.equal(run("playerDiscipline('player-1').diffida"),true);assert.equal(run("playerDiscipline('player-1').reds"),1);
 run("state.events.push({id:'yellow-4',match_id:'cards',player_id:'player-1',minute:5,event_type:'Ammonizione'})");assert.equal(run("playerDiscipline('player-1').pending.length"),1);
 run("state.disciplinary_clearances=[{id:'clear',player_id:'player-1',season_start:'2026-07-01',threshold_event_id:'yellow-4',served_match_id:'served'}]");assert.equal(run("playerDiscipline('player-1').valid.length"),1);
 run("state.events.push(...Array.from({length:4},(_,i)=>({id:'yellow-'+(i+5),match_id:'served',player_id:'player-1',minute:i,event_type:'Ammonizione'})))");assert.equal(run("playerDiscipline('player-1').total"),9);assert.equal(run("playerDiscipline('player-1').diffida"),true);
 run("state.events.push({id:'yellow-9',match_id:'served',player_id:'player-1',minute:5,event_type:'Ammonizione'})");assert.equal(run("playerDiscipline('player-1').cycles"),2);
 run("state.events=state.events.filter(e=>e.id!=='yellow-0')");assert.equal(run("playerDiscipline('player-1').valid.length"),0);assert.equal(run("playerDiscipline('player-1').review.length"),1);
});
test('Absence notices seed expected attendance without persisting actual attendance',async t=>{
 const {w,run}=await app(t),before=JSON.stringify(w.fixtureData.attendance);run("state.activities.push({id:'train',activity_type:'Allenamento',activity_date:'2026-10-08',status:'Programmato',revision:3});state.roster.push({activity_id:'train',player_id:'player-1',availability:'Indisponibile'},{activity_id:'train',player_id:'player-2',availability:'In attesa'});window.d=makeTrainingDraft();seedPlannedReplies(d,state.activities.at(-1))");
 assert.equal(run("d.entries.get('player-1').status"),'Assente');assert.equal(run("d.entries.get('player-1').notified"),null);assert.equal(run("d.entries.get('player-2').status"),'Presente');assert.equal(run("attendanceCounts(d.entries.values()).pending"),0);assert.equal(run('draftRows(d).length'),2);assert.equal(run('d.activityRevision'),3);assert.equal(JSON.stringify(w.fixtureData.attendance),before);assert.equal(w.fixtureRpcCalls.length,0);
});
test('Complete player history loads archived rows without replacing the selected season',async t=>{
 const {w,run}=await app(t);w.fixtureData.sessions.push({id:'old-session',user_id:'demo-user',session_date:'2025-10-06',session_type:'Allenamento'});w.fixtureData.attendance.push({id:'old-attendance',user_id:'demo-user',session_id:'old-session',player_id:'player-1',status:'Assente'});await run('refresh()');assert.equal(run('state.sessions.length'),1);
 await run("loadSportPeriod('2025-01-01','2026-10-09',teamOwner(),'player-1').then(s=>window.report=reportData('2025-01-01','2026-10-09','player-1',s))");assert.equal(run('report.attendance.length'),2);assert.equal(run('state.sessions.length'),1);
});
test('Player PDF includes outgoing substitutions and paginates long historical text',async t=>{
 const {run}=await app(t);run("state.events.push({id:'outgoing',match_id:state.matches[0].id,player_id:'player-2',outgoing_player_id:'player-1',event_type:'Sostituzione',minute:65});window.model=playerReportModel(reportData('2026-10-01','2026-10-31','player-1'))");assert.equal(run('model.attendance.reduce((n,r)=>n+r[1],0)'),1);assert.equal(run("model.events.some(x=>x.includes('(uscito)'))"),true);
 run("model.history=Array.from({length:120},(_,i)=>'08/10/2026 | Allenamento | Presente | Risposto - riga '+i);model.events.push('11/10/2026 | Avversario | Nota | '+('Osservazione tecnica lunga. '.repeat(50)));window.pdf=createPlayerReportPdf(model)");assert.ok(run('pdf.getNumberOfPages()')>3);assert.equal(Buffer.from(run("pdf.output('arraybuffer')")).subarray(0,4).toString(),'%PDF');
});
test('Private realtime broadcasts merge new and deleted messages without duplicate subscriptions or stale logout data',async t=>{
 const {w,run}=await app(t);run('initCommunicationsLifecycle()');const channel=w.fixtureChannels[0];assert.equal(channel.options.config.private,true);assert.equal(channel.topic,'team:demo-user:communications');
 w.fixtureData.staff_communications.push({id:'remote',user_id:'demo-user',title:'Avviso',body:'Condiviso',created_by:'other',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString()});channel.event({payload:{}});await wait(150);assert.equal(run('state.staff_communications.length'),1);w.fixtureData.staff_communications=[];channel.event({payload:{}});await wait(150);assert.equal(run('state.staff_communications.length'),0);
 const count=w.fixtureChannels.length;await run('refresh()');assert.equal(w.fixtureChannels.length,count);run('renderLogin()');assert.equal(channel.removed,true);channel.event({payload:{}});await wait(150);assert.equal(run('state.staff_communications.length'),0);
});
test('Realtime reconnect recovers missed data and expiration updates active messages without polling',async t=>{
 const {w,run}=await app(t);run('initCommunicationsLifecycle()');w.Date.now=Date.now;const channel=w.fixtureChannels[0];w.fixtureData.staff_communications.push({id:'missed',user_id:'demo-user',title:'Recuperato',body:'Avviso',created_by:'other',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+600).toISOString()});channel.status('SUBSCRIBED');await wait(150);assert.equal(run('activeCommunications().length'),1);const queries=w.fixtureQueries?.length;await wait(650);assert.equal(run('activeCommunications().length'),0);assert.equal(w.fixtureQueries?.length,queries);
});


test('new attendance never becomes missing survey replies in mixed historical reports',async t=>{
 const {run}=await app(t);
 run(`state.sessions.push({id:'notice-session',session_type:'Allenamento',session_date:'2026-10-08',attendance_mode:'absence_notice'});state.attendance.push({id:'notice-row',session_id:'notice-session',player_id:'player-1',status:'Assente',notified:null});window.mixed=playerReportModel(reportData('2026-10-01','2026-10-09','player-1'));window.fresh=playerReportModel(reportData('2026-10-08','2026-10-09','player-1'))`);
 assert.equal(run('mixed.attendance.reduce((n,r)=>n+r[1],0)'),2);
 assert.equal(run('mixed.legacyReplyCount'),1);assert.equal(run('mixed.replies.reduce((n,r)=>n+r[1],0)'),1);
 assert.equal(run('fresh.legacyReplyCount'),0);assert.equal(run('fresh.replies.reduce((n,r)=>n+r[1],0)'),0);
 assert.equal(run('fresh.history.some(line=>line.includes("Da verificare"))'),false);
});
