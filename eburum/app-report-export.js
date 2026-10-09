import { esc, fmt, state } from './app-part1.js';

/* Individual report charts and local PDF export. No player data leaves the device. */
function playerReportModel(d){
 const p=state.players.find(p=>p.id===d.player);if(!p)throw new Error('Seleziona un giocatore');
 const sessions=new Map(d.sessions.map(s=>[s.id,s])),matches=new Map(d.matches.map(m=>[m.id,m])),activities=new Map(d.activities.map(a=>[a.id,a]));
 const count=status=>d.attendance.filter(r=>r.status===status).length;
 const months=new Map();for(const r of d.attendance){const key=sessions.get(r.session_id)?.session_date.slice(0,7);if(!key)continue;if(!months.has(key))months.set(key,{present:0,total:0,minutes:0});const m=months.get(key);m.total++;if(r.status==='Presente')m.present++}
 for(const r of d.roster){const a=activities.get(r.activity_id);if(a?.activity_type!=='Partita')continue;const key=a.activity_date.slice(0,7);if(!months.has(key))months.set(key,{present:0,total:0,minutes:0});months.get(key).minutes+=Number(r.minutes_played||0)}
 const sport=d.roster.filter(r=>activities.get(r.activity_id)?.activity_type==='Partita');
 return {name:`${p.surname} ${p.name}`,role:p.role||'',from:d.from,to:d.to,
  attendance:[['Presenze',count('Presente')],['Assenze',count('Assente')],['Infortuni',count('Infortunato')]],
  replies:[['Ha risposto',d.attendance.filter(r=>r.notified===true).length],['Non ha risposto',d.attendance.filter(r=>r.notified===false).length],['Da verificare',d.attendance.filter(r=>r.notified==null).length]],
  sport:[['Convocazioni',sport.filter(r=>r.called).length],['Minuti giocati',sport.reduce((n,r)=>n+Number(r.minutes_played||0),0)],['Gol',d.events.filter(e=>e.event_type==='Gol'&&e.player_id===d.player).length],['Ammonizioni',d.events.filter(e=>e.event_type==='Ammonizione'&&e.player_id===d.player).length],['Espulsioni',d.events.filter(e=>e.event_type==='Espulsione'&&e.player_id===d.player).length],['Sostituzioni',d.events.filter(e=>e.event_type==='Sostituzione').length]],
  months:[...months].sort(([a],[b])=>a.localeCompare(b)).map(([key,m])=>({...m,label:new Intl.DateTimeFormat('it-IT',{month:'short',year:'numeric'}).format(new Date(key+'-15T12:00:00'))})),
  history:[...d.attendance].sort((a,b)=>sessions.get(a.session_id).session_date.localeCompare(sessions.get(b.session_id).session_date)).map(r=>`${fmt(sessions.get(r.session_id).session_date)} | ${sessions.get(r.session_id).session_type} | ${r.status} | ${r.notified===true?'Risposto':r.notified===false?'Non risposto':'Da verificare'}`),
  events:[...d.events].sort((a,b)=>matches.get(a.match_id).match_date.localeCompare(matches.get(b.match_id).match_date)||(a.minute||0)-(b.minute||0)).map(e=>`${fmt(matches.get(e.match_id).match_date)} | ${matches.get(e.match_id).opponent} | ${e.event_type}${e.event_type==='Sostituzione'?(e.player_id===d.player?' (entrato)':' (uscito)'):''}${e.minute==null?'':' | '+e.minute+' min'}${e.detail?' | '+e.detail:''}`)
 };
}
function renderPlayerCharts(m){
 const bars=(title,rows,unit='')=>{const max=Math.max(1,...rows.map(r=>r[1]));return `<article class="chart-card"><h4>${esc(title)}</h4>${rows.length?rows.map(([label,value])=>`<div class="chart-bar-row"><span>${esc(label)}</span><div class="chart-track"><div class="chart-fill" style="width:${Math.round(value/max*100)}%"></div></div><b>${value}${unit}</b></div>`).join(''):'<p class="empty">Nessun dato registrato nel periodo.</p>'}</article>`};
 return bars('Presenze effettive',m.attendance)+bars('Risposte WhatsApp registrate',m.replies)+bars('Minuti giocati per mese',m.months.map(x=>[x.label,x.minutes]),' min')+`<p class="row-sub">Le barre confrontano i valori all’interno di ogni grafico. Le risposte WhatsApp non determinano automaticamente la presenza. I minuti sono quelli registrati dallo staff.</p>`;
}
function playerReportFilename(d){const p=state.players.find(p=>p.id===d.player);return `Eburum-${(p?.surname+'-'+p?.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-]/g,'-')}-${d.from}-${d.to}.pdf`}
function createPlayerReportPdf(m){
 if(!globalThis.jspdf?.jsPDF)throw new Error('Modulo PDF non disponibile. Ricarica la pagina.');
 const pdf=new globalThis.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});let y=22;
 const clean=t=>String(t).replace(/[–—]/g,'-').replace(/′/g,"'").replace(/[^\x20-\x7e\xa0-\xff\n]/g,'');
 const page=()=>{pdf.addPage();y=20};const room=h=>{if(y+h>277)page()};
 const text=(t,size=10,bold=false)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(32,42,57);const lines=pdf.splitTextToSize(clean(t),174);for(const line of lines){room(size*.45+2);pdf.text(line,18,y);y+=size*.45+2}};
 const heading=t=>{room(18);y+=5;text(t,13,true);y+=2};
 const chart=(title,rows,unit='')=>{heading(title);const max=Math.max(1,...rows.map(r=>r[1]));if(!rows.length){text('Nessun dato registrato nel periodo.');return}for(const [label,value] of rows){room(13);pdf.setFontSize(9);pdf.text(clean(label),18,y);pdf.setFillColor(231,237,245);pdf.rect(70,y-4,82,5,'F');pdf.setFillColor(75,135,200);if(value>0)pdf.rect(70,y-4,82*value/max,5,'F');pdf.text(clean(value+unit),190,y,{align:'right'});y+=11}};
 pdf.setProperties({title:`Report giocatore - ${clean(m.name)}`,subject:`${m.from} - ${m.to}`,author:'Eburum Team Manager'});
 text('EBVRVM / TEAM MANAGER',11,true);text(m.name,22,true);text(`Report individuale | ${fmt(m.from)} - ${fmt(m.to)}`,11);if(m.role)text(m.role);y+=4;
 const total=m.attendance.reduce((n,r)=>n+r[1],0);text(`Presenze: ${m.attendance[0][1]} su ${total} registrazioni${total?' ('+Math.round(m.attendance[0][1]/total*100)+'%)':''}.`,11,true);
 text('La disponibilità comunicata su WhatsApp e la presenza effettiva sono dati separati. Gli infortuni indicano lo stato registrato nelle singole sessioni.');
 heading('Partite e impiego');for(let i=0;i<m.sport.length;i+=2)text(`${m.sport[i][0]}: ${m.sport[i][1]}     |     ${m.sport[i+1][0]}: ${m.sport[i+1][1]}`);
 chart('Presenze effettive',m.attendance);chart('Risposte WhatsApp registrate',m.replies);chart('Minuti giocati per mese',m.months.map(x=>[x.label,x.minutes]),' min');
 heading('Andamento delle presenze');if(!m.months.some(x=>x.total))text('Nessuna presenza registrata.');for(const month of m.months.filter(x=>x.total))text(`${month.label}: ${month.present}/${month.total} presenze (${Math.round(month.present/month.total*100)}%)`);
 heading('Storico delle sessioni');for(const row of m.history.length?m.history:['Nessuna sessione registrata nel periodo.'])text(row,9);
 heading('Eventi delle partite');for(const row of m.events.length?m.events:['Nessun evento del giocatore registrato nel periodo.'])text(row,9);
 for(let i=1;i<=pdf.getNumberOfPages();i++){pdf.setPage(i);pdf.setDrawColor(205,215,227);pdf.line(18,283,192,283);pdf.setFontSize(8);pdf.setTextColor(91,105,122);pdf.text('Eburum | Report individuale | '+m.from+' - '+m.to,18,289);pdf.text(`${i} / ${pdf.getNumberOfPages()}`,192,289,{align:'right'})}
 return pdf;
}

export { playerReportModel, renderPlayerCharts, playerReportFilename, createPlayerReportPdf };
