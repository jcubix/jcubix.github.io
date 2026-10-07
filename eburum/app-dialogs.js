function bindDialog(root,onClose){
 const previous=document.activeElement;
 const focusable=()=>Array.from(root.querySelectorAll('button,input,select,textarea,[tabindex="0"]')).filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);
 root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();onClose();return}if(event.key!=='Tab')return;const nodes=focusable(),first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}});
 focusable()[0]?.focus();
 const observer=new MutationObserver(()=>{if(!root.isConnected){observer.disconnect();if(previous?.isConnected)previous.focus()}});observer.observe(document.body,{childList:true});
}
