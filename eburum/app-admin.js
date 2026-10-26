import {db,isAdmin} from './app-part1.js';import {ui} from './src/ui-service.ts';

async function adminRequest(body) {
  const { data, error } = await db.functions.invoke("manage-users", { body });
  if (error) {
    let message =
      "Servizio non raggiungibile. Controlla la connessione e riprova.";
    try {
      const context =
        typeof error.context?.clone === "function"
          ? error.context.clone()
          : error.context;
      const detail = await context.json();
      message = detail.error || message;
    } catch {}
    throw new Error(message);
  }
  if (!data || typeof data !== "object")
    throw new Error("Risposta del servizio non valida. Riprova.");
  if (data.error) throw new Error(data.error);
  return data;
}

function usersModal(){if(isAdmin())return ui.open('users',{}, {page:'more',detail:'tool:users'})} export {usersModal};
export { adminRequest };
