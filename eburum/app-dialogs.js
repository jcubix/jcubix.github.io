import { icon } from './app-icons.js';
const dialogRoots=[];
const inertBeforeDialogs=new Map();
const dialogBody=document.body;
let bodyOverflowBeforeDialogs='';
let workspacePresenter=null,detailPresenter=null;
const dialogClosers=new Map();
function setDialogDetailPresenter(presenter){detailPresenter=presenter}
const workspaceEditors=new Map();
function setWorkspaceEditorPresenter(presenter){workspacePresenter=presenter}
function closeWorkspaceEditors(){
 for(const root of [...dialogRoots].reverse()){if(!root.isConnected)continue;dialogClosers.get(root)?.();if(root.isConnected)return false;}
 for(const [root,close] of workspaceEditors){if(!root.isConnected){workspaceEditors.delete(root);continue}close();if(root.isConnected)return false;workspaceEditors.delete(root)}
 return true;
}

// Nested sheets keep the active dialog interactive and the background still.
function syncDialogIsolation(){
 const active=dialogRoots.filter(root=>root.isConnected).at(-1);
 if(active){
  for(const element of dialogBody.children){
   if(element.id!=='app'&&!element.classList.contains('modal-back'))continue;
   if(!inertBeforeDialogs.has(element))inertBeforeDialogs.set(element,element.getAttribute('inert'));
   if(element===active)element.removeAttribute('inert');else element.setAttribute('inert','');
  }
  dialogBody.style.overflow='hidden';
 }else{
  for(const [element,value] of inertBeforeDialogs){if(value===null)element.removeAttribute('inert');else element.setAttribute('inert',value)}
  inertBeforeDialogs.clear();dialogBody.style.overflow=bodyOverflowBeforeDialogs;
 }
}

function bindDialog(root,onClose){
 root.querySelectorAll('.modal-head button').forEach(button=>{
  const label=button.getAttribute('aria-label')||'';
  if(/^Chiudi(?:\s|$)|^Annulla e chiudi/.test(label)||/^[Xx×✕✖]$/.test(button.textContent.trim())){
   if(!label)button.setAttribute('aria-label','Chiudi');
   button.innerHTML=icon('close',20);
  }
 });
 const previous=document.activeElement;
 dialogClosers.set(root,onClose);
 const workspace=workspacePresenter&&(root.querySelector('#planningForm')||root.querySelector('#activityForm')||root.dataset.workspace==='true');
 if(workspace&&!closeWorkspaceEditors()){root.remove();dialogClosers.delete(root);return}
 if(root.dataset.detail)detailPresenter?.(root,onClose);

 if(workspace){
  if(workspacePresenter(root)){
   root.classList.add('workspace-editor');if(root.dataset.workspace==='true')root.classList.add('workspace-view');
   const section=root.querySelector('.modal');section.setAttribute('role','region');section.removeAttribute('aria-modal');
   workspaceEditors.set(root,onClose);
   root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();onClose()}});
   section.setAttribute('tabindex','-1');section.focus({preventScroll:true});
   const observer=new MutationObserver(()=>{if(!root.isConnected){workspaceEditors.delete(root);dialogClosers.delete(root);observer.disconnect();if(previous?.isConnected&&!previous.closest('[inert]'))previous.focus({preventScroll:true})}});
   observer.observe(root.parentElement,{childList:true});
   return;
  }
 }
 if(!dialogRoots.length)bodyOverflowBeforeDialogs=dialogBody.style.overflow;
 dialogRoots.push(root);syncDialogIsolation();
 const viewport=window.visualViewport;
 const resize=()=>{root.style.setProperty('--dialog-height',`${viewport?.height||window.innerHeight}px`);root.style.setProperty('--dialog-top',`${viewport?.offsetTop||0}px`)};
 resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);window.addEventListener('resize',resize);
 const focusable=()=>Array.from(root.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')).filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);
 root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();onClose();return}if(event.key!=='Tab')return;const nodes=focusable(),first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}});
 focusable()[0]?.focus();
 const observer=new MutationObserver(()=>{if(!root.isConnected){const wasActive=dialogRoots.at(-1)===root;dialogRoots.splice(dialogRoots.indexOf(root),1);syncDialogIsolation();dialogClosers.delete(root);observer.disconnect();viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize);if(wasActive&&previous?.isConnected&&!previous.closest('[inert]'))previous.focus()}});observer.observe(document.body,{childList:true});
}

export { setDialogDetailPresenter, bindDialog, setWorkspaceEditorPresenter, closeWorkspaceEditors };
