export const boardColors = [
  "#ffffff",
  "#ff7b8b",
  "#f4cf63",
  "#80caff",
] as const;
export type Point = { x: number; y: number };
export type MarkKind = "pen" | "arrow" | "circle" | "text" | "home" | "away";
export type Mark = {
  id: string;
  kind: MarkKind;
  color: string;
  points: Point[];
  label: string;
};
export type BoardDocument = { background: string; marks: Mark[] };
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
// Keep saved coordinates unchanged when the field turns vertically on phones.
export function boardViewPoint(x: number, y: number, portrait = false): Point {
  return boardPoint(
    portrait ? y * 1000 : x * 1000,
    portrait ? (1 - x) * 640 : y * 640,
  );
}
export function boardNoteLayout(label: string, portrait = false) {
  const lines: string[] = [];
  if (portrait) {
    for (let rest = label.trim(); rest;) {
      let end = Math.min(22, rest.length);
      if (end < rest.length) {
        const space = rest.lastIndexOf(" ", end);
        if (space > 0) end = space;
      }
      lines.push(rest.slice(0, end));
      rest = rest.slice(end).trimStart();
    }
  } else lines.push(label);
  if (!lines.length) lines.push("");
  const lineHeight = portrait ? 32 : 26;
  return {
    lines,
    width: Math.max(
      32,
      Math.max(...lines.map((line) => line.length)) * (portrait ? 14 : 11) + 16,
    ),
    height: lines.length * lineHeight + 6,
    top: portrait ? 26 : 22,
    lineHeight,
  };
}
export function moveMark(
  mark: Mark,
  dx: number,
  dy: number,
  portrait = false,
): Mark {
  const xs = mark.points.map((p) => p.x),
    ys = mark.points.map((p) => p.y);
  const token = mark.kind === "home" || mark.kind === "away";
  const note = boardNoteLayout(mark.label, portrait);
  const radius = portrait ? 28 : 22;
  let [left, right, top, bottom] = token
    ? [radius, radius, radius, radius]
    : mark.kind === "text"
      ? [8, note.width - 8, note.top, note.height - note.top]
      : [0, 0, 0, 0];
  if (portrait && mark.kind === "text")
    [left, right, top, bottom] = [top, bottom, right, left];
  dx = Math.max(
    left - Math.min(...xs),
    Math.min(1000 - right - Math.max(...xs), dx),
  );
  dy = Math.max(
    top - Math.min(...ys),
    Math.min(640 - bottom - Math.max(...ys), dy),
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
    !Array.isArray(doc.marks) ||
    doc.marks.length > 200
  )
    throw Error(
      "Lavagna non valida. Usa al massimo 200 elementi e una foto più piccola.",
    );
  const ids = new Set<string>();
  for (const m of doc.marks) {
    if (
      !m ||
      typeof m.id !== "string" ||
      !m.id ||
      m.id.length > 64 ||
      ids.has(m.id) ||
      !["pen", "arrow", "circle", "text", "home", "away"].includes(m.kind) ||
      !(boardColors as readonly string[]).includes(m.color) ||
      typeof m.label !== "string" ||
      m.label.length > 80 ||
      !Array.isArray(m.points) ||
      m.points.length < 1 ||
      m.points.length > 600 ||
      (["arrow", "circle"].includes(m.kind) && m.points.length !== 2) ||
      (["text", "home", "away"].includes(m.kind) && m.points.length !== 1) ||
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
