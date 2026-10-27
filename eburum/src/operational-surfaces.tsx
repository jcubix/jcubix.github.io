import { useSyncExternalStore, type ComponentType } from "react";
import {
  Discipline,
  DisciplineClearance,
  Sanction,
} from "./discipline-editors";
import { History, Priorities } from "./history-editor";
import { EventEditor } from "./matches/event-editor";
import { MatchEditor } from "./matches/match-editor";
import { ReadOnlyActivity } from "./matches/read-only-activity";
import { RosterEditor } from "./matches/roster-editor";
import { Expiries } from "./people/expiries";
import { PlayerEditor } from "./people/player-editor";
import { PlayerSheet } from "./people/player-sheet";
import { UserEditor } from "./people/user-editor";
import { UsersEditor } from "./people/users-editor";
import { MatchReport } from "./reports/match-report";
import { ReportDetail } from "./reports/report-detail";
import { AttendanceNote } from "./training/attendance-note";
import { AttendanceReview } from "./training/attendance-review";
import { PlanningEditor } from "./training/planning-editor";
import type { Runtime } from "./types";
import { ui, type Surface } from "./ui-service";
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
