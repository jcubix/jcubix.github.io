import { db, esc, state, teamOwner, teamRequestGuard } from './app-part1.js';
import { bindDialog } from './app-dialogs.js';
import { icon } from './app-icons.js';

export function activityHistoryModal(id) {
  const root=document.createElement('div');root.className='modal-back';
  root.innerHTML='<section class="modal" role="dialog" aria-modal="true" aria-labelledby="activityHistoryTitle"><div class="modal-head"><h2 id="activityHistoryTitle">Storico modifiche</h2><button type="button" aria-label="Chiudi storico">'+icon('close')+'</button></div><p class="muted">Risposte, convocazioni, risultato ed eventi. Le modifiche precedenti all’attivazione di questo storico non sono ricostruibili.</p><div id="activityHistoryList" class="list" aria-live="polite">Caricamento…</div><button id="moreActivityHistory" type="button" hidden>Carica precedenti</button></section>';
  document.body.append(root);const close=()=>root.remove();root.querySelector('.modal-head button').onclick=close;bindDialog(root,close);
  let offset=0,busy=false;const current=teamRequestGuard();
  const labels={title:'Titolo',activity_date:'Data',status:'Stato attività',start_time:'Inizio',location:'Campo',organization_note:'Indicazioni',meeting_time:'Ritrovo',meeting_place:'Luogo ritrovo',goals_for:'Gol Eburum',goals_against:'Gol avversari',venue:'Campo gara',duration_minutes:'Durata',minutes_auto:'Minuti automatici',note:'Nota',called:'Convocato',lineup:'Impiego',position:'Posizione',minutes_played:'Minuti',availability:'Risposta WhatsApp',response_note:'Nota risposta',event_type:'Evento',minute:'Minuto',player_id:'Giocatore',outgoing_player_id:'Giocatore uscito',detail:'Dettaglio'};
  const value=(key,v)=>v==null?'Non indicato':typeof v==='boolean'?(v?'Sì':'No'):['player_id','outgoing_player_id'].includes(key)?state.players.find(p=>p.id===v)?.surname||'Giocatore storico':String(v);
  const load=async()=>{if(busy)return;busy=true;const button=root.querySelector('#moreActivityHistory');button.disabled=true;
    try {const {data,error}=await db.from('activity_history').select('*').eq('user_id',teamOwner()).eq('activity_id',id).order('changed_at',{ascending:false}).order('id').range(offset,offset+19);if(error)throw error;if(!current()||!root.isConnected)return;
      const list=root.querySelector('#activityHistoryList');if(!offset)list.replaceChildren();
      list.insertAdjacentHTML('beforeend',data.map(h=>'<article class="history-change"><b>'+esc(({activities:'Organizzazione',activity_roster:'Risposta / convocazione',matches:'Risultato',match_events:'Evento'})[h.entity]||'Modifica')+' · '+esc(({INSERT:'Inserimento',UPDATE:'Aggiornamento',DELETE:'Rimozione'})[h.action])+'</b><p class="row-sub">'+esc(h.actor_label||'Sistema')+' · '+esc(new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(h.changed_at)))+'</p>'+Object.entries(labels).filter(([key])=>JSON.stringify(h.before_data?.[key])!==JSON.stringify(h.after_data?.[key])).map(([key,label])=>'<div class="history-field"><strong>'+label+'</strong><span>'+esc(value(key,h.before_data?.[key]))+' → '+esc(value(key,h.after_data?.[key]))+'</span></div>').join('')+'</article>').join(''));
      if(!offset&&!data.length)list.textContent='Nessuna modifica registrata dall’attivazione dello storico.';offset+=data.length;button.hidden=data.length<20;
    }catch(error){if(current()&&root.isConnected){root.querySelector('#activityHistoryList').textContent=error.message||'Storico non caricato';button.hidden=false;button.textContent='Riprova';}}
    finally{busy=false;button.disabled=false;}
  };root.querySelector('#moreActivityHistory').onclick=load;load();
}
