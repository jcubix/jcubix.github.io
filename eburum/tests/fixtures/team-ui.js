const fixtureData={players:[{id:'player-1',surname:'Rossi',name:'Marco',role:'Centrocampista',active:true,user_id:'demo-user'},{id:'player-2',surname:'Bianchi',name:'Luca',role:'Difensore',active:true,user_id:'demo-user'}],sessions:[{id:'session-1',user_id:'demo-user',session_date:'2026-10-06',session_type:'Allenamento',note:'Preparazione partita'}],attendance:[{id:'attendance-1',user_id:'demo-user',session_id:'session-1',player_id:'player-1',status:'Presente',delay_minutes:0},{id:'attendance-2',user_id:'demo-user',session_id:'session-1',player_id:'player-2',status:'Assente',delay_minutes:0}],matches:[{id:'match-1',user_id:'demo-user',match_date:'2026-10-11',opponent:'Squadra ospite',venue:'Casa',goals_for:2,goals_against:1,note:'Appunti dimostrativi della partita'}],match_events:[{id:'event-1',user_id:'demo-user',match_id:'match-1',player_id:'player-1',minute:24,event_type:'Gol',detail:'Conclusione dal limite',created_at:'2026-10-07T12:00:00Z'}]};
const fixtureUser={id:'demo-user',email:'demo@example.test',app_metadata:{role:'admin'}};
let fixtureNext=0;
class FixtureQuery {
 constructor(table){this.table=table;this.filters=[];this.action='select';this.rows=null;this.orders=[]}
 select(){return this} gt(key,value){this.filters.push(row=>row[key]>value);return this} gte(key,value){this.filters.push(row=>row[key]>=value);return this} lte(key,value){this.filters.push(row=>row[key]<=value);return this} in(key,values){this.filters.push(row=>values.includes(row[key]));return this} limit(n){this.bounds=[0,n-1];return this} eq(key,value){this.filters.push(row=>row[key]===value);return this} order(key,options={}){this.orders.push({key,ascending:options.ascending!==false});return this}
 insert(rows){this.action='insert';this.rows=Array.isArray(rows)?rows:[rows];return this}
 upsert(row,options={}){this.action='upsert';this.rows=row;this.conflict=options.onConflict;return this} update(row){this.action='update';this.rows=row;return this} delete(){this.action='delete';return this}
 single(){this.one=true;return this} range(start,end){this.bounds=[start,end];return this}
 async result(){if(this.table==='staff_communications'&&window.fixtureCommunicationError)return {data:null,error:window.fixtureCommunicationError};if(this.table==='match_events'&&this.action!=='select'&&window.fixtureEventError)return {data:null,error:window.fixtureEventError};(window.fixtureQueries||=[]).push({table:this.table,action:this.action});const table=fixtureData[this.table]||[];if(this.table==='match_events'&&this.action==='insert'&&this.rows.some(row=>table.some(existing=>existing.id===row.id)))return {data:null,error:{code:'23505',message:'Evento duplicato'}};let rows=table.filter(row=>this.filters.every(f=>f(row)));const beforeRows=rows.map(r=>({...r}));if(this.action==='upsert'){let existing=table.find(r=>r[this.conflict]===this.rows[this.conflict]);if(existing){Object.assign(existing,this.rows);rows=[existing]}else{rows=[{...this.rows,id:'test-'+(++fixtureNext)}];table.push(...rows)}}if(this.action==='insert'){rows=this.rows.map(row=>({...row,id:row.id||'test-'+(++fixtureNext),created_at:new Date().toISOString()}));if(this.table==='staff_communications')rows.forEach(row=>Object.assign(row,{created_by:fixtureUser.id,author_label:'Demo staff',expires_at:new Date((row.kind==="meeting"?Date.parse(row.meeting_date+"T"+row.meeting_time):Date.now())+row.retention_days*86400000).toISOString()}));table.push(...rows)}if(this.action==='update'){rows.forEach(row=>Object.assign(row,this.rows))}if(this.action==='delete'){fixtureData[this.table]=table.filter(row=>!rows.includes(row))}if(this.table==='match_events'&&this.action!=='select')for(const row of rows){const old=this.action==='insert'?null:beforeRows.find(r=>r.id===row.id),next=this.action==='delete'?null:row;if(JSON.stringify(old)===JSON.stringify(next))continue;const m=fixtureData.matches.find(m=>m.id===row.match_id),a=fixtureData.activities.find(a=>a.match_id===row.match_id);if(m){const own=Number(next?.event_type==='Gol'&&!!next?.player_id)-Number(old?.event_type==='Gol'&&!!old?.player_id),opp=Number(next?.event_type==='Gol'&&!next?.player_id)-Number(old?.event_type==='Gol'&&!old?.player_id);if(own||opp){m.goals_for=Math.max(0,(m.goals_for??0)+own);m.goals_against=Math.max(0,(m.goals_against??0)+opp)}if(a)a.revision++}}if(this.orders.length)rows.sort((a,b)=>{for(const o of this.orders){const delta=String(a[o.key]??'').localeCompare(String(b[o.key]??''));if(delta)return o.ascending?delta:-delta}return 0});if(this.bounds)rows=rows.slice(this.bounds[0],this.bounds[1]+1);return {data:this.one?rows[0]:rows.map(row=>({...row})),error:null}}
 then(resolve,reject){return this.result().then(resolve,reject)}
}
window.fixtureData=fixtureData;
window.fixtureUser=fixtureUser;
window.confirm=()=>true;
window.fixtureRpcCalls=[];
fixtureData.attendance_history=[];
fixtureData.activities=[{id:'activity-1',user_id:'demo-user',activity_date:'2026-10-11',activity_type:'Partita',title:'Squadra ospite',status:'Programmato',revision:0,match_id:'match-1',start_time:'15:00',meeting_time:'14:00',location:'Campo comunale',meeting_place:'Sede squadra',organization_note:'Portare divisa blu'}];fixtureData.activity_roster=[];fixtureData.player_administration=[];fixtureData.activity_technical=[];
window.fixtureTeamCalls=[];

