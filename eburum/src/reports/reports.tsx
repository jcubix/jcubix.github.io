import { useSearchParams } from "react-router-dom";
import { TeamReports } from "../team-reports";
import type { Runtime } from "../types";
import { PlayerReports } from "./player-reports";
export function Reports({ runtime }: { runtime: Runtime }) {
  const [params] = useSearchParams();
  return params.get("view") === "team" ? (
    <TeamReports runtime={runtime} />
  ) : (
    <PlayerReports runtime={runtime} />
  );
}
