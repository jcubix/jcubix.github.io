const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Only the test harness exposes module exports to legacy test expressions.
// Production retains lexical module scope and never publishes globals.
async function loadApp(dom){
 dom.window.TextEncoder=TextEncoder;dom.window.TextDecoder=TextDecoder;
 const root=path.join(__dirname,'..'),context=dom.getInternalVMContext(),cache=new Map();
 vm.runInContext(fs.readFileSync(path.join(root,'vendor/jspdf.umd.min.js'),'utf8'),context);
 const getModule=file=>{
  const absolute=path.resolve(root,file);if(cache.has(absolute))return cache.get(absolute);
  let source=fs.readFileSync(absolute,'utf8');if(file==='app-main.js')source=source.replace(/boot\(\);\s*$/,'');
  const mod=new vm.SourceTextModule(source,{context,identifier:absolute});cache.set(absolute,mod);return mod;
 };
 const main=getModule('app-main.js');
 await main.link((specifier,ref)=>getModule(path.relative(root,path.resolve(path.dirname(ref.identifier),specifier))));await main.evaluate();
 for(const mod of cache.values())for(const name of Object.keys(mod.namespace))context[name]=mod.namespace[name];
 return cache;
}
module.exports={loadApp};
