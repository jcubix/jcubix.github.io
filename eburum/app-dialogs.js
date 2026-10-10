const dialogRoots=[];
const inertBeforeDialogs=new Map();
const dialogBody=document.body;
let bodyOverflowBeforeDialogs='';

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
 const previous=document.activeElement;
 if(!dialogRoots.length)bodyOverflowBeforeDialogs=dialogBody.style.overflow;
 dialogRoots.push(root);syncDialogIsolation();
 const viewport=window.visualViewport;
 const resize=()=>{root.style.setProperty('--dialog-height',`${viewport?.height||window.innerHeight}px`);root.style.setProperty('--dialog-top',`${viewport?.offsetTop||0}px`)};
 resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);window.addEventListener('resize',resize);
 const focusable=()=>Array.from(root.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')).filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);
 root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();onClose();return}if(event.key!=='Tab')return;const nodes=focusable(),first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}});
 focusable()[0]?.focus();
 const observer=new MutationObserver(()=>{if(!root.isConnected){const wasActive=dialogRoots.at(-1)===root;dialogRoots.splice(dialogRoots.indexOf(root),1);syncDialogIsolation();observer.disconnect();viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize);if(wasActive&&previous?.isConnected&&!previous.closest('[inert]'))previous.focus()}});observer.observe(document.body,{childList:true});
}

export { bindDialog };
