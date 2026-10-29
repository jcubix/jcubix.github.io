const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
let compiled;
async function source() {
  if (!compiled)
    compiled = (async () => {
      const { build } = await import("vite");
      const { default: react } = await import("@vitejs/plugin-react");
      const result = await build({
        root,
        configFile: false,
        logLevel: "silent",
        define: { "process.env.NODE_ENV": '"production"' },
        plugins: [react()],
        build: {
          write: false,
          minify: false,
          lib: {
            entry: path.join(__dirname, "fixtures/react-entry.tsx"),
            name: "EburumTests",
            formats: ["iife"],
          },
        },
      });
      return (Array.isArray(result) ? result[0] : result).output.find(
        (item) => item.type === "chunk" && item.isEntry,
      ).code;
    })();
  return compiled;
}
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(check(), "React did not reach the expected state");
}
async function app(t, role = "admin", seed = () => {}) {
  const dom = new JSDOM('<div id="app"></div>', {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "https://eburum.test/#/matches",
  });
  const w = dom.window,
    context = dom.getInternalVMContext();
  let mounted;
  const errors = [];
  w.console.error = (...args) => errors.push(args.map(String).join(" "));
  w.addEventListener("error", (event) => errors.push(event.message));
  t.after(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    mounted?.unmount();
    await new Promise(resolve => setTimeout(resolve, 0));
    w.close();
    assert.deepEqual(errors, [], "Unhandled React errors");
  });
  for(const key of ["fetch","Headers","Request","Response"])w[key]=globalThis[key];
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.scrollTo = () => {};
  w.matchMedia = () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  });
  w.CONFIG = {
    supabaseUrl: "demo",
    supabaseAnonKey: "demo",
    season: "2026/2027",
  };
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "fixtures/team-ui.js"), "utf8"),
    context,
  );
  w.fixtureUser.app_metadata.role = role;
  w.fixtureData.matches[0].match_date = "2026-10-01";
  w.fixtureData.match_events = Array.from({ length: 6 }, (_, i) => ({
    id: "yellow-" + i,
    user_id: "demo-user",
    match_id: "match-1",
    player_id: i < 5 ? "player-1" : "player-2",
    event_type: "Ammonizione",
    minute: i,
    created_at: "2026-10-01T12:00:00Z",
  }));
  w.fixtureData.activities[0].activity_date = "2026-10-01";
  seed(w.fixtureData);
  vm.runInContext(await source(), context);
  mounted = await w.EburumTests.mount();
  // Flush discrete React interactions before synchronous DOM assertions.
  for(const [prototype,key] of [[w.HTMLElement.prototype,"click"],[w.EventTarget.prototype,"dispatchEvent"]]){
    const native=prototype[key];prototype[key]=function(...args){if(key==="dispatchEvent" && !["input","change","submit","keydown"].includes(args[0]?.type))return native.apply(this,args);let result;w.EburumTests.flushSync(()=>{result=native.apply(this,args)});return result;};
  }
  await until(() => w.document.querySelector(".sc-match-grid"));
  return {
    w,
    runtime: mounted.runtime,
    $: (selector) => w.document.querySelector(selector),
    clickText: (text) => {
      const button = [...w.document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === text || b.getAttribute("aria-label") === text,
      );
      assert.ok(button, "Missing button: " + text);
      button.click();
    },
  };
}

