import { useSyncExternalStore, type ComponentType } from "react";
import { ui, type Surface } from "./ui-service";
import type { Runtime } from "./types";
import {
  UsersEditor,
  UserEditor,
  PlayerEditor,
  PlayerSheet,
  Expiries,
} from "./people-editors";
import {
  PlanningEditor,
  AttendanceReview,
  AttendanceNote,
} from "./training-editors";
import {
  MatchEditor,
  EventEditor,
  RosterEditor,
  ReadOnlyActivity,
} from "./match-editors";
import { MatchReport, ReportDetail } from "./report-pages";
import {
  Discipline,
  Sanction,
  DisciplineClearance,
} from "./discipline-editors";
import { History, Priorities } from "./history-editor";
const editors: Record<
  string,
  ComponentType<{ runtime: Runtime; surface: Surface }>
> = {
  users: UsersEditor,
  "user-edit": UserEditor,
  "player-edit": PlayerEditor,
  player: PlayerSheet,
  expiries: Expiries,
  planning: PlanningEditor,
  "attendance-review": AttendanceReview,
  "attendance-note": AttendanceNote,
  match: MatchEditor,
  event: EventEditor,
  roster: RosterEditor,
  "activity-readonly": ReadOnlyActivity,
  "match-report": MatchReport,
  "report-detail": ReportDetail,
  discipline: Discipline,
  sanction: Sanction,
  "dismissal-clearance": DisciplineClearance,
  "yellow-clearance": DisciplineClearance,
  history: History,
  priority: Priorities,
};
export function OperationalSurfaces({
  runtime,
  workspace = false,
}: {
  runtime: Runtime;
  workspace?: boolean;
}) {
  const snapshot = useSyncExternalStore(ui.subscribe, ui.getSnapshot);
  return snapshot.surfaces
    .filter((surface) => !!surface.workspace === workspace)
    .map((surface) => {
      const Editor = editors[surface.kind];
      return Editor ? (
        <Editor key={surface.id} runtime={runtime} surface={surface} />
      ) : null;
    });
}
