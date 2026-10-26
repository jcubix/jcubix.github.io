const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let compiled;
async function source(){
 if(!compiled)compiled=(async()=>{const {build}=await import('vite');const result=await build({root:path.resolve(__dirname,'..'),configFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':'"production"'},build:{write:false,minify:false,lib:{entry:path.join(__dirname,'fixtures/domain-entry.ts'),name:'EburumDomainTests',formats:['iife']}}});return (Array.isArray(result)?result[0]:result).output.find(item=>item.type==='chunk'&&item.isEntry).code;})();
 return compiled;
}
// Domain tests run the production modules; all UI interactions live in the React suite.
async function loadApp(dom){
 const w=dom.window,context=dom.getInternalVMContext();
 for(const key of ['fetch','Headers','Request','Response','TextEncoder','TextDecoder'])w[key]=globalThis[key];
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../vendor/jspdf.umd.min.js'),'utf8'),context);
 vm.runInContext(await source(),context);
 Object.assign(w,w.EburumDomainTests.domain);
 return w.EburumDomainTests.domain;
}
module.exports={loadApp};
