const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only',url:'https://eburum.vercel.app'}),w=dom.window,run=code=>vm.runInContext(code,dom.getInternalVMContext());
w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.CONFIG={supabaseUrl:'demo',supabaseAnonKey:'demo',season:'2026/27'};w.scrollTo=()=>{};
run(fs.readFileSync(__dirname+'/fixtures/team-ui.js','utf8'));
for(const file of ['vendor/jspdf.umd.min.js','app-dialogs.js','app-part1.js','app-part2.js','app-part3.js','app-part4.js','app-report-export.js','app-part5.js','app-team.js','app-operations.js','app-workflows.js','app-access.js','app-admin.js'])run(fs.readFileSync(__dirname+'/../'+file,'utf8').replace(/boot\(\);\s*$/,''));
(async()=>{
run("state.user=fixtureUser");await run('refresh()');run("state.team.role='secretary';state.page='dashboard';render()");
const $=s=>w.document.querySelector(s);
assert.ok($('[data-expiries]'));assert.equal($('#users'),null);assert.equal($('[data-page="training"]'),null);
$('[data-expiries]').click();assert.match($('#expiryTitle').textContent,/Scadenze/);$('.modal-head button').click();
run("state.page='more';render()");assert.match($('#app').textContent,/Segretario/);assert.equal($('#teamUsers'),null);assert.ok($('[data-expiries]'));
run("playerSheet('player-1')");assert.ok($('#playerAdminForm'));$('.modal-head button').click();
run("state.page='matches';render()");assert.equal($('#addMatch'),null);$('[data-match]').click();assert.ok($('#readonlyActivityTitle'));assert.equal($('#activityForm'),null);assert.equal($('#technicalNote'),null);assert.match($('.modal').textContent,/Consultazione/);$('.modal-head button').click();
run("state.page='agenda';render()");assert.equal($('[data-new-activity]'),null);
run("state.page='training';render()");assert.equal(run('state.page'),'register');assert.equal($('#saveTraining'),null);
run("state.page='reports';render()");assert.ok($('#exportReportPdf'));
run("state.team.role='admin';usersModal()");assert.ok($('#newUserRole option[value="secretary"]'));$('#newUserRole').value='secretary';$('#newUserRole').dispatchEvent(new w.Event('change'));assert.match($('#roleHelp').textContent,/scadenze/);assert.match($('#roleHelp').textContent,/nessuna modifica/);
dom.window.close();console.log('PASS: secretary dashboard expiries, administrative editor, read-only matches, hidden sporting commands, reports and admin role selection');
})().catch(error=>{console.error(error);process.exitCode=1;dom.window.close()});
