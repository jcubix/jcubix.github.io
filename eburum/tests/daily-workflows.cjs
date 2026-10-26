const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
test('Presentation derives days across DST, Eburum outcomes and relative time without changing match data',async()=>{
 const {dayLabel,matchOutcome,relativeTime}=await import('../app-presentation.js');
 assert.equal(dayLabel('2026-10-25','2026-10-24'),'Domani');assert.equal(dayLabel('2026-10-25','2026-10-25'),'Oggi');assert.equal(dayLabel('2026-10-28','2026-10-25'),'Tra 3 giorni');
 const match={venue:'Trasferta',goals_for:3,goals_against:1};assert.equal(matchOutcome(match),'V');assert.equal(match.goals_for,3);assert.equal(matchOutcome({goals_for:1,goals_against:1}),'N');assert.equal(matchOutcome({goals_for:0,goals_against:1}),'P');assert.equal(matchOutcome({goals_for:null,goals_against:0}),null);
 assert.equal(relativeTime('2026-10-25T10:00:00Z',Date.parse('2026-10-25T12:00:00Z')),'2 h fa');
});
async function app(t){const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only',url:'https://eburum.test'}),w=dom.window,run=code=>vm.runInContext(code,dom.getInternalVMContext());t.after(()=>w.close());w.CONFIG={supabaseUrl:'demo',supabaseAnonKey:'demo',season:'2026/27'};w.scrollTo=()=>{};run(fs.readFileSync(__dirname+'/fixtures/team-ui.js','utf8'));await require('./load-app.cjs').loadApp(dom);run('state.user=fixtureUser');await run('refresh()');return {w,run,$:s=>w.document.querySelector(s)};}
test('document states distinguish missing values from genuinely expired dates',async()=>{
 const {documentState}=await import('../app-workflow-tools.js');assert.equal(documentState(null,'2026-10-11','2026-11-10'),'Mancante');assert.equal(documentState('2026-10-10','2026-10-11','2026-11-10'),'Scaduto');assert.equal(documentState('2026-10-11','2026-10-11','2026-11-10'),'In scadenza');assert.equal(documentState('2026-12-01','2026-10-11','2026-11-10'),'In regola');
});
test('match final review detects absent scores, impossible substitutions and manual minute checks',async()=>{
 const {matchReview}=await import('../app-workflow-tools.js'),roster=Array.from({length:11},(_,i)=>({player_id:'p'+i,called:true,lineup:'Titolare',minutes_played:90}));roster.push({player_id:'sub',called:true,lineup:'Panchina',minutes_played:0});
 assert.deepEqual(matchReview({goals_for:0,goals_against:0,minutes_auto:true,duration_minutes:90},roster,[]),[]);
 assert.ok(matchReview({goals_for:null,goals_against:null,minutes_auto:false},roster,[]).some(i=>i.includes('Risultato')));
 const issues=matchReview({goals_for:0,goals_against:0,minutes_auto:true},roster,[{id:'a',event_type:'Sostituzione',minute:60,player_id:'sub',outgoing_player_id:'p0'},{id:'b',event_type:'Sostituzione',minute:70,player_id:'p0',outgoing_player_id:'sub'}]);assert.ok(issues.some(i=>i.includes('70')));
});
test('Operational presentation preserves stable chronology and previews Rome deadlines across DST',async()=>{
 const {newestFirst,communicationDeadline,detailPath,detailListPath}=await import('../app-presentation.js');
 const rows=[{id:'b',day:'2026-10-02'},{id:'z',day:'2026-10-03'},{id:'a',day:'2026-10-02'}];
 assert.deepEqual(newestFirst(rows,x=>x.day).map(x=>x.id),['z','a','b']);assert.equal(rows[0].id,'b');
 assert.equal(communicationDeadline('meeting','2026-01-15','20:30',1),'2026-01-16T19:30:00.000Z');
 assert.equal(communicationDeadline('meeting','2026-07-15','20:30',3),'2026-07-18T18:30:00.000Z');
 assert.equal(communicationDeadline('meeting','2026-03-29','02:30',1),null);
 assert.equal(communicationDeadline('meeting','2026-10-25','02:30',1),null);
 assert.equal(communicationDeadline('meeting','2026-02-30','20:30',1),null);
 assert.equal(communicationDeadline('notice',null,null,2),null);
 assert.equal(communicationDeadline('notice',null,null,1,0),'1970-01-02T00:00:00.000Z');
 assert.equal(detailListPath('#/reports?player=p1&period=month&match=m1'),'/reports?player=p1&period=month');
 assert.equal(detailPath('players','player:p1','#/players?q=Rossi&sort=surname'),'/players?q=Rossi&sort=surname&player=p1');
});
