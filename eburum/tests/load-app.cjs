const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Only the test harness exposes module exports to legacy test expressions.
// Production retains lexical module scope and never publishes globals.
async function loadApp(dom){
 dom.window.TextEncoder=TextEncoder;dom.window.TextDecoder=TextDecoder;
 const root=path.join(__dirname,'..'),context=dom.getInternalVMContext(),cache=new Map();
 vm.runInContext(fs.readFileSync(path.join(root,'vendor/jspdf.umd.min.js'),'utf8'),context);
 const getModule=file=>{
  const absolute=path.resolve(root,file);if(cache.has(absolute))return cache.get(absolute);
  const source=fs.readFileSync(absolute,'utf8');
  const mod=new vm.SourceTextModule(source,{context,identifier:absolute,importModuleDynamically:async(specifier,ref)=>{
   const imported=linker(specifier,ref);
   if(imported.status==='unlinked')await imported.link(linker);
   if(imported.status==='linked')await imported.evaluate();
   return imported;
  }});cache.set(absolute,mod);return mod;
 };
 const linker=(specifier,ref)=>getModule(path.relative(root,path.resolve(path.dirname(ref.identifier),specifier)));
 const main=new vm.SourceTextModule("import {registerCommunications} from './app-communications.js';import {registerDiscipline} from './app-discipline.js';import {registerOperations} from './app-operations.js';import {registerWorkflows} from './app-workflows.js';registerOperations();registerWorkflows();registerDiscipline();registerCommunications();",{context,identifier:path.join(root,'test-entry.js')});
 await main.link(linker);await main.evaluate();
 for(const mod of cache.values())if(mod.namespace.setConfirmationPresenter)mod.namespace.setConfirmationPresenter(({message})=>dom.window.confirm(message));
 for(const mod of cache.values())for(const name of Object.keys(mod.namespace))context[name]=mod.namespace[name];
 return cache;
}
module.exports={loadApp};
