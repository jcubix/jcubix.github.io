import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "../../src/app";
import { createRuntime } from "../../src/runtime";
import { setConfirmationPresenter } from "../../app-confirm.js";
export { parseCents, validateReceipt, financeApi, exportCsv, exportFinancePdf } from "../../src/finance-api";

export async function mount({confirmations="native"}:{confirmations?:"native"|"react"}={}) {
  const runtime = await createRuntime();
  const root = createRoot(document.getElementById("app")!);
  flushSync(()=>root.render(
    <HashRouter useTransitions={false}>
      <App runtime={runtime} />
    </HashRouter>,
  ));
  await runtime.start();
  flushSync(()=>{});
  if(confirmations==="native")setConfirmationPresenter(({message}: {message:string})=>window.confirm(message));
  return { runtime, unmount: () => root.unmount() };
}
export { renderLogin } from "../../app-part1.js";

export { ensureJsPdf } from "../../app-pdf-loader.js";
export { playerDismissals, dismissalState, dismissalAlert } from "../../app-dismissals.js";
export { validateBoard, moveMark, emptyBoard, boardViewPoint, boardNoteLayout } from "../../src/whiteboard-model";

export { setConfirmationPresenter } from "../../app-confirm.js";

export {flushSync} from "react-dom";
