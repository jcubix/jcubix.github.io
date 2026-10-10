import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "../../src/app";
import { createRuntime } from "../../src/runtime";

export async function mount() {
  const runtime = await createRuntime();
  const root = createRoot(document.getElementById("app")!);
  root.render(
    <HashRouter>
      <App runtime={runtime} />
    </HashRouter>,
  );
  await runtime.start();
  return { runtime, unmount: () => root.unmount() };
}
