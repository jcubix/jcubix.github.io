let presenter=null;
let activeConfirmation=null;
function setConfirmationPresenter(value){presenter=value}
async function confirmDialog({message='',title='Conferma',confirmLabel='Conferma',cancelLabel='Annulla',danger=false}={}){
 if(presenter)return Promise.resolve(presenter({message,title,confirmLabel,cancelLabel,danger}));
 if(activeConfirmation)return Promise.resolve(false);
 const reservation={};activeConfirmation=reservation;
 let bindDialog;
 try{({bindDialog}=await import('./app-dialogs.js'))}catch(error){if(activeConfirmation===reservation)activeConfirmation=null;throw error}
 return new Promise(resolve=>{
  const root=document.createElement('div');root.className='modal-back confirm-back';activeConfirmation=root;
  root.innerHTML='<section class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmBody"><div class="modal-head"><h2 id="confirmTitle"></h2><button type="button" data-confirm-cancel aria-label="Annulla e chiudi">×</button></div><p id="confirmBody"></p><div class="modal-actions confirm-actions"><button type="button" data-confirm-cancel></button><button type="button" data-confirm-accept></button></div></section>';
  root.querySelector('#confirmTitle').textContent=title;root.querySelector('#confirmBody').textContent=message;
  root.querySelector('.confirm-actions [data-confirm-cancel]').textContent=cancelLabel;
  const accept=root.querySelector('[data-confirm-accept]');accept.textContent=confirmLabel;accept.className=danger?'danger':'primary';
  let settled=false;
  const observer=new MutationObserver(()=>{if(!root.isConnected)close(false)});
  const close=value=>{if(settled)return;settled=true;observer.disconnect();root.remove();if(activeConfirmation===root)activeConfirmation=null;resolve(value)};
  root.querySelectorAll('[data-confirm-cancel]').forEach(button=>button.onclick=()=>close(false));accept.onclick=()=>close(true);
  root.addEventListener('click',event=>{if(event.target===root)close(false)});
  document.body.append(root);bindDialog(root,()=>close(false));
  root.querySelector('.confirm-actions [data-confirm-cancel]').focus({preventScroll:true});
  observer.observe(document.body,{childList:true});
 });
}
export { confirmDialog, setConfirmationPresenter };
