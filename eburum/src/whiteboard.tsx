import { LoadingState } from "./components/ui/loading-state";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  Circle,
  Download,
  Hand,
  ImagePlus,
  MousePointer2,
  Pencil,
  Plus,
  Presentation,
  Redo2,
  Save,
  Trash2,
  Type,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { canTechnicalRole } from "../app-roles.js";
import { confirmDialog } from "../app-confirm.js";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { PageHeading } from "./pages";
import { whiteboardApi } from "./whiteboard-api";
import {
  boardColors,
  boardNoteLayout,
  boardPhoto,
  boardViewPoint,
  emptyBoard,
  moveMark,
  type Board,
  type BoardDocument,
  type BoardSummary,
  type Mark,
  type MarkKind,
  type Point,
} from "./whiteboard-model";
import type { Runtime } from "./types";
import "./whiteboard.css";

type Tool = MarkKind | "select" | "pan";
const tools = [
  { kind: "select", label: "Sposta", icon: MousePointer2 },
  { kind: "pen", label: "Penna", icon: Pencil },
  { kind: "arrow", label: "Freccia", icon: ArrowUpRight },
  { kind: "circle", label: "Cerchio", icon: Circle },
  { kind: "text", label: "Nota", icon: Type },
  { kind: "home", label: "Eburum", icon: UserRound },
  { kind: "away", label: "Avversario", icon: UserRound },
  { kind: "pan", label: "Scorri", icon: Hand },
] as const;
const colorNames = ["Bianco", "Rosso", "Giallo", "Azzurro"];
const fingerprint = (title: string, activity: string, doc: BoardDocument) =>
  JSON.stringify([title.trim(), activity, doc]);
const date = (value: string) => new Date(value).toLocaleDateString("it-IT");

