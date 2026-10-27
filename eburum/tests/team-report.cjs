const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const domain=import('../app-team-report.js');
const players=[{id:'a',surname:'Rossi',name:'Marco',role:'Difensore',active:true},{id:'b',surname:'Bianchi',name:'Luca',role:'Attaccante',active:false},{id:'c',surname:'Verdi',name:'Paolo',role:'Portiere',active:true}];
const source=()=>({
 sessions:[{id:'s1',session_type:'Allenamento',session_date:'2026-10-01'},{id:'s2',session_type:'Allenamento',session_date:'2026-10-02'},{id:'meeting',session_type:'Riunione',session_date:'2026-10-03'},{id:'old',session_type:'Allenamento',session_date:'2025-10-01'}],
 attendance:[{player_id:'a',session_id:'s1',status:'Presente'},{player_id:'a',session_id:'s2',status:'Assente'},{player_id:'b',session_id:'s1',status:'Infortunato'},{player_id:'b',session_id:'s2',status:'Da confermare'},{player_id:'a',session_id:'meeting',status:'Presente'},{player_id:'a',session_id:'old',status:'Presente'}],
 matches:[{id:'played',match_date:'2026-10-04',goals_for:1,goals_against:1},{id:'future',match_date:'2026-10-31',goals_for:null,goals_against:null},{id:'cancelled',match_date:'2026-10-05',goals_for:5,goals_against:0},{id:'old-game',match_date:'2025-10-05',goals_for:1,goals_against:0}],
 activities:[{id:'ga',match_id:'played',activity_type:'Partita',activity_date:'2026-10-04',status:'Concluso'},{id:'gf',match_id:'future',activity_type:'Partita',activity_date:'2026-10-31',status:'Programmato'},{id:'gc',match_id:'cancelled',activity_type:'Partita',activity_date:'2026-10-05',status:'Annullato'},{id:'training',activity_type:'Allenamento',activity_date:'2026-10-03',status:'Programmato'}],
 roster:[{player_id:'a',activity_id:'ga',called:true,lineup:'Titolare',minutes_played:60},{player_id:'b',activity_id:'ga',called:true,lineup:'Panchina',minutes_played:30},{player_id:'c',activity_id:'ga',called:true,lineup:'Panchina',minutes_played:0},{player_id:'a',activity_id:'gf',called:true,lineup:'Titolare',minutes_played:0},{player_id:'a',activity_id:'gc',called:true,lineup:'Titolare',minutes_played:90},{player_id:'a',activity_id:'training',availability:'Indisponibile',called:false,minutes_played:0}],
 events:[{player_id:'a',event_type:'Gol',match_id:'played'},{player_id:null,event_type:'Gol',match_id:'played'},{player_id:'a',event_type:'Ammonizione',match_id:'played'},{player_id:'b',event_type:'Espulsione',match_id:'played'},{player_id:'b',outgoing_player_id:'a',event_type:'Sostituzione',match_id:'played'},{player_id:'b',outgoing_player_id:'c',event_type:'Sostituzione',match_id:'played'},{player_id:'a',event_type:'Gol',match_id:'cancelled'},{player_id:'a',event_type:'Gol',match_id:'old-game'}]
});
test('team report uses confirmed training records, excludes cancelled and old matches, and keeps inactive history',async()=>{
 const {teamReportRows}=await domain;const rows=teamReportRows(players,source(),'2026-10-01','2026-10-31');assert.equal(rows.length,3);
 assert.deepEqual(rows[0],{id:'a',name:'Rossi Marco',role:'Difensore',active:true,sessions:2,present:1,absent:1,injured:0,percentage:50,called:2,starters:1,substitutes:0,minutes:60,goals:1,yellows:1,reds:0});
 assert.equal(rows[1].active,false);assert.equal(rows[1].sessions,1);assert.equal(rows[1].injured,1);assert.equal(rows[1].substitutes,1);assert.equal(rows[1].reds,1);assert.equal(rows[2].substitutes,0);assert.equal(rows[2].percentage,null);assert.equal(rows[2].absent,0);
 const narrow=teamReportRows(players,source(),'2026-10-01','2026-10-01');assert.equal(narrow[0].percentage,100);assert.equal(narrow[0].goals,0);
});
test('team report sorts without mutation',async()=>{
 const {teamReportRows,sortTeamReport}=await domain;const rows=teamReportRows(players,source(),'2026-10-01','2026-10-31');const before=JSON.stringify(rows);
 assert.deepEqual(sortTeamReport(rows).map(r=>r.id),['b','a','c']);assert.deepEqual(sortTeamReport(rows,'minutes','desc').map(r=>r.id),['a','b','c']);assert.equal(sortTeamReport(rows,'percentage','desc').at(-1).id,'c');assert.equal(JSON.stringify(rows),before);
});

