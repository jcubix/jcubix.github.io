import { type ReportItem } from "../player-report-model";
export interface ReportDetailData {
  title: string;
  items: ReportItem[];
  from: string;
  to: string;
  player: string;
}