function Pitch() {
  return (
    <g aria-hidden="true">
      <rect width="1000" height="640" fill="#17483e" />
      <g stroke="#e1efe8" strokeWidth="2.5" fill="none" opacity="0.8">
        <rect x="32" y="32" width="936" height="576" />
        <path d="M500 32V608M32 165H190V475H32M968 165H810V475H968M32 245H95V395H32M968 245H905V395H968" />
        <circle cx="500" cy="320" r="78" />
        <path d="M190 255A78 78 0 0 1 190 385M810 255A78 78 0 0 0 810 385M32 300H18V340H32M968 300H982V340H968" />
      </g>
      <g fill="#e1efe8">
        <circle cx="500" cy="320" r="4" />
        <circle cx="140" cy="320" r="4" />
        <circle cx="860" cy="320" r="4" />
      </g>
    </g>
  );
}
function Ink({
  mark: m,
  markerId,
  portrait,
}: {
  mark: Mark;
  markerId: string;
  portrait: boolean;
}) {
  const p = m.points[0],
    end = m.points.at(-1)!;
  const upright = portrait ? `rotate(-90 ${p.x} ${p.y})` : undefined;
  if (m.kind === "home" || m.kind === "away")
    return (
      <g transform={upright}>
        <circle
          cx={p.x}
          cy={p.y}
          r={portrait ? 28 : 22}
          fill={m.kind === "home" ? "#d9e7ff" : "#ffd3da"}
          stroke="#0b1220"
          strokeWidth="3"
        />
        <text
          x={p.x}
          y={p.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#14213b"
          fontSize={portrait ? 22 : 18}
          fontWeight="700"
          fontFamily="Arial, sans-serif"
        >
          {m.label.slice(0, 4)}
        </text>
      </g>
    );
  if (m.kind === "text") {
    const note = boardNoteLayout(m.label, portrait);
    return (
      <g transform={upright}>
        <rect
          x={p.x - 8}
          y={p.y - note.top}
          width={note.width}
          height={note.height}
          rx="6"
          fill="#0b1220"
          stroke={m.color}
          strokeWidth="2"
        />
        <text
          x={p.x}
          y={p.y}
          fill="#ffffff"
          fontSize={portrait ? 24 : 19}
          fontFamily="Arial, sans-serif"
        >
          {note.lines.map((line, i) => (
            <tspan key={i} x={p.x} dy={i ? note.lineHeight : 0}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  }
  if (m.kind === "circle")
    return (
      <>
        <ellipse
          cx={(p.x + end.x) / 2}
          cy={(p.y + end.y) / 2}
          rx={Math.abs(end.x - p.x) / 2}
          ry={Math.abs(end.y - p.y) / 2}
          fill="none"
          stroke="#0b1220"
          strokeWidth="7"
        />
        <ellipse
          cx={(p.x + end.x) / 2}
          cy={(p.y + end.y) / 2}
          rx={Math.abs(end.x - p.x) / 2}
          ry={Math.abs(end.y - p.y) / 2}
          fill="none"
          stroke={m.color}
          strokeWidth="4"
        />
      </>
    );
  const d =
    m.points.length === 1
      ? `M${p.x},${p.y}l0.1,0`
      : m.points
          .map((point, i) => `${i ? "L" : "M"}${point.x},${point.y}`)
          .join(" ");
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke="#0b1220" strokeWidth="8" />
      <path
        d={d}
        stroke={m.color}
        strokeWidth="4"
        markerEnd={
          m.kind === "arrow"
            ? `url(#${markerId}-${boardColors.indexOf(m.color as (typeof boardColors)[number])})`
            : undefined
        }
      />
    </g>
  );
}

export function WhiteboardPage({ runtime }: { runtime: Runtime }) {
  const [params, setParams] = useSearchParams(),
    navigate = useNavigate(),
    location = useLocation();
  const libraryScroll = useRef(0);
  const role = runtime.state.team?.role || "",
    allowed = canTechnicalRole(role);
  const api = useMemo(
    () => whiteboardApi(runtime),
    [runtime, runtime.state.team?.owner_id, runtime.state.user?.id, role],
  );
  const [boards, setBoards] = useState<BoardSummary[]>([]),
    [hasMore, setHasMore] = useState(false);
  const [board, setBoard] = useState<Board | null>(null),
    [title, setTitle] = useState(""),
    [activity, setActivity] = useState("");
  const [history, setHistory] = useState<{
    past: BoardDocument[];
    doc: BoardDocument;
    future: BoardDocument[];
  }>({ past: [], doc: emptyBoard(), future: [] });
  const [tool, setTool] = useState<Tool>(() =>
      window.matchMedia("(max-width: 640px)").matches ? "pan" : "select",
    ),
    [color, setColor] = useState<string>(boardColors[1]),
    [label, setLabel] = useState("");
  const [selected, setSelected] = useState(""),
    [preview, setPreview] = useState<Mark | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const pending = useRef(false),
    alive = useRef(true),
    baseline = useRef("");
  const svg = useRef<SVGSVGElement>(null),
    photo = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    pointer: number;
    start: Point;
    mark: Mark;
    moving: boolean;
  } | null>(null);
  const markerId = useId().replace(/:/g, "");
  const { doc } = history;
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 640px)").matches,
  );
  const [settingsOpen, setSettingsOpen] = useState(!compact);
  const portrait = compact && doc.background === "pitch";
  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const resize = () => {
      setCompact(media.matches);
      setSettingsOpen(!media.matches);
      drag.current = null;
      setPreview(null);
    };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  const dirty =
    !!board && fingerprint(title, activity, doc) !== baseline.current;
  const current = () => alive.current && api.current();
  const commit = (next: BoardDocument) => {
    if (JSON.stringify(next) === JSON.stringify(doc)) return;
    setHistory((h) => ({
      past: [...h.past.slice(-39), h.doc],
      doc: next,
      future: [],
    }));
    setNotice("");
  };
  const canLeave = () =>
    !pending.current &&
    (!dirty ||
      window.confirm("Scartare le modifiche non salvate alla lavagna?"));
  const restore = (value: Board) => {
    setBoard(value);
    setTitle(value.title);
    setActivity(value.activity_id || "");
    setHistory({ past: [], doc: value.document, future: [] });
    baseline.current = fingerprint(
      value.title,
      value.activity_id || "",
      value.document,
    );
    setSelected("");
    setPreview(null);
    drag.current = null;
    setError("");
    setNotice("");
  };
  const create = (linked = "") => {
    if (!canLeave()) return;
    const a = runtime.state.activities.find((a) => a.id === linked);
    restore({
      id: crypto.randomUUID(),
      title: a
        ? `${a.title} · ${date(a.activity_date + "T12:00:00")}`
        : "Nuova lavagna",
      activity_id: a?.id || null,
      revision: 0,
      updated_at: "",
      document: emptyBoard(),
    });
  };
  const loadList = async (offset = 0) => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await api.list(offset);
      if (current()) {
        setBoards((old) => (offset ? [...old, ...rows] : rows));
        setHasMore(rows.length === 50);
      }
    } catch (e) {
      if (current())
        setError((e as Error).message || "Lavagne non caricate. Riprova.");
    } finally {
      if (current()) setLoading(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    void loadList();
    if (allowed && params.get("activity") && !params.get("board"))
      create(params.get("activity")!);
    return () => {
      alive.current = false;
    };
  }, [api]);
  useLayoutEffect(() => {
    runtime.setNavigationGuard(canLeave);
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty || pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      runtime.setNavigationGuard(null);
      window.removeEventListener("beforeunload", unload);
    };
  }, [runtime, dirty]);
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      if (current())
        setError((e as Error).message || "Operazione non riuscita. Riprova.");
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  const open = (id: string) => {
    if (!canLeave()) return;
    libraryScroll.current = window.scrollY;
    setParams(
      (p) => {
        p.set("board", id);
        p.delete("activity");
        return p;
      },
      { state: { boardEntry: true } },
    );
  };
  useEffect(() => {
    if (!allowed) return;
    const id = params.get("board");
    if (id && id !== board?.id) {
      if (!canLeave()) {
        setParams(
          (p) => {
            if (board) p.set("board", board.id);
            else p.delete("board");
            return p;
          },
          { replace: true },
        );
        return;
      }
      void run(async () => {
        const value = await api.load(id);
        if (current()) restore(value);
      });
    } else if (!id && board?.updated_at) {
      if (!canLeave()) {
        setParams(
          (p) => {
            p.set("board", board.id);
            return p;
          },
          { replace: true, state: { boardEntry: true } },
        );
        return;
      }
      setBoard(null);
      requestAnimationFrame(() =>
        window.scrollTo({ top: libraryScroll.current, behavior: "instant" }),
      );
    }
  }, [params.get("board"), api]);
  const save = () => {
    if (!board) return;
    void run(async () => {
      const value = await api.save(
        board.id,
        title,
        activity,
        doc,
        board.revision,
      );
      if (!current()) return;
      setBoard(value);
      setTitle(value.title);
      baseline.current = fingerprint(
        value.title,
        value.activity_id || "",
        value.document,
      );
      if (params.get("board") !== value.id)
        setParams(
          (p) => {
            p.set("board", value.id);
            p.delete("activity");
            return p;
          },
          { state: { boardEntry: true } },
        );
      setNotice("Lavagna salvata e disponibile allo staff tecnico.");
      setBoards((rows) => [value, ...rows.filter((b) => b.id !== value.id)]);
    });
  };
  const undo = (redo = false) => {
    setSelected("");
    setPreview(null);
    drag.current = null;
    setHistory((h) =>
      redo
        ? h.future.length
          ? {
              past: [...h.past, h.doc],
              doc: h.future[0],
              future: h.future.slice(1),
            }
          : h
        : h.past.length
          ? {
              past: h.past.slice(0, -1),
              doc: h.past.at(-1)!,
              future: [h.doc, ...h.future],
            }
          : h,
    );
  };
  const removeSelected = () => {
    commit({ ...doc, marks: doc.marks.filter((m) => m.id !== selected) });
    setSelected("");
  };
  const point = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return boardViewPoint(
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height,
      portrait,
    );
  };
  const pointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (busy || tool === "pan" || e.button > 0 || drag.current) return;
    const p = point(e);
    if (tool === "select") {
      const id =
        (e.target as Element)
          .closest("[data-mark]")
          ?.getAttribute("data-mark") || "";
      setSelected(id);
      const stored = doc.marks.find((m) => m.id === id);
      const mark = stored && moveMark(stored, 0, 0, portrait);
      if (mark)
        drag.current = { pointer: e.pointerId, start: p, mark, moving: true };
    } else {
      if (doc.marks.length >= 200) {
        setError(
          "Limite di 200 elementi raggiunto. Elimina quelli che non servono.",
        );
        return;
      }
      if (tool === "text" && !label.trim()) {
        setError(
          "Scrivi la nota nel campo Testo, poi tocca il punto del campo.",
        );
        return;
      }
      let mark: Mark = {
        id: crypto.randomUUID(),
        kind: tool,
        color,
        points: [p],
        label:
          tool === "text"
            ? label.trim()
            : label.trim().slice(0, 4) ||
              String(doc.marks.filter((m) => m.kind === tool).length + 1),
      };
      if (["arrow", "circle"].includes(tool)) mark.points.push(p);
      if (["text", "home", "away"].includes(tool))
        mark = moveMark(mark, 0, 0, portrait);
      drag.current = { pointer: e.pointerId, start: p, mark, moving: false };
      setSelected("");
      setPreview(mark);
    }
    if (drag.current) {
      e.preventDefault();
      e.currentTarget.focus({ preventScroll: true });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const pointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== e.pointerId) return;
    const p = point(e);
    if (gesture.moving)
      setPreview(
        moveMark(
          gesture.mark,
          p.x - gesture.start.x,
          p.y - gesture.start.y,
          portrait,
        ),
      );
    else {
      if (gesture.mark.kind === "pen" && gesture.mark.points.length < 600)
        gesture.mark = { ...gesture.mark, points: [...gesture.mark.points, p] };
      else if (["arrow", "circle"].includes(gesture.mark.kind))
        gesture.mark = { ...gesture.mark, points: [gesture.start, p] };
      setPreview(gesture.mark);
    }
  };
  const finishPointer = (e: PointerEvent<SVGSVGElement>, cancelled = false) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== e.pointerId) return;
    if (!cancelled) {
      const p = point(e);
      const mark = gesture.moving
        ? moveMark(
            gesture.mark,
            p.x - gesture.start.x,
            p.y - gesture.start.y,
            portrait,
          )
        : ["arrow", "circle"].includes(gesture.mark.kind)
          ? { ...gesture.mark, points: [gesture.start, p] }
          : gesture.mark;
      if (
        !["arrow", "circle"].includes(mark.kind) ||
        Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 5
      )
        commit({
          ...doc,
          marks: gesture.moving
            ? doc.marks.map((m) => (m.id === mark.id ? mark : m))
            : [...doc.marks, mark],
        });
    }
    drag.current = null;
    setPreview(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const exportPng = () =>
    void run(async () => {
      if (!svg.current) return;
      const copy = svg.current.cloneNode(true) as SVGSVGElement;
      copy.querySelectorAll("[data-selection]").forEach((n) => n.remove());
      copy.querySelectorAll("[data-hit]").forEach((n) => n.remove());
      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const width = portrait ? 1280 : 2000,
        height = portrait ? 2000 : 1280;
      copy.setAttribute("width", String(width));
      copy.setAttribute("height", String(height));
      const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(copy)], {
          type: "image/svg+xml;charset=utf-8",
        }),
      );
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height + 100;
        const ctx = canvas.getContext("2d");
        if (!ctx)
          throw Error("Esportazione non disponibile su questo browser.");
        ctx.fillStyle = "#0b1220";
        ctx.fillRect(0, 0, width, height + 100);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 32px Arial";
        ctx.fillText(title || "Lavagna Eburum", 32, 60, width - 64);
        ctx.drawImage(image, 0, 100, width, height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!blob) throw Error("Immagine non generata. Riprova.");
        const download = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = download;
        a.download =
          (title.replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 80) ||
            "lavagna-eburum") + ".png";
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(download), 10000);
        if (current())
          setNotice(
            "Immagine esportata. Contiene anche le modifiche non ancora salvate.",
          );
      } finally {
        URL.revokeObjectURL(url);
      }
    });
  if (!allowed)
    return (
      <div className="sc-surface">
        <PageHeading
          title="Lavagna tattica"
          description="Area riservata allo staff tecnico."
        />
        <p role="status">
          Accesso previsto per amministratore, allenatore e collaboratore
          tecnico.
        </p>
      </div>
    );
  const activityRows = runtime.state.activities.filter(
    (a) => a.activity_type !== "Riunione",
  );
  const shown = (
    preview
      ? [...doc.marks.filter((m) => m.id !== preview.id), preview]
      : doc.marks
  ).map((m) => moveMark(m, 0, 0, portrait));
  return (
    <div className="sc-surface wb-page">
      <PageHeading
        title="Lavagna tattica"
        description="Metti a fuoco l’azione. Spiega cosa migliorare."
      >
        {board ? (
          <Button
            disabled={busy}
            aria-label="Chiudi lavagna"
            onClick={() => {
              if (canLeave()) {
                if (params.get("board")) {
                  if (location.state?.boardEntry) navigate(-1);
                  else
                    setParams(
                      (p) => {
                        p.delete("board");
                        return p;
                      },
                      { replace: true },
                    );
                } else setBoard(null);
                setError("");
              }
            }}
          >
            <X />
            <span className="page-add-label">Chiudi</span>
          </Button>
        ) : boards.length ? (
          <Button
            onClick={() => create()}
            disabled={busy}
            aria-label="Nuova lavagna"
          >
            <Plus />
            <span className="page-add-label">Nuova lavagna</span>
          </Button>
        ) : null}
      </PageHeading>
      <div className="wb-feedback" aria-live="polite">
        {error ? <p role="alert">{error}</p> : <p role="status">{notice}</p>}
      </div>
      {board ? (
        <section className="wb-editor" aria-label="Editor lavagna">
          <details
            className="wb-settings"
            open={settingsOpen}
            onToggle={(e) => setSettingsOpen(e.currentTarget.open)}
          >
            <summary>
              Dettagli lavagna <span>{title || "Nuova lavagna"}</span>
            </summary>
            <fieldset disabled={busy} className="wb-fields">
              <label>
                Titolo
                <Input
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Collega a un’attività
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                >
                  <option value="">Lavagna libera</option>
                  {activity && !activityRows.some((a) => a.id === activity) ? (
                    <option value={activity}>
                      Attività collegata non presente nell’elenco
                    </option>
                  ) : null}
                  {activityRows.map((a) => (
                    <option value={a.id} key={a.id}>
                      {date(a.activity_date + "T12:00:00")} · {a.title}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          </details>
          <div className="wb-workspace">
            <div className="wb-controls">
              <div
                className="wb-toolbar"
                role="group"
                aria-label="Strumenti di disegno"
              >
                {tools.map(({ kind, label: name, icon: Icon }) => (
                  <Button
                    key={kind}
                    variant="secondary"
                    aria-pressed={tool === kind}
                    aria-label={name}
                    title={name}
                    disabled={busy}
                    onClick={() => {
                      setTool(kind);
                      setSelected("");
                      setError("");
                    }}
                  >
                    <Icon />
                    <span>{name}</span>
                  </Button>
                ))}
              </div>
              <div className="wb-options">
                <div
                  className="wb-colors"
                  role="group"
                  aria-label="Colore del disegno"
                >
                  {boardColors.map((c, i) => (
                    <button
                      key={c}
                      style={{ "--swatch": c } as React.CSSProperties}
                      aria-label={colorNames[i]}
                      aria-pressed={color === c}
                      disabled={busy}
                      onClick={() => setColor(c)}
                    >
                      <span />
                    </button>
                  ))}
                </div>
                {["text", "home", "away"].includes(tool) ? (
                  <label className="wb-label">
                    {tool === "text" ? "Testo della nota" : "Numero o sigla"}
                    <Input
                      value={label}
                      maxLength={tool === "text" ? 80 : 4}
                      onChange={(e) => setLabel(e.target.value)}
                      disabled={busy}
                      placeholder={
                        tool === "text"
                          ? "Es. Chiudere la linea di passaggio"
                          : "Es. 7"
                      }
                    />
                  </label>
                ) : (
                  <p className="sc-helper">
                    {compact
                      ? tool === "pan"
                        ? "Scorri: muovi la pagina."
                        : tool === "select"
                          ? "Sposta: trascina gli elementi."
                          : "Trascina sul campo per disegnare."
                      : tool === "pan"
                        ? "Scorri sul campo per muoverti nella pagina. Scegli uno strumento per disegnare."
                        : tool === "select"
                          ? "Trascina pedine e annotazioni. Per muoverti nella pagina scegli Scorri."
                          : "Trascina sul campo per disegnare. Il rosso aiuta a evidenziare gli errori."}
                  </p>
                )}
              </div>
            </div>
            <div className="wb-stage" data-portrait={portrait}>
              <svg
                ref={svg}
                viewBox={portrait ? "0 0 640 1000" : "0 0 1000 640"}
                data-tool={tool}
                role="application"
                aria-label="Lavagna interattiva: usa gli strumenti per disegnare o seleziona un elemento dall’elenco sottostante"
                tabIndex={0}
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={(e) => finishPointer(e)}
                onPointerCancel={(e) => finishPointer(e, true)}
                onLostPointerCapture={() => {
                  drag.current = null;
                  setPreview(null);
                }}
                onKeyDown={(e) => {
                  if (busy) return;
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                    e.preventDefault();
                    undo(e.shiftKey);
                  }
                  if (selected && ["Delete", "Backspace"].includes(e.key)) {
                    e.preventDefault();
                    removeSelected();
                  }
                  const m = doc.marks.find((m) => m.id === selected),
                    step = e.shiftKey ? 10 : 2;
                  if (
                    m &&
                    [
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                    const dx =
                      e.key === "ArrowLeft"
                        ? -step
                        : e.key === "ArrowRight"
                          ? step
                          : 0;
                    const dy =
                      e.key === "ArrowUp"
                        ? -step
                        : e.key === "ArrowDown"
                          ? step
                          : 0;
                    const next = moveMark(
                      m,
                      portrait ? dy : dx,
                      portrait ? -dx : dy,
                      portrait,
                    );
                    commit({
                      ...doc,
                      marks: doc.marks.map((v) =>
                        v.id === selected ? next : v,
                      ),
                    });
                  }
                }}
              >
                <defs>
                  {boardColors.map((c, i) => (
                    <marker
                      key={c}
                      id={`${markerId}-${i}`}
                      markerWidth="12"
                      markerHeight="12"
                      refX="8"
                      refY="5"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <path
                        d="M1 1L9 5L1 9"
                        fill="none"
                        stroke={c}
                        strokeWidth="3"
                      />
                    </marker>
                  ))}
                </defs>
                <g
                  transform={
                    portrait ? "translate(640 0) rotate(90)" : undefined
                  }
                >
                  {doc.background === "pitch" ? (
                    <Pitch />
                  ) : (
                    <>
                      <rect width="1000" height="640" fill="#0b1220" />
                      <image
                        href={doc.background}
                        width="1000"
                        height="640"
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </>
                  )}
                  {shown.map((m) => (
                    <g
                      key={m.id}
                      data-mark={m.id}
                      style={{
                        cursor: tool === "select" ? "grab" : "crosshair",
                      }}
                    >
                      {tool === "select" ? (
                        <circle
                          data-hit="true"
                          cx={m.points[0].x}
                          cy={m.points[0].y}
                          r={compact ? (portrait ? 42 : 64) : 28}
                          fill="transparent"
                        />
                      ) : null}
                      <Ink mark={m} markerId={markerId} portrait={portrait} />
                      {selected === m.id ? (
                        <circle
                          data-selection="true"
                          cx={m.points[0].x}
                          cy={m.points[0].y}
                          r="30"
                          fill="none"
                          stroke="#ffffff"
                          strokeDasharray="5 5"
                          strokeWidth="2"
                          pointerEvents="none"
                        />
                      ) : null}
                    </g>
                  ))}
                </g>
              </svg>
            </div>
          </div>
          <div className="wb-secondary-actions">
            <div>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Annulla ultima modifica"
                disabled={busy || !history.past.length}
                onClick={() => undo()}
              >
                <Undo2 />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Ripristina modifica"
                disabled={busy || !history.future.length}
                onClick={() => undo(true)}
              >
                <Redo2 />
              </Button>
              <Button
                variant="secondary"
                disabled={busy || !selected}
                onClick={removeSelected}
              >
                <Trash2 />
                Elimina elemento
              </Button>
            </div>
            <div>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => photo.current?.click()}
              >
                <ImagePlus />
                Carica foto
              </Button>
              <Button
                variant="secondary"
                disabled={busy || doc.background === "pitch"}
                onClick={() => commit({ ...doc, background: "pitch" })}
              >
                <Presentation />
                Usa campo
              </Button>
            </div>
          </div>
          <input
            ref={photo}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-label="Carica foto sulla lavagna"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file)
                void run(async () => {
                  const background = await boardPhoto(file);
                  if (current()) commit({ ...doc, background });
                });
            }}
          />
          <p className="sc-helper">
            Foto JPG, PNG e WebP fino a 10 MB, ridimensionate per il
            salvataggio. Lo sfondo e i disegni si possono annullare
            separatamente.
          </p>
          <details className="wb-elements">
            <summary>Elementi sulla lavagna ({doc.marks.length}/200)</summary>
            <p className="sc-helper">
              Seleziona un elemento, poi usa Sposta e le frecce della tastiera.
              Canc elimina l’elemento.
            </p>
            <div>
              {doc.marks.map((m, i) => (
                <Button
                  key={m.id}
                  variant="secondary"
                  aria-pressed={selected === m.id}
                  disabled={busy}
                  onClick={() => {
                    setSelected(m.id);
                    setTool("select");
                    svg.current?.focus();
                  }}
                >
                  {i + 1}. {tools.find((t) => t.kind === m.kind)?.label}
                  {m.label && ["text", "home", "away"].includes(m.kind)
                    ? ` · ${m.label}`
                    : ""}
                </Button>
              ))}
            </div>
          </details>
          <div className="wb-save">
            <p role="status">
              {busy
                ? "Operazione in corso…"
                : dirty
                  ? "Modifiche da salvare"
                  : board.updated_at
                    ? "Tutte le modifiche sono salvate"
                    : "Bozza vuota · non ancora salvata"}
            </p>
            <div>
              <Button variant="secondary" disabled={busy} onClick={exportPng}>
                <Download />
                Esporta immagine
              </Button>
              <Button
                disabled={
                  busy || (!dirty && !!board.updated_at) || !title.trim()
                }
                onClick={save}
              >
                <Save />
                Salva lavagna
              </Button>
            </div>
          </div>
          <div className="wb-close">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (canLeave()) {
                  setBoard(null);
                  setError("");
                }
              }}
            >
              <X />
              Chiudi lavagna
            </Button>
            {board.revision > 0 ? (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  if (
                    pending.current ||
                    !(await confirmDialog({
                      title: "Eliminare la lavagna?",
                      message:
                        "La foto e tutte le annotazioni salvate saranno eliminate. Questa operazione non si può annullare.",
                      confirmLabel: "Elimina lavagna",
                      danger: true,
                    })) ||
                    !current()
                  )
                    return;
                  void run(async () => {
                    await api.remove(board);
                    if (current()) {
                      setBoard(null);
                      setParams(
                        (p) => {
                          p.delete("board");
                          return p;
                        },
                        { replace: true },
                      );
                      setBoards((rows) =>
                        rows.filter((b) => b.id !== board.id),
                      );
                      setNotice("Lavagna eliminata.");
                    }
                  });
                }}
              >
                <Trash2 />
                Elimina lavagna
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
      {!board ? (
        <section className="wb-library" aria-labelledby="boardLibrary">
          <div className="sc-section-heading">
            <h3 id="boardLibrary">Lavagne dello staff</h3>
            <Button
              variant="ghost"
              disabled={loading || busy}
              onClick={() => void loadList()}
            >
              Aggiorna elenco
            </Button>
          </div>
          {loading && !boards.length ? (
            <LoadingState label="Caricamento lavagne…" />
          ) : !boards.length ? (
            <div className="sc-empty-state">
              <Presentation />
              <h3>La prossima spiegazione parte da qui</h3>
              <p>
                Crea una lavagna, disegna sul campo o carica una foto
                dell’azione.
              </p>
              <Button onClick={() => create()}>Nuova lavagna</Button>
            </div>
          ) : (
            <div className="sc-directory">
              {boards.map((b) => (
                <button
                  className="sc-list-row"
                  key={b.id}
                  disabled={busy}
                  onClick={() => open(b.id)}
                >
                  <Presentation size={22} />
                  <span className="sc-row-copy">
                    <strong>{b.title}</strong>
                    <small>
                      Aggiornata il {date(b.updated_at)}
                      {b.activity_id
                        ? " · Collegata a un’attività"
                        : " · Lavagna libera"}
                    </small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
          )}
          {hasMore ? (
            <Button
              variant="secondary"
              disabled={loading || busy}
              onClick={() => void loadList(boards.length)}
            >
              Carica altre lavagne
            </Button>
          ) : null}
          <p className="sc-helper">
            Visibili solo ad amministratore, allenatore e collaboratore tecnico.
            Il salvataggio richiede una connessione. Le modifiche di un collega
            compaiono riaprendo la lavagna.
          </p>
        </section>
      ) : null}
    </div>
  );
}