test('team Excel round-trips ordered data as real numbers and safe text, with filters and frozen headings',async()=>{
 const {teamReportRows,sortTeamReport,createTeamReportExcel,teamReportColumns}=await domain;
 const rows=sortTeamReport(teamReportRows(players,source(),'2026-10-01','2026-10-31'),'minutes','desc');
 rows[0].name='  =HYPERLINK("test")';rows[1].role='@SUM(1)';rows[2].name='D’Angelo Nicolò & <Paolo>';
 rows.push({...rows[0],id:'full',name:'Presenza completa',percentage:100});const before=JSON.stringify(rows);
 const bytes=await createTeamReportExcel(rows,'2026-10-01','2026-10-31');assert.equal(Buffer.from(bytes).subarray(0,2).toString(),'PK');assert.equal(JSON.stringify(rows),before);
 const {Workbook,ValueType}=require('exceljs'),book=new Workbook();await book.xlsx.load(bytes);assert.equal(book.worksheets.length,1);const sheet=book.getWorksheet('Report squadra');
 assert.equal(sheet.getCell('A2').value,'01/10/2026 – 31/10/2026 · 4 giocatori');assert.equal(sheet.rowCount,8);assert.equal(sheet.columnCount,14);assert.deepEqual(sheet.getRow(4).values.slice(1),teamReportColumns.map(c=>c.label));
 for(const [i,row] of rows.entries())for(const [j,column] of teamReportColumns.entries()){
  const cell=sheet.getCell(i+5,j+1);let expected=row[column.key];if(column.key==='name'&&!row.active)expected+=' (Inattivo)';if(column.key==='percentage'&&expected!=null)expected/=100;
  assert.equal(cell.value,expected);assert.equal(cell.formula,undefined);if(typeof expected==='number')assert.equal(cell.type,ValueType.Number);
 }
 assert.equal(sheet.getCell('G5').numFmt,'0%');assert.equal(sheet.getCell('G6').value,0);assert.equal(sheet.getCell('G7').value,null);assert.equal(sheet.getCell('G8').value,1);assert.equal(sheet.getCell('A5').type,ValueType.String);assert.equal(sheet.getCell('B6').type,ValueType.String);
 assert.equal(sheet.views[0].state,'frozen');assert.equal(sheet.views[0].xSplit,1);assert.equal(sheet.views[0].ySplit,4);assert.equal(sheet.autoFilter,'A4:N8');assert.equal(sheet.getCell('A4').fill.fgColor.argb,'FF101D42');assert.ok(sheet.getRow(4).height>=30);assert.equal(sheet.getCell('A4').alignment.wrapText,true);
});
test('team PDF is a real landscape document with repeated headers on multiple pages',async t=>{
 const dom=new JSDOM('',{runScripts:'outside-only'});t.after(()=>{dom.window.close();delete globalThis.jspdf});dom.window.TextEncoder=TextEncoder;dom.window.TextDecoder=TextDecoder;vm.runInContext(fs.readFileSync(__dirname+'/../vendor/jspdf.umd.min.js','utf8'),dom.getInternalVMContext());globalThis.jspdf=dom.window.jspdf;
 const {teamReportRows,createTeamReportPdf}=await domain;const row=teamReportRows(players,source(),'2026-10-01','2026-10-31')[0];const pdf=createTeamReportPdf(Array.from({length:100},(_,i)=>({...row,name:'D’Alessandro Santamaria Massimiliano Francesco '+i})),'2026-10-01','2026-10-31');assert.ok(pdf.getNumberOfPages()>2);assert.ok(pdf.internal.pageSize.getWidth()>pdf.internal.pageSize.getHeight());assert.equal(Buffer.from(pdf.output('arraybuffer')).subarray(0,4).toString(),'%PDF');
});
