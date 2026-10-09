import { applyRoleControls } from './app-access.js';
import { usersModal } from './app-admin.js';
import { bindSeasonPicker, loadTeamData, seasonPicker } from './app-data.js';
import { dashboard } from './app-operations.js';
import { bindPlayers, playersPage } from './app-part2.js';
import { bindMatches, bindRegister, matchesPage, registerPage } from './app-part4.js';
import { bindReports, reportsPage } from './app-part5.js';
import { notifyCommunications, stopCommunicationsRealtime, syncCommunicationsRealtime } from './app-realtime.js';
import { agendaPage, bindAgenda, bindMore, bindTeamLinks, morePage } from './app-team.js';
import { bindTraining, trainingPage } from './app-workflows.js';

const db=window.supabase.createClient(window.CONFIG.supabaseUrl,window.CONFIG.supabaseAnonKey);
const app=document.querySelector('#app');
const ROLE_ORDER=['Portiere','Difensore','Centrocampista','Attaccante'];
const TEAM_ARRAYS=['players','sessions','attendance','matches','events','activities','roster','administration','technical','disciplinary_clearances','staff_communications'];
const state={user:null,page:'dashboard'};
for(const key of TEAM_ARRAYS)state[key]=[];
let refreshGeneration=0,authGeneration=0,sessionEpoch=0;
function clearTeamState(){
 for(const key of TEAM_ARRAYS)state[key]=[];
 state.team=null;state.loadedActor=null;state.page='dashboard';state.trainingMode='actual';delete state.registerDate;state.trainingDraft=null;
 stopCommunicationsRealtime();delete state.seasonYear;delete state.dataRange;delete state.earliestSport;
 document.querySelectorAll('.modal-back').forEach(n=>n.remove());notifyCommunications();
}
function teamRequestGuard(){
 const actor=state.user?.id,owner=state.team?.owner_id,role=state.team?.role,epoch=sessionEpoch;
 return ()=>!!actor&&state.user?.id===actor&&state.team?.owner_id===owner&&state.team?.role===role&&sessionEpoch===epoch;
}
const esc=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const teamOwner=()=>state.team?.owner_id||state.user.id;
const teamRole=()=>state.team?.role||(state.user?.app_metadata?.role==='admin'?'admin':'manager');
const isAdmin=()=>teamRole()==='admin';
const canManage=()=>['admin','manager','secretary'].includes(teamRole());
const canOperate=()=>['admin','manager','coach'].includes(teamRole());
const canTechnical=()=>['admin','coach'].includes(teamRole());
const fmt=d=>d?new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(d+'T12:00:00')):'';
const roleRank=r=>{const i=ROLE_ORDER.indexOf(r);return i<0?99:i};
const sortPlayers=a=>[...a].sort((x,y)=>roleRank(x.role)-roleRank(y.role)||(Number(x.role_order)||9999)-(Number(y.role_order)||9999)||`${x.surname} ${x.name}`.localeCompare(`${y.surname} ${y.name}`,'it'));
const activePlayers=()=>sortPlayers(state.players.filter(p=>p.active));
const badge=s=>({Presente:'b-green',Assente:'b-red',Infortunato:'b-blue'}[s]||'b-gray');
function toast(msg){const n=document.createElement('div');n.textContent=msg;Object.assign(n.style,{position:'fixed',top:'16px',left:'50%',transform:'translateX(-50%)',zIndex:100,background:'var(--panel)',color:'var(--text)',border:'1px solid var(--border)',maxWidth:'calc(100vw - 32px)',textAlign:'center',padding:'12px 16px',borderRadius:'14px'});document.body.appendChild(n);setTimeout(()=>n.remove(),2200)}
function fail(e){console.error(e);toast(e?.message||'Operazione non riuscita')}

