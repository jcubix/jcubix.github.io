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
  t.after(() => {
    mounted?.unmount();
    w.close();
    assert.deepEqual(errors, [], "Unhandled React errors");
  });
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
  await until(() => w.document.querySelector(".match-list"));
  return {
    w,
    runtime: mounted.runtime,
    $: (selector) => w.document.querySelector(selector),
    clickText: (text) => {
      const button = [...w.document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === text,
      );
      assert.ok(button, "Missing button: " + text);
      button.click();
    },
  };
}

test("React match and tools buttons show saved yellows, history and suspension controls", async (t) => {
  const { w, runtime, $, clickText } = await app(t);
  clickText("Cartellini e diffide");
  await until(() => $("#disciplineList"));
  assert.equal(w.document.querySelectorAll(".discipline-card").length, 2);
  assert.match($("#disciplineList").textContent, /5 gialli/);
  assert.match($("#disciplineList").textContent, /1 gialli/);
  assert.equal(w.document.querySelectorAll(".discipline-event").length, 6);
  assert.ok($("[data-clearance-event]"));
  $('[aria-label="Chiudi cartellini"]').click();
  runtime.navigate("more");
  await until(() => $(".native-tool-list"));
  const toolsButton = [
    ...w.document.querySelectorAll(".native-tool-list button"),
  ].find((b) => b.textContent.includes("Cartellini e diffide"));
  toolsButton.click();
  await until(() => $("#disciplineList"));
  assert.equal(w.document.querySelectorAll(".discipline-event").length, 6);
  assert.equal(w.fixtureData.match_events.length, 6);
});

test("React secretary can inspect saved discipline and cannot confirm a suspension", async (t) => {
  const { w, $, clickText } = await app(t, "secretary");
  clickText("Cartellini e diffide");
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
  await runtime.actions.changeSeason(2025);
  assert.equal(runtime.actions.playerDiscipline("player-1").total, 1);
  await runtime.actions.changeSeason(2026);
  assert.equal(runtime.actions.playerDiscipline("player-1").total, 5);
  runtime.navigate("reports");
  await until(() => $("#reportContent"));
  $("#rp").value = "player-1";
  $("#rp").dispatchEvent(new w.Event("change"));
  clickText("Tutto lo storico");
  await until(() => $("#report").textContent.includes("Cartellini: 6"));
  assert.equal(w.fixtureData.match_events.length, 7);
  assert.equal(w.fixtureData.matches.length, 2);
});

test("React attendance drafts survive page navigation and require consent before logout", async (t) => {
  const { w, runtime, $ } = await app(t);
  runtime.navigate("training");
  runtime.state.trainingMode = "actual";
  runtime.render();
  await until(() => $("#trainList"));
  $('[data-presence-player="player-1"][data-presence="Presente"]').click();
  assert.equal(runtime.actions.hasAttendanceDraft(), true);
  const draft = runtime.state.trainingDraft;
  runtime.navigate("players");
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
    runtime.navigate("players");
    await until(() => $(".native-player"));
    assert.equal(text().includes("Giocatore"), manage);
    runtime.navigate("training");
    await until(() => $("#trainingHubList"));
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
  runtime.navigate("communications");
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
  assert.equal(runtime.navigate("training"), false);
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
