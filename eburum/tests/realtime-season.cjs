const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),{JSDOM}=require('jsdom'),{loadApp}=require('./load-app.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function app(t){const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only',url:'https://eburum.vercel.app'}),w=dom.window,run=code=>vm.runInContext(code,dom.getInternalVMContext());t.after(()=>w.close());w.CONFIG={supabaseUrl:'demo',supabaseAnonKey:'demo',season:'2026/27'};w.scrollTo=()=>{};run(fs.readFileSync(__dirname+'/fixtures/team-ui.js','utf8'));await loadApp(dom);run('state.user=fixtureUser');await run('refresh()');return {w,run,$:s=>w.document.querySelector(s)}}
test('private broadcasts update the closed-panel dashboard and open panel, then remove deleted messages',async t=>{
 const {w,run,$}=await app(t),channel=w.fixtureChannels[0];assert.equal(channel.options.config.private,true);assert.equal(channel.topic,'team:demo-user:communications');
 w.fixtureData.staff_communications.push({id:'remote',user_id:'demo-user',title:'Pubblicato da un altro membro',body:'Messaggio condiviso',created_by:'other',author_label:'Staff',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString()});channel.event({payload:{}});await wait(150);
 assert.equal($('[data-communication-count]').textContent,'1');assert.match($('[data-communication-preview]').textContent,/altro membro/);
 $('[data-communications]').click();await wait(30);assert.match($('#communicationsList').textContent,/altro membro/);w.fixtureData.staff_communications=[];channel.event({payload:{}});await wait(150);assert.equal($('[data-communication-count]').textContent,'0');assert.match($('#communicationsList').textContent,/Nessuna comunicazione attiva/);
 const count=w.fixtureChannels.length;await run('refresh()');assert.equal(w.fixtureChannels.length,count,'ordinary refresh does not duplicate subscriptions');
 run('renderLogin()');assert.equal(channel.removed,true);channel.event({payload:{}});await wait(150);assert.equal(run('state.staff_communications.length'),0);assert.ok($('#loginForm'));
});
test('reconnect fetches missed changes and expiry updates the dashboard without database polling',async t=>{
 const {w,$}=await app(t),channel=w.fixtureChannels[0];w.fixtureData.staff_communications.push({id:'missed',user_id:'demo-user',title:'Recuperato al rientro',body:'Avviso',created_by:'other',author_label:'Staff',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+600).toISOString()});channel.status('SUBSCRIBED');await wait(150);assert.equal($('[data-communication-count]').textContent,'1');await wait(650);assert.equal($('[data-communication-count]').textContent,'0');
});
test('season loads exclude archived rows while a complete individual report retrieves them',async t=>{
 const {w,run,$}=await app(t);w.fixtureData.sessions.push({id:'old-session',user_id:'demo-user',session_date:'2025-10-06',session_type:'Allenamento'});w.fixtureData.attendance.push({id:'old-attendance',user_id:'demo-user',session_id:'old-session',player_id:'player-1',status:'Assente'});await run('refresh()');
 assert.equal(run('state.sessions.some(s=>s.id==="old-session")'),false);assert.equal(run('state.attendance.some(s=>s.id==="old-attendance")'),false);assert.ok([...$('#sportSeason').options].some(o=>o.value==='2025'));
 run("state.page='reports';render();document.querySelector('#rp').value='player-1'");$('[data-report-period="all"]').click();await wait(50);assert.match($('#report').textContent,/Sessioni registrate per il giocatore: 2/);assert.equal($('#exportReportPdf').disabled,false);assert.equal(run('state.sessions.length'),1,'report history does not overwrite selected-season state');
 run("state.page='register';render()");$('#sportSeason').value='2025';$('#sportSeason').dispatchEvent(new w.Event('change'));await wait(50);assert.equal(run('state.sessions[0].id'),'old-session');assert.equal(run('state.attendance.length'),1);
});
test('named dashboard and tool slots stay present without relying on CSS class strings',async t=>{
 const {run,$}=await app(t);assert.ok($('.dash-communications'));run("state.page='more';render()");assert.ok($('[data-communications]'));assert.ok($('[data-discipline]'));run("playerSheet('player-1')");assert.ok($('[data-discipline-player="player-1"]'));
});
