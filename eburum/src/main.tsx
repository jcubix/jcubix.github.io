import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./app";
import { createRuntime } from "./runtime";
import "./styles.css";
import "./soft-club.css";
import "./soft-club-reference.css";

import { initializeTheme } from "./theme";
import "./dark-theme.css";
import "./design-system.css";
initializeTheme();

async function start() {
  const root = createRoot(document.getElementById("app")!);
  try {
    const runtime = await createRuntime();
    root.render(
      <HashRouter>
        <App runtime={runtime} />
      </HashRouter>,
    );
    await runtime.start();
  } catch {
    root.render(
      <main className="startup-error">
        <h1>Eburum non è stato caricato</h1>
        <p>Verifica la connessione e riprova.</p>
        <button onClick={() => window.location.reload()}>Riprova</button>
      </main>,
    );
  }
}
void start();
