async function adminRequest(body){
 const {data,error}=await db.functions.invoke('manage-users',{body});
 if(error){let message='Operazione non riuscita';try{const detail=await error.context.json();message=detail.error||message}catch{}throw new Error(message)}
 if(data.error)throw new Error(data.error);return data;
}
function usersModal(){
 if(!isAdmin())return;
 const root=document.createElement('div');root.className='modal-back';
 root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="usersTitle"><div class="modal-head"><h2 id="usersTitle">Gestione utenti</h2><button id="closeUsers" aria-label="Chiudi">✕</button></div><p class="muted">Crea un accesso per un nuovo membro. Ogni utenza gestisce i propri dati.</p><form id="createUserForm"><div class="field"><label for="newUserEmail">Email</label><input id="newUserEmail" type="email" autocomplete="off" required maxlength="254"></div><div class="field field-space"><label for="newUserPassword">Password iniziale</label><input id="newUserPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required><small class="muted">Almeno 12 caratteri. Comunica le credenziali al nuovo utente.</small></div><button class="primary wide field-space" type="submit">Crea utenza</button><p id="userMessage" role="status"></p></form><div class="hr"></div><h3>Utenze abilitate</h3><div class="list" id="usersList" aria-live="polite">Caricamento…</div><button class="ghost wide field-space" id="moreUsers" hidden>Carica altri utenti</button></section>`;
 document.body.appendChild(root);root.querySelector('#closeUsers').onclick=()=>root.remove();
 bindDialog(root,()=>root.querySelector('#closeUsers').click());
 let page=1;
 const load=async(reset=false)=>{if(reset){page=1;root.querySelector('#usersList').innerHTML=''}try{const data=await adminRequest({action:'list',page});if(page===1)root.querySelector('#usersList').innerHTML='';root.querySelector('#usersList').insertAdjacentHTML('beforeend',data.users.map(u=>`<div class="row user-row"><div class="row-main"><b>${esc(u.email||'Utente')}</b><div class="row-sub">${fmt((u.created_at||'').slice(0,10))}</div></div><span class="badge ${u.role==='admin'?'b-yellow':'b-blue'}">${u.role==='admin'?'Amministratore':'Membro'}</span></div>`).join(''));page=data.nextPage;root.querySelector('#moreUsers').hidden=!page}catch(e){root.querySelector('#usersList').textContent=e.message}};
 root.querySelector('#moreUsers').onclick=async e=>{e.target.disabled=true;await load();e.target.disabled=false};
 root.querySelector('#createUserForm').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button[type="submit"]'),message=root.querySelector('#userMessage');button.disabled=true;message.textContent='Creazione in corso…';try{await adminRequest({action:'create',email:root.querySelector('#newUserEmail').value,password:root.querySelector('#newUserPassword').value});e.target.reset();message.textContent='Utenza creata. Il membro può accedere.';await load(true)}catch(error){message.textContent=error.message}finally{button.disabled=false}};
 load();
}
boot();