async function boot(){
 if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
 const {data:{session}}=await db.auth.getSession();
 db.auth.onAuthStateChange((_,next)=>setTimeout(()=>syncSession(next?.user||null),0));
 await syncSession(session?.user||null);
}
async function syncSession(user){
 const generation=++authGeneration;
 if(state.user?.id!==user?.id){sessionEpoch++;refreshGeneration++;clearTeamState();app.innerHTML='<main class="shell"><div class="card" role="status">Caricamento squadra…</div></main>'}
 state.user=user;
 if(!user){renderLogin();return}
 try{
  const {data,error}=await db.auth.getUser();
  if(generation!==authGeneration)return;
  if(error&&![401,403].includes(error.status))throw error;
  if(error||!data?.user||data.user.id!==user.id){state.user=null;renderLogin();toast('Sessione scaduta. Accedi nuovamente.');return}
  state.user=data.user;await refresh();
 }catch(error){if(generation===authGeneration)showTeamLoadError(error)}
}
function renderLogin(){authGeneration++;refreshGeneration++;sessionEpoch++;state.user=null;clearTeamState();app.innerHTML=`<main class="login"><section class="login-card"><div class="brand"><img src="./icon.svg" alt="Eburum"><div><h1>EBVRVM</h1><small>${esc(window.CONFIG.season)} · Team Manager</small></div></div><h2>Bentornato in squadra</h2><p class="muted">Accedi con le credenziali ricevute dall’amministratore.</p><form id="loginForm"><div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="username" required></div><div class="field field-space"><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required></div><button class="primary wide field-space" id="login" type="submit">Accedi</button></form><div class="login-help">Accesso riservato. Le nuove utenze vengono create dagli amministratori.</div></section></main>`;document.querySelector('#loginForm').onsubmit=e=>{e.preventDefault();login()}}
async function login(){const button=document.querySelector('#login');if(button.disabled)return;button.disabled=true;button.textContent='Accesso…';try{const email=document.querySelector('#email').value.trim(),password=document.querySelector('#password').value;const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error}catch(e){fail(e)}finally{button.disabled=false;button.textContent='Accedi'}}