const fixtureRpc=async(name,payload)=>{if(name==='acknowledge_communication'){window.fixtureAcknowledgements=(window.fixtureAcknowledgements||0)+1;if(window.fixtureAckGate)await window.fixtureAckGate;if(window.fixtureAckError)return {data:null,error:window.fixtureAckError};if(!fixtureData.communication_receipts.some(r=>r.communication_id===payload.p_id&&r.reader_id===fixtureUser.id))fixtureData.communication_receipts.push({communication_id:payload.p_id,user_id:fixtureUser.id,reader_id:fixtureUser.id,reader_label:'Demo staff',acknowledged_at:new Date().toISOString()});return {data:null,error:null};}if(name==='team_administration_summary')return {data:fixtureData.players.map(p=>({player_id:p.id,registration_status:'Da verificare',certificate_status:'Da verificare',document_status:'In scadenza',needs_review:true})),error:null};if(name==='save_activity_observation'){window.fixtureTeamCalls.push({...payload,rpc:name});if(window.fixtureSaveError)return {data:null,error:window.fixtureSaveError};const a=fixtureData.activities.find(a=>a.id===payload.p_id);if(a.revision!==payload.p_revision)return {data:null,error:{code:'40001',message:'Partita modificata'}};let technical=fixtureData.activity_technical.find(t=>t.activity_id===a.id);if(!technical){technical={activity_id:a.id,user_id:a.user_id,formation:null};fixtureData.activity_technical.push(technical)}technical.note=payload.p_note;a.revision++;return {data:null,error:null};}if(name==='save_match_result'){window.fixtureTeamCalls.push(JSON.parse(JSON.stringify(payload)));if(window.fixtureSaveError)return {data:null,error:window.fixtureSaveError};const m=fixtureData.matches.find(m=>m.id===payload.p_id),a=fixtureData.activities.find(a=>a.match_id===m.id);if(a.revision!==payload.p_revision)return {data:null,error:{message:'Partita modificata nel frattempo'}};Object.assign(m,payload.p_values);a.revision++;return {data:{...m},error:null}}if(name==='team_context')return {data:{owner_id:fixtureUser.id,role:fixtureUser.app_metadata.role==='admin'?'admin':fixtureUser.app_metadata.role||'manager'},error:null};if(name==='save_team_activity'){window.fixtureTeamCalls.push(JSON.parse(JSON.stringify(payload)));if(window.fixtureSaveError)return {data:null,error:window.fixtureSaveError};let a=fixtureData.activities.find(a=>a.id===payload.p_id);if(!a){a={id:'new-activity-'+(++fixtureNext),user_id:fixtureUser.id,revision:0};fixtureData.activities.push(a)}Object.assign(a,payload.p_activity,{revision:a.revision+1});for(const row of payload.p_roster){let r=fixtureData.activity_roster.find(r=>r.activity_id===a.id&&r.player_id===row.player_id);if(r)Object.assign(r,row);else fixtureData.activity_roster.push({...row,id:'roster-'+(++fixtureNext),user_id:fixtureUser.id,activity_id:a.id})}if(payload.p_technical){let t=fixtureData.activity_technical.find(t=>t.activity_id===a.id);if(t)Object.assign(t,payload.p_technical);else fixtureData.activity_technical.push({...payload.p_technical,activity_id:a.id,user_id:fixtureUser.id})}return {data:{...a},error:null}}if(name==='save_training_attendance'){const a=fixtureData.activities.find(a=>a.id===payload.p_activity_id);if(a?.revision!==payload.p_activity_revision)return {data:null,error:{code:'40001',message:'Allenamento modificato nel frattempo'}};}window.fixtureRpcCalls.push(JSON.parse(JSON.stringify(payload)));if(window.fixtureRpcGate)await window.fixtureRpcGate;if(window.fixtureSaveError)return {data:null,error:window.fixtureSaveError};let session=fixtureData.sessions.find(s=>s.id===payload.p_session_id);if(!session){session={id:'new-session-'+(++fixtureNext),user_id:fixtureUser.id,revision:0};fixtureData.sessions.push(session)}Object.assign(session,payload.p_session,{revision:(session.revision||0)+1,updated_at:new Date().toISOString(),updated_by:fixtureUser.id});for(const row of payload.p_attendance){let a=fixtureData.attendance.find(x=>x.session_id===session.id&&x.player_id===row.player_id);if(a){const before={status:a.status,delay_minutes:a.delay_minutes,notified:a.notified??null,note:a.note??null};if(JSON.stringify(before)!==JSON.stringify({status:row.status,delay_minutes:row.delay_minutes,notified:row.notified,note:row.note}))fixtureData.attendance_history.push({id:'history-'+(++fixtureNext),user_id:fixtureUser.id,session_id:session.id,player_id:row.player_id,actor_id:fixtureUser.id,entity:'attendance',action:'UPDATE',changed_at:new Date().toISOString(),before_data:before,after_data:{...row}});Object.assign(a,row)}else fixtureData.attendance.push({...row,id:'attendance-'+(++fixtureNext),session_id:session.id,user_id:fixtureUser.id})}if(name==='save_training_attendance'){const a=fixtureData.activities.find(a=>a.id===payload.p_activity_id);Object.assign(a,{session_id:session.id,status:'Concluso',revision:a.revision+1})}return {data:{session:{...session}},error:null}};
window.supabase={createClient:()=>({channel:(topic,options)=>{const c={topic,options,on(type,filter,callback){this.event=callback;return this},subscribe(callback){this.status=callback;return this}};window.fixtureChannels.push(c);return c},removeChannel:async c=>{c.removed=true},from:table=>new FixtureQuery(table),rpc:fixtureRpc,auth:{getSession:async()=>({data:{session:{user:fixtureUser}}}),getUser:async()=>({data:{user:fixtureUser}}),onAuthStateChange:()=>{},signOut:async()=>{}},functions:{invoke:async(_,options)=>({data:options.body.action==='list'?{users:[{...fixtureUser,role:'admin',created_at:'2026-10-06T12:00:00Z'}],nextPage:null}:{user:{id:'new-demo-user'}},error:null})}})};


