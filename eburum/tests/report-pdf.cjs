const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="app"></div>',{runScripts:'outside-only',url:'https://eburum.vercel.app'}),w=dom.window,run=code=>vm.runInContext(code,dom.getInternalVMContext());
w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.CONFIG={supabaseUrl:'demo',supabaseAnonKey:'demo',season:'2026/27'};w.scrollTo=()=>{};
run(fs.readFileSync(__dirname+'/fixtures/team-ui.js','utf8'));
const ready=require('./load-app.cjs').loadApp(dom);
(async()=>{await ready;run("state.user=fixtureUser");await run("refresh()");
run("state.user=fixtureUser;state.page='reports';render();document.querySelector('#rp').value='player-1';document.querySelector('#rf').value='2026-10-01';document.querySelector('#rt').value='2026-10-31';document.querySelector('#rp').dispatchEvent(new Event('change'))");
assert.equal(w.document.querySelector('[data-report-tab="team"]'),null);
assert.match(w.document.querySelector('#playerCharts').textContent,/WhatsApp/);
run("state.events.push({id:'outgoing',match_id:state.matches[0].id,player_id:'player-2',outgoing_player_id:'player-1',event_type:'Sostituzione',minute:65})");
const model=run("playerReportModel(reportData('2026-10-01','2026-10-31','player-1'))");assert.match(model.name,/Rossi/);assert.equal(model.attendance.reduce((n,r)=>n+r[1],0),1);assert.ok(model.events.some(x=>x.includes('(uscito)')));
const short=run("createPlayerReportPdf(playerReportModel(reportData('2026-10-01','2026-10-31','player-1')))");assert.ok(short.getNumberOfPages()>=1);
const data=Buffer.from(short.output('arraybuffer'));assert.equal(data.subarray(0,4).toString(),'%PDF');
run("const stressModel=playerReportModel(reportData('2026-10-01','2026-10-31','player-1'));stressModel.history=Array.from({length:120},(_,i)=>'08/10/2026 | Allenamento | Presente | Risposto - riga '+i);stressModel.events.push('11/10/2026 | Avversario | Nota | '+('Osservazione tecnica lunga. '.repeat(50)));const stressPdf=createPlayerReportPdf(stressModel)");
assert.ok(run('stressPdf.getNumberOfPages()')>3);
run("state.players=[];render()");assert.equal(w.document.querySelector('#exportReportPdf').disabled,true);
if(process.env.REPORT_PDF_OUTPUT){fs.mkdirSync(process.env.REPORT_PDF_OUTPUT,{recursive:true});fs.writeFileSync(process.env.REPORT_PDF_OUTPUT+'/report-demo.pdf',data);fs.writeFileSync(process.env.REPORT_PDF_OUTPUT+'/report-stress.pdf',Buffer.from(run("stressPdf.output('arraybuffer')")))}
console.log('PASS: individual-only reports, scoped charts, outgoing substitutions, PDF bytes, multipage history and long text, empty roster export guard');

})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>dom.window.close());
