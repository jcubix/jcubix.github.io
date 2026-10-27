import { canTechnicalRole } from "../app-roles.ts";
import type { Runtime } from "./types";
import {
  validateBoard,
  type Board,
  type BoardDocument,
  type BoardSummary,
} from "./whiteboard-model";

export function whiteboardApi(runtime: Runtime) {
  const owner = runtime.state.team?.owner_id,
    role = runtime.state.team?.role;
  const current = runtime.requestGuard();
  const guard = () => {
    if (
      !current() ||
      runtime.state.team?.owner_id !== owner ||
      runtime.state.team?.role !== role ||
      !canTechnicalRole(role || "")
    )
      throw Error("Sessione o permessi cambiati. Riapri la lavagna.");
  };
  return {
    current,
    async list(offset: number) {
      guard();
      const { data, error } = await runtime.db
        .from("tactical_boards")
        .select("id,title,activity_id,revision,updated_at")
        .eq("user_id", owner!)
        .order("updated_at", { ascending: false })
        .order("id")
        .range(offset, offset + 49);
      guard();
      if (error) throw error;
      return data as BoardSummary[];
    },
    async load(id: string) {
      guard();
      const { data, error } = await runtime.db
        .from("tactical_boards")
        .select("*")
        .eq("user_id", owner!)
        .eq("id", id)
        .single();
      guard();
      if (error) throw error;
      validateBoard(data.document);
      return data as Board;
    },
    async save(
      id: string,
      title: string,
      activity: string,
      document: BoardDocument,
      revision: number,
    ) {
      guard();
      validateBoard(document);
      title = title.trim();
      if (!title || title.length > 120)
        throw Error("Inserisci un titolo, fino a 120 caratteri.");
      const { data, error } = await runtime.db.rpc("save_tactical_board", {
        p_id: id,
        p_title: title,
        p_activity_id: activity || null,
        p_document: document,
        p_revision: revision,
      });
      guard();
      if (error) throw error;
      return data as Board;
    },
    async remove(board: Board) {
      guard();
      const { data, error } = await runtime.db
        .from("tactical_boards")
        .delete()
        .eq("user_id", owner!)
        .eq("id", board.id)
        .eq("revision", board.revision)
        .select("id");
      guard();
      if (error) throw error;
      if (!data?.length)
        throw Error(
          "Lavagna modificata da un collega. Riaprila prima di eliminarla.",
        );
    },
  };
}
