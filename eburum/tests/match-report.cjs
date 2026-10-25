const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
async function app(t){
 const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only',url:'https://eburum.vercel.app'}),w=dom.window,run=s=>vm.runInContext(s,dom.getInternalVMContext());t.after(()=>w.close());
 w.CONFIG={supabaseUrl:'demo',supabaseAnonKey:'demo',season:'2026/27'};w.scrollTo=()=>{};
 run(fs.readFileSync(path.join(__dirname,'fixtures/team-ui.js'),'utf8'));await require('./load-app.cjs').loadApp(dom);
 run('state.user=fixtureUser');await run('refresh()');return {w,run,$:s=>w.document.querySelector(s)};
}
function example(){
 const entries=[['Cavaliere','Giovanni','Portiere'],['Viggianiello','Michele','Difensore'],['Longobardi','Giuseppe','Difensore'],['Jammeh','Ousman','Difensore'],['Verderame','Salvatore','Difensore'],['D’Arco','Luigi','Centrocampista'],['Perna','Antonio','Centrocampista'],['Verderame','Carlo','Centrocampista'],['Boffa','Francesco','Attaccante'],['Mastrangelo','Luca','Attaccante'],['Maiorano','Vito','Attaccante'],['Pastore','Felice','Difensore'],['Ristallo','Vito','Centrocampista'],['Migliozzi','Marco','Attaccante'],['Melillo','Andrea','Attaccante'],['Pirozzi','Antonio','Attaccante'],['Mastrangelo','Giuseppe','Attaccante'],['Pirozzi','Aniello','Attaccante'],['Pastore','Mario','Difensore']];
 const players=entries.map(([surname,name,role],i)=>({id:'p'+i,surname,name,role,role_order:i+1,active:i!==2,user_id:'demo-user'}));
 const roster=players.slice(0,16).map((p,i)=>({id:'r'+i,user_id:'demo-user',activity_id:'activity-1',player_id:p.id,called:true,lineup:i<11?'Titolare':'Panchina',minutes_played:0}));
 const goal=(minute,detail=null)=>({minute,event_type:'Gol',player_id:'p6',detail});
 const sub=(minute,outgoing,incoming)=>({minute,event_type:'Sostituzione',outgoing_player_id:'p'+outgoing,player_id:'p'+incoming});
 const events=[goal(8,'Rigore'),goal(47),sub(50,2,11),sub(55,7,12),sub(68,8,13),{minute:71,event_type:'Ammonizione',player_id:'p1'},sub(79,9,14),sub(82,10,15),goal(90)].map((e,i)=>({...e,id:'e'+i,match_id:'match-1',user_id:'demo-user',created_at:'2026-10-10T12:00:00Z'}));
 return {players,roster,events,match:{id:'match-1',user_id:'demo-user',opponent:'Pellezzano',venue:'Casa',goals_for:3,goals_against:2,match_date:'2026-10-10'},activity:{id:'activity-1',user_id:'demo-user',match_id:'match-1',activity_type:'Partita',title:'Pellezzano',activity_date:'2026-10-10',status:'Concluso',revision:0}};
}
const expected=`EBURUM - Pellezzano

Formazione Titolare:
Cavaliere
Viggianiello
Longobardi
Jammeh
Verderame S
D’Arco
Perna
Verderame C
Boffa
Mastrangelo L
Maiorano

8’ - Gol Perna (RIG)
47’ - Gol Perna
50’ - Esce Longobardi entra Pastore F
55’ - Esce Verderame C entra Ristallo
68’ - Esce Boffa entra Migliozzi
71’ - Ammonito Viggianiello
79’ - Esce Mastrangelo L entra Melillo
82’ - Esce Maiorano entra Pirozzi Ant
90’ - Gol Perna

Risultato finale: 3-2`;

