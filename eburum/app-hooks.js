// Stable, named extension slots. Rendering never depends on an HTML substring.
const extensions=new Map(),binders=new Map();
function registerExtension(slot,id,render,order=0){if(!extensions.has(slot))extensions.set(slot,new Map());extensions.get(slot).set(id,{render,order,id})}
function renderExtensions(slot,...args){return [...(extensions.get(slot)?.values()||[])].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)).map(x=>x.render(...args)).join('')}
function registerBinder(id,bind){binders.set(id,bind)}
function bindExtensions(root){for(const bind of binders.values())bind(root)}

export { extensions, binders, registerExtension, renderExtensions, registerBinder, bindExtensions };
