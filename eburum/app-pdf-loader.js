/** A single local script request shared by all PDF exports, with retry on failure. */
let loading = null;
export function ensureJsPdf() {
 if (typeof globalThis.jspdf?.jsPDF === 'function') return Promise.resolve();
 if (!loading) {
  loading = new Promise((resolve,reject) => {
   const script=document.createElement('script');
   const timer=setTimeout(()=>fail(),30000);
   const cleanup=()=>{clearTimeout(timer);script.onload=null;script.onerror=null;};
   const fail=()=>{cleanup();script.remove();loading=null;reject(new Error('Modulo PDF non caricato. Controlla la connessione e riprova.'));};
   script.src=new URL('./vendor/jspdf.umd.min.js',document.baseURI).href;
   script.async=true;script.dataset.pdfLoader='true';
   script.onload=()=>{if(typeof globalThis.jspdf?.jsPDF!=='function'){fail();return}cleanup();resolve();};
   script.onerror=fail;
   document.head.appendChild(script);
  });
 }
 return loading;
}
