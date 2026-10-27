import { childRows, loadSportPeriod, loadTeamData } from "../../app-data.ts";
import { roleLabels } from "../../app-roles.ts";
import { state } from "../../src/domain-state";
import type { Attendance, TeamState } from "../../src/types";

declare const loaded: Awaited<ReturnType<typeof loadTeamData>>;
const attendance: Attendance[] = loaded.attendance;
const initial: TeamState = state;
void attendance;
void initial;

// @ts-expect-error Dates and the owner must be strings.
void loadSportPeriod(2026, "2026-10-31", "owner");
// @ts-expect-error Child queries only allow the existing child tables.
void childRows("users", "id", [], "owner");
// @ts-expect-error A label cannot introduce a role outside the permission model.
void roleLabels.superadmin;
// @ts-expect-error Match rows cannot be assigned to attendance records.
const invalid: Attendance[] = loaded.matches;
void invalid;