const treasurySeed=data=>{
 data.finance_accounts=[{id:'cash-1',name:'Cassa squadra',kind:'cash',opened_on:'2026-01-01',closed_through:null}];
 data.finance_entries=[{id:'opening-1',user_id:'demo-user',account_id:'cash-1',entry_date:'2026-01-01',kind:'opening',economic_type:'opening',amount_cents:10000,category:'Saldo iniziale',description:'Saldo iniziale',actor_label:'Staff',created_at:'2026-01-01T12:00:00Z'}];
};
function reactInput(w,element,value){
 const prototype=element.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype;
 Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value);
 element.dispatchEvent(new w.Event('input',{bubbles:true}));
}
async function finance(t,role='admin',seed=treasurySeed){
 const ctx=await app(t,role,seed);ctx.w.location.hash='#/finance';await until(()=>ctx.$('.finance-summary'));return ctx;
}
for(const role of ['admin','treasurer'])test('Fund editing retains drafts and ledger for '+role,async t=>{
 const {w,$,clickText}=await finance(t,role);clickText('Modifica fondo');await until(()=>$('.finance-editor form'));
 assert.equal($('.finance-editor input[type=date]'),null);assert.equal($('.finance-editor input[inputmode=decimal]'),null);
 reactInput(w,$('.finance-editor input'),'Cassa staff');await until(()=>$('.finance-editor input').value==='Cassa staff');
 w.fixtureFinanceSaveError=true;$('.finance-editor form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>$('.finance-feedback[role=alert]'));assert.equal($('.finance-editor input').value,'Cassa staff');
 const first=w.fixtureFinanceCalls.at(-1);assert.equal(first.p_action,'account_edit');assert.equal(first.p_values.expected_name,'Cassa squadra');
 w.fixtureFinanceSaveError=false;$('.finance-editor form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>!$('.finance-editor')&&$('.finance-fund h4')?.textContent==='Cassa staff');
 assert.equal(w.fixtureFinanceCalls.at(-1).p_request_id,first.p_request_id);assert.equal(w.fixtureData.finance_entries.length,1);assert.equal(w.fixtureData.finance_entries[0].amount_cents,10000);
});
test('Archived funds remain visible but cannot be chosen for new transactions',async t=>{
 const {w,$,clickText}=await finance(t,'treasurer',data=>{treasurySeed(data);data.finance_accounts[0].archived_at='2026-10-01T12:00:00Z'});
 assert.match($('.finance-fund').textContent,/Archiviato/);assert.equal($('[aria-label="Nuovo movimento"]').matches(":disabled"),true);
 assert.equal([...w.document.querySelectorAll('.finance-fund button')].some(b=>b.textContent.includes('Modifica fondo')),false);
 assert.equal([...w.document.querySelectorAll('.finance-fund button')].some(b=>b.textContent.includes('Riattiva fondo')),true);
});
test('President cannot modify or remove funds',async t=>{
 const {w}=await finance(t,'president');const labels=[...w.document.querySelectorAll('button')].map(b=>b.textContent.trim());
 for(const text of ['Modifica fondo','Elimina fondo','Riattiva fondo'])assert.equal(labels.includes(text),false);
});
test('Fund removal requires confirmation and deletes an empty fund once',async t=>{
 const {w,$,clickText}=await finance(t,'treasurer',data=>{treasurySeed(data);data.finance_entries=[]});
 let confirmations=0;w.confirm=()=>{confirmations++;return false};
 clickText('Elimina fondo');await until(()=>confirmations===1);await until(()=>!$('.finance-fund button').matches(":disabled"));
 assert.equal(w.fixtureFinanceCalls.length,0);
 w.confirm=()=>{confirmations++;return true};clickText('Elimina fondo');
 await until(()=>!$('.finance-fund'));assert.equal(w.fixtureFinanceCalls.length,1);assert.equal(w.fixtureFinanceCalls[0].p_action,'account_remove');
 assert.equal(w.fixtureFinanceCalls[0].p_values.remove_unused_initial,true);assert.equal(w.fixtureData.finance_accounts.length,0);assert.match(w.document.body.textContent,/Fondo vuoto eliminato/);
});
test('Treasury money parsing preserves cents and rejects ambiguous or excessive amounts',async t=>{
 const {w}=await app(t);const parse=w.EburumTests.parseCents;
 assert.equal(parse('12,34'),1234);assert.equal(parse('0.29'),29);assert.equal(parse('-1,20',true),-120);
 for(const value of ['1.234,56','1e3','-1','1.234','100000000.01','NaN'])assert.throws(()=>parse(value));
 assert.throws(()=>w.EburumTests.validateReceipt(new w.File(['x'],'bad.svg',{type:'image/svg+xml'})));
});
for(const role of ['admin','treasurer','president','coach','manager','secretary','technical_assistant'])test('Economy tools and direct route enforce '+role+' permissions',async t=>{
 const {runtime,$,w}=await app(t,role,treasurySeed);await runtime.navigate('more');await until(()=>$('.sc-tool-list'));
 assert.equal(!!$('.sc-tools a[href="#/finance"]'),['admin','treasurer','president'].includes(role));
 await until(()=>w.location.hash==='#/more');w.location.hash='#/finance';await until(()=>$('.sc-finance')||w.document.body.textContent.includes('Area riservata'));
 if(['admin','treasurer','president'].includes(role)){await until(()=>$('.finance-summary'));assert.equal(!!$('[aria-label="Nuovo movimento"]'),role!=='president');}
 else{assert.equal($('.finance-summary'),null);assert.equal(w.fixtureFinanceCalls.length,0);}
});
test('Treasurer home opens economy and keeps existing sporting sections read only',async t=>{
 const {runtime,$,w}=await app(t,'treasurer',treasurySeed);w.location.hash='#/dashboard';await until(()=>$('.finance-summary'));
 assert.ok($('.finance-home-link'));assert.equal($('nav a[href="#/matches"]')!==null,true);
 w.location.hash='#/matches';await until(()=>$('.sc-match-grid'));assert.equal($('[aria-label="Aggiungi partita"]'),null);
});
for(const role of ['treasurer','president'])test('Office navigation replaces training and roster for '+role,async t=>{
 const {w,runtime,$}=await app(t,role,treasurySeed);
 const links=[...w.document.querySelectorAll('.app-mobile-nav a')];
 assert.deepEqual(links.map(a=>a.textContent),['Home','Messaggi','Economia','Partite','Altro']);
 assert.equal($('.app-mobile-nav a[href="#/training"]'),null);assert.equal($('.app-mobile-nav a[href="#/players"]'),null);
 $('.app-mobile-nav a[href="#/communications"]').click();await until(()=>$('.app-mobile-nav a[href="#/communications"][aria-current=page]'));
 assert.equal(w.document.querySelectorAll('.app-mobile-nav a[aria-current=page]').length,1);
 $('.app-mobile-nav a[href="#/finance"]').click();await until(()=>$('.finance-summary'));
 assert.equal($('.app-mobile-nav a[href="#/finance"]').getAttribute('aria-current'),'page');
 assert.equal($('.app-mobile-nav a[href="#/more"]').getAttribute('aria-current'),null);
 assert.equal(!!$('[aria-label="Nuovo movimento"]'),role==='treasurer');
 await runtime.navigate('register');await until(()=>$('.app-mobile-nav a[href="#/more"][aria-current=page]'));
});
test('Finance failed save retains draft; double submission writes once and blocks navigation',async t=>{
 const {w,runtime,$}=await finance(t);$('[aria-label="Nuovo movimento"]').click();await until(()=>$('.finance-editor form'));
 reactInput(w,$('input[inputmode=decimal]'),'12,34');reactInput(w,$('.finance-editor textarea'),'Materiale allenamento');
 await until(()=>$('input[inputmode=decimal]').value==='12,34');w.fixtureFinanceSaveError=true;
 const submit=()=>$('.finance-editor form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));submit();await until(()=>$('.finance-feedback[role=alert]'));
 assert.equal($('input[inputmode=decimal]').value,'12,34');assert.equal(w.fixtureData.finance_entries.length,1);
 w.fixtureFinanceSaveError=false;let release;w.fixtureFinanceGate=new Promise(resolve=>release=resolve);submit();submit();await until(()=>w.fixtureFinanceCalls.length===2);
 assert.equal(await runtime.navigate('players'),false);release();await until(()=>!$('.finance-editor'));assert.equal(w.fixtureData.finance_entries.length,2);assert.equal(w.fixtureData.finance_entries[1].amount_cents,-1234);
});
test('Receipt failure after posting retries attachment without another ledger movement',async t=>{
 const {w,$}=await finance(t);$('[aria-label="Nuovo movimento"]').click();await until(()=>$('.finance-editor form'));
 reactInput(w,$('input[inputmode=decimal]'),'5');reactInput(w,$('.finance-editor textarea'),'Ricevuta materiale');
 const file=new w.File(['pdf'],'receipt.pdf',{type:'application/pdf'});Object.defineProperty($('input[type=file]'),'files',{value:[file],configurable:true});$('input[type=file]').dispatchEvent(new w.Event('change',{bubbles:true}));
 w.fixtureReceiptError=true;$('.finance-editor form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>$('.finance-save')?.textContent==='Riprova caricamento ricevuta');
 assert.equal(w.fixtureFinanceCalls.filter(c=>c.p_action==='entry').length,1);assert.equal($('.finance-editor fieldset').matches(":disabled"),true);
 w.fixtureReceiptError=false;$('.finance-editor form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>!$('.finance-editor'));
 assert.equal(w.fixtureFinanceCalls.filter(c=>c.p_action==='entry').length,1);assert.equal(w.fixtureFinanceCalls.filter(c=>c.p_action==='receipt').length,1);
});
test('Finance API stops a late export after account or team context changes',async t=>{
 const {w,runtime}=await app(t,'treasurer',treasurySeed);const api=w.EburumTests.financeApi(runtime);runtime.state.team.owner_id='different-team';
 await assert.rejects(api.entries('2026-01-01','2026-12-31'),/Sessione o permessi/);
});
test('Finance exports paginate the complete period and preserve later reversal state',async t=>{
 const {w,runtime}=await app(t,'treasurer',data=>{
  treasurySeed(data);data.finance_entries=Array.from({length:501},(_,i)=>({id:'entry-'+String(i).padStart(4,'0'),user_id:'demo-user',account_id:'cash-1',entry_date:'2026-01-02',kind:'expense',economic_type:'expense',amount_cents:-1,category:'Altro',description:'Test '+i,actor_label:'Staff',created_at:'2026-01-02T12:00:00Z'}));
  data.finance_entries.push({id:'later-reversal',user_id:'demo-user',account_id:'cash-1',entry_date:'2026-02-01',kind:'reversal',economic_type:'expense',amount_cents:1,reverses_id:'entry-0000',category:'Altro',description:'Correction',actor_label:'Staff',created_at:'2026-02-01T12:00:00Z'});
 });
 const rows=await w.EburumTests.financeApi(runtime).entries('2026-01-01','2026-01-31');assert.equal(rows.length,501);assert.equal(new Set(rows.map(e=>e.id)).size,501);assert.equal(rows.find(e=>e.id==='entry-0000').reversed,true);
});
test('Excel CSV quotes text and neutralizes formulas while retaining negative numeric amounts',async t=>{
 const {w}=await app(t);let blob;w.URL.createObjectURL=value=>{blob=value;return 'blob:fixture'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 w.EburumTests.exportCsv([{id:'entry-1',account_id:'cash-1',entry_date:'2026-01-01',kind:'expense',category:'Altro',description:'=HYPERLINK("test")',amount_cents:-1234,actor_label:'@Staff'}],[{id:'cash-1',name:'Cassa'}],'2026-01-01','2026-01-31');
 const csv=await new Promise((resolve,reject)=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsText(blob)});
 assert.ok(csv.includes('"\'=HYPERLINK(""test"")"'));assert.ok(csv.includes('"\'@Staff"'));assert.ok(csv.includes('"-12,34"'));assert.ok(!csv.includes('"\'-12,34"'));
});

test("React login errors are translated without exposing raw server messages",async t=>{
 const {w,runtime,$}=await app(t);
 runtime.db.auth.signOut=async()=>({error:null});
 runtime.db.auth.getUser=async()=>({data:{user:null},error:null});
 await runtime.start();await until(()=>$('input[name=email]'));
 reactInput(w,$('input[name=email]'),'staff@example.test');reactInput(w,$('input[name=password]'),'password-test');
 const errors=[['Invalid login credentials','Email o password non corretti.'],['Email not confirmed','Email non ancora confermata.'],['Email logins are disabled','Accesso con email disattivato.'],['Too many requests','Troppi tentativi.'],['Failed to fetch','Connessione non disponibile.'],['secret internal server detail','Accesso non riuscito.']];
 for(const [raw,expected] of errors){
  runtime.db.auth.signInWithPassword=async()=>({error:new w.Error(raw)});
  const form=$('input[name=email]').closest('form');form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>$('#loginError')?.textContent.includes(expected));
  assert.ok(!$('#loginError').textContent.includes(raw));
 }
});

test("Away matches display home-first scores without swapping stored Eburum goals", async t => {
 const {w,runtime,$,clickText}=await app(t,'admin',data=>{data.matches[0].venue='Trasferta'});
 assert.equal($('.sc-match-preview').getAttribute('aria-label'),'Squadra ospite – Eburum, 01/10/2026');
 assert.equal([...w.document.querySelectorAll('.match-goals')].map(n=>n.textContent).join(' : '),'1 : 2');
 $('.sc-match-preview').click();await until(()=>$('#matchGoalsFor'));
 assert.equal($('#activityTitle').textContent,'Squadra ospite – Eburum');
 const order=()=>[...w.document.querySelectorAll('.match-score-fields input')].map(el=>el.id);
 assert.deepEqual(order(),['matchGoalsAgainst','matchGoalsFor']);
 eventValue(w,$('#matchGoalsFor'),'3');
 $('#matchVenue').value='Casa';$('#matchVenue').dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.deepEqual(order(),['matchGoalsFor','matchGoalsAgainst']);
 assert.equal($('#matchGoalsFor').value,'3');assert.equal($('#matchGoalsAgainst').value,'1');
 $('#matchVenue').value='Trasferta';$('#matchVenue').dispatchEvent(new w.Event('change',{bubbles:true}));
 let saved;const rpc=runtime.db.rpc;
 runtime.db.rpc=async(name,payload)=>{
  if(name!=='save_match_result')return rpc(name,payload);
  saved=payload.p_values;Object.assign(w.fixtureData.matches[0],saved);
  return {data:{...w.fixtureData.matches[0]},error:null};
 };
 $('#saveMatchResult').click();await until(()=>saved&&$('#matchGoalsFor')?.value==='3'&&!$('#saveMatchResult').matches(":disabled"));
 assert.equal(saved.goals_for,3);assert.equal(saved.goals_against,1);assert.equal(saved.venue,'Trasferta');
 $('#closeActivity').click();await until(()=>$('.match-goals'));
 assert.equal([...w.document.querySelectorAll('.match-goals')].map(n=>n.textContent).join(' : '),'1 : 3');
 await runtime.navigate('register');await until(()=>$('#calendarGrid'));
 const selected=$('.calendar-day[aria-pressed=true]');assert.ok(selected);
 assert.match(selected.getAttribute('aria-label'),/attività registrata/);
 const empty=$('button.calendar-day:not(.has-activity)');empty.click();
 assert.equal($('.calendar-day[aria-pressed=true]').dataset.date,empty.dataset.date);
 assert.match($('#registerDetail').textContent,/Nessuna/);
});

test("React match and tools buttons show saved yellows, history and suspension controls", async (t) => {
  const { w, runtime, $, clickText } = await app(t);
  clickText("Cartellini");
  await until(() => $("#disciplineList"));
  assert.equal(w.document.querySelectorAll(".discipline-card").length, 2);
  assert.match(w.document.querySelectorAll(".discipline-totals")[0].textContent, /5Gialli0Rossi/);
  assert.match(w.document.querySelectorAll(".discipline-totals")[1].textContent, /1Giallo0Rossi/);
  assert.equal(w.document.querySelectorAll(".discipline-event").length, 6);
  assert.ok($("[data-clearance-event]"));
  $('[aria-label="Chiudi cartellini"]').click();
  await runtime.navigate("more");
  await until(() => $(".sc-tool-list"));
  const toolsButton = [
    ...w.document.querySelectorAll(".sc-tool-list button"),
  ].find((b) => b.textContent.includes("Cartellini e diffide"));
  toolsButton.click();
  await until(() => $("#disciplineList"));
  assert.equal(w.document.querySelectorAll(".discipline-event").length, 6);
  assert.equal(w.fixtureData.match_events.length, 6);
});

test("React secretary can inspect saved discipline and cannot confirm a suspension", async (t) => {
  const { w, $, clickText } = await app(t, "secretary");
  clickText("Cartellini");
  await until(() => $("#disciplineList"));
  assert.equal(w.document.querySelectorAll(".discipline-event").length, 6);
  assert.equal($("[data-clearance-event]"), null);
  assert.equal($('[aria-label="Gestione utenti"]'), null);
});

test("React season selection and individual reports preserve the complete stored history", async (t) => {
  const { w, runtime, $, clickText } = await app(t, "admin", (data) => {
    data.matches.push({
      ...data.matches[0],
      id: "old-match",
      match_date: "2025-10-01",
    });
    data.match_events.push({
      ...data.match_events[0],
      id: "old-yellow",
      match_id: "old-match",
    });
  });
  assert.equal(runtime.actions.playerDiscipline("player-1").total, 5);
  $('.header-settings').open=true;
  const seasonSelect=$('.header-settings-panel .app-season select');
  seasonSelect.value='2025';seasonSelect.dispatchEvent(new w.Event('change',{bubbles:true}));
  await until(()=>runtime.actions.season().year===2025&&!seasonSelect.disabled);
  assert.equal(runtime.actions.playerDiscipline("player-1").total, 1);
  seasonSelect.value='2026';seasonSelect.dispatchEvent(new w.Event('change',{bubbles:true}));
  await until(()=>runtime.actions.season().year===2026&&!seasonSelect.disabled);
  assert.equal(runtime.actions.playerDiscipline("player-1").total, 5);
  await runtime.navigate("reports");
  await until(() => $("#reportContent"));
  $("#rp").value = "player-1";
  $("#rp").dispatchEvent(new w.Event("change",{bubbles:true}));
  await until(()=>$("#rp").value==="player-1");
  $("#reportPeriod").value="all";$("#reportPeriod").dispatchEvent(new w.Event("change",{bubbles:true}));
  await until(() => $("#report")?.textContent.includes("Cartellini: 6"));
  assert.equal(w.fixtureData.match_events.length, 7);
  assert.equal(w.fixtureData.matches.length, 2);
});

test("React attendance drafts survive page navigation and require consent before logout", async (t) => {
  const { w, runtime, $ } = await app(t);
  await runtime.navigate("training");
  runtime.state.trainingMode = "actual";
  runtime.render();
  await until(() => $("#trainList"));
  $('[data-presence-player="player-1"][data-presence="Presente"]').click();
  assert.equal(runtime.actions.hasAttendanceDraft(), true);
  const draft = runtime.state.trainingDraft;
  w.confirm=()=>false;assert.equal(await runtime.navigate("players"),false);assert.equal(runtime.state.trainingDraft,draft);
  w.confirm=()=>true;await runtime.navigate("players");
  await until(() => $(".native-player"));
  assert.equal(runtime.state.trainingDraft, draft);
  let exits = 0;
  runtime.db.auth.signOut = async () => {
    exits++;
    return { error: null };
  };
  w.confirm = () => false;
  await runtime.actions.logout();
  assert.equal(exits, 0);
  assert.equal(runtime.state.trainingDraft, draft);
  w.confirm = () => true;
  draft.saving = true;
  await runtime.actions.logout();
  assert.equal(exits, 0);
  draft.saving = false;
  await runtime.actions.logout();
  assert.equal(exits, 1);
  assert.equal(w.fixtureData.attendance.length, 2);
});

for (const [role, manage, operate] of [
  ["admin", true, true],
  ["manager", true, true],
  ["coach", false, true],
  ["secretary", true, false],
  ["technical_assistant", false, false],
  ["president", false, false],
]) {
  test("React native actions respect " + role + " permissions", async (t) => {
    const { w, runtime, $ } = await app(t, role);
    const text = () => w.document.querySelector("#mainContent").textContent;
    assert.equal(!!$('[aria-label="Gestione utenti"]'), role === "admin");
    assert.equal(
      [...w.document.querySelectorAll("button")].some(
        (b) => b.textContent.trim() === "Partita",
      ),
      operate,
    );
    await runtime.navigate("players");
    await until(() => $(".native-player"));
    assert.equal(text().includes("Giocatore"), manage);
    await runtime.navigate("training");
    await until(() => $(".training-scope"));
    assert.equal(
      [...w.document.querySelectorAll("button")].some(
        (b) => b.textContent.trim() === "Allenamento",
      ),
      operate,
    );
  });
}

test("React communication publication retains failed drafts and rejects duplicate submissions", async (t) => {
  const { w, runtime, $, clickText } = await app(t);
  await runtime.navigate("communications");
  await until(() => $(".communication-list-status"));
  clickText("Nuova comunicazione");
  await until(() => $("#communication-title"));
  const change = (element, value) => {
    Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      "value",
    ).set.call(element, value);
    element.dispatchEvent(new w.Event("input", { bubbles: true }));
  };
  change($("#communication-title"), "Aggiornamento staff");
  change(
    $("#communication-body"),
    "<script>unsafe()</script> Testo conservato",
  );
  await until(() => $('form[data-dirty="true"]'));
  w.fixtureCommunicationError = { message: "Synthetic network failure" };
  const form = $('form[data-dirty="true"]');
  form.dispatchEvent(
    new w.Event("submit", { bubbles: true, cancelable: true }),
  );
  form.dispatchEvent(
    new w.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => form.textContent.includes("Pubblicazione non riuscita"));
  assert.equal($("#communication-title").value, "Aggiornamento staff");
  assert.equal(w.fixtureData.staff_communications.length, 0);
  w.confirm = () => false;
  assert.equal(await runtime.navigate("training"), false);
  delete w.fixtureCommunicationError;
  form.dispatchEvent(
    new w.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => !$("#communication-title"));
  assert.equal(w.fixtureData.staff_communications.length, 1);
  assert.match(
    $(".native-message").textContent,
    /<script>unsafe\(\)<\/script>/,
  );
  assert.equal($(".native-message script"), null);
});


test("React communication dialog follows keyboard viewport changes and releases listeners", async t => {
 const {w,runtime,$,clickText}=await app(t);
 const viewport=new w.EventTarget();viewport.height=700;viewport.offsetTop=0;
 let listeners=0;
 const add=viewport.addEventListener.bind(viewport),remove=viewport.removeEventListener.bind(viewport);
 viewport.addEventListener=(...args)=>{listeners++;add(...args)};
 viewport.removeEventListener=(...args)=>{listeners--;remove(...args)};
 Object.defineProperty(w,'visualViewport',{configurable:true,value:viewport});
 await runtime.navigate('communications');await until(()=>$('.communications-workspace'));
 clickText('Nuova comunicazione');await until(()=>$('.modern-dialog-viewport:has(.modern-dialog)')?.style.height==='700px');
 assert.equal(listeners,2);
 viewport.height=360;viewport.offsetTop=40;viewport.dispatchEvent(new w.Event('resize'));
 await until(()=>$('.modern-dialog-viewport:has(.modern-dialog)')?.style.height==='360px');
 assert.equal($('.modern-dialog-viewport:has(.modern-dialog)').style.top,'40px');
 viewport.offsetTop=65;viewport.dispatchEvent(new w.Event('scroll'));
 await until(()=>$('.modern-dialog-viewport:has(.modern-dialog)')?.style.top==='65px');
 $('.modern-dialog [aria-label="Chiudi"]').click();await until(()=>!$('.modern-dialog'));
 await until(()=>listeners===0);
 assert.ok($('.app-mobile-nav'));
});

test("Club Office preserves every tool and greets with the admin-managed name as text", async t => {
 const { w, runtime, $ } = await app(t);
 runtime.state.team.first_name = '<img src=x onerror=alert(1)> Giàcomo';
 runtime.render();await runtime.navigate('dashboard');
 await until(() => $('.office-heading'));
 assert.match($('.office-heading').textContent, /Bentornato, <img src=x onerror=alert\(1\)> Giàcomo/);
 assert.equal($('.office-heading img'), null);
 runtime.state.team.first_name='';runtime.render();
 await until(() => $('.office-heading h1').textContent==='Bentornato');
 await runtime.navigate('more');await until(()=>$('.sc-tool-list'));
 for(const path of ['players','reports','register'])assert.ok($('.sc-tools [href="#/'+path+'"]'));
 for(const label of ['Cartellini e diffide','Scadenze e tesseramenti','Gestione utenti'])assert.match($('.sc-tools').textContent,new RegExp(label));
});

test('Admin email correction preserves failed input, rejects double submit and refreshes the directory',async t=>{
 const {w,runtime,$}=await app(t);let email=w.fixtureUser.email,calls=[],fail=true;
 runtime.db.functions.invoke=async(_,options)=>{
  if(options.body.action==='list')return {data:{users:[{id:w.fixtureUser.id,email,role:'admin',created_at:'2026-10-06'}],nextPage:null},error:null};
  calls.push(options.body);await new Promise(r=>setTimeout(r,20));
  if(fail)return {data:{error:'Erreur simulée'},error:null};email=options.body.email;return {data:{updated:true,email},error:null};
 };
 runtime.actions.users();await until(()=>$('[data-user-email]'));$('[data-user-email]').click();await until(()=>$('#userEmailForm'));
 eventValue(w,$('#staffEmail'),'corrected@example.test');const submit=()=>$('#userEmailForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));submit();submit();
 await until(()=>$('#emailMessage').textContent.includes('Erreur'));assert.equal(calls.length,1);assert.equal($('#staffEmail').value,'corrected@example.test');assert.equal($('#staffEmail').matches(":disabled"),false);
 fail=false;submit();await until(()=>!$('#userEmailForm')&&$('#usersList').textContent.includes('corrected@example.test'));
 assert.equal(calls.length,2);assert.equal(calls[1].action,'email');assert.equal(calls[1].userId,w.fixtureUser.id);assert.equal(calls[1].previousEmail,w.fixtureUser.email);assert.equal(calls[1].password,undefined);assert.equal(runtime.state.team.role,'admin');
});
test('Admin deletion confirms identity, protects owner/self, retries errors and submits once',async t=>{
 const {w,runtime,$}=await app(t);const staff={id:'removable-staff',email:'coach@example.test',first_name:'Luca',last_name:'Bianchi',role:'coach'};let exists=true,fail=true,calls=[];
 runtime.state.team.owner_id='team-owner';
 runtime.db.functions.invoke=async(_,options)=>{
  const body=options.body;
  if(body.action==='list')return {data:{users:[{id:'team-owner',email:'owner@example.test',role:'admin'},{id:w.fixtureUser.id,email:w.fixtureUser.email,role:'admin'},...(exists?[staff]:[])],nextPage:null},error:null};
  calls.push(body);await new Promise(r=>setTimeout(r,20));
  if(fail)return {data:{error:'Eliminazione non confermata, riprova.'},error:null};exists=false;return {data:{deleted:true},error:null};
 };
 runtime.actions.users();await until(()=>$('[data-user-delete]'));
 assert.equal(w.document.querySelectorAll('[data-user-delete]').length,1);
 $('[data-user-delete]').click();await until(()=>$('#deleteUserForm'));
 assert.match($('#deleteUserDescription').textContent,/Luca Bianchi.*coach@example.test/);assert.match($('#deleteUserDescription').textContent,/storico.*conservati/);
 assert.equal(w.document.activeElement.id,'cancelDeleteUser');$('#cancelDeleteUser').click();await until(()=>!$('#deleteUserForm'));assert.equal($('#deleteUserForm'),null);assert.equal(calls.length,0);
 $('[data-user-delete]').click();const submit=()=>$('#deleteUserForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));submit();submit();$('#cancelDeleteUser').click();assert.ok($('#deleteUserForm'));
 await until(()=>$('#deleteUserMessage').textContent.includes('non confermata'));assert.equal(calls.length,1);assert.equal($('#cancelDeleteUser').matches(":disabled"),false);
 fail=false;submit();await until(()=>!$('#deleteUserForm')&&!$('[data-user-delete]'));
 assert.equal(calls.length,2);assert.deepEqual(JSON.parse(JSON.stringify(calls[1])),{action:'delete',userId:staff.id,confirmEmail:staff.email});
 assert.match($('#usersList').textContent,/owner@example.test/);assert.match($('#usersList').textContent,/demo@example.test/);
});

test('Deletion responses after logout cannot restore the staff directory',async t=>{
 const {w,runtime,$}=await app(t);let release,reads=0;
 runtime.db.functions.invoke=async(_,options)=>{
  if(options.body.action==='list'){reads++;return {data:{users:[{id:'staff',email:'staff@example.test',role:'coach'}],nextPage:null},error:null}}
  await new Promise(r=>release=r);return {data:{deleted:true},error:null};
 };
 runtime.actions.users();await until(()=>$('[data-user-delete]'));$('[data-user-delete]').click();$('#deleteUserForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>release);
 w.EburumTests.renderLogin();release();await new Promise(r=>setTimeout(r,30));assert.equal($('#usersList'),null);assert.equal(reads,1);
});

test("Admin profile edits preserve failed input and update the home greeting after retry", async t => {
 const { w, runtime, $, clickText } = await app(t);
 let calls=0, fail=true, names={first_name:'',last_name:''};
 const rpc=runtime.db.rpc;runtime.db.rpc=async(name,payload)=> name==='team_context'?{data:{owner_id:w.fixtureUser.id,role:'admin',...names},error:null}:rpc(name,payload);
 runtime.db.functions.invoke=async(_,options)=>{
  const body=options.body;
  if(body.action==='list')return {data:{users:[{id:w.fixtureUser.id,email:w.fixtureUser.email,role:'admin',created_at:'2026-10-06',...names}],nextPage:null},error:null};
  if(body.action==='profile'){calls++;await new Promise(r=>setTimeout(r,20));if(fail)return {data:{error:'Errore simulato, riprova'},error:null};names={first_name:body.first_name,last_name:body.last_name};return {data:{updated:true},error:null}};
  throw Error('Unexpected test action');
 };
 runtime.actions.users();await until(()=>$('[data-user-profile]'));$('[data-user-profile]').click();
 await until(()=>$('#userProfileForm'));eventValue(w,$('#staffFirstName'),'  Giàcomo  ');eventValue(w,$('#staffLastName'),"D’Angelo");
 const submit=()=>$('#userProfileForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));submit();submit();
 await until(()=>$('#profileMessage').textContent.includes('Errore simulato'));
 assert.equal(calls,1);assert.equal($('#staffFirstName').value,'  Giàcomo  ');assert.equal($('#staffFirstName').matches(":disabled"),false);
 fail=false;submit();await until(()=>!$('#userProfileForm'));assert.equal(calls,2);assert.equal(runtime.state.team.first_name,'Giàcomo');
 w.document.querySelector('#closeUsers').click();await runtime.navigate('dashboard');await until(()=>$('.office-heading h1')?.textContent==='Bentornato, Giàcomo.');
});

test("Realtime updates Club Office home previews without opening communications",async t=>{
 const {w,runtime,$}=await app(t);await runtime.navigate('dashboard');await until(()=>$('.office-comms'));
 w.fixtureData.staff_communications.push({id:'new-home-message',user_id:w.fixtureUser.id,title:'Avviso ricevuto',body:'Tutto lo staff',created_by:'other',author_label:'Staff',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()});
 w.fixtureChannels.at(-1).event({payload:{}});await until(()=>$('.office-comms').textContent.includes('Avviso ricevuto'));
 assert.equal($('.office-comms [data-communication-count]').textContent,'1');assert.equal(runtime.state.page,'dashboard');
});


test("Workspace editors protect unsaved replies and preserve the React navigation", async t=>{
 const {w,runtime,$}=await app(t,"admin",data=>{data.activities.push({id:"training-port",user_id:"demo-user",activity_date:"2026-10-01",activity_type:"Allenamento",title:"Allenamento test",status:"Programmato",revision:0})});
 await runtime.actions.openActivity("training-port");await until(()=>$("#planningForm"));
 assert.ok($("#workspaceEditor #planningForm"));assert.equal($("#planningForm").closest(".modal").getAttribute("role"),"region");assert.equal($("#app").hasAttribute("inert"),false);
 $("[data-training-reply=Indisponibile]").click();w.confirm=()=>false;assert.equal(await runtime.navigate("players"),false);assert.ok($("#planningForm"));
 $("[data-training-phase=actual]").click();assert.equal($("#planningForm").hidden,true);assert.equal($(".training-actual-entry").hidden,false);$("[data-training-phase=replies]").click();assert.equal($("#planningForm").hidden,false);
 w.confirm=()=>true;assert.equal(await runtime.navigate("players"),true);await until(()=>$(".sc-directory"));assert.equal($("#planningForm"),null);assert.ok($(".app-mobile-nav"));
});

test("Contextual yellow action edits inline and protects unsaved event navigation",async t=>{
 const {w,runtime,$,clickText}=await app(t);$(".sc-match-preview").click();await until(()=>$("#addYellow"));
 assert.ok($("#workspaceEditor #activityForm"));$("[data-activity-tab=results]").click();$("#addYellow").click();await until(()=>$("#eventForm"));
 assert.equal($("[data-event-type=Ammonizione]").getAttribute("aria-pressed"),"true");assert.ok($("#workspaceEditor .inline-match-event"));assert.equal($("#app").hasAttribute("inert"),false);eventValue(w,$("#eventMinute"),"71");w.confirm=()=>false;assert.equal(await runtime.navigate("players"),false);w.confirm=()=>true;
 $("#close").click();await until(()=>!$("#eventForm"));assert.equal($("#app").hasAttribute("inert"),false);assert.ok($("#workspaceEditor #activityForm"));assert.equal($(".match-workspace").dataset.dirty,"false");assert.equal($("#matchGoalsFor").matches(":disabled"),false);
});


test("Real React player directory opens the administrative sheet and retains cancelled edits",async t=>{
 const {w,runtime,$}=await app(t);await runtime.navigate("players");await until(()=>$(".player-directory-entry"));$(".player-directory-entry").click();await until(()=>$("#playerAdminForm"));
 eventValue(w,$("#certificateUntil"),"2027-06-30");w.confirm=()=>false;$("[aria-label='Chiudi scheda']").click();assert.ok($("#playerAdminForm"));assert.equal($("#certificateUntil").value,"2027-06-30");
 w.confirm=()=>true;$("[aria-label='Chiudi scheda']").click();await until(()=>!$("#playerAdminForm"));assert.equal(w.fixtureData.player_administration.length,0);
});

test("Attendance phase transition keeps one current navigation item and the training route",async t=>{
 const {w,runtime,$}=await app(t,"admin",data=>{data.activities.push({id:"training-nav",user_id:"demo-user",activity_date:"2026-10-01",activity_type:"Allenamento",title:"Training navigation test",status:"Programmato",revision:0})});
 await runtime.actions.openActivity("training-nav");await until(()=>$("#planningForm"));$("[data-training-phase=actual]").click();$("#planningAttendance").click();await until(()=>$("#trainList")&&w.location.hash==="#/training");
 const current=w.document.querySelectorAll(".app-mobile-nav [aria-current=page]");assert.equal(current.length,1);assert.equal(current[0].textContent,"Allenamenti");
 assert.equal(w.document.querySelectorAll(".app-mobile-nav a").length,5);
 assert.equal($(".app-sidebar"),null,"Soft Club uses one floating navigation at every width");
 assert.ok($(".actual-presence-panel #trainingCounts"));assert.ok($(".actual-presence-panel #td"));
});

test("Collaborator records replies and observations without planning or lineup controls",async t=>{
 const {w,runtime,$}=await app(t,'technical_assistant',data=>{
  data.activities.push({id:'assistant-training',user_id:'demo-user',activity_date:'2026-10-01',activity_type:'Allenamento',title:'Allenamento',status:'Programmato',revision:0});
  data.activity_technical.push({activity_id:'activity-1',formation:'4-3-3',note:'Prima nota'});
  data.activity_roster.push({activity_id:'activity-1',player_id:'player-1',called:true,lineup:'Titolare',minutes_played:90,availability:'Disponibile'});
 });
 runtime.actions.newTraining();assert.equal($('#planningForm'),null);
 runtime.actions.newMatch();assert.equal($('#activityForm'),null);
 await runtime.actions.openActivity('activity-1');await until(()=>$('#activityForm'));
 assert.equal($('#activityName').matches(":disabled"),true);assert.equal($('#formation').matches(":disabled"),true);
 assert.equal($('[data-called]').matches(":disabled"),true);assert.equal($('[data-roster-edit]').matches(":disabled"),true);
 assert.equal($('#matchVenue').matches(":disabled"),true);assert.equal($('#matchMinutesMode').matches(":disabled"),true);
 assert.equal($('#addYellow').matches(":disabled"),false);
 $('[data-activity-tab="roster"]').click();eventValue(w,$('#technicalNote'),'Osservazione aggiornata');
 $('#activityForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>$('#activityFeedback').textContent.includes('Osservazioni tecniche salvate'));
 const request=w.fixtureTeamCalls.find(c=>c.rpc==='save_activity_observation');assert.equal(request.p_note,'Osservazione aggiornata');assert.equal(request.p_roster,undefined);
 assert.equal(w.fixtureData.activity_technical[0].formation,'4-3-3');$('#closeActivity').click();
 await runtime.navigate('training');await until(()=>$('.sc-inline-training'));
 assert.equal($('#planningDate').matches(":disabled"),true);assert.equal($('#planningAttendance').matches(":disabled"),false);
 $('[data-training-player="player-1"][data-training-reply="Indisponibile"]').click();$('#savePlanning').click();
 await until(()=>w.fixtureTeamCalls.some(c=>c.p_id==='assistant-training'));
 const training=w.fixtureTeamCalls.find(c=>c.p_id==='assistant-training');assert.equal(training.p_activity.title,'Allenamento');assert.equal(training.p_roster.length,2);
});

test("President sees only summarized deadlines and read-only sporting workflows",async t=>{
 const {w,runtime,$}=await app(t,'president',data=>data.activities.push({id:'president-training',user_id:'demo-user',activity_date:'2026-10-01',activity_type:'Allenamento',title:'Allenamento',status:'Programmato',revision:0}));
 await runtime.navigate('dashboard');await until(()=>$('.club-office-home'));
 assert.match($('.club-office-home').textContent,/Situazione squadra/);assert.match($('.club-office-home').textContent,/Consulta allenamento/);
 await runtime.navigate('more');await until(()=>$('.sc-tool-list'));assert.match($('.sc-tools').textContent,/Scadenze e tesseramenti/);assert.doesNotMatch($('.sc-tools').textContent,/Gestione utenti/);
 runtime.actions.expiries();await until(()=>$('#expiryTitle'));assert.match($('.expiry-row').textContent,/In scadenza/);assert.doesNotMatch($('.expiry-row').textContent,/\d{2}\/\d{2}\/\d{4}/);
 $('.expiry-row').click();await until(()=>$('#playerSheetTitle'));assert.equal($('#playerAdminForm'),null);$('[aria-label="Chiudi scheda"]').click();
 await runtime.navigate('training');await until(()=>$('.sc-inline-training'));assert.equal($('#planningAttendance').matches(":disabled"),true);
 assert.equal($('[data-training-reply="Disponibile"]').matches(":disabled"),true);
 $('#planningForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(w.fixtureTeamCalls.length,0);
 runtime.actions.users();assert.equal($('#usersTitle'),null);
 await runtime.navigate('communications');await until(()=>$('.communication-list-status'));assert.ok([...w.document.querySelectorAll('button')].some(b=>b.textContent.includes('Nuova comunicazione')));
});

test("Direct training replies preserve failed drafts, guard season changes and save the full roster without attendance",async t=>{
 const {w,runtime,$}=await app(t,"admin",data=>data.activities.push({id:"inline-training",user_id:"demo-user",activity_date:"2026-10-01",activity_type:"Allenamento",title:"Allenamento",status:"Programmato",revision:0}));
 await runtime.navigate("training");await until(()=>$(".sc-inline-training #planningForm"));
 assert.equal(w.document.querySelectorAll("#planningForm").length,1);
 assert.equal($(".sc-inline-training").getAttribute("aria-modal"),null);
 const attendanceBefore=w.fixtureData.attendance.length,season=runtime.actions.season().year;
 $('[data-training-player="player-1"][data-training-reply="Indisponibile"]').click();$("#pendingReplyFilter").click();
 assert.equal(w.document.querySelectorAll(".sc-reply-row").length,1);
 w.confirm=()=>false;assert.equal(await runtime.navigate("players"),false);await runtime.actions.changeSeason(season-1);assert.equal(runtime.actions.season().year,season);
 w.fixtureSaveError={message:"Errore di rete simulato"};$("#savePlanning").click();await until(()=>$("#planningFeedback").textContent.includes("simulato"));
 assert.equal($("#savePlanning").matches(":disabled"),false);assert.equal(w.fixtureData.attendance.length,attendanceBefore);
 w.fixtureSaveError=null;$("#savePlanning").click();$("#savePlanning").click();await until(()=>w.fixtureData.activity_roster.some(r=>r.activity_id==="inline-training")&&$("#planningChanges").hidden);
 assert.equal(w.fixtureData.activity_roster.filter(r=>r.activity_id==="inline-training").length,2);
 assert.equal(w.fixtureData.activity_roster.find(r=>r.activity_id==="inline-training"&&r.player_id==="player-1").availability,"Indisponibile");
 assert.equal(w.fixtureData.attendance.length,attendanceBefore);assert.equal(w.fixtureTeamCalls.length,2,'one failed attempt, one successful save despite duplicate clicks');
});

test("Secretary direct training workspace is read-only and cannot submit sporting changes",async t=>{
 const {w,runtime,$}=await app(t,"secretary",data=>data.activities.push({id:"readonly-training",user_id:"demo-user",activity_date:"2026-10-01",activity_type:"Allenamento",title:"Allenamento",status:"Programmato",revision:0}));
 await runtime.navigate("training");await until(()=>$(".sc-inline-training #planningForm"));
 assert.ok([...w.document.querySelectorAll("[data-training-reply]")].every(b=>b.disabled));
 $("#planningForm").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));assert.equal(w.fixtureTeamCalls.length,0);
});

test('Register replaces training history and preserves read-only access to past sheets',async t=>{
 const {w,runtime,$}=await app(t,'president',data=>data.activities.push({id:'confirmed',user_id:'demo-user',activity_date:'2026-10-06',activity_type:'Allenamento',title:'Allenamento storico',status:'Concluso',session_id:'session-1',organization_note:'Divisa blu',revision:0}));
 await runtime.navigate('training');await until(()=>$('.training-scope'));
 assert.deepEqual([...w.document.querySelectorAll('.training-scope button')].map(b=>b.textContent),['Prossimi','Da confermare0']);
 assert.equal($('#planningForm'),null);assert.ok(w.document.querySelector('a[href="#/register"]'));
 await runtime.navigate('register');await until(()=>$('[data-register-training]'));
 assert.match($('#registerDetail').textContent,/Presente|Presenti/);assert.match($('#registerDetail').textContent,/Divisa blu/);
 $('[data-register-training]').click();await until(()=>$('#readonlyActivityTitle'));
 assert.match(w.document.body.textContent,/Consultazione/);assert.equal($('#planningForm'),null);assert.equal(runtime.state.page,'register');
});

test('Register retains cancelled trainings without inventing attendance',async t=>{
 const {w,runtime,$}=await app(t,'admin',data=>{data.activities.push({id:'cancelled-training',user_id:'demo-user',activity_date:'2026-10-05',activity_type:'Allenamento',title:'Pioggia <img src=x>',status:'Annullato',organization_note:'Campo chiuso',revision:0});});
 await runtime.navigate('register');await until(()=>$('#calendarGrid'));
 const day=$('[data-date="2026-10-05"]');assert.ok(day.classList.contains('has-activity'));day.click();
 assert.match($('#registerDetail').textContent,/Annullato/);assert.match($('#registerDetail').textContent,/nessuna presenza/);assert.match($('#registerDetail').textContent,/Campo chiuso/);
 assert.equal($('#registerDetail img'),null);assert.equal(w.fixtureData.attendance.length,2);
 $('[data-register-training]').click();await until(()=>$('#planningForm'));
 assert.equal($('#planningAttendance').matches(":disabled"),true);assert.equal(runtime.state.page,'register');
 $('#closePlanning').click();await until(()=>!$('#planningForm'));assert.match($('#registerDetail').textContent,/Campo chiuso/);
});

test('Register opens confirmed training sheet and returns to selected calendar day',async t=>{
 const {w,runtime,$}=await app(t,'admin',data=>data.activities.push({id:'confirmed',user_id:'demo-user',activity_date:'2026-10-06',activity_type:'Allenamento',title:'Allenamento storico',status:'Concluso',session_id:'session-1',revision:0}));
 await runtime.navigate('register');await until(()=>$('[data-register-training]'));
 $('[data-register-training]').click();await until(()=>$('#planningForm'));
 assert.equal(runtime.state.page,'register');assert.equal($('#planningForm').hidden,true);assert.ok($('.training-confirmed-summary'));
 $('#closePlanning').click();await until(()=>!$('#planningForm'));assert.equal($('#registerDetail').dataset.selected,'2026-10-06');assert.equal(w.fixtureTeamCalls.length,0);
});

test('Important communication acknowledgement is explicit, retryable and single-submit',async t=>{
 const {w,runtime,$}=await app(t,'secretary',data=>data.staff_communications.push({id:'important',user_id:'demo-user',created_by:'other-staff',title:'Avviso importante',body:'Leggere prima della gara',requires_ack:true,retention_days:3,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()}));
 await runtime.navigate('communications');await until(()=>$('.communication-ack'));
 assert.equal(w.fixtureAcknowledgements,undefined,'opening never acknowledges');
 const button=$('.communication-ack button');w.fixtureAckError={message:'Network'};button.click();await until(()=>$('.native-message [role=alert]'));assert.equal(button.disabled,false);
 w.fixtureAckError=null;w.fixtureAckGate=new Promise(resolve=>w.releaseAck=resolve);button.click();button.click();await until(()=>button.disabled);assert.equal(w.fixtureAcknowledgements,2);w.releaseAck();await until(()=>button.textContent==='Lettura confermata');assert.equal(button.disabled,true);assert.equal(w.fixtureData.communication_receipts.length,1);
 assert.match($('.communication-ack').textContent,/Demo staff/);
});


test('Roster groups roles, sorts by surname and removes duplicate management list', async t => {
 const {w,runtime,$}=await app(t,'admin',data=>{ data.players[0].surname='Zeta'; data.players[0].role='Portiere'; data.players[1].surname='Alfa'; data.players[1].role='Difensore'; });
 await runtime.navigate('players'); await until(()=>$('.sc-roster-sort select'));
 assert.equal($('.sc-player-management'),null);
 assert.deepEqual([...w.document.querySelectorAll('.sc-roster-group h3')].map(e=>e.textContent),['Portiere','Difensore']);
 const select=$('.sc-roster-sort select');select.value='surname';select.dispatchEvent(new w.Event('change',{bubbles:true}));
 await until(()=>!$('.sc-roster-group'));
 const names=[...w.document.querySelectorAll('.player-directory-entry b')].map(e=>e.textContent);
 assert.ok(names[0].startsWith('Alfa'));assert.ok(names[1].startsWith('Zeta'));
 assert.equal(w.document.querySelectorAll('.player-directory-entry').length,2);
 $('.player-directory-entry').click();await until(()=>$('#toggleSheetPlayer'));
 assert.equal($('#toggleSheetPlayer').textContent,'Disattiva giocatore');
 $('#editSheetPlayer').click();await until(()=>$('#playerEditTitle'));assert.equal($('#playerSheetTitle'),null);
});

test('Coach can consult player sheets without roster management controls', async t=>{
 const {runtime,$}=await app(t,'coach');await runtime.navigate('players');await until(()=>$('.player-directory-entry'));$('.player-directory-entry').click();await until(()=>$('#playerSheetTitle'));
 assert.equal($('#toggleSheetPlayer'),null);assert.equal($('#editSheetPlayer'),null);
});

test('Motion input tracking switches between pointer and keyboard without changing navigation', async t => {
 const {w,runtime,$}=await app(t,'admin');
 w.dispatchEvent(new w.Event('pointerdown'));assert.equal(w.document.documentElement.dataset.uiInput,'pointer');
 w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab'}));assert.equal(w.document.documentElement.dataset.uiInput,'keyboard');
 await runtime.navigate('players');await until(()=>$('.sc-roster-sort'));assert.equal(w.document.documentElement.dataset.uiInput,'keyboard');
 w.dispatchEvent(new w.Event('pointerdown'));assert.equal(w.document.documentElement.dataset.uiInput,'pointer');
});

test('Navigation highlights stay unique across page changes and do not create interactive controls', async t=>{
 const {w,runtime,$}=await app(t,'admin');

 w.HTMLElement.prototype.getBoundingClientRect = function(){return {left:0,top:0,right:100,bottom:44,width:100,height:44,x:0,y:0,toJSON(){}}};
 w.dispatchEvent(new w.Event('resize'));
 await until(()=>$('.app-mobile-nav .club-nav-highlight'));
 const marker=$('.app-mobile-nav .club-nav-highlight');
 assert.equal(marker.getAttribute('aria-hidden'),'true');
 await runtime.navigate('players');await until(()=>$('.sc-roster-sort'));await new Promise(r=>setTimeout(r,40));
 assert.equal(w.document.querySelectorAll('.app-mobile-nav .club-nav-highlight').length,1);
 assert.equal($('.app-mobile-nav .club-nav-highlight'),marker);
 assert.equal(w.document.querySelectorAll('.app-mobile-nav a[aria-current=page]').length,1);
 await runtime.navigate('finance');await until(()=>$('.finance-tabs .club-nav-highlight'));
 await runtime.navigate('more');await until(()=>$('.sc-tools-list')||!$('.finance-tabs'));
 assert.equal($('.finance-tabs .club-nav-highlight'),null);
});
for (const role of ['admin','treasurer']) test('User guide searches and respects role topics for '+role,async t=>{
 const {w,$,clickText}=await app(t,role);
 $('[aria-label="Guida all’app"]').click();await until(()=> $('[role="dialog"]'));
 assert.match($('[role="dialog"]').textContent,/Guida a Eburum/);
 assert.equal([...w.document.querySelectorAll('.guide-topic summary')].some(e=>e.textContent==='Utenti e accessi'),role==='admin');
 const input=$('[aria-label="Cerca nella guida"]');
 const setValue=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set;
 setValue.call(input,'storna');input.dispatchEvent(new w.Event('input',{bubbles:true}));await until(()=>w.document.querySelectorAll('.guide-topic').length===1);
 assert.match($('.guide-topic').textContent,/Economia/);assert.equal($('.guide-topic').open,true);
 setValue.call(input,'inesistenteabcdef');input.dispatchEvent(new w.Event('input',{bubbles:true}));await until(()=>$('[role="dialog"]').textContent.includes('Nessun argomento trovato'));
 $('[role="dialog"] [aria-label="Chiudi"]').click();await until(()=>!$('[role="dialog"]'));
 assert.equal(w.fixtureFinanceCalls?.length||0,0);
});
test('Theme preference persists and follows system changes',async t=>{
 const {w,$}=await app(t);
 const select=$('[aria-label="Tema dell’app"]');
 assert.equal(select.value,'system');
 select.value='dark';select.dispatchEvent(new w.Event('change',{bubbles:true}));await until(()=>w.document.documentElement.dataset.theme==='dark');
 assert.equal(w.localStorage.getItem('eburum.theme'),'dark');
 select.value='light';select.dispatchEvent(new w.Event('change',{bubbles:true}));await until(()=>w.document.documentElement.dataset.theme==='light');
 assert.equal(w.localStorage.getItem('eburum.theme'),'light');
 select.value='system';select.dispatchEvent(new w.Event('change',{bubbles:true}));await until(()=>w.localStorage.getItem('eburum.theme')==='system');
});
test('Finance API rejects a response from an earlier login to the same account',async t=>{
 const {w,runtime}=await app(t,'treasurer',treasurySeed);
 const api=w.EburumTests.financeApi(runtime),actor=runtime.state.user,team=runtime.state.team;
 let release;const gate=new Promise(r=>release=r),original=runtime.db.rpc;
 runtime.db.rpc=async(name,payload)=>{if(name==='finance_snapshot')await gate;return original(name,payload)};
 const pending=api.snapshot('2026-01-01','2026-12-31');
 w.EburumTests.renderLogin();runtime.state.user=actor;runtime.state.team=team;
 release();await assert.rejects(pending,/Sessione o permessi/);
 assert.equal(api.current(),false);
});
test('PDF loader deduplicates concurrent requests and permits retry after failure',async t=>{
 const {w}=await app(t);const load=w.EburumTests.ensureJsPdf;
 const a=load(),b=load();assert.equal(a,b);assert.equal(w.document.querySelectorAll('script[data-pdf-loader]').length,1);
 const failure=assert.rejects(a,/connessione/);w.document.querySelector('script[data-pdf-loader]').dispatchEvent(new w.Event('error'));await failure;
 assert.equal(w.document.querySelectorAll('script[data-pdf-loader]').length,0);
 const retry=load();w.jspdf={jsPDF:function(){}};w.document.querySelector('script[data-pdf-loader]').dispatchEvent(new w.Event('load'));await retry;
 await load();assert.equal(w.document.querySelectorAll('script[data-pdf-loader]').length,1);
});

test('Finance PDF loads on demand and refuses an obsolete session before download',async t=>{
 const {w}=await app(t);let current=true,downloaded=0;
 const render=w.EburumTests.exportFinancePdf({totals:{opening:0,closing:0,income:0,expense:0,initial:0},accounts:[],categories:[]},[],'2026-10-01','2026-10-13',()=>current);
 current=false;const failure=assert.rejects(render,/Sessione cambiata/);
 w.jspdf={jsPDF:class{setFontSize(){}text(){}splitTextToSize(s){return [s]}addPage(){}save(){downloaded++}}};
 w.document.querySelector('script[data-pdf-loader]').dispatchEvent(new w.Event('load'));await failure;assert.equal(downloaded,0);
 await w.EburumTests.exportFinancePdf({totals:{opening:0,closing:0,income:0,expense:0,initial:0},accounts:[],categories:[]},[],'2026-10-01','2026-10-13',()=>true);assert.equal(downloaded,1);
});

for(const role of ['admin','treasurer']) test('React match sheet exports saved data and returns focus for '+role,async t=>{
 const {w,$}=await app(t,role);$('.sc-match-preview').click();await until(()=>$('.match-report-trigger'));
 const trigger=$('.match-report-trigger');trigger.focus();trigger.click();await until(()=>$('#matchReportText'));
 assert.match($('#matchReportText').value,/EBURUM - Squadra ospite/);assert.match($('#matchReportText').value,/Ammonito Rossi/);
 assert.ok(trigger.closest('[aria-hidden="true"]'));assert.equal($('#matchReportText').readOnly,true);
 $('[aria-label="Chiudi tabellino"]').click();await until(()=>!$('#matchReportText'));
 if(role==='admin'){await until(()=>!$('#app').hasAttribute('inert'));assert.ok($('#activityForm'));assert.equal(w.document.activeElement,trigger);}
 else {assert.equal($('#activityForm'),null);assert.ok($('#readonlyActivityTitle'));}
 assert.equal(w.fixtureTeamCalls.length,0);assert.equal(w.fixtureData.match_events.length,6);
});

function eventValue(w,element,value){if(element.tagName==='SELECT'){element.value=value;element.dispatchEvent(new w.Event('change',{bubbles:true}));}else reactInput(w,element,value);}
test('Match goals update score in place; editing sides and deleting restore the saved result',async t=>{
 const {w,runtime,$}=await app(t);$('.sc-match-preview').click();await until(()=>$('#addGoal'));const sheet=$('#activityForm');w.fixtureQueries=[];
 $('#addGoal').click();assert.ok($('#workspaceEditor .inline-match-event'));assert.equal($('#eventForm').tagName,'FORM');assert.equal(w.document.querySelector('form form'),null);eventValue(w,$('#eventPlayer'),'player-1');eventValue(w,$('#eventMinute'),'71');$('#eventPenalty').click();$('[data-save-event]').click();
 await until(()=>!$('#eventForm')&&$('#matchGoalsFor').value==='3');assert.equal($('#activityForm'),sheet);assert.equal($('#matchGoalsAgainst').value,'1');assert.equal(w.fixtureTeamCalls.length,0);
 assert.ok(w.fixtureQueries.every(q=>['matches','activities','match_events','activity_roster','activity_technical','sessions','disciplinary_clearances'].includes(q.table)));
 const goal=w.fixtureData.match_events.find(e=>e.event_type==='Gol');assert.equal(goal.detail,'RIG');$(`[data-unified-event="${goal.id}"]`).click();eventValue(w,$('#eventPlayer'),'');$('[data-save-event]').click();
 await until(()=>!$('#eventForm')&&$('#matchGoalsAgainst').value==='2');assert.equal($('#matchGoalsFor').value,'2');assert.match($('#matchEventList').textContent,/Squadra avversaria/);
 assert.equal($(`[data-unified-event="${goal.id}"]`).closest('.event-item').querySelector('.badge').textContent,'Gol avversario');assert.ok($(`[data-unified-event="${goal.id}"]`).closest('.event-item').querySelector('.badge').classList.contains('b-red'));
 $(`[data-unified-event="${goal.id}"]`).click();$('#deleteEvent').click();await until(()=>!$('#eventForm')&&$('#matchGoalsAgainst').value==='1');assert.equal($('#activityForm'),sheet);assert.equal($('#matchGoalsFor').value,'2');
});
test('Explicit opponent goal has no player field and exports the correct attribution',async t=>{
 const {w,$}=await app(t);$('.sc-match-preview').click();await until(()=>$('#addOpponentGoal'));$('#addOpponentGoal').click();assert.equal($('[data-event-person]').hidden,true);
 eventValue(w,$('#eventMinute'),'50');$('[data-save-event]').click();await until(()=>!$('#eventForm')&&$('#matchGoalsAgainst').value==='2');assert.equal($('#matchGoalsFor').value,'2');
 $('.match-report-trigger').click();await until(()=>$('#matchReportText'));assert.match($('#matchReportText').value,/50’ - Gol Squadra avversaria/);assert.doesNotMatch($('#matchReportText').value,/giocatore non indicato/i);
});
test('Quick event retries retain fields and never submit the surrounding match form',async t=>{
 const {w,$}=await app(t);$('.sc-match-preview').click();await until(()=>$('#addGoal'));$('#addGoal').click();eventValue(w,$('#eventMinute'),'77');$('[data-save-event]').click();await until(()=>$('#eventFeedback').textContent.includes('marcatore'));assert.match($('#eventFeedback').textContent,/marcatore/);
 eventValue(w,$('#eventPlayer'),'player-1');w.fixtureEventError={message:'Rete interrotta'};$('[data-save-event]').click();$('[data-save-event]').click();await until(()=>$('#eventFeedback').textContent.includes('Rete interrotta'));
 assert.equal($('#eventMinute').value,'77');assert.equal($('#eventPlayer').value,'player-1');assert.equal(w.fixtureTeamCalls.length,0);assert.equal(w.fixtureData.match_events.length,6);
 w.fixtureEventError=null;$('[data-save-event]').click();await until(()=>!$('#eventForm')&&$('#matchGoalsFor').value==='3');assert.equal(w.fixtureData.match_events.length,7);
});
test('Retry after a lost goal response uses the same id and does not count twice',async t=>{
 const {w,$}=await app(t);$('.sc-match-preview').click();await until(()=>$('#addGoal'));
 w.eval("const eventResultBeforeLoss=FixtureQuery.prototype.result;FixtureQuery.prototype.result=async function(){const r=await eventResultBeforeLoss.call(this);if(this.table==='match_events'&&this.action==='insert'&&!window.lostGoal){window.lostGoal=true;return {data:null,error:{message:'Risposta persa'}}}return r}");
 $('#addGoal').click();eventValue(w,$('#eventMinute'),'10');eventValue(w,$('#eventPlayer'),'player-1');$('[data-save-event]').click();await until(()=>$('#eventFeedback').textContent.includes('Risposta persa'));
 assert.equal(w.fixtureData.matches[0].goals_for,3);$('[data-save-event]').click();await until(()=>!$('#eventForm')&&$('#matchGoalsFor').value==='3');assert.equal(w.fixtureData.match_events.length,7);assert.equal(w.fixtureData.matches[0].goals_for,3);
});
test('A committed goal with failed timeline reload offers a read-only retry',async t=>{
 const {w,$}=await app(t);$('.sc-match-preview').click();await until(()=>$('#addOpponentGoal'));
 w.eval("const eventResultBeforeReadError=FixtureQuery.prototype.result;FixtureQuery.prototype.result=async function(){if(this.table==='matches'&&window.failMatchReload)return {data:null,error:{message:'Rete interrotta'}};return eventResultBeforeReadError.call(this)}");
 w.failMatchReload=true;$('#addOpponentGoal').click();eventValue(w,$('#eventMinute'),'20');$('[data-save-event]').click();await until(()=>$('#eventFeedback').textContent.includes('Evento salvato'));
 assert.equal(w.fixtureData.matches[0].goals_against,2);assert.ok($('#eventForm'));assert.equal($('#eventMinute').matches(':disabled'),true);w.failMatchReload=false;$('[data-save-event]').click();await until(()=>$('#matchGoalsAgainst').value==='2');assert.equal(w.fixtureData.match_events.length,7);
});
test('Flat match tabs and quick lineup selection preserve a single draft',async t=>{
 const {w,$}=await app(t);$('.sc-match-preview').click();await until(()=>$('#activityForm'));assert.equal($('.match-phases'),null);
 assert.deepEqual([...w.document.querySelectorAll('.activity-tabs [role=tab]')].map(el=>el.textContent),['Gara','Convocati','Impostazioni']);
 $('[data-activity-tab=roster]').click();$('[data-called="player-1"]').click();eventValue(w,$('[data-roster-lineup="player-1"]'),'Titolare');assert.equal($('#rosterTitle'),null);assert.match($('#rosterCounts').textContent,/1 titolari/);assert.equal(w.fixtureTeamCalls.length,0);
 $('#activityForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>$('#activityFeedback')?.textContent.includes('Partita e convocazioni salvate'));assert.ok($('#activityForm'));assert.equal(w.fixtureTeamCalls[0].p_roster.find(r=>r.player_id==='player-1').lineup,'Titolare');
});

test('Match event actions highlight only the open editor and follow type and team changes',async t=>{
 const {w,$}=await app(t);$('.sc-match-preview').click();await until(()=>$('#addGoal'));
 const active=()=>[...w.document.querySelectorAll('.match-event-actions [aria-pressed="true"]')].map(b=>b.id);
 assert.deepEqual(active(),[]);$('#addSubstitution').click();assert.deepEqual(active(),['addSubstitution']);
 $('.inline-match-event #close').click();await until(()=>active().length===0);assert.deepEqual(active(),[]);
 $('#addOpponentGoal').click();assert.deepEqual(active(),['addOpponentGoal']);$('.inline-match-event #close').click();await until(()=>active().length===0);
 $('#addMatchEvent').click();assert.deepEqual(active(),['addMatchEvent']);$('[data-event-type="Gol"]').click();assert.deepEqual(active(),['addOpponentGoal']);
 eventValue(w,$('#eventPlayer'),'player-1');assert.deepEqual(active(),['addGoal']);
 w.fixtureEventError={message:'Rete interrotta'};$('[data-save-event]').click();await until(()=>$('#eventFeedback').textContent.includes('Rete interrotta'));assert.deepEqual(active(),['addGoal']);
 w.fixtureEventError=null;$('[data-save-event]').click();await until(()=>!$('#eventForm'));assert.deepEqual(active(),[]);
 const own=[...w.document.querySelectorAll('#matchEventList .event-item')].find(e=>e.textContent.includes('Gol')&&!e.textContent.includes('avversaria'));assert.ok(own.querySelector('.b-green'));
});

function dismissalSeed(data){
 data.match_events.push({id:'red-1',user_id:'demo-user',match_id:'match-1',player_id:'player-1',event_type:'Espulsione',minute:30,created_at:'2026-10-01T12:00:00Z'});
 data.matches.push({id:'served-red',user_id:'demo-user',match_date:'2026-10-06',opponent:'Gara successiva',goals_for:0,goals_against:0,minutes_auto:false});
 data.activities.push({id:'served-red-activity',user_id:'demo-user',match_id:'served-red',activity_type:'Partita',activity_date:'2026-10-06',title:'Gara successiva',status:'Concluso',revision:0});
}

test('Discipline integrates red cards without an empty yellow progression and preserves both filters',async t=>{
 const {w,$,clickText}=await app(t,'admin',data=>{
  data.match_events=[];dismissalSeed(data);
  data.match_events.push(...Array.from({length:4},(_,i)=>({id:'yellow-layout-'+i,user_id:'demo-user',match_id:'match-1',player_id:'player-2',event_type:'Ammonizione',minute:i})));
 });
 clickText('Cartellini');await until(()=>$('#disciplineList'));
 const cards=[...w.document.querySelectorAll('.discipline-card')],red=cards.find(c=>c.querySelector('.dismissal-section')),yellow=cards.find(c=>c.querySelector('.discipline-yellows'));
 assert.ok(red);assert.equal(red.querySelector('.discipline-progress'),null);assert.equal(red.querySelector('.discipline-yellows'),null);
 assert.match(red.querySelector('.discipline-totals').textContent,/0Gialli1Rosso/);assert.match(red.querySelector('.dismissal-section').textContent,/Provvedimento da definire/);
 assert.equal(yellow.querySelectorAll('.discipline-progress .filled').length,4);assert.match(yellow.querySelector('.discipline-yellows').textContent,/Diffida/);
 $('[data-discipline-filter=reds]').click();assert.equal(w.document.querySelectorAll('.discipline-card').length,1);assert.equal($('.discipline-totals').children.length,1);assert.ok($('[data-sanction-event="red-1"]'));
 $('[data-discipline-filter=all]').click();assert.equal(w.document.querySelectorAll('.discipline-card').length,2);
});
test('Dismissal decisions retain errors, save the official games, confirm and undo a served match',async t=>{
 const {w,$,clickText}=await app(t,'admin',dismissalSeed);clickText('Cartellini');await until(()=>$('#disciplineList'));
 $('[data-discipline-filter=reds]').click();assert.match($('#disciplineList').textContent,/Provvedimento da definire/);$('[data-sanction-event="red-1"]').click();
 eventValue(w,$('#sanctionGames'),'2');eventValue(w,$('#sanctionNote'),'Comunicato <img src=x>');w.fixtureDismissalError={message:'Rete interrotta'};$('#sanctionForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>$('#sanctionFeedback').textContent.includes('Rete interrotta'));assert.equal($('#sanctionGames').value,'2');
 w.fixtureDismissalError=null;$('#sanctionForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>!$('#sanctionForm'));assert.match($('.dismissal-section').textContent,/2 gare da scontare/);assert.equal($('.dismissal-section img'),null);
 $('[data-dismissal-serve]').click();assert.ok($('#dismissalServedMatch option[value="served-red"]'));assert.equal($('#dismissalServedMatch option[value="match-1"]'),null);eventValue(w,$('#dismissalServedMatch'),'served-red');$('#dismissalServedConfirmed').click();$('#dismissalClearanceForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>!$('#dismissalClearanceForm'));assert.match($('.dismissal-section').textContent,/1 gara da scontare/);
 $('[data-dismissal-undo]').click();await until(()=>$('[data-dismissal-undo]')===null);assert.match($('.dismissal-section').textContent,/2 gare da scontare/);assert.equal(w.fixtureData.dismissal_clearances.length,0);
});
test('Date sanctions are inclusive, can be voided without losing history, and warn in the lineup',async t=>{
 const {w,$,runtime,clickText}=await app(t,'admin',data=>{dismissalSeed(data);data.dismissal_sanctions.push({event_id:'red-1',user_id:'demo-user',player_id:'player-1',match_id:'match-1',kind:'until',match_count:null,suspended_until:'2026-10-20',note:'Comunicato 12',voided:false,revision:1});});
 assert.equal(w.EburumTests.playerDismissals('player-1','2026-10-20')[0].attention,true);assert.equal(w.EburumTests.playerDismissals('player-1','2026-10-21')[0].attention,false);
 $('.sc-match-preview').click();await until(()=>$('#activityForm'));$('[data-activity-tab=roster]').click();assert.match($('.roster-suspension').textContent,/20\/10\/2026/);$('#closeActivity').click();await until(()=>!$('#activityForm'));
 clickText('Cartellini');await until(()=>$('#disciplineList'));$('[data-sanction-event="red-1"]').click();$('#voidSanction').click();await until(()=>!$('#sanctionForm'));assert.match($('.dismissal-section').textContent,/Provvedimento annullato/);assert.equal(w.fixtureData.dismissal_sanctions.length,1);assert.equal(w.fixtureData.match_events.some(e=>e.id==='red-1'),true);
 const corrected={...w.fixtureData.match_events.find(e=>e.id==='red-1'),match_date:'2026-10-01',player_id:'player-2'};assert.equal(w.EburumTests.dismissalState(corrected).label,'Provvedimento da definire');
});
test('Dismissal monitor retains inactive and previous-season cases and exposes unassigned events',async t=>{
 const {w,$,clickText}=await app(t,'secretary',data=>{dismissalSeed(data);data.players[0].active=false;data.matches.push({id:'old-red-match',user_id:'demo-user',match_date:'2026-05-01',opponent:'Stagione precedente'});data.match_events.push({id:'old-red',user_id:'demo-user',match_id:'old-red-match',player_id:'player-2',event_type:'Espulsione',minute:40},{id:'unassigned-red',user_id:'demo-user',match_id:'match-1',player_id:null,event_type:'Espulsione',minute:50});});
 clickText('Cartellini');await until(()=>$('#disciplineList'));$('[data-discipline-filter=reds]').click();assert.equal(w.document.querySelectorAll('.discipline-card').length,2);assert.match($('#disciplineList').textContent,/Inattivo/);assert.match($('#disciplineList').textContent,/Stagione precedente/);assert.equal($('#unassignedDismissals').hidden,false);assert.equal($('[data-sanction-event]'),null);assert.equal($('[data-dismissal-serve]'),null);assert.equal(w.fixtureDismissalCalls.length,0);
});
test('Sanction saves are single-submit and cannot repopulate client data after logout',async t=>{
 const {w,$,clickText}=await app(t,'admin',dismissalSeed);clickText('Cartellini');await until(()=>$('[data-sanction-event="red-1"]'));$('[data-sanction-event="red-1"]').click();eventValue(w,$('#sanctionGames'),'2');
 w.fixtureDismissalGate=new Promise(r=>w.releaseDismissal=r);const form=$('#sanctionForm');form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>w.fixtureDismissalCalls.length===1);assert.equal($('#sanctionGames').matches(":disabled"),true);
 w.EburumTests.renderLogin();w.releaseDismissal();await new Promise(r=>setTimeout(r,30));assert.equal($('#sanctionForm'),null);assert.equal($('.dismissal-section'),null);assert.equal(w.fixtureData.dismissal_sanctions.length,1);
});

test('Date decision saved before a failed reload retries only the read and keeps the date',async t=>{
 const year=new Date().getFullYear()+1,untilDate=`${year}-10-20`;
 const {w,$,clickText}=await app(t,'admin',dismissalSeed);clickText('Cartellini');await until(()=>$('[data-sanction-event="red-1"]'));$('[data-sanction-event="red-1"]').click();
 eventValue(w,$('#sanctionKind'),'until');eventValue(w,$('#sanctionUntil'),untilDate);w.fixtureDismissalReadError={message:'Lettura interrotta'};$('#sanctionForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>$('#sanctionFeedback').textContent.includes('Ricarica dati'));
 assert.equal(w.fixtureData.dismissal_sanctions[0].suspended_until,untilDate);assert.equal($('#sanctionUntil').matches(":disabled"),true);assert.equal(w.fixtureDismissalCalls.length,1);w.fixtureDismissalReadError=null;$('#sanctionForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>!$('#sanctionForm'));assert.equal(w.fixtureDismissalCalls.length,1);assert.ok($('.dismissal-section').textContent.includes(`20/10/${year}`));
});

async function whiteboard(t,role='admin'){
 const ctx=await app(t,role);ctx.w.location.hash='#/whiteboard';await until(()=>[...ctx.w.document.querySelectorAll('button')].some(b=>b.textContent==='Nuova lavagna')||ctx.w.document.body.textContent.includes('Area riservata allo staff tecnico.'));return ctx;
}
test('Whiteboard validates untrusted documents and keeps moved marks in bounds',async t=>{
 const {w}=await app(t);const model=w.EburumTests;
 model.validateBoard(model.emptyBoard());
 const mark={id:'one',kind:'arrow',color:'#ff7b8b',label:'',points:[{x:10,y:20},{x:980,y:620}]};
 const moved=model.moveMark(mark,1000,-1000);assert.equal(moved.points[1].x,1000);assert.equal(moved.points[0].y,0);assert.equal(moved.points[1].x-moved.points[0].x,970);
 for(const document of [{background:'https://example.test/x',marks:[]},{background:'pitch',marks:[{...mark,points:[]}]},{background:'pitch',marks:[{...mark,points:[{x:Infinity,y:0},{x:1,y:1}]}]},{background:'pitch',marks:[mark,mark]},{background:'pitch',marks:Array.from({length:201},(_,i)=>({...mark,id:String(i)}))}])assert.throws(()=>model.validateBoard(document));
});
test('Whiteboard preserves a failed save, retries the same ID and guards unsaved navigation',async t=>{
 const {w,$,clickText}=await whiteboard(t);clickText('Nuova lavagna');await until(()=>$('.wb-editor'));
 reactInput(w,$('.wb-fields input'),'Linea difensiva');await until(()=>$('.wb-fields input').value==='Linea difensiva');
 w.confirm=()=>false;w.location.hash='#/players';await until(()=>w.location.hash==='#/whiteboard');assert.equal($('.wb-fields input').value,'Linea difensiva');
 w.fixtureBoardError={message:'Nessuna connessione'};clickText('Salva lavagna');await until(()=>$('.wb-feedback [role=alert]'));assert.equal($('.wb-fields input').value,'Linea difensiva');assert.ok($('.wb-editor'));
 const id=w.fixtureBoardCalls[0].p_id;w.fixtureBoardError=null;w.fixtureBoardLostReply=true;clickText('Salva lavagna');await until(()=>$('.wb-feedback [role=alert]')?.textContent.includes('persa'));
 clickText('Salva lavagna');await until(()=>$('.wb-feedback [role=status]')?.textContent.includes('salvata'));assert.equal(w.fixtureData.tactical_boards.length,1);assert.equal(w.fixtureData.tactical_boards[0].revision,1);assert.ok(w.fixtureBoardCalls.every(c=>c.p_id===id));
});

test('Portrait whiteboard maps touch coordinates and keeps upright notes inside the field',async t=>{
 const {w}=await app(t);const model=w.EburumTests;
 for(const [x,y] of [[0,0],[1,0],[0,1],[1,1],[.25,.2]]){
  const p=model.boardViewPoint(x,y,true);assert.equal(p.x,y*1000);assert.equal(p.y,(1-x)*640);
 }
 assert.equal(model.boardViewPoint(.25,.2).x,250);assert.equal(model.boardViewPoint(.25,.2).y,128);
 const text='Chiudere la linea di passaggio senza lasciare spazio alle spalle della difesa';
 const note=model.boardNoteLayout(text,true);assert.ok(note.lines.length>1);assert.ok(note.width<640);assert.equal(note.lines.join(' '),text);
 const mark={id:'note',kind:'text',label:text,color:'#ffffff',points:[{x:0,y:0}]};
 for(const delta of [-10000,10000]){
  const p=model.moveMark(mark,delta,delta,true).points[0];
  assert.ok(p.x-note.top>=0);assert.ok(p.x+note.height-note.top<=1000);
  assert.ok(p.y-(note.width-8)>=0);assert.ok(p.y+8<=640);
 }
});

test('Mobile whiteboard draws, moves with screen directions and resizes without rewriting saved coordinates',async t=>{
 const {w,$,clickText}=await app(t);let resize;
 const media={matches:true,addEventListener(type,listener){resize=listener},removeEventListener(){}};
 w.matchMedia=()=>media;w.location.hash='#/whiteboard';await until(()=>[...w.document.querySelectorAll('button')].some(b=>b.textContent==='Nuova lavagna'));clickText('Nuova lavagna');await until(()=>$('.wb-editor'));
 assert.equal($('.wb-settings').open,false);let svg=$('.wb-stage svg');assert.equal(svg.getAttribute('viewBox'),'0 0 640 1000');
 svg.getBoundingClientRect=()=>({left:0,top:0,width:320,height:500});svg.setPointerCapture=()=>{};svg.hasPointerCapture=()=>false;
 const pointer=(target,type,x,y)=>{const event=new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});Object.defineProperty(event,'pointerId',{value:1});target.dispatchEvent(event)};
 clickText('Eburum');await until(()=>$('[aria-pressed=true]')?.textContent==='Eburum');pointer(svg,'pointerdown',80,100);pointer(svg,'pointerup',80,100);await until(()=>$('[data-mark]'));
 clickText('Sposta');await until(()=>svg.dataset.tool==='select');pointer($('[data-mark] circle'),'pointerdown',80,100);pointer(svg,'pointerup',80,100);await until(()=>$('[data-selection]'));
 svg.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
 await until(()=>$('[data-selection]').getAttribute('cy')==='478');clickText('Salva lavagna');await until(()=>w.fixtureData.tactical_boards.length===1);
 const saved=JSON.stringify(w.fixtureData.tactical_boards[0].document);const mark=w.fixtureData.tactical_boards[0].document.marks[0];assert.equal(mark.points[0].x,200);assert.equal(mark.points[0].y,478);
 media.matches=false;resize();await until(()=>svg.getAttribute('viewBox')==='0 0 1000 640');assert.equal($('.wb-settings').open,true);assert.equal(JSON.stringify(w.fixtureData.tactical_boards[0].document),saved);
 assert.match($('.wb-save').textContent,/Tutte le modifiche sono salvate/);
});
test('Whiteboard stale saves retain the draft and cannot silently replace a colleague',async t=>{
 const {w,$,clickText}=await whiteboard(t,'coach');clickText('Nuova lavagna');await until(()=>$('.wb-editor'));clickText('Salva lavagna');await until(()=>w.fixtureData.tactical_boards.length===1&&!!$('button[disabled] svg.lucide-save'));
 await until(()=>$('.wb-feedback [role=status]')?.textContent.includes('salvata'));
 w.fixtureData.tactical_boards[0].revision=2;w.fixtureData.tactical_boards[0].title='Versione collega';
 reactInput(w,$('.wb-fields input'),'La mia analisi');await until(()=>$('.wb-fields input').value==='La mia analisi');clickText('Salva lavagna');await until(()=>$('.wb-feedback [role=alert]')?.textContent.includes('collega'));
 assert.equal($('.wb-fields input').value,'La mia analisi');assert.equal(w.fixtureData.tactical_boards[0].title,'Versione collega');
});
for(const role of ['manager','secretary','president','treasurer'])test('Whiteboard is private to technical staff: '+role,async t=>{
 const {w,$}=await whiteboard(t,role);assert.equal($('.wb-editor'),null);assert.equal($('.wb-page'),null);assert.equal((w.fixtureQueries||[]).filter(q=>q.table==='tactical_boards').length,0);
 w.location.hash='#/more';await until(()=>$('.sc-tool-list'));assert.equal([...w.document.querySelectorAll('.sc-tool-list a')].some(a=>a.textContent.includes('Lavagna tattica')),false);
});

for(const role of ['admin','manager','coach','secretary','technical_assistant','president','treasurer'])test('Priority navbar has one communications destination and keeps roster in tools: '+role,async t=>{
 const {w,runtime,$}=await app(t,role);const paths=[...w.document.querySelectorAll('.app-mobile-nav a')].map(a=>a.getAttribute('href'));
 assert.deepEqual(paths,['president','treasurer'].includes(role)?['#/dashboard','#/communications','#/finance','#/matches','#/more']:['#/dashboard','#/training','#/communications','#/matches','#/more']);
 await runtime.navigate('more');await until(()=>$('.sc-tool-list'));assert.ok($('.sc-tool-list [href="#/players"]'));assert.equal($('.sc-tool-list [href="#/meetings"]'),null);
});
test('Meeting invitations preserve failed drafts and publish the event with explicit read acknowledgement',async t=>{
 const {w,runtime,$,clickText}=await app(t);await runtime.navigate('communications');await until(()=>$('.communication-filters'));clickText('Nuova comunicazione');await until(()=>$('#communication-title'));clickText('Riunione');await until(()=>$('#meeting-date'));
 const next=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
 reactInput(w,$('#communication-title'),'Riunione dello staff');reactInput(w,$('#communication-body'),'Rivediamo la linea difensiva.');reactInput(w,$('#meeting-date'),next);reactInput(w,$('#meeting-time'),'20:30');reactInput(w,$('#meeting-location'),'Sede Eburum');await until(()=>$('#meeting-location').value==='Sede Eburum');
 w.fixtureCommunicationError={message:'Offline'};const form=$('#communication-title').closest('form');form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>form.textContent.includes('Pubblicazione non riuscita'));assert.equal($('#meeting-date').value,next);assert.equal($('#meeting-time').value,'20:30');
 delete w.fixtureCommunicationError;form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>!$('#communication-title'));const m=w.fixtureData.staff_communications.at(-1);assert.equal(m.kind,'meeting');assert.equal(m.requires_ack,true);assert.equal(m.player_id,null);assert.equal(m.meeting_date,next);assert.equal(m.meeting_location,'Sede Eburum');
 assert.match($('.communication-meeting-info').textContent,/20:30/);assert.match($('.native-message').textContent,/Confermo di aver letto/);assert.equal(w.fixtureData.communication_receipts.length,0);
 const filter=$('[aria-label="Filtra comunicazioni"]');[...filter.querySelectorAll('button')].find(b=>b.textContent==='Riunioni').click();await until(()=>$('.native-message h3').textContent==='Riunione dello staff');
});
test('Previous meetings remain reachable inside communications and old routes preserve the new navigation',async t=>{
 const {w,runtime,$}=await app(t,'secretary',data=>data.activities.push({id:'legacy-meeting',user_id:'demo-user',activity_type:'Riunione',title:'Riunione precedente',activity_date:'2026-10-01',start_time:'18:00',status:'Concluso',revision:0}));
 w.location.hash='#/meetings';await until(()=>$('.communication-legacy-meetings'));assert.match($('.communication-legacy-meetings').textContent,/Riunione precedente/);assert.equal($('.app-mobile-nav a[aria-current=page]').getAttribute('href'),'#/communications');
 $('[aria-label="Nuova comunicazione"]').click();await until(()=>$('#communication-title'));assert.equal($('[aria-label="Tipo comunicazione"]'),null);assert.equal($('#meeting-date'),null);runtime.render();
});


test('Design brief home prioritizes the next match and shares document counts with grouped tools',async t=>{
 const next=new Date();next.setDate(next.getDate()+1);const day=next.toLocaleDateString('en-CA');
 const {w,runtime,$}=await app(t,'admin',data=>{
  data.matches.push({id:'next-brief-match',user_id:'demo-user',opponent:'Avversario futuro',match_date:day,venue:'Trasferta',goals_for:null,goals_against:null});
  data.activities.push({id:'next-brief-activity',user_id:'demo-user',activity_type:'Partita',title:'Avversario futuro',activity_date:day,start_time:'15:00',status:'Programmato',match_id:'next-brief-match',revision:0});
 });
 await runtime.navigate('dashboard');await until(()=>$('.sc-home-hero'));
 assert.match($('.sc-home-hero').textContent,/Prossima partita.*Domani.*Avversario futuro/);assert.equal($('[data-home-season]'),null);assert.ok($('.header-settings-panel .app-season select'));assert.equal($('.sc-home-hero button').dataset.openActivity,'next-brief-activity');
 const count=runtime.actions.documentSummary().review;
 assert.match($('.sc-home-tasks').textContent,new RegExp(count+' da verificare'));
 await runtime.navigate('more');await until(()=>$('.tool-group'));
 assert.equal(w.document.querySelectorAll('.tool-group').length,3);
 const documents=[...w.document.querySelectorAll('.sc-tools button')].find(b=>b.textContent.includes('Scadenze e tesseramenti'));assert.match(documents.textContent,new RegExp(String(count)));
 assert.equal(w.document.querySelectorAll('.app-mobile-nav a[aria-current=page]').length,1);
});

test('Home message composer and accessible password visibility retain the existing flows',async t=>{
 const {w,runtime,$}=await app(t);await runtime.navigate('dashboard');await until(()=>$('[href="#/communications?compose=1"]'));$('[href="#/communications?compose=1"]').click();await until(()=>$('#communication-title'));assert.equal(runtime.state.page,'communications');
 w.EburumTests.renderLogin();await until(()=>$('input[name=password]'));
 const password=$('input[name=password]');password.value='Synthetic-secret';$('[aria-label="Mostra password"]').click();await until(()=>password.type==='text');assert.equal(password.type,'text');assert.equal(password.value,'Synthetic-secret');$('[aria-label="Nascondi password"]').click();await until(()=>password.type==='password');assert.equal(password.type,'password');
 [...w.document.querySelectorAll('button')].find(b=>b.textContent==='Password dimenticata?').click();await until(()=>$('.auth-panel').textContent.includes('Gestione utenti → Cambia password'));assert.match($('.auth-panel').textContent,/Gestione utenti → Cambia password/);
});


test('Operational routes preserve player context and close details on Back and section changes',async t=>{
 const {w,$,runtime}=await app(t);
 w.location.hash='#/players';await until(()=>$('.sc-directory'));
 reactInput(w,$('input[type=search]'),'Rossi');await until(()=>$('.sc-directory').textContent.includes('Rossi'));
 $('[aria-label="Scheda di Rossi Marco"]').click();await until(()=>$('#playerSheetTitle'));
 assert.match(w.location.hash,/player=player-1/);
 w.history.back();await until(()=>!$('#playerSheetTitle'));assert.equal($('input[type=search]').value,'Rossi');
 w.history.forward();await until(()=>$('#playerSheetTitle'));
 w.location.hash='#/matches';await until(()=>$('.sc-match-grid')&&!$('#playerSheetTitle'));
 assert.equal(w.document.querySelector('#app').hasAttribute('inert'),false);
 assert.equal(runtime.getSnapshot().page,'matches');
});

test('Operational training creation keeps replies hidden and retains existing time validation',async t=>{
 const {w,$,runtime}=await app(t);await runtime.navigate('training');await until(()=>$('.training-scope'));
 runtime.actions.newTraining();await until(()=>$('#planningForm'));
 assert.equal($('.training-replies'),null);assert.equal($('#savePlanning').textContent,'Crea allenamento');
 assert.equal($('#planningNote').labels[0].textContent,'Indicazioni per l’allenamento');
 eventValue(w,$('#planningStart'),'20:00');
 eventValue(w,$('#planningEnd'),'19:00');
 assert.match($('#planningTimeError').textContent,/successiva/);
 $('#planningForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>$('#planningFeedback').textContent.includes('successiva'));assert.match($('#planningFeedback').textContent,/successiva/);assert.equal(w.fixtureTeamCalls.length,0);
});

test('Operational direct player URL opens after initial data load and pristine close needs no confirmation',async t=>{
 const {w,$}=await app(t);let confirms=0;w.confirm=()=>{confirms++;return true};
 w.location.hash='#/players?player=player-1';await until(()=>$('#playerSheetTitle'));
 assert.match($('#playerSheetTitle').textContent,/Rossi Marco/);
 $('[aria-label="Chiudi scheda"]').click();await until(()=>!$('#playerSheetTitle')&&!w.location.hash.includes('player='));
 assert.equal(confirms,0);assert.doesNotMatch(w.location.hash,/player=/);
});

test('Operational login validates fields in Italian before making an authentication request',async t=>{
 const {w,runtime,$}=await app(t);runtime.db.auth.getUser=async()=>({data:{user:null},error:null});await runtime.start();await until(()=>$('input[name=email]'));
 let calls=0;runtime.db.auth.signInWithPassword=async()=>{calls++;return {error:null}};
 $('input[name=email]').closest('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>$('input[name=email]').getAttribute('aria-invalid')==='true');
 assert.equal(calls,0);assert.match(w.document.body.textContent,/Inserisci.*email/i);assert.equal(w.document.activeElement,$('input[name=email]'));
});

test('Operational future match opens a compact role-grouped roster and filters empty role headings',async t=>{
 const day=new Date(Date.now()+86400000).toISOString().slice(0,10);
 const {w,runtime,$}=await app(t,'admin',data=>{data.matches[0].match_date=day;data.matches[0].goals_for=null;data.matches[0].goals_against=null;data.activities.find(a=>a.match_id==='match-1').activity_date=day;data.activity_roster.push({id:'called-operational',user_id:'demo-user',activity_id:data.activities.find(a=>a.match_id==='match-1').id,player_id:'player-1',called:true,lineup:'Non impiegato',minutes_played:0});});
 runtime.actions.openMatch(runtime.state.matches[0]);await until(()=>$('#activityRoster .roster-role'));
 assert.equal($('[data-activity-panel=roster]').hidden,false);assert.match($('#activityRoster').textContent,/Convocato/);
 $('[data-roster-filter=called]').click();assert.ok([...w.document.querySelectorAll('.roster-person')].filter(n=>!n.hidden).length>0);
});

test('Operational pristine whiteboard has one creation action and closes without losing a draft',async t=>{
 const {w,$}=await whiteboard(t);assert.equal([...w.document.querySelectorAll('button')].filter(b=>b.textContent==='Nuova lavagna').length,1);
 [...w.document.querySelectorAll('button')].find(b=>b.textContent==='Nuova lavagna').click();await until(()=>$('.wb-editor'));
 let confirms=0;w.confirm=()=>{confirms++;return false};$('[aria-label="Chiudi lavagna"]').click();await until(()=>!$('.wb-editor'));assert.equal(confirms,0);
});

test('Operational Register correction asks before leaving changed attendance and restores date context',async t=>{
 const {w,runtime,$}=await app(t);w.location.hash='#/register?date=2026-10-06&month=2026-10';await until(()=>$('[data-edit-session="session-1"]'));
 $('[data-edit-session="session-1"]').click();await until(()=>$('#trainList'));
 $('[data-presence-player="player-1"][data-presence="Assente"]').click();let prompts=0;w.confirm=()=>{prompts++;return false};
 $('#backToTrainings').click();assert.ok($('#trainList'));assert.equal(prompts,1);
 w.confirm=()=>true;$('#backToTrainings').click();await until(()=>$('#calendarGrid')&&w.location.hash.includes('date=2026-10-06'));
 assert.equal(runtime.state.registerDate,'2026-10-06');assert.equal(runtime.state.registerMonth,'2026-10');assert.match(w.location.hash,/date=2026-10-06/);
});

test('Operational browser Back closes pristine attendance but protects changed attendance on the same route',async t=>{
 const {w,runtime,$}=await app(t);w.location.hash='#/training';await until(()=>$('.training-scope'));
 w.location.hash='#/training?session=session-1';await until(()=>w.location.hash.includes('session=')&&$('#trainList'));
 w.history.back();await until(()=>$('.training-scope')&&!$('#trainList'));
 w.location.hash='#/training?session=session-1';await until(()=>w.location.hash.includes('session=')&&$('#trainList'));
 $('[data-presence-player="player-1"][data-presence="Assente"]').click();w.confirm=()=>false;w.history.back();await until(()=>w.location.hash.includes('session='));assert.ok($('#trainList'));
});

test('Operational report drills keep four observed dates newest-first across players and period changes',async t=>{
 const dates=['2026-10-01','2026-10-08','2026-09-30','2026-10-06'];
 const {w,runtime,$}=await app(t,'admin',data=>{
  data.sessions=dates.map((day,i)=>({id:'chronology-session-'+i,user_id:'demo-user',session_date:day,session_type:'Allenamento'}));
  data.attendance=dates.flatMap((day,i)=>['player-1','player-2'].map(player_id=>({id:'chronology-attendance-'+i+player_id,user_id:'demo-user',session_id:'chronology-session-'+i,player_id,status:'Presente',delay_minutes:0})));
  data.matches=dates.map((day,i)=>({id:'chronology-match-'+i,user_id:'demo-user',match_date:day,opponent:'Avversario '+i,venue:'Casa',goals_for:2,goals_against:0}));
  data.activities=data.matches.map((m,i)=>({id:'chronology-activity-'+i,user_id:'demo-user',match_id:m.id,activity_type:'Partita',activity_date:m.match_date,title:m.opponent,status:'Concluso',revision:0}));
  data.activity_roster=data.activities.flatMap((a,i)=>['player-1','player-2'].map(player_id=>({id:'chronology-roster-'+i+player_id,user_id:'demo-user',activity_id:a.id,player_id,called:true,lineup:'Titolare',minutes_played:90})));
  data.match_events=data.matches.flatMap((m,i)=>['player-1','player-2'].map(player_id=>({id:'chronology-goal-'+i+player_id,user_id:'demo-user',match_id:m.id,player_id,event_type:'Gol',minute:10,created_at:m.match_date+'T12:00:00Z'})));
 });
 await runtime.navigate('reports');await until(()=>$('#rp'));
 const choose=async id=>{$('#rp').value=id;$('#rp').dispatchEvent(new w.Event('change',{bubbles:true}));await until(()=>new URLSearchParams(w.location.hash.split('?')[1]).get('player')===id&&runtime.state.reportView?.player===id&&!$('#reportLoading')&&$('[data-report-detail=present] b')?.textContent==='4')};
 const expectDates=async(key,expected)=>{
  $('[data-report-detail="'+key+'"]').click();await until(()=>$('#reportDetailTitle'));
  const modal=$('#reportDetailTitle').closest('.modal'),observed=[...modal.querySelectorAll('.list article b')].map(n=>n.textContent.slice(0,10));assert.deepEqual(observed,expected);
  if(['called','minutes','goals'].includes(key))assert.equal(modal.querySelectorAll('[data-drill-match]').length,expected.length);
  $('[aria-label="Chiudi dettagli report"]').click();await until(()=>!$('#reportDetailTitle')&&!w.location.hash.includes('detail='));
 };
 for(const player of ['player-1','player-2']){await choose(player);for(const key of ['present','called','minutes','goals'])await expectDates(key,['08/10/2026','06/10/2026','01/10/2026','30/09/2026']);}
 eventValue(w,$('#rf'),'2026-10-02');await until(()=>new URLSearchParams(w.location.hash.split('?')[1]).get('from')==='2026-10-02');eventValue(w,$('#rt'),'2026-10-09');await until(()=>!$('#reportLoading')&&$('[data-report-detail=present] b')?.textContent==='2');await expectDates('present',['08/10/2026','06/10/2026']);assert.equal($('#rp').value,'player-2');
});

test('Control audit match tabs have one tab stop and preserve keyboard selection with unsaved events',async t=>{
 const {w,runtime,$}=await app(t);runtime.actions.openMatch(runtime.state.matches[0]);await until(()=>$('#activityForm'));
 const tabs=()=>[...w.document.querySelectorAll('[data-activity-tab]')];assert.equal(tabs().filter(n=>n.tabIndex===0).length,1);
 const selected=()=>$('[data-activity-tab][aria-selected=true]');selected().focus();selected().dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(selected().dataset.activityTab,'roster');const panel=w.document.getElementById(selected().getAttribute('aria-controls'));assert.equal(panel.getAttribute('role'),'tabpanel');assert.equal(panel.getAttribute('aria-labelledby'),selected().id);assert.equal(w.document.activeElement,selected());assert.equal(tabs().filter(n=>n.tabIndex===0).length,1);
 selected().dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(selected().dataset.activityTab,'results');$('#addGoal').click();await until(()=>$('#eventForm'));eventValue(w,$('#eventMinute'),'20');selected().focus();selected().dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(selected().dataset.activityTab,'results');assert.equal(tabs().filter(n=>n.tabIndex===0).length,1);
});

test('Control audit shares close icons without losing accessible names or close handlers',async t=>{
 const {w,runtime,$}=await app(t);runtime.actions.playerSheet('player-1');await until(()=>$('#playerSheetTitle'));const close=$('[aria-label="Chiudi scheda"]');assert.ok(close.querySelector('svg[aria-hidden="true"]'));assert.equal(close.textContent.trim(),'');close.click();await until(()=>!$('#playerSheetTitle'));assert.equal(w.document.querySelector('#app').hasAttribute('inert'),false);
 runtime.actions.users();await until(()=>$('#closeUsers'));assert.ok($('#closeUsers svg'));assert.equal($('#closeUsers').getAttribute('aria-label'),'Chiudi');$('#closeUsers').click();await until(()=>!$('#usersTitle'));
});


test('Navigation motion ignores unrelated class changes but discovers new bars',async t=>{
 const {w}=await app(t);await new Promise(resolve=>setTimeout(resolve,60));
 let frames=0;const raf=w.requestAnimationFrame.bind(w);w.requestAnimationFrame=callback=>{frames++;return raf(callback)};
 const unrelated=w.document.createElement('div');w.document.body.append(unrelated);unrelated.className='changed';await new Promise(resolve=>setTimeout(resolve,35));assert.equal(frames,0);
 const bar=w.document.createElement('div');bar.className='sc-segmented';bar.getBoundingClientRect=()=>({width:200,height:48,left:0,top:0,right:200,bottom:48});bar.innerHTML='<button aria-pressed="true">Uno</button><button aria-pressed="false">Due</button>';w.document.body.append(bar);await new Promise(resolve=>setTimeout(resolve,35));assert.ok(frames>0);
 frames=0;bar.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent==='Due')));await new Promise(resolve=>setTimeout(resolve,35));assert.ok(frames>0);bar.remove();
});


test('Player activation updates the authoritative row without reloading sporting history',async t=>{
 const {w,runtime}=await app(t);const attendance=runtime.state.attendance,events=runtime.state.events;
 w.fixtureQueries=[];await runtime.actions.setPlayerActive(runtime.state.players.find(p=>p.id==='player-1'),false);
 assert.equal(runtime.state.players.find(p=>p.id==='player-1').active,false);
 assert.equal(runtime.state.attendance,attendance);assert.equal(runtime.state.events,events);
 assert.deepEqual([...w.fixtureQueries].map(q=>q.table),['players']);
 await runtime.actions.setPlayerActive(runtime.state.players.find(p=>p.id==='player-1'),true);assert.equal(runtime.state.players.find(p=>p.id==='player-1').active,true);
});


test('React actual attendance saves only after full review and preserves the complete draft on retry',async t=>{
 const {w,runtime,$}=await app(t,'admin',data=>data.activities.push({id:'react-actual',user_id:'demo-user',activity_type:'Allenamento',title:'Allenamento',activity_date:'2026-10-02',status:'Programmato',revision:0}));
 await runtime.actions.openActivity('react-actual');await until(()=>$('#planningForm'));$('[data-training-phase=actual]').click();$('#planningAttendance').click();await until(()=>$('#trainList'));
 const before=w.fixtureData.attendance.length;assert.equal(runtime.state.trainingDraft.entries.get('player-1').status,'Presente');assert.equal(runtime.state.trainingDraft.entries.get('player-2').status,'Presente');assert.equal(runtime.state.trainingDraft.session.attendance_mode,'absence_notice');assert.equal(w.fixtureData.attendance.length,before);
 $('[data-presence-player="player-2"][data-presence="Assente"]').click();$('#saveTraining').click();await until(()=>$('#reviewTitle'));w.fixtureSaveError={message:'Errore rete'};$('#confirmTraining').click();$('#confirmTraining').click();await until(()=>$('#reviewStatus').textContent.includes('Errore rete'));assert.ok(runtime.state.trainingDraft);assert.equal(w.fixtureData.attendance.length,before);w.fixtureSaveError=null;$('#confirmTraining').click();await until(()=>!$('#reviewTitle')&&runtime.state.page==='register');assert.equal(runtime.state.trainingDraft,null);assert.equal(w.fixtureRpcCalls.at(-1).p_attendance.length,2);assert.equal(w.fixtureRpcCalls.at(-1).p_activity_id,'react-actual');
});
test('React attendance conflicts require reopening the Register and never replay a stale revision',async t=>{
 const {w,runtime,$}=await app(t);w.location.hash='#/training?session=session-1';await until(()=>$('#trainList'));$('[data-presence-player="player-1"][data-presence="Assente"]').click();$('#saveTraining').click();await until(()=>$('#confirmTraining'));
 const rpc=runtime.db.rpc;let writes=0;runtime.db.rpc=async(name,params)=>{if(name==='save_attendance_session'){writes++;return {data:null,error:{code:'PT409',message:'Sessione modificata da un collega'}}}return rpc(name,params)};
 $('#confirmTraining').click();await until(()=>$('#confirmTraining').textContent==='Riapri dal Registro');$('#confirmTraining').click();await until(()=>runtime.state.page==='register'&&!$('#reviewTitle'));assert.equal(writes,1);assert.ok(runtime.state.trainingDraft);assert.equal(runtime.state.trainingDraft.entries.get('player-1').status,'Assente');
});
test('React event deletion rejects double clicks and a session changed during confirmation',async t=>{
 const {w,runtime,$}=await app(t);$('.sc-match-preview').click();await until(()=>$('[data-unified-event]'));$('[data-unified-event]').click();await until(()=>$('#deleteEvent'));let release,count=0;w.EburumTests.setConfirmationPresenter(()=>{count++;return new Promise(resolve=>release=resolve)});const before=JSON.stringify(w.fixtureData.match_events);$('#deleteEvent').click();$('#deleteEvent').click();assert.equal(count,1);assert.equal($('#deleteEvent').matches(':disabled'),true);runtime.state.user=null;release(true);await new Promise(resolve=>setTimeout(resolve,20));assert.equal(JSON.stringify(w.fixtureData.match_events),before);
});
test('React substitution preview validates the timeline and automatic minutes stay read-only',async t=>{
 const {w,$}=await app(t,'admin',data=>{data.matches[0].minutes_auto=true;data.matches[0].duration_minutes=90;data.activity_roster=[{id:'starter',user_id:'demo-user',activity_id:'activity-1',player_id:'player-1',called:true,lineup:'Titolare',minutes_played:90},{id:'bench',user_id:'demo-user',activity_id:'activity-1',player_id:'player-2',called:true,lineup:'Panchina',minutes_played:0}];});
 $('.sc-match-preview').click();await until(()=>$('#addSubstitution'));$('#addSubstitution').click();eventValue(w,$('#eventMinute'),'65');eventValue(w,$('#eventOutgoing'),'player-1');eventValue(w,$('#eventPlayer'),'player-2');assert.match($('#substitutionMinutesPreview').textContent,/65′.*25′/);$('#close').click();await until(()=>!$('#eventForm'));$('[data-activity-tab=roster]').click();$('[data-roster-edit="player-1"]').click();await until(()=>$('#rosterMinutes'));assert.equal($('#rosterMinutes').readOnly,true);
});
test('React historical training shows saved attendance without inventing survey responses',async t=>{
 const {w,runtime,$}=await app(t,'admin',data=>data.activities.push({id:'historic-react',user_id:'demo-user',activity_type:'Allenamento',title:'Allenamento storico',activity_date:'2026-10-06',session_id:'session-1',status:'Concluso',revision:0}));await runtime.actions.openActivity('historic-react');await until(()=>$('.training-confirmed-summary'));assert.equal($('#planningForm').hidden,true);assert.match($('.training-actual-description').textContent,/Registro salvato/);assert.equal($('[aria-label="Assenti: 1"]').getAttribute('aria-pressed'),'true');assert.equal($('.training-attendance-names li').textContent,'Bianchi Luca');$('[aria-label="Presenti: 1"]').click();assert.equal($('.training-attendance-names li').textContent,'Rossi Marco');$('[aria-label="Infortunati: 0"]').click();assert.match($('.training-attendance-empty').textContent,/Nessun infortunato/);assert.equal(w.fixtureRpcCalls.length,0);
});


test('React event deletion retries only the timeline read after a committed delete',async t=>{
 const {w,$}=await app(t);$('.sc-match-preview').click();await until(()=>$('[data-unified-event]'));$('[data-unified-event]').click();await until(()=>$('#deleteEvent'));w.eval("const previousDeleteRead=FixtureQuery.prototype.result;FixtureQuery.prototype.result=async function(){if(this.table==='matches'&&window.failDeleteReload)return {data:null,error:{message:'Rete interrotta'}};return previousDeleteRead.call(this)}");w.fixtureQueries=[];w.failDeleteReload=true;$('#deleteEvent').click();await until(()=>$('#eventFeedback').textContent.includes('Evento eliminato'));assert.equal($('#deleteEvent').matches(':disabled'),true);assert.equal(w.fixtureQueries.filter(q=>q.table==='match_events'&&q.action==='delete').length,1);w.failDeleteReload=false;$('[data-save-event]').click();await until(()=>!$('#eventForm'));assert.equal(w.fixtureQueries.filter(q=>q.table==='match_events'&&q.action==='delete').length,1);
});
test('React yellow clearance undo confirms once and refuses a changed account',async t=>{
 const {w,runtime,$,clickText}=await app(t,'admin',data=>{data.matches.push({id:'served-guard',user_id:'demo-user',match_date:'2026-10-02',opponent:'Gara scontata',goals_for:0,goals_against:0});data.disciplinary_clearances.push({id:'clear-guard',user_id:'demo-user',player_id:'player-1',season_start:'2026-07-01',threshold_event_id:'yellow-4',served_match_id:'served-guard'});});clickText('Cartellini');await until(()=>$('[data-undo-clearance]'));let release,count=0;w.EburumTests.setConfirmationPresenter(()=>{count++;return new Promise(resolve=>release=resolve)});$('[data-undo-clearance]').click();$('[data-undo-clearance]').click();assert.equal(count,1);assert.equal($('[data-undo-clearance]').matches(':disabled'),true);runtime.state.user=null;release(true);await new Promise(resolve=>setTimeout(resolve,20));assert.equal(w.fixtureData.disciplinary_clearances.length,1);
});

test('React team report retries historical reads and rejects a late result from a previous period',async t=>{
 const {w,runtime,$,clickText}=await app(t,'admin',data=>{data.players[1].active=false});let failing=true,release,held=false;
 const original=runtime.db.from.bind(runtime.db);runtime.db.from=table=>{const query=original(table),then=query.then.bind(query);query.then=(resolve,reject)=>{if(table==='sessions'&&failing)return Promise.resolve({data:null,error:{message:'Storico offline'}}).then(resolve,reject);if(table==='sessions'&&held)return new Promise(done=>release=done).then(()=>then(resolve,reject));return then(resolve,reject)};return query};
 w.location.hash='#/reports?view=team&period=custom&from=2025-01-01&to=2026-10-31';await until(()=>$('#teamReportError')?.textContent.includes('Storico offline'));assert.equal($('[data-team-player]'),null);assert.equal([...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('Esporta Excel')).disabled,true);
 failing=false;clickText('Riprova');await until(()=>$('[data-team-player="player-1"]'));assert.match($('[data-team-player="player-2"]').textContent,/Inattivo/);
 held=true;w.location.hash='#/reports?view=team&period=custom&from=2024-01-01&to=2026-10-31';await until(()=>release);w.location.hash='#/reports?view=team&period=season';await until(()=>$('[data-team-player="player-1"]'));held=false;release();await new Promise(resolve=>setTimeout(resolve,20));assert.equal($('#teamReportPeriod').value,'season');assert.match($('.team-report-period').textContent,/01\/07\/2026/);assert.equal($('#teamReportError').textContent,'');assert.equal(w.fixtureRpcCalls.length,0);
 eventValue(w,$('#teamReportPeriod'),'custom');await until(()=>$('#teamReportFrom'));eventValue(w,$('#teamReportFrom'),'2026-10-01');eventValue(w,$('#teamReportTo'),'2026-10-12');await until(()=>w.location.hash.includes('from=2026-10-01')&&w.location.hash.includes('to=2026-10-12'));await until(()=>$('#teamReportFrom').value==='2026-10-01'&&$('#teamReportTo').value==='2026-10-12');
});

for(const origin of ['dashboard','training','register'])for(const saved of [false,true])test(`Attendance transition from ${origin} keeps the actual editor after history settles (${saved?'correction':'new'})`,async t=>{
 const {w,runtime,$}=await app(t,'admin',data=>data.activities.push({id:'attendance-route',user_id:'demo-user',activity_type:'Allenamento',title:'Presenze navigazione',activity_date:saved?'2026-10-06':'2026-10-02',status:saved?'Concluso':'Programmato',session_id:saved?'session-1':null,revision:0}));
 await runtime.navigate(origin);await until(()=>w.location.hash==='#/'+origin);await runtime.actions.openActivity('attendance-route');await until(()=>$('#planningAttendance'));$('[data-training-phase=actual]').click();$('#planningAttendance').click();
 const expected=saved?'#/training?session=session-1':'#/training';await until(()=>$('#trainList')&&w.location.hash===expected);await new Promise(resolve=>setTimeout(resolve,30));assert.ok($('#trainList'),'The activity close must not navigate back to the originating page');assert.equal(w.location.hash,expected);assert.equal($('#planningAttendance'),null);
 $('[data-presence-player="player-1"][data-presence="Assente"]').click();w.confirm=()=>false;assert.equal(await runtime.navigate('players'),false);assert.ok($('#trainList'));assert.equal(w.fixtureRpcCalls.length,0);
});

test('Unsaved training replies show the reason attendance cannot start without leaving the activity',async t=>{
 const {w,runtime,$}=await app(t,'admin',data=>data.activities.push({id:'attendance-unsaved',user_id:'demo-user',activity_type:'Allenamento',title:'Presenze da verificare',activity_date:'2026-10-02',status:'Programmato',revision:0}));await runtime.navigate('dashboard');await until(()=>w.location.hash==='#/dashboard');await runtime.actions.openActivity('attendance-unsaved');await until(()=>$('#planningAttendance'));$('[data-training-player="player-1"][data-training-reply="Indisponibile"]').click();$('[data-training-phase=actual]').click();$('#planningAttendance').click();
 assert.match($('#planningActualError').textContent,/Salva le modifiche e le assenze/);assert.equal($('#planningActualError').hidden,false);assert.equal($('#trainList'),null);assert.ok($('#planningAttendance'));assert.equal(w.fixtureRpcCalls.length,0);
});


test('targeted session reload updates the open player report without a whole-team read',async t=>{
 const {w,runtime,$}=await app(t);w.location.hash='#/reports?player=player-1&period=season';
 await until(()=>$('[data-report-detail=present] b')?.textContent==='1');
 w.fixtureQueries=[];w.fixtureData.attendance.find(r=>r.player_id==='player-1').status='Assente';
 assert.equal(await runtime.actions.reloadAffected({kind:'session',id:'session-1'}),true);
 await until(()=>$('[data-report-detail=present] b')?.textContent==='0');
 assert.equal($('[data-report-detail=absent] b').textContent,'1');
 assert.ok(!w.fixtureQueries.some(q=>['players','player_administration','staff_communications'].includes(q.table)));
});

test('a failed targeted read after player creation offers reload without replaying the insert',async t=>{
 const {w,runtime,$}=await app(t);runtime.actions.editPlayer();await until(()=>$('#ps'));
 reactInput(w,$('#ps'),'Nuovo');reactInput(w,$('#pn'),'Giocatore');
 const from=runtime.db.from;let inserted=0,failed=false;
 runtime.db.from=table=>{const q=from(table);if(table==='players'){
  const insert=q.insert.bind(q);q.insert=values=>{inserted++;return insert(values)};
  const range=q.range.bind(q);q.range=(...args)=>{if(!failed){failed=true;return Promise.resolve({data:null,error:{message:'Lettura offline'}})}return range(...args)};
 }return q};
 $('#save').click();await until(()=>runtime.getSnapshot().status==='error');
 assert.equal(inserted,1);assert.equal(w.fixtureData.players.filter(p=>p.surname==='Nuovo').length,1);
 await runtime.actions.reload();await until(()=>runtime.getSnapshot().status==='ready');
 assert.equal(inserted,1);assert.equal(runtime.state.players.filter(p=>p.surname==='Nuovo').length,1);
});


test('absence notices save optional reasons, can be withdrawn and seed only an unsaved attendance draft',async t=>{
 const {w,runtime,$}=await app(t,'admin',data=>data.activities.push({id:'absence-workflow',user_id:'demo-user',activity_type:'Allenamento',title:'Allenamento',activity_date:'2026-10-02',status:'Programmato',revision:0}));
 await runtime.actions.openActivity('absence-workflow');await until(()=>$('#planningForm'));
 assert.equal(w.document.querySelectorAll('[data-training-reply="In attesa"]').length,0);
 assert.equal($('#savePlanning').disabled,true);assert.equal($('#planningReplySummary').children.length,2);
 $('[data-training-player="player-1"][data-training-reply="Indisponibile"]').click();reactInput(w,$('#absence-player-1'),'Lavoro');
 assert.equal($('#planningChanges').textContent,'1');
 $('[data-training-player="player-1"][data-training-reply="Disponibile"]').click();assert.equal($('#absence-player-1'),null);assert.equal($('#savePlanning').disabled,true);
 $('[data-training-player="player-1"][data-training-reply="Indisponibile"]').click();reactInput(w,$('#absence-player-1'),'Lavoro');$('#savePlanning').click();
 await until(()=>$('#savePlanning').disabled&&$('#planningChanges').hidden);
 const row=w.fixtureData.activity_roster.find(r=>r.activity_id==='absence-workflow'&&r.player_id==='player-1');assert.equal(row.response_note,'Lavoro');assert.equal(row.availability,'Indisponibile');
 const before=w.fixtureData.attendance.length;$('[data-training-phase=actual]').click();$('#planningAttendance').click();await until(()=>$('#trainList'));
 const draft=runtime.state.trainingDraft;assert.equal(draft.entries.get('player-1').status,'Assente');assert.equal(draft.entries.get('player-1').note,'Lavoro');assert.equal(draft.entries.get('player-2').status,'Presente');assert.equal(draft.session.attendance_mode,'absence_notice');
 assert.ok([...draft.entries.values()].every(r=>r.notified===null));assert.equal(w.fixtureData.attendance.length,before);
});

test('historical surveys remain read-only and corrections keep their original method',async t=>{
 const {w,runtime,$}=await app(t,'admin',data=>{
  data.activities.push({id:'old-poll',user_id:'demo-user',activity_type:'Allenamento',title:'Vecchio sondaggio',activity_date:'2026-10-06',session_id:'session-1',status:'Concluso',revision:0});
  data.activity_roster.push({activity_id:'old-poll',user_id:'demo-user',player_id:'player-1',availability:'In attesa'});
 });
 const before=JSON.stringify(w.fixtureData.attendance);await runtime.actions.openActivity('old-poll');await until(()=>$('#planningForm'));
 $('[data-training-phase=replies]').click();assert.match($('#planningForm').textContent,/metodo precedente/);
 assert.ok([...w.document.querySelectorAll('[data-training-reply]')].every(b=>b.disabled));
 $('[data-training-phase=actual]').click();$('#planningAttendance').click();await until(()=>$('#trainList'));
 assert.equal(runtime.state.trainingDraft.session.attendance_mode,'poll');assert.equal(JSON.stringify(w.fixtureData.attendance),before);
});
