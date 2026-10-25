import { confirmDialog } from './app-confirm.js';
import { roleHelp } from './app-roles.js';
import { bindDialog } from './app-dialogs.js';
import { db, esc, fmt, isAdmin, refresh, state, teamOwner, teamRequestGuard, toast } from './app-part1.js';
import { roleLabels } from './app-team.js';
import { setBusyControls, trackDialogDraft } from './app-workflows.js';

async function adminRequest(body){
 const {data,error}=await db.functions.invoke('manage-users',{body});
 if(error){let message='Servizio non raggiungibile. Controlla la connessione e riprova.';try{const context=typeof error.context?.clone==='function'?error.context.clone():error.context;const detail=await context.json();message=detail.error||message}catch{}throw new Error(message)}
 if(!data||typeof data!=='object')throw new Error('Risposta del servizio non valida. Riprova.');if(data.error)throw new Error(data.error);return data;
}
function userPasswordModal(user){
 if(!isAdmin()||user.id===state.user.id)return;
 const root=document.createElement('div');root.className='modal-back event-back';
 root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="passwordTitle"><div class="modal-head"><h2 id="passwordTitle">Cambia password</h2><button id="closePassword" aria-label="Chiudi">X</button></div><p class="muted">Nuova password per <b>${esc(user.email||'utente')}</b>. Comunicala direttamente all’utente dopo il salvataggio.</p><form id="userPasswordForm"><div class="field"><label for="staffPassword">Nuova password</label><input id="staffPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required><small class="muted">Da 12 a 128 caratteri.</small></div><div class="field field-space"><label for="staffPasswordConfirm">Conferma password</label><input id="staffPasswordConfirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div><p id="passwordMessage" role="status" aria-live="polite"></p><button type="submit" class="primary wide field-space">Salva password</button></form></section>`;
 document.body.appendChild(root);let busy=false;const current=teamRequestGuard(),close=()=>{if(busy)return;root.querySelector('form').reset();root.remove()};root.querySelector('#closePassword').onclick=close;bindDialog(root,close);
 root.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;const password=root.querySelector('#staffPassword').value,message=root.querySelector('#passwordMessage');
  if(password.length<12||password.length>128){message.textContent='Password da 12 a 128 caratteri';return}
  if(password!==root.querySelector('#staffPasswordConfirm').value){message.textContent='Le password non coincidono';return}
  busy=true;setBusyControls(root,true);message.textContent='Aggiornamento in corso…';try{await adminRequest({action:'password',userId:user.id,password});if(!current())return;busy=false;close();toast('Password aggiornata')}catch(error){message.textContent=error.message}finally{busy=false;setBusyControls(root,false)}
 };
}
function userProfileModal(user, saved){
 if(!isAdmin())return;
 const root=document.createElement('div');root.className='modal-back event-back';
 root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="profileTitle"><div class="modal-head"><h2 id="profileTitle">Nome e cognome</h2><button type="button" id="closeProfile" aria-label="Chiudi">✕</button></div><p class="muted">${esc(user.email||'Utente staff')} · Il nome comparirà nel saluto personale della home.</p><form id="userProfileForm"><div class="form-grid"><div class="field"><label for="staffFirstName">Nome</label><input id="staffFirstName" autocomplete="given-name" maxlength="80" value="${esc(user.first_name||'')}"></div><div class="field"><label for="staffLastName">Cognome</label><input id="staffLastName" autocomplete="family-name" maxlength="80" value="${esc(user.last_name||'')}"></div></div><p id="profileMessage" role="status" aria-live="polite"></p><button class="primary wide field-space" type="submit">Salva nominativo</button></form></section>`;
 document.body.append(root);let busy=false;const current=teamRequestGuard();const close=()=>{if(!busy)root.remove()};root.querySelector('#closeProfile').onclick=close;bindDialog(root,close);
 root.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;setBusyControls(root,true);const message=root.querySelector('#profileMessage');message.textContent='Salvataggio…';try{await adminRequest({action:'profile',userId:user.id,first_name:root.querySelector('#staffFirstName').value.trim(),last_name:root.querySelector('#staffLastName').value.trim()});if(!current())return;await refresh();if(!current())return;busy=false;close();await saved();toast('Nome e cognome aggiornati')}catch(error){message.textContent=error.message}finally{busy=false;setBusyControls(root,false)}};
}
function userEmailModal(user,saved){
 if(!isAdmin())return;
 const root=document.createElement('div');root.className='modal-back event-back';
 root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="emailTitle"><div class="modal-head"><h2 id="emailTitle">Modifica email di accesso</h2><button type="button" id="closeEmail" aria-label="Chiudi">✕</button></div><p class="muted">Correggi l’indirizzo di ${esc(user.email||'utente')}. Al prossimo accesso servirà la nuova email; password, ruolo e storico restano invariati. Comunica la modifica all’utente.</p><form id="userEmailForm"><div class="field"><label for="staffEmail">Nuova email</label><input id="staffEmail" type="email" autocomplete="off" maxlength="254" required value="${esc(user.email||'')}"></div><p id="emailMessage" role="status" aria-live="polite"></p><button type="submit" class="primary wide field-space">Salva email</button></form></section>`;
 document.body.append(root);let busy=false;const current=teamRequestGuard();
 const close=()=>{if(busy)return;if(root.querySelector('#staffEmail').value.trim()!==(user.email||'')&&!confirm('Scartare la modifica dell’email non salvata?'))return;root.remove()};
 root.querySelector('#closeEmail').onclick=close;bindDialog(root,close);
 root.querySelector('form').onsubmit=async e=>{e.preventDefault();if(busy)return;
 const email=root.querySelector('#staffEmail').value.trim().toLowerCase(),message=root.querySelector('#emailMessage');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254){message.textContent='Inserisci una email valida';return}
 busy=true;setBusyControls(root,true);message.textContent='Aggiornamento in corso…';
 try{await adminRequest({action:'email',userId:user.id,email,previousEmail:user.email});if(!current())return;root.remove();await saved();toast('Email di accesso aggiornata')}
 catch(error){message.textContent=error.message}finally{busy=false;setBusyControls(root,false)}};
}

function userDeleteModal(user,saved){
 if(!isAdmin()||user.id===state.user.id||user.id===teamOwner())return;
 const root=document.createElement('div');root.className='modal-back event-back';
 const name=[user.first_name,user.last_name].filter(Boolean).join(' ')||user.email||'Utente';
 root.innerHTML=`<section class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="deleteUserTitle" aria-describedby="deleteUserDescription"><div class="modal-head"><h2 id="deleteUserTitle">Elimina utenza</h2><button type="button" aria-label="Annulla e chiudi">✕</button></div><p id="deleteUserDescription">Eliminare l’accesso di <b>${esc(name)}</b> (${esc(user.email)})? L’utente non potrà più accedere alla squadra. Le registrazioni e lo storico della squadra saranno conservati. L’operazione è definitiva.</p><form id="deleteUserForm"><p id="deleteUserMessage" role="status" aria-live="polite"></p><div class="modal-actions confirm-actions"><button type="button" class="ghost" id="cancelDeleteUser">Annulla</button><button type="submit" class="danger">Elimina utenza</button></div></form></section>`;
 document.body.append(root);let busy=false;const current=teamRequestGuard(),close=()=>{if(!busy)root.remove()};
 root.querySelector('.modal-head button').onclick=close;root.querySelector('#cancelDeleteUser').onclick=close;bindDialog(root,close);root.querySelector('#cancelDeleteUser').focus();
 root.querySelector('form').onsubmit=async e=>{
  e.preventDefault();if(busy||!current()||!root.isConnected||!isAdmin())return;
  busy=true;setBusyControls(root,true);const message=root.querySelector('#deleteUserMessage');message.textContent='Eliminazione in corso…';
  try{await adminRequest({action:'delete',userId:user.id,confirmEmail:user.email});if(!current())return;root.remove();await saved();if(current())toast('Utenza eliminata. Storico della squadra conservato.')}
  catch(error){if(current()&&root.isConnected)message.textContent=error.message}
  finally{busy=false;setBusyControls(root,false)}
 };
}

function usersModal(){
 if(!isAdmin())return;
 const root=document.createElement('div');root.className='modal-back';root.dataset.detail='tool:users';root.dataset.page='more';
 root.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="usersTitle"><div class="modal-head"><h2 id="usersTitle">Gestione utenti</h2><button type="button" id="closeUsers" aria-label="Chiudi">✕</button></div><p class="muted">Gestisci gli accessi dello staff. Le utenze lavorano sulla stessa squadra con permessi diversi.</p><form id="createUserForm"><div class="form-grid"><div class="field"><label for="newUserFirstName">Nome</label><input id="newUserFirstName" autocomplete="given-name" maxlength="80" required></div><div class="field"><label for="newUserLastName">Cognome</label><input id="newUserLastName" autocomplete="family-name" maxlength="80" required></div></div><div class="field field-space"><label for="newUserEmail">Email</label><input id="newUserEmail" type="email" autocomplete="off" required maxlength="254"></div><div class="field field-space"><label for="newUserPassword">Password iniziale</label><input id="newUserPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required><small class="muted">Almeno 12 caratteri. Comunica le credenziali al nuovo utente.</small></div><div class="field field-space"><label for="newUserRole">Ruolo nella squadra</label><select id="newUserRole"><option value="manager">Team manager</option><option value="coach">Allenatore</option><option value="secretary">Segretario</option><option value="technical_assistant">Collaboratore tecnico</option><option value="president">Presidente</option><option value="treasurer">Tesoriere</option><option value="admin">Amministratore</option></select><small class="muted" id="roleHelp"></small></div><button class="primary wide field-space" type="submit">Crea utenza</button><p id="userMessage" role="status"></p></form><div class="hr"></div><h3>Utenze abilitate</h3><div class="list" id="usersList" aria-live="polite">Caricamento…</div><button type="button" class="ghost wide field-space" id="moreUsers" hidden>Carica altri utenti</button></section>`;
 document.body.append(root);let creatingUser=false,roleBusy=false;const close=trackDialogDraft(root,()=>creatingUser||roleBusy);root.querySelector('#closeUsers').onclick=close;bindDialog(root,close);
 const createForm=root.querySelector('#createUserForm'),usersSection=document.createElement('section'),switcher=document.createElement('div');
 usersSection.className='users-section';createForm.hidden=true;
 const list=root.querySelector('#usersList');usersSection.append(list.previousElementSibling,list,root.querySelector('#moreUsers'));root.querySelector('.modal').append(usersSection);
 switcher.className='workflow-switch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Gestione accessi');switcher.innerHTML='<button type="button" data-users-tab="list" aria-pressed="true">Utenze</button><button type="button" data-users-tab="create" aria-pressed="false">Nuovo utente</button>';root.querySelector('.modal-head').after(switcher);
 const message=root.querySelector('#userMessage');switcher.after(message);
 switcher.querySelectorAll('button').forEach(button=>button.onclick=async()=>{const creating=button.dataset.usersTab==='create';if(!creating&&root.dataset.dirty==='true'){if(!(await confirmDialog({message:'Scartare la nuova utenza non ancora creata?',confirmLabel:'Scarta'})))return;createForm.reset();root.dataset.dirty='false'}createForm.hidden=!creating;usersSection.hidden=creating;switcher.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(creating)root.querySelector('#newUserFirstName').focus()});
 const updateRoleHelp=()=>root.querySelector('#roleHelp').textContent=roleHelp[root.querySelector('#newUserRole').value];root.querySelector('#newUserRole').onchange=updateRoleHelp;updateRoleHelp();
 let page=1,loadGeneration=0;const users=new Map(),current=teamRequestGuard();
 const load=async(reset=false)=>{
  const generation=++loadGeneration;if(reset){page=1;users.clear()}const requestedPage=page;
  try{const data=await adminRequest({action:'list',page:requestedPage});if(generation!==loadGeneration||!current()||!root.isConnected)return;
   if(requestedPage===1)root.querySelector('#usersList').innerHTML='';data.users.forEach(u=>users.set(u.id,u));
   root.querySelector('#usersList').insertAdjacentHTML('beforeend',data.users.map(u=>`<div class="row user-row"><div class="row-main"><b>${esc([u.first_name,u.last_name].filter(Boolean).join(' ')||u.email||'Utente')}</b><div class="row-sub">${esc(u.email||'')} · ${fmt((u.created_at||'').slice(0,10))}</div></div><span class="badge ${u.role==='admin'?'b-yellow':'b-blue'}">${roleLabels[u.role]||'Membro'}</span><div class="user-actions"><button type="button" class="ghost" data-user-profile="${esc(u.id)}">Nome e cognome</button><button type="button" class="ghost" data-user-email="${esc(u.id)}">Modifica email</button>${u.id!==teamOwner()?`<select data-user-role="${esc(u.id)}" aria-label="Ruolo di ${esc(u.email||'utente')}">${Object.entries(roleLabels).map(([value,label])=>`<option value="${value}" ${u.role===value?'selected':''}>${label}</option>`).join('')}</select>`:''}${u.id!==state.user.id?`<button type="button" class="ghost" data-user-password="${esc(u.id)}">Cambia password</button>`:''}${u.id!==state.user.id&&u.id!==teamOwner()?`<button type="button" class="danger" data-user-delete="${esc(u.id)}">Elimina utenza</button>`:''}</div></div>`).join(''));
   root.querySelectorAll('[data-user-role]').forEach(select=>select.onchange=async()=>{if(roleBusy)return;roleBusy=true;select.disabled=true;try{await adminRequest({action:'role',userId:select.dataset.userRole,role:select.value});await refresh();if(!isAdmin()){root.remove();return}await load(true);toast('Ruolo aggiornato')}catch(error){root.querySelector('#userMessage').textContent=error.message;await load(true)}finally{roleBusy=false;select.disabled=false}});
   root.querySelectorAll('[data-user-email]').forEach(button=>button.onclick=()=>{const user=users.get(button.dataset.userEmail);if(user)userEmailModal(user,()=>load(true))});
   root.querySelectorAll('[data-user-password]').forEach(button=>button.onclick=()=>{const user=users.get(button.dataset.userPassword);if(user)userPasswordModal(user)});
   root.querySelectorAll('[data-user-profile]').forEach(button=>button.onclick=()=>{const user=users.get(button.dataset.userProfile);if(user)userProfileModal(user,()=>load(true))});
   root.querySelectorAll('[data-user-delete]').forEach(button=>button.onclick=()=>{const user=users.get(button.dataset.userDelete);if(user)userDeleteModal(user,()=>load(true))});
   page=data.nextPage;root.querySelector('#moreUsers').hidden=!page;
  }catch(error){if(generation===loadGeneration&&current()&&root.isConnected)root.querySelector('#usersList').textContent=error.message}
 };
 root.querySelector('#moreUsers').onclick=async e=>{e.target.disabled=true;await load();e.target.disabled=false};
 root.querySelector('#createUserForm').onsubmit=async e=>{e.preventDefault();if(creatingUser)return;creatingUser=true;const message=root.querySelector('#userMessage');setBusyControls(e.target,true);message.textContent='Creazione in corso…';try{const data=await adminRequest({action:'create',first_name:root.querySelector('#newUserFirstName').value.trim(),last_name:root.querySelector('#newUserLastName').value.trim(),email:root.querySelector('#newUserEmail').value,password:root.querySelector('#newUserPassword').value,role:root.querySelector('#newUserRole').value});if(!current()||!root.isConnected)return;e.target.reset();root.dataset.dirty='false';updateRoleHelp();message.textContent=data.warning||'Utenza creata e associata alla squadra.';await load(true)}catch(error){message.textContent=error.message}finally{creatingUser=false;setBusyControls(e.target,false)}};
 load();
}
export { adminRequest, userPasswordModal, userProfileModal, usersModal };
