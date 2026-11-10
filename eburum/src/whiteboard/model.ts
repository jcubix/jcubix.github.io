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
  content: JSON.stringify([
    title.trim(),
    activity,
    doc.pitchLayout ?? "auto",
    doc.whitePitch ?? false,
    doc.raisedPitch ?? false,
    doc.marks,
    doc.phases ?? [],
  ]),
});
export const markLabel = (mark: Mark, index: number) =>
  `${index + 1}. ${isEquipmentKind(mark.kind) ? boardEquipment[mark.kind].label : mark.kind === "home" ? "Eburum" : mark.kind === "away" ? "Avversario" : tools.find((tool) => tool.kind === mark.kind)?.label}${
    mark.label && ["text", "home", "away"].includes(mark.kind)
      ? ` · ${mark.label}`
      : ""
  }`;
export const date = (value: string) =>
  new Date(value).toLocaleDateString("it-IT");

export const formations = {
  "4-3-3": [4, 3, 3],
  "4-4-2": [4, 4, 2],
  "3-5-2": [3, 5, 2],
  "4-2-3-1": [4, 2, 3, 1],
} as const;

export function formationMarks(formation: keyof typeof formations): Mark[] {
  const lines = [1, ...formations[formation]];
  return lines.flatMap((count, line) =>
    Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(),
      kind: "home",
      color: "#80caff",
      label: "",
      points: [
        {
          x: 100 + (line * 670) / (lines.length - 1),
          y: ((i + 1) * 640) / (count + 1),
        },
      ],
    })),
  );
}

export function tweenMarks(from: Mark[], to: Mark[], progress: number) {
  const targets = new Map(to.map((mark) => [mark.id, mark]));
  return from.map((mark) => {
    const next = targets.get(mark.id);
    if (
      next?.kind !== mark.kind ||
      !["home", "away", "ball"].includes(mark.kind)
    )
      return mark;
    const a = mark.points[0],
      b = next.points[0];
    return {
      ...mark,
      points: [
        { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress },
      ],
    };
  });
}
