export const boardColors = [
  "#ffffff",
  "#ff7b8b",
  "#f4cf63",
  "#80caff",
] as const;
export type Point = { x: number; y: number };
export const boardEquipment = {
  disc: { label: "Cinesina", width: 32, height: 13 },
  cone: { label: "Conetto", width: 24, height: 30 },
  pole: { label: "Asta", width: 12, height: 40 },
  mannequin: { label: "Sagoma barriera", width: 24, height: 40 },
  ball: { label: "Pallone", width: 23, height: 23 },
  hurdle: { label: "Ostacolo", width: 36, height: 24 },
  ladder: { label: "Scaletta", width: 28, height: 45 },
  mini_goal: { label: "Porticina", width: 44, height: 28 },
  hoop: { label: "Cerchio agilità", width: 27, height: 27 },
} as const;
export type EquipmentKind = keyof typeof boardEquipment;
export const isEquipmentKind = (kind: string): kind is EquipmentKind =>
  Object.hasOwn(boardEquipment, kind);
export const isPlayerKind = (kind: string) =>
  kind === "home" || kind === "away";
export const isPointMark = (kind: string) =>
  kind === "text" || isPlayerKind(kind) || isEquipmentKind(kind);
export type MarkKind =
  "pen" | "arrow" | "circle" | "text" | "home" | "away" | EquipmentKind;
export type Mark = {
  id: string;
  kind: MarkKind;
  color: string;
  points: Point[];
  label: string;
  scale?: number;
  dashed?: boolean;
};
export const pitchLayouts = {
  auto: "Automatico",
  "full-landscape": "Intero orizzontale",
  "full-portrait": "Intero verticale",
  "half-landscape": "Metà orizzontale",
  "half-portrait": "Metà verticale",
} as const;
export type PitchLayout = keyof typeof pitchLayouts;
export const playerRadius = (mark: Mark, portrait: boolean) =>
  (portrait ? 28 : 22) * (mark.scale ?? 1);
