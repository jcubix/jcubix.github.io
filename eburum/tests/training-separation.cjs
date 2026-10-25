const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),{JSDOM}=require('jsdom');
async function app(t){const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only',url:'https://eburum.vercel.app'}),w=dom.window,run=code=>vm.runInContext(code,dom.getInternalVMContext());t.after(()=>w.close());w.CONFIG={supabaseUrl:'demo',supabaseAnonKey:'demo',season:'2026/27'};w.scrollTo=()=>{};run(fs.readFileSync(__dirname+'/fixtures/team-ui.js','utf8'));await require('./load-app.cjs').loadApp(dom);run('state.user=fixtureUser');await run('refresh()');return {w,run,$:s=>w.document.querySelector(s)}}
const tick=()=>new Promise(r=>setTimeout(r,30));
test('new match venue stays visible across preparation tabs and survives failed save',async t=>{
 const {w,run,$}=await app(t);run("state.page='matches';render()");$('#addMatch').click();
 assert.ok($('#activityVenue'));assert.equal($('#activityVenue').closest('[data-activity-panel]'),null);
 $('#activityVenue').value='Trasferta';$('#activityVenue').dispatchEvent(new w.Event('change',{bubbles:true}));
 $('[data-activity-tab="roster"]').click();assert.equal($('#activityVenue').value,'Trasferta');
 $('#activityName').value='Avversario';w.fixtureSaveError={message:'Interrotto'};
 await $('#activityForm').onsubmit({preventDefault(){},target:$('#activityForm')});
 assert.match($('#activityFeedback').textContent,/Interrotto/);assert.equal($('#activityVenue').value,'Trasferta');
 assert.equal(w.fixtureTeamCalls.at(-1).p_activity.venue,'Trasferta');
 w.fixtureSaveError=null;await $('#activityForm').onsubmit({preventDefault(){},target:$('#activityForm')});
 assert.equal(w.fixtureTeamCalls.at(-1).p_activity.venue,'Trasferta');assert.ok($('#activityForm'));assert.equal($('[data-activity-panel=roster]').hidden,false);assert.match($('#activityRoster').textContent,/Rossi/);
});
test('match sheets expose only football operations; meetings have a secondary entry',async t=>{
 const {run,$}=await app(t);run("state.page='matches';render()");$('#addMatch').click();assert.equal($('#activityType').type,'hidden');assert.equal($('#activityType').value,'Partita');assert.equal($('#activityAttendance'),null);assert.equal($('#copyActivityReminder'),null);assert.equal($('[data-availability]'),null);assert.doesNotMatch($('#rosterCounts').textContent,/risposto|disponibili/);$('#closeActivity').click();
 run("state.page='more';render()");$('[data-page="meetings"]').click();$('[data-new-meeting]').click();assert.ok($('#planningForm'));assert.equal($('#trainingReplies'),null);assert.equal($('#planningAttendance'),null);assert.equal($('#formation'),null);$('#planningName').value='Riunione staff';await $('#planningForm').onsubmit({preventDefault(){}});assert.equal(run("fixtureData.activities.at(-1).activity_type"),'Riunione');assert.equal(run('fixtureTeamCalls.at(-1).p_roster.length'),0);assert.equal(run('fixtureTeamCalls.at(-1).p_technical'),null);
});
test('reply saves retain the complete roster and draft on failure, with no attendance writes',async t=>{
 const {w,run,$}=await app(t);run("state.page='training';render()");$('[data-new-training]').click();const count=w.fixtureData.attendance.length;$('[data-training-player="player-1"][data-training-reply="Disponibile"]').click();$('#pendingReplyFilter').click();run("window.fixtureSaveError={message:'Connessione interrotta'}");await $('#planningForm').onsubmit({preventDefault(){}});assert.match($('#planningFeedback').textContent,/Connessione/);assert.equal($('#savePlanning').disabled,false);assert.equal(w.fixtureData.attendance.length,count);assert.equal(w.fixtureTeamCalls.at(-1).p_roster.length,2);assert.equal(w.fixtureTeamCalls.at(-1).p_roster.find(r=>r.player_id==='player-1').availability,'Disponibile');run('window.fixtureSaveError=null');await $('#planningForm').onsubmit({preventDefault(){}});assert.ok($('#planningAttendance'));$('#planningName').value='Bozza';$('#planningName').dispatchEvent(new w.Event('input',{bubbles:true}));$('#planningAttendance').click();assert.ok($('#planningForm'),'dirty replies and organization cannot silently become the attendance source');assert.equal($('#saveTraining'),null);
});
test('attendance remains a draft until confirmation; failure and duplicate submit preserve it',async t=>{
 const {w,run,$}=await app(t);run("const a={id:'training-test',user_id:fixtureUser.id,activity_type:'Allenamento',activity_date:today(),title:'Allenamento',status:'Programmato',revision:0};fixtureData.activities.push(a);state.activities.push({...a});state.roster.push({activity_id:a.id,player_id:'player-1',availability:'Disponibile'},{activity_id:a.id,player_id:'player-2',availability:'In attesa'});startActualAttendance(a)");assert.equal(run("state.trainingDraft.entries.get('player-1').status"),'Presente');assert.equal(run("state.trainingDraft.entries.get('player-2').status"),'Da confermare');const before=w.fixtureData.attendance.length;$('#saveTraining').click();assert.equal($('#confirmTraining'),null);assert.equal(w.fixtureData.attendance.length,before);$('[data-presence-player="player-2"][data-presence="Infortunato"]').click();$('#saveTraining').click();w.fixtureRpcGate=new Promise(resolve=>w.release=resolve);const submit=$('#confirmTraining').onclick;submit();submit();assert.equal(w.fixtureRpcCalls.length,1);assert.equal($('#confirmTraining').disabled,true);w.fixtureSaveError={message:'Salvataggio interrotto'};w.release();await tick();assert.match($('#reviewStatus').textContent,/interrotto/);assert.equal(run("state.trainingDraft.entries.get('player-2').status"),'Infortunato');assert.equal($('#confirmTraining').disabled,false);w.fixtureSaveError=null;w.fixtureRpcGate=null;await $('#confirmTraining').onclick();assert.equal(w.fixtureData.attendance.length,before+2);assert.equal(w.fixtureRpcCalls[0].p_request_id,w.fixtureRpcCalls[1].p_request_id,'retry uses the same idempotency key');assert.equal(w.fixtureData.activity_roster.length,0,'actual attendance does not rewrite predicted replies');
});
test('future and cancelled training cannot open new attendance; secretary can consult trainings',async t=>{
 const {run,$}=await app(t);run("startActualAttendance({id:'future',activity_type:'Allenamento',activity_date:'2300-01-01',status:'Programmato'})");assert.equal($('#saveTraining'),null);run("startActualAttendance({id:'canceled',activity_type:'Allenamento',activity_date:today(),status:'Annullato'})");assert.equal($('#saveTraining'),null);run("state.team.role='secretary';state.page='training';state.trainingMode='hub';render()");assert.ok($('#trainingHubList'));assert.equal($('[data-new-training]'),null);run("planningModal({activity_type:'Allenamento'})");assert.equal($('#planningForm'),null);
});
test('historical attendance date corrections preserve the existing session and calendar API',async t=>{
 const {w,run,$}=await app(t);
 run("const a={id:'historical-training',user_id:fixtureUser.id,activity_type:'Allenamento',activity_date:'2026-10-06',session_id:'session-1',status:'Concluso',revision:0};fixtureData.activities.push(a);state.activities.push({...a})");
 await run("editAttendanceSession('session-1')");
 assert.equal($('#td').readOnly,false);
 $('#td').value='2026-10-05';$('#td').dispatchEvent(new w.Event('input',{bubbles:true}));
 $('#saveTraining').click();await $('#confirmTraining').onclick();
 assert.equal(w.fixtureRpcCalls.at(-1).p_session_id,'session-1');
 assert.equal(w.fixtureRpcCalls.at(-1).p_session.session_date,'2026-10-05');
 assert.equal(w.fixtureRpcCalls.at(-1).p_activity_id,undefined);
 assert.equal(w.fixtureData.sessions.length,1);
});

for(const code of ['40001','PT409'])test(`activity conflict ${code} keeps the draft and offers reload without retry`,async t=>{
 const {w,run,$}=await app(t);run("state.page='matches';render()");$('#addMatch').click();
 $('#activityName').value='Bozza da conservare';w.fixtureSaveError={code,message:'Attività modificata nel frattempo. Riaprila.'};
 const before=w.fixtureData.activities.length;
 await $('#activityForm').onsubmit({preventDefault(){},target:$('#activityForm')});
 assert.equal(w.fixtureTeamCalls.length,1);assert.equal(w.fixtureData.activities.length,before);
 assert.equal($('#activityName').value,'Bozza da conservare');
 assert.equal($('#activityFeedback button').textContent,'Ricarica partite');
 assert.equal($('#activityForm button[type=submit]').disabled,false);
});
