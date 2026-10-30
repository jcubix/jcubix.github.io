import {
  ArrowUpRight,
  Circle,
  Hand,
  MousePointer2,
  Pencil,
  Type,
} from "lucide-react";
import {
  type BoardDocument,
  type Mark,
  type MarkKind,
  boardEquipment,
  isEquipmentKind,
} from "../whiteboard-model";
import "../whiteboard.css";
export type Tool = MarkKind | "select" | "pan";
export const tools = [
  { kind: "select", label: "Sposta", icon: MousePointer2 },
  { kind: "pen", label: "Penna", icon: Pencil },
  { kind: "arrow", label: "Freccia", icon: ArrowUpRight },
  { kind: "circle", label: "Cerchio", icon: Circle },
  { kind: "text", label: "Nota", icon: Type },
  { kind: "pan", label: "Scorri", icon: Hand },
] as const;
export const colorNames = ["Bianco", "Rosso", "Giallo", "Azzurro"];
export const fingerprint = (
  title: string,
  activity: string,
  doc: BoardDocument,
) => ({
  background: doc.background,
  content: JSON.stringify([title.trim(), activity, doc.marks]),
});
export const markLabel = (mark: Mark, index: number) =>
  `${index + 1}. ${isEquipmentKind(mark.kind) ? boardEquipment[mark.kind].label : mark.kind === "home" ? "Eburum" : mark.kind === "away" ? "Avversario" : tools.find((tool) => tool.kind === mark.kind)?.label}${
    mark.label && ["text", "home", "away"].includes(mark.kind)
      ? ` · ${mark.label}`
      : ""
  }`;
export const date = (value: string) =>
  new Date(value).toLocaleDateString("it-IT");