fixtureData.disciplinary_clearances=[];

fixtureData.staff_communications=[];

window.fixtureChannels=[];

fixtureData.communication_receipts=[];fixtureData.activity_history=[];

// Treasury fixture supplies server-shaped responses; database invariants are tested in treasury.sql.
fixtureData.dismissal_sanctions=[];fixtureData.dismissal_clearances=[];window.fixtureDismissalCalls=[];
const dismissalCreateClient=window.supabase.createClient;
window.supabase.createClient=()=>{
 const client=dismissalCreateClient(),rpc=client.rpc;
 client.rpc=async(name,payload)=>{
  if(name==='disciplinary_dismissal_snapshot'){
   if(window.fixtureDismissalReadError)return {data:null,error:window.fixtureDismissalReadError};
   return {error:null,data:{dismissals:fixtureData.match_events.filter(e=>e.event_type==='Espulsione'||fixtureData.dismissal_sanctions.some(s=>s.event_id===e.id)).map(e=>{const m=fixtureData.matches.find(m=>m.id===e.match_id),a=fixtureData.activities.find(a=>a.match_id===e.match_id);return {...e,match_date:m?.match_date,opponent:m?.opponent,activity_status:a?.status}}),dismissal_sanctions:fixtureData.dismissal_sanctions.map(s=>({...s})),dismissal_clearances:fixtureData.dismissal_clearances.map(c=>{const m=fixtureData.matches.find(m=>m.id===c.match_id),a=fixtureData.activities.find(a=>a.match_id===m?.id);return {...c,match_date:m?.match_date,opponent:m?.opponent,activity_status:a?.status,has_result:m?.goals_for!=null&&m?.goals_against!=null,has_minutes:fixtureData.activity_roster.some(r=>r.activity_id===a?.id&&r.player_id===c.player_id&&r.minutes_played>0)}})}};
  }
  if(['save_dismissal_sanction','confirm_dismissal_match'].includes(name)){
   window.fixtureDismissalCalls.push({name,...payload});if(window.fixtureDismissalGate)await window.fixtureDismissalGate;if(window.fixtureDismissalError)return {data:null,error:window.fixtureDismissalError};
   const event=fixtureData.match_events.find(e=>e.id===payload.p_event_id);
   if(name==='save_dismissal_sanction'){
    let s=fixtureData.dismissal_sanctions.find(s=>s.event_id===event.id);
    if(s&&s.revision!==payload.p_revision&&Object.entries(payload.p_values).some(([k,v])=>s[k]!==v))return {error:{code:'40001',message:'Provvedimento modificato nel frattempo'},data:null};
    if(!s){s={event_id:event.id,user_id:fixtureUser.id,player_id:event.player_id,match_id:event.match_id,revision:0};fixtureData.dismissal_sanctions.push(s)}Object.assign(s,payload.p_values,{revision:s.revision+1});return {data:{...s},error:null};
   }
   let c=fixtureData.dismissal_clearances.find(c=>c.event_id===event.id&&c.match_id===payload.p_match_id);if(!c){c={id:'red-clearance-'+(++fixtureNext),event_id:event.id,user_id:fixtureUser.id,player_id:event.player_id,match_id:payload.p_match_id};fixtureData.dismissal_clearances.push(c)}return {data:{...c},error:null};
  }
  return rpc(name,payload);
 };
 return client;
};
fixtureData.finance_accounts=[];fixtureData.finance_entries=[];
window.fixtureFinanceCalls=[];
const fixtureCreateClient=window.supabase.createClient;
window.supabase.createClient=()=>{
 const client=fixtureCreateClient();const rpc=client.rpc;
 client.rpc=async(name,payload)=>{
  if(name==='finance_snapshot'){
   if(window.fixtureFinanceReadError)return {error:{message:'Connessione economia non disponibile'},data:null};
   const all=fixtureData.finance_entries,rows=all.filter(e=>e.entry_date>=payload.p_from&&e.entry_date<=payload.p_to),sum=list=>list.reduce((n,e)=>n+e.amount_cents,0);
   return {error:null,data:{accounts:fixtureData.finance_accounts.map(a=>({...a,balance_cents:sum(all.filter(e=>e.account_id===a.id&&e.entry_date<=payload.p_to))})),entries:rows.map(e=>({...e,receipts:e.receipts||[],reversed:all.some(r=>r.reverses_id===e.id)})),entry_count:rows.length,totals:{opening:sum(all.filter(e=>e.entry_date<payload.p_from)),closing:sum(all.filter(e=>e.entry_date<=payload.p_to)),initial:sum(rows.filter(e=>e.economic_type==='opening')),income:sum(rows.filter(e=>e.economic_type==='income')),expense:-sum(rows.filter(e=>e.economic_type==='expense'))},categories:[],reconciliations:[],audit:[]}};
  }
  if(name==='finance_mutate'){
   window.fixtureFinanceCalls.push({...payload});
   if(window.fixtureFinanceGate)await window.fixtureFinanceGate;
   if(window.fixtureFinanceSaveError)return {data:null,error:{message:'Salvataggio economia non disponibile'}};
   const id='finance-'+(++fixtureNext),v=payload.p_values;
   if(payload.p_action==='entry')fixtureData.finance_entries.push({...v,id,user_id:fixtureUser.id,amount_cents:v.kind==='expense'?-v.amount_cents:v.amount_cents,economic_type:v.kind,entry_date:v.date,actor_label:'Demo staff',created_at:new Date().toISOString()});
   if(payload.p_action==='account_edit'){const a=fixtureData.finance_accounts.find(a=>a.id===v.account_id);Object.assign(a,{name:v.name,kind:v.kind});return {data:{id:a.id},error:null};}
   if(payload.p_action==='account_restore'){const a=fixtureData.finance_accounts.find(a=>a.id===v.account_id);a.archived_at=null;return {data:{id:a.id},error:null};}
   if(payload.p_action==='account_remove'){const a=fixtureData.finance_accounts.find(a=>a.id===v.account_id),archived=fixtureData.finance_entries.some(e=>e.account_id===a.id);if(archived)a.archived_at=new Date().toISOString();else fixtureData.finance_accounts=fixtureData.finance_accounts.filter(f=>f.id!==a.id);return {data:{id:a.id,archived},error:null};}
   if(payload.p_action==='account')fixtureData.finance_accounts.push({id,name:v.name,kind:v.kind,opened_on:v.date,closed_through:null});
   return {data:{id},error:null};
  }
  return rpc(name,payload);
 };
 client.storage={from:()=>({upload:async()=>window.fixtureReceiptError?{error:{message:'Caricamento ricevuta non riuscito'}}:{error:null},download:async()=>({data:new Blob(['receipt']),error:null})})};return client;
};