async function fetchAllRows(build){const data=[];for(let offset=0;;offset+=500){const result=await build().range(offset,offset+499);if(result.error)return {data:null,error:result.error};data.push(...(result.data||[]));if((result.data||[]).length<500)return {data,error:null}}}
async function refresh(){
 const actor=state.user?.id;if(!actor)return false;
 const generation=++refreshGeneration,current=()=>generation===refreshGeneration&&state.user?.id===actor;
 try{
  const context=await db.rpc('team_context');if(!current())return false;
  if(context.error||!context.data){clearTeamState();showTeamLoadError(context.error||new Error('Utenza non associata a una squadra'));return false}
  if(state.loadedActor!==actor||state.team?.owner_id!==context.data.owner_id||state.team?.role!==context.data.role){clearTeamState();app.innerHTML='<main class="shell"><div class="card" role="status">Caricamento squadra…</div></main>'}
  state.team=context.data;state.loadedActor=actor;const uid=teamOwner();
  const data=await loadTeamData(uid);if(!current())return false;
  Object.assign(state,data);syncCommunicationsRealtime();notifyCommunications();render();return true;
 }catch(error){if(current())showTeamLoadError(error);return false}
}
function showTeamLoadError(error){app.innerHTML=`<main class="shell"><div class="card"><h2>Squadra non caricata</h2><p>${esc(error.message||'Connessione non disponibile')}</p><div class="toolbar"><button id="retryTeam">Riprova</button><button id="exitTeam">Esci</button></div></div></main>`;document.querySelector('#retryTeam').onclick=()=>refresh();document.querySelector('#exitTeam').onclick=()=>db.auth.signOut()}
function navBtn(page,label){
 const paths={dashboard:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',agenda:'<path d="M4 5h16v16H4zM8 3v4m8-4v4M4 11h16m-11 4h2m3 0h2m-7 3h2"/>',players:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v1"/>',matches:'<path d="M4 5h16v15H4zM8 5V3m8 2V3M4 10h16"/><path d="M8 14h2m4 0h2m-8 3h2m4 0h2"/>',more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'};
 const active=state.page===page||page==='more'&&['training','register','reports'].includes(state.page);
 return `<button data-page="${page}" class="${active?'active':''}" ${active?'aria-current="page"':''}><b aria-hidden="true"><svg viewBox="0 0 24 24">${paths[page]}</svg></b><span>${label}</span></button>`;
}
function shell(content){return `<main class="shell ${state.page==='dashboard'?'dashboard-shell':''}"><header class="topbar"><div class="brand"><img src="./icon.svg" alt="Eburum"><div><h1>EBVRVM</h1><small>${esc(window.CONFIG.season)} · Team Manager</small></div></div><div class="header-actions">${isAdmin()?'<button class="ghost" id="users">Utenti</button>':''}<button class="ghost" id="logout">Esci</button></div></header>${content}</main><nav class="nav team-nav ${state.page==='dashboard'?'dashboard-nav':''}" aria-label="Navigazione principale"><div class="nav-brand" aria-hidden="true"><img src="./icon.svg" alt=""><span>EBVRVM<small>Team Manager</small></span></div>${navBtn('dashboard','Home')}${navBtn('agenda','Agenda')}${navBtn('players','Rosa')}${navBtn('matches','Partite')}${navBtn('more','Altro')}</nav>`}
function render(){if(!canOperate()&&state.page==='training')state.page='register';const pages={dashboard,training:trainingPage,players:playersPage,matches:matchesPage,register:registerPage,reports:reportsPage,agenda:agendaPage,more:morePage};app.innerHTML=shell(seasonPicker()+(pages[state.page]||pages.dashboard)());bindSeasonPicker();document.querySelector('#logout').onclick=()=>db.auth.signOut();const users=document.querySelector('#users');if(users)users.onclick=usersModal;document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;render()});if(state.page==='players')bindPlayers();if(state.page==='training')bindTraining();if(state.page==='matches')bindMatches();if(state.page==='reports')bindReports();if(state.page==='register')bindRegister();if(state.page==='dashboard')bindDashboard();if(state.page==='agenda')bindAgenda();if(state.page==='more')bindMore();bindTeamLinks();applyRoleControls()}

function emptyTeamDashboard(){return `<div class="card"><h2>Importa i dati Eburum</h2><p class="muted">Il database è pronto. Inserisci il codice monouso per caricare i 30 giocatori e lo storico degli allenamenti dal file Excel.</p><div class="field"><label>Codice importazione</label><input id="claimCode" autocomplete="off" placeholder="EBURUM-...."></div><button class="primary" id="claimSeed" style="width:100%;margin-top:12px">Importa rosa e storico</button></div>`;}
async function bindDashboard(){const b=document.querySelector('#claimSeed');if(!b)return;b.onclick=async()=>{try{const code=document.querySelector('#claimCode').value.trim();if(!code)throw new Error('Inserisci il codice di importazione');b.disabled=true;b.textContent='Importazione in corso...';const {data,error}=await db.rpc('claim_eburum_seed',{p_code:code});if(error)throw error;toast(`Importati ${data.players} giocatori e ${data.attendance} registrazioni`);await refresh()}catch(e){b.disabled=false;b.textContent='Importa rosa e storico';fail(e)}}}

export { db, app, ROLE_ORDER, TEAM_ARRAYS, state, refreshGeneration, authGeneration, sessionEpoch, clearTeamState, teamRequestGuard, esc, today, teamOwner, teamRole, isAdmin, canManage, canOperate, canTechnical, fmt, roleRank, sortPlayers, activePlayers, badge, toast, fail, boot, syncSession, renderLogin, login, fetchAllRows, refresh, showTeamLoadError, navBtn, shell, render, emptyTeamDashboard, bindDashboard };
