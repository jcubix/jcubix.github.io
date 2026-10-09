import { activeCommunications, communicationCount, fetchCommunications } from './app-communications.js';
import { db, state, teamOwner, teamRequestGuard, teamRole } from './app-part1.js';

// One private subscription per signed-in team. Broadcasts contain no message contents.
let channel=null,channelKey='',realtimeGeneration=0,reloadTimer=null,expiryTimer=null,refreshInFlight=false,refreshAgain=false;
const communicationListeners=new Set();
function onCommunicationsChanged(listener){communicationListeners.add(listener);return ()=>communicationListeners.delete(listener)}
function notifyCommunications(){
 communicationCount();for(const listener of communicationListeners)listener();
 clearTimeout(expiryTimer);const next=Math.min(...activeCommunications().map(m=>Date.parse(m.expires_at)));
 if(state.user&&Number.isFinite(next))expiryTimer=setTimeout(notifyCommunications,Math.max(1,Math.min(2147483647,next-Date.now()+20)));
}
function stopCommunicationsRealtime(){
 realtimeGeneration++;channelKey='';clearTimeout(reloadTimer);clearTimeout(expiryTimer);refreshInFlight=false;refreshAgain=false;
 if(channel){const previous=channel;channel=null;db.removeChannel(previous).catch(()=>{})}
}
function scheduleCommunicationReload(){
 if(!channel||!state.user)return;
 clearTimeout(reloadTimer);const generation=realtimeGeneration,current=teamRequestGuard();
 reloadTimer=setTimeout(async()=>{
  if(generation!==realtimeGeneration||!current())return;
  if(refreshInFlight){refreshAgain=true;return}refreshInFlight=true;
  try{await fetchCommunications()}catch(error){if(current())document.querySelectorAll('[data-realtime-status]').forEach(el=>el.textContent='Aggiornamento non riuscito. Premi Aggiorna o torna online.')}
  finally{if(generation===realtimeGeneration){refreshInFlight=false;if(refreshAgain){refreshAgain=false;scheduleCommunicationReload()}}}
 },80);
}
function syncCommunicationsRealtime(){
 if(!state.user||!state.team){stopCommunicationsRealtime();return}
 const key=`${state.user.id}:${teamOwner()}:${teamRole()}`;if(key===channelKey)return;
 stopCommunicationsRealtime();channelKey=key;const generation=realtimeGeneration;
 channel=db.channel(`team:${teamOwner()}:communications`,{config:{private:true}})
  .on('broadcast',{event:'communications_changed'},scheduleCommunicationReload)
  .subscribe(status=>{
   if(generation!==realtimeGeneration)return;
   state.communicationRealtimeStatus=status;
   document.querySelectorAll('[data-realtime-status]').forEach(el=>el.textContent=status==='SUBSCRIBED'?'Aggiornamenti in tempo reale attivi':'Connessione in corso. Puoi aggiornare manualmente.');
   if(status==='SUBSCRIBED')scheduleCommunicationReload();
  });
}
function initCommunicationsLifecycle(){
 window.addEventListener('online',scheduleCommunicationReload);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleCommunicationReload()});
}

export { channel, channelKey, realtimeGeneration, reloadTimer, expiryTimer, refreshInFlight, refreshAgain, communicationListeners, onCommunicationsChanged, notifyCommunications, stopCommunicationsRealtime, scheduleCommunicationReload, syncCommunicationsRealtime, initCommunicationsLifecycle };