test('match sheet reproduces the requested report, disambiguates names and preserves source data',async t=>{
 const {w,run}=await app(t);const sample=example();w.sample=sample;sample.events.reverse();const before=JSON.stringify(sample);
 assert.equal(run('matchReportModel(sample).text'),expected);assert.equal(JSON.stringify(sample),before);
});
test('away, zero scores, missing minutes and historical players remain explicit',async t=>{
 const {w,run}=await app(t);const sample=example();w.sample=sample;sample.match.venue='Trasferta';
 assert.match(run('matchReportModel(sample).text'),/^Pellezzano - EBURUM/);assert.match(run('matchReportModel(sample).text'),/Risultato finale: 2-3$/);
 sample.match.goals_for=0;sample.match.goals_against=0;assert.equal(run('matchReportModel(sample).result'),'Risultato finale: 0-0');
 sample.match.goals_against=null;assert.equal(run('matchReportModel(sample).result'),'Risultato: da registrare');
 sample.events.push({id:'unknown',match_id:'match-1',minute:null,event_type:'Espulsione',player_id:'deleted'});assert.match(run('matchReportModel(sample).text'),/Minuto non indicato - Espulso Giocatore storico/);
 sample.events.push({id:'opponent',match_id:'match-1',minute:0,event_type:'Gol',player_id:null,detail:'Rigore'});assert.match(run('matchReportModel(sample).text'),/0’ - Gol Squadra avversaria \(RIG\)/);
 sample.roster=[];sample.events=[];sample.activity.status='Annullato';assert.match(run('matchReportModel(sample).text'),/Partita annullata\n\nFormazione Titolare:\nFormazione non registrata/);
 sample.match.goals_for=1;sample.match.goals_against=0;assert.equal(run('matchReportModel(sample).result'),'Risultato registrato: 0-1');
});
test('only this match and its called starters enter the report; partial scores are not declared final',async t=>{
 const {w,run}=await app(t);const sample=example();w.sample=sample;sample.events.push({match_id:'another',event_type:'Gol',minute:9});sample.roster.push({...sample.roster[0],activity_id:'another'});sample.roster[0].called=false;
 assert.equal(run('matchReportModel(sample).starters.length'),10);assert.equal(run('matchReportModel(sample).events.length'),9);
 sample.activity.status='Programmato';sample.match.match_date='2099-10-10';assert.equal(run('matchReportModel(sample).result'),'Risultato registrato: 3-2');
});
test('PDF exports all events across pages with long content and safe filenames',async t=>{
 const {w,run}=await app(t);const sample=example();w.sample=sample;
 sample.events=Array.from({length:100},(_,i)=>({id:'e'+i,match_id:'match-1',minute:i,event_type:'Nota',detail:'Controllo tabellino multipagina '+i+' '+('testo lungo '.repeat(8))}));sample.match.opponent='../Pellezzano / Èlite';
 const model=run('matchReportModel(sample)');const pdf=run('createMatchReportPdf')(model);
 assert.ok(pdf.getNumberOfPages()>2);const bytes=pdf.output('arraybuffer');assert.ok(bytes.byteLength>5000);assert.match(model.filename,/^[a-zA-Z0-9-]+$/);assert.match(model.text,/multipagina 99/);
});
test('export uses saved lineup and blocks an unsaved score; clipboard fallback and closing preserve edits',async t=>{
 const {w,run,$}=await app(t);const sample=example();w.fixtureData.players=sample.players;w.fixtureData.activities=[sample.activity];w.fixtureData.matches=[sample.match];w.fixtureData.activity_roster=sample.roster;w.fixtureData.match_events=sample.events;
 await run('refresh()');await run("openActivity('activity-1','results')");$('#matchGoalsFor').value='4';$('#matchGoalsFor').dispatchEvent(new w.Event('input',{bubbles:true}));$('.match-report-trigger').click();assert.equal($('#matchReportText'),null);assert.match($('.toast').textContent,/Salva le modifiche/);
 w.confirm=()=>true;$('#closeActivity').click();await run("openActivity('activity-1','results')");$('.match-report-trigger').click();assert.equal($('#matchReportText').value,expected);assert.ok($('#app').hasAttribute('inert'));
 await $('#copyMatchReport').onclick();assert.match($('#matchReportStatus').textContent,/Copia manualmente/);assert.equal($('#matchReportText').selectionEnd,expected.length);
 $('[aria-label="Chiudi tabellino"]').click();await tick();assert.equal($('#matchReportText'),null);assert.equal($('.activity-modal').parentElement.hasAttribute('inert'),false);assert.equal($('#matchGoalsFor').value,'3');
});
test('read-only roles can export match sheets without gaining editing controls',async t=>{
 const {run,$}=await app(t);
 for(const role of ['secretary','president','treasurer']){
  run("state.team.role='"+role+"'");await run("openActivity('activity-1')");assert.equal($('#activityForm'),null);assert.ok($('.match-report-trigger'));$('.match-report-trigger').click();assert.ok($('#matchReportText'));$('[aria-label="Chiudi tabellino"]').click();$('[aria-label="Chiudi attività"]').click();await tick();
 }
});
test('PDF requests are single-submit and cannot export after account changes or closing',async t=>{
 const {w,run,$}=await app(t);w.sample=example();run('matchReportModal(sample)');delete w.jspdf;
 const pending=$('#downloadMatchReport').onclick();await $('#downloadMatchReport').onclick();assert.equal(w.document.querySelectorAll('script[data-pdf-loader]').length,1);
 let saved=0;w.jspdf={jsPDF:class {constructor(){saved++}}};run('state.user=null');$('script[data-pdf-loader]').onload();await pending;assert.equal(saved,0);assert.equal($('#downloadMatchReport').disabled,false);
 run('state.user=fixtureUser');$('[aria-label="Chiudi tabellino"]').click();delete w.jspdf;run('matchReportModal(sample)');
 const closing=$('#downloadMatchReport').onclick();$('[aria-label="Chiudi tabellino"]').click();await closing;assert.equal(saved,0);
});
