function bindDialog(root,onClose){
 const previous=document.activeElement;
 const viewport=window.visualViewport;
 const resize=()=>{root.style.setProperty('--dialog-height',`${viewport?.height||window.innerHeight}px`);root.style.setProperty('--dialog-top',`${viewport?.offsetTop||0}px`)};
 resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);window.addEventListener('resize',resize);
 const focusable=()=>Array.from(root.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')).filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);
 root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();onClose();return}if(event.key!=='Tab')return;const nodes=focusable(),first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}});
 focusable()[0]?.focus();
 const observer=new MutationObserver(()=>{if(!root.isConnected){observer.disconnect();viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize);if(previous?.isConnected)previous.focus()}});observer.observe(document.body,{childList:true});
}