export type BoardDocument = {
  background: string;
  pitchLayout?: PitchLayout;
  whitePitch?: boolean;
  raisedPitch?: boolean;
  marks: Mark[];
  phases?: Mark[][];
};
export const maxBoardPhases = 8;
export const maxBoardBytes = 2_000_000;
export type BoardSummary = {
  id: string;
  title: string;
  activity_id: string | null;
  revision: number;
  updated_at: string;
};
export type Board = BoardSummary & { document: BoardDocument };
export const emptyBoard = (): BoardDocument => ({
  background: "pitch",
  marks: [],
});
export function boardPoint(x: number, y: number): Point {
  return {
    x: Math.round(Math.max(0, Math.min(1000, x)) * 10) / 10,
    y: Math.round(Math.max(0, Math.min(640, y)) * 10) / 10,
  };
}
export function boardNoteLayout(label: string, portrait = false) {
  const lines: string[] = [];
  const limit = portrait ? 22 : 32;
  for (const paragraph of label.trim().split(/\r\n?|\n/)) {
    let rest = paragraph.trim();
    while (rest.length > limit) {
      const space = rest.lastIndexOf(" ", limit);
      const end = space > 0 ? space : limit;
      lines.push(rest.slice(0, end));
      rest = rest.slice(end).trimStart();
    }
    lines.push(rest);
  }
  const lineHeight = Math.min(portrait ? 32 : 26, 320 / lines.length);
  const fontSize = Math.min(portrait ? 24 : 19, lineHeight * 0.75);
  return {
    lines,
    width: Math.max(
      32,
      Math.max(...lines.map((line) => line.length)) * (portrait ? 14 : 11) + 16,
    ),
    height: lines.length * lineHeight + 6,
    top: Math.min(portrait ? 26 : 22, lineHeight),
    lineHeight,
    fontSize,
  };
}
export function moveMark(
  mark: Mark,
  dx: number,
  dy: number,
  portrait = false,
  lengthScale = 1,
  widthScale = 1,
): Mark {
  const xs = mark.points.map((p) => p.x),
    ys = mark.points.map((p) => p.y);
  const token = isPlayerKind(mark.kind);
  const note = boardNoteLayout(mark.label, portrait);
  const radius = playerRadius(mark, portrait);
  const equipment = isEquipmentKind(mark.kind)
    ? boardEquipment[mark.kind]
    : null;
  const scale = (portrait ? 1.2 : 1) * (mark.scale ?? 1);
  let [left, right, top, bottom] = token
    ? [radius, radius, radius, radius]
    : mark.kind === "text"
      ? [8, note.width - 8, note.top, note.height - note.top]
      : equipment
        ? [
            equipment.width * scale,
            equipment.width * scale,
            equipment.height * scale,
            equipment.height * scale,
          ]
        : [0, 0, 0, 0];
  if (portrait && (mark.kind === "text" || equipment))
    [left, right, top, bottom] = [top, bottom, right, left];
  dx = Math.max(
    left / lengthScale - Math.min(...xs),
    Math.min(1000 - right / lengthScale - Math.max(...xs), dx),
  );
  dy = Math.max(
    top / widthScale - Math.min(...ys),
    Math.min(640 - bottom / widthScale - Math.max(...ys), dy),
  );
  return {
    ...mark,
    points: mark.points.map((p) => boardPoint(p.x + dx, p.y + dy)),
  };
}
export function validateBoard(value: unknown): asserts value is BoardDocument {
  const doc = value as BoardDocument;
  if (
    !doc ||
    typeof doc.background !== "string" ||
    (doc.background !== "pitch" &&
      (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(doc.background) ||
        doc.background.length > 1_400_000)) ||
    (doc.pitchLayout !== undefined &&
      (typeof doc.pitchLayout !== "string" ||
        !Object.hasOwn(pitchLayouts, doc.pitchLayout))) ||
    (doc.whitePitch !== undefined && typeof doc.whitePitch !== "boolean") ||
    (doc.raisedPitch !== undefined && typeof doc.raisedPitch !== "boolean") ||
    !Array.isArray(doc.marks) ||
    (doc.phases !== undefined &&
      (!Array.isArray(doc.phases) || doc.phases.length >= maxBoardPhases))
  )
    throw Error(
      "Lavagna non valida. Usa al massimo 200 elementi e una foto più piccola.",
    );
  for (const marks of [doc.marks, ...(doc.phases ?? [])]) {
    if (!Array.isArray(marks) || marks.length > 200)
      throw Error("Usa al massimo 200 elementi per fase.");
    const ids = new Set<string>();
    for (const m of marks) {
      if (
        !m ||
        typeof m.id !== "string" ||
        !m.id ||
        m.id.length > 64 ||
        ids.has(m.id) ||
        (!["pen", "arrow", "circle"].includes(m.kind) &&
          !isPointMark(m.kind)) ||
        !(boardColors as readonly string[]).includes(m.color) ||
        typeof m.label !== "string" ||
        m.label.length > 80 ||
        (m.scale !== undefined &&
          ((!isEquipmentKind(m.kind) && !isPlayerKind(m.kind)) ||
            !Number.isFinite(m.scale) ||
            m.scale < 0.25 ||
            m.scale > 2)) ||
        (m.dashed !== undefined &&
          (m.kind !== "arrow" || typeof m.dashed !== "boolean")) ||
        !Array.isArray(m.points) ||
        m.points.length < 1 ||
        m.points.length > 600 ||
        (m.kind === "arrow" && m.points.length < 2) ||
        (m.kind === "circle" && m.points.length !== 2) ||
        (isPointMark(m.kind) && m.points.length !== 1) ||
        m.points.some(
          (p) =>
            !p ||
            !Number.isFinite(p.x) ||
            !Number.isFinite(p.y) ||
            p.x < 0 ||
            p.x > 1000 ||
            p.y < 0 ||
            p.y > 640,
        )
      )
        throw Error("La lavagna contiene un elemento non valido.");
      ids.add(m.id);
    }
  }
  if (new TextEncoder().encode(JSON.stringify(doc)).length > maxBoardBytes)
    throw Error("Lavagna troppo grande. Riduci le fasi o la foto di sfondo.");
}

export async function boardPhoto(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !file.size ||
    file.size > 10 * 1024 * 1024
  )
    throw Error("Scegli una foto JPG, PNG o WebP fino a 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40_000_000
    )
      throw Error("Foto troppo grande: usa un’immagine fino a 40 megapixel.");
    const scale = Math.min(
      1,
      1400 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Il browser non riesce a preparare la foto.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.82);
    if (result.length > 1_400_000)
      throw Error(
        "Foto ancora troppo pesante. Scegli un’immagine più piccola.",
      );
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}