fixtureData.tactical_boards=[];window.fixtureBoardCalls=[];
const boardCreateClient=window.supabase.createClient;
window.supabase.createClient=()=>{
 const client=boardCreateClient(),rpc=client.rpc;
 client.rpc=async(name,p)=>{
  if(name!=='save_tactical_board')return rpc(name,p);
  window.fixtureBoardCalls.push(JSON.parse(JSON.stringify(p)));
  if(window.fixtureBoardGate)await window.fixtureBoardGate;
  if(window.fixtureBoardError)return {data:null,error:window.fixtureBoardError};
  let b=fixtureData.tactical_boards.find(b=>b.id===p.p_id);
  const same=b&&JSON.stringify([b.title,b.activity_id,b.document])===JSON.stringify([p.p_title,p.p_activity_id,p.p_document]);
  if(!same){
   if(b&&b.revision!==p.p_revision)return {data:null,error:{code:'40001',message:'Lavagna modificata da un collega. La tua bozza è conservata.'}};
   if(!b){b={id:p.p_id,user_id:fixtureUser.id,revision:0};fixtureData.tactical_boards.push(b)}
   Object.assign(b,{title:p.p_title,activity_id:p.p_activity_id,document:JSON.parse(JSON.stringify(p.p_document)),revision:b.revision+1,updated_at:new Date().toISOString()});
  }
  if(window.fixtureBoardLostReply){window.fixtureBoardLostReply=false;return {data:null,error:{message:'Risposta di rete persa'}}}
  return {data:JSON.parse(JSON.stringify(b)),error:null};
 };
 return client;
};
