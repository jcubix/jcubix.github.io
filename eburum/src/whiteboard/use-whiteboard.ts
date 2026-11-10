import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { confirmDialog } from "../../app-confirm.js";
import { canTechnicalRole } from "../../app-roles.ts";
import { saveDownload } from "../finance-api";
import type { Runtime } from "../types";
import { whiteboardApi } from "../whiteboard-api";
import {
  boardColors,
  emptyBoard,
  isEquipmentKind,
  isPlayerKind,
  isPointMark,
  maxBoardBytes,
  maxBoardPhases,
  validateBoard,
  type Board,
  type BoardDocument,
  type BoardSummary,
  type Mark,
  type Point,
} from "../whiteboard-model";
import "../whiteboard.css";
import {
  date,
  fingerprint,
  formationMarks,
  formations,
  tweenMarks,
  Tool,
} from "./model";
import { pitchView } from "./pitch-view";
import { renderWhiteboardImage } from "./render-image";
function extendArrow(mark: Mark, point: Point): Mark {
  const last = mark.points.at(-1)!;
  if (Math.hypot(point.x - last.x, point.y - last.y) < 1) return mark;
  // Thin older samples at the cap so the tip can still follow the gesture.
  const points =
    mark.points.length < 600
      ? mark.points
      : mark.points.filter((_, i) => i % 2 === 0);
  return { ...mark, points: [...points, point] };
}
export function useWhiteboard({ runtime }: { runtime: Runtime }) {
  const [params, setParams] = useSearchParams(),
    navigate = useNavigate(),
    location = useLocation();
  const libraryScroll = useRef(0);
  const role = runtime.state.team?.role || "",
    allowed = canTechnicalRole(role);
  const api = useMemo(() => whiteboardApi(runtime), [runtime]);
  const [boards, setBoards] = useState<BoardSummary[]>([]),
    [hasMore, setHasMore] = useState(false);
  const listFilter = useRef("");
  const listRequest = useRef(0);
  const [filter, setFilter] = useState("");
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
  const [freeArrow, setFreeArrow] = useState(false);
  const [dashedArrow, setDashedArrow] = useState(false);
  const [selected, setSelected] = useState(""),
    [preview, setPreview] = useState<Mark | null>(null);
  const [equipmentScale, setEquipmentScale] = useState(0.6);
  const [playerScale, setPlayerScale] = useState(1);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const pending = useRef(false),
    alive = useRef(true),
    baseline = useRef<ReturnType<typeof fingerprint> | null>(null);
  const svg = useRef<SVGSVGElement>(null),
    photo = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    pointer: number;
    start: Point;
    mark: Mark;
    moving: boolean;
    freeArrow?: boolean;
  } | null>(null);
  const markerId = useId().replace(/:/g, "");
  const { doc } = history;
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [animated, setAnimated] = useState<Mark[] | null>(null);
  const phases = useMemo(
    () => [doc.marks, ...(doc.phases ?? [])],
    [doc.marks, doc.phases],
  );
  const phase = Math.min(phaseIndex, phases.length - 1);
  const marks = phases[phase];
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 640px)").matches,
  );
  const [settingsOpen, setSettingsOpen] = useState(!compact);
  const layout = doc.pitchLayout ?? "auto";
  const isPitch = doc.background === "pitch";
  const half = isPitch && layout.startsWith("half-");
  const raised = isPitch && doc.raisedPitch === true;
  const portrait =
    isPitch && (layout === "auto" ? compact : layout.endsWith("-portrait"));
  const view = useMemo(
    () => pitchView(half, portrait, raised),
    [half, portrait, raised],
  );
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
  const snapshot = useMemo(
    () => fingerprint(title, activity, doc),
    [title, activity, doc],
  );
  const dirty =
    !!board &&
    (snapshot.background !== baseline.current?.background ||
      snapshot.content !== baseline.current?.content);
  const current = useCallback(() => alive.current && api.current(), [api]);
  const commit = (next: BoardDocument, coalesce = false) => {
    if (
      next.background === snapshot.background &&
      fingerprint(title, activity, next).content === snapshot.content
    )
      return;
    setHistory((h) => ({
      past: coalesce ? h.past : [...h.past.slice(-39), h.doc],
      doc: next,
      future: [],
    }));
    setNotice("");
  };
  const commitMarks = (next: Mark[], coalesce = false) => {
    commit(
      phase === 0
        ? { ...doc, marks: next }
        : {
            ...doc,
            phases: doc.phases!.map((m, i) => (i + 1 === phase ? next : m)),
          },
      coalesce,
    );
  };
  const goToPhase = (next: number) => {
    setPhaseIndex(next);
    setSelected("");
    setPreview(null);
    drag.current = null;
  };
  const addPhase = () => {
    if (phases.length >= maxBoardPhases || !marks.length) return;
    const next = [...phases];
    next.splice(phase + 1, 0, marks);
    const updated = { ...doc, phases: next.slice(1) };
    try {
      validateBoard(updated);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    commit(updated);
    setError("");
    goToPhase(phase + 1);
    setTool("select");
  };
  const removePhase = () => {
    if (phases.length < 2) return;
    const next = phases.filter((_, i) => i !== phase);
    const { phases: _, ...base } = doc;
    commit({
      ...base,
      marks: next[0],
      ...(next.length > 1 ? { phases: next.slice(1) } : {}),
    });
    goToPhase(Math.max(phase - 1, 0));
  };
  useEffect(() => {
    if (!playing) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = 1400;
    let start: number | undefined;
    let request = 0;
    const tick = (now: number) => {
      start ??= now;
      const elapsed = (now - start) / duration;
      const index = Math.floor(elapsed);
      setPhaseIndex(Math.min(index, phases.length - 1));
      if (index >= phases.length - 1) {
        setAnimated(null);
        setPlaying(false);
        return;
      }
      if (!reduced)
        setAnimated(
          tweenMarks(phases[index], phases[index + 1], elapsed - index),
        );
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, phases]);
  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      setAnimated(null);
    } else {
      goToPhase(0);
      setPlaying(true);
    }
  };
  const canLeave = useCallback(async () => {
    if (pending.current) return false;
    if (!dirty) return true;
    return (
      (await confirmDialog({
        message: "Scartare le modifiche non salvate alla lavagna?",
        confirmLabel: "Scarta",
      })) &&
      current() &&
      !pending.current
    );
  }, [dirty, current]);
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
    goToPhase(0);
    setPlaying(false);
    setAnimated(null);
    setError("");
    setNotice("");
  };
  const draft = (
    title: string,
    document = emptyBoard(),
    activityId: string | null = null,
  ) =>
    restore({
      id: crypto.randomUUID(),
      title,
      activity_id: activityId,
      revision: 0,
      updated_at: "",
      document,
    });
  const create = async (linked = "") => {
    if (!(await canLeave())) return;
    const a = runtime.state.activities.find((a) => a.id === linked);
    draft(
      a
        ? `${a.title} · ${date(a.activity_date + "T12:00:00")}`
        : "Nuova lavagna",
      emptyBoard(),
      a?.id || null,
    );
  };
  const duplicateBoard = () => {
    if (!board?.revision || dirty || busy || playing) return;
    draft(("Copia · " + title).slice(0, 120), doc);
    baseline.current = null;
    setSettingsOpen(true);
    setNotice(
      "Copia pronta. Salvala per aggiungerla alle lavagne dello staff.",
    );
  };
  const loadList = useCallback(
    async (offset = 0, search = listFilter.current) => {
      if (!allowed) {
        setLoading(false);
        return;
      }
      const request = ++listRequest.current;
      listFilter.current = search;
      setFilter(search);
      setLoading(true);
      setError("");
      if (!offset) setHasMore(false);
      try {
        const rows = await api.list(offset, search);
        if (current() && request === listRequest.current) {
          setBoards((old) => (offset ? [...old, ...rows] : rows));
          setHasMore(rows.length === 50);
        }
      } catch (e) {
        if (current() && request === listRequest.current)
          setError((e as Error).message || "Lavagne non caricate. Riprova.");
      } finally {
        if (current() && request === listRequest.current) setLoading(false);
      }
    },
    [allowed, api, current],
  );
  const createLinked = useEffectEvent((id: string) => {
    void create(id);
  });
  const boardId = params.get("board") || "",
    linkedActivity = params.get("activity") || "";
  useEffect(() => {
    if (allowed && linkedActivity && !boardId) createLinked(linkedActivity);
  }, [allowed, linkedActivity, boardId]);
  useEffect(() => {
    alive.current = true;
    void loadList();
    return () => {
      alive.current = false;
    };
  }, [loadList]);
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
  }, [runtime, dirty, canLeave]);
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
  const importFile = (file: File) =>
    void run(async () => {
      if (file.size > maxBoardBytes + 1024)
        throw Error(
          "Il file è troppo grande. Scegli un file di lavagna Eburum.",
        );
      let value: { format?: unknown; title?: unknown; document?: unknown };
      try {
        value = JSON.parse(await file.text());
      } catch {
        throw Error(
          "Il file non è leggibile. Scegli un file di lavagna Eburum.",
        );
      }
      if (
        value?.format !== "eburum-whiteboard-1" ||
        typeof value.title !== "string" ||
        !value.title.trim() ||
        value.title.length > 120
      )
        throw Error("Il file non è una lavagna Eburum.");
      validateBoard(value.document);
      if (!current()) return;
      draft(value.title.trim(), value.document);
      baseline.current = null;
      setNotice(
        "Lavagna importata come bozza. Salvala per renderla disponibile allo staff.",
      );
    });
  const open = async (id: string) => {
    if (!(await canLeave())) return;
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
  const close = async () => {
    if (!(await canLeave())) return;
    setBoard(null);
    setPlaying(false);
    setAnimated(null);
    setError("");
    if (params.get("board") && location.state?.boardEntry) navigate(-1);
    else if (params.get("board") || params.get("activity"))
      setParams(
        (p) => {
          p.delete("board");
          p.delete("activity");
          return p;
        },
        { replace: true },
      );
  };
  const syncBoard = useEffectEvent(async (cancelled: () => boolean) => {
    if (!allowed) return;
    const id = params.get("board");
    if (id && id !== board?.id) {
      if (!(await canLeave())) {
        if (cancelled()) return;
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
      if (cancelled()) return;
      void run(async () => {
        const value = await api.load(id);
        if (current() && !cancelled()) restore(value);
      });
    } else if (!id && board?.updated_at) {
      if (!(await canLeave())) {
        if (cancelled()) return;
        setParams(
          (p) => {
            p.set("board", board.id);
            return p;
          },
          { replace: true, state: { boardEntry: true } },
        );
        return;
      }
      if (cancelled()) return;
      setBoard(null);
      setPlaying(false);
      setAnimated(null);
      requestAnimationFrame(() =>
        window.scrollTo({ top: libraryScroll.current, behavior: "instant" }),
      );
    }
  });
  useEffect(() => {
    let cancelled = false;
    void syncBoard(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [boardId, api, allowed]);
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
          {
            replace: params.has("board"),
            state: {
              boardEntry: params.has("board")
                ? location.state?.boardEntry
                : true,
            },
          },
        );
      setNotice("Lavagna salvata e disponibile allo staff tecnico.");
      setBoards((rows) => [
        ...(value.title
          .toLocaleLowerCase("it-IT")
          .includes(listFilter.current.toLocaleLowerCase("it-IT"))
          ? [value]
          : []),
        ...rows.filter((b) => b.id !== value.id),
      ]);
    });
  };
  const undo = (redo = false) => {
    setSelected("");
    setPreview(null);
    drag.current = null;
    const next = redo ? history.future[0] : history.past.at(-1);
    if (next) setPhaseIndex(Math.min(phase, next.phases?.length ?? 0));
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
    commitMarks(marks.filter((m) => m.id !== selected));
    setSelected("");
  };
  const updateSelected = (
    patch: Partial<Pick<Mark, "label" | "color" | "dashed" | "scale">>,
    coalesce = false,
  ) =>
    commitMarks(
      marks.map((m) =>
        m.id === selected ? view.move({ ...m, ...patch }, 0, 0) : m,
      ),
      coalesce,
    );
  const duplicateSelected = () => {
    const mark = marks.find((m) => m.id === selected);
    if (!mark || marks.length >= 200) return;
    const delta = view.nudge(mark.points[0], 32, 24);
    const copy = {
      ...view.move(mark, delta.x, delta.y),
      id: crypto.randomUUID(),
    };
    commitMarks([...marks, copy]);
    setSelected(copy.id);
  };
  const insertFormation = (formation: keyof typeof formations) => {
    if (view.half || doc.background !== "pitch" || marks.length > 189) return;
    commitMarks([...marks, ...formationMarks(formation)]);
    setSelected("");
    setTool("select");
  };
  const resizeElement = (scale: number, coalesce = false) => {
    if (busy || !Number.isFinite(scale) || scale < 0.25 || scale > 2) return;
    const mark = marks.find((m) => m.id === selected);
    const kind = mark?.kind ?? tool;
    if (isEquipmentKind(kind)) setEquipmentScale(scale);
    else if (half && isPlayerKind(kind)) {
      if (!mark) setPlayerScale(scale);
    } else return;
    if (!mark) return;
    updateSelected({ scale }, coalesce);
  };
  const point = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * view.width,
      y: ((e.clientY - rect.top) / rect.height) * view.height,
    };
  };
  const pointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (busy || playing || tool === "pan" || e.button > 0 || drag.current)
      return;
    const screen = point(e);
    if (screen.y > view.drawingHeight) return;
    const p = view.unproject(screen.x, screen.y);
    if (tool === "select") {
      const id =
        (e.target as Element)
          .closest("[data-mark]")
          ?.getAttribute("data-mark") || "";
      setSelected(id);
      const stored = marks.find((m) => m.id === id);
      const mark = stored && view.move(stored, 0, 0);
      if (mark)
        drag.current = { pointer: e.pointerId, start: p, mark, moving: true };
    } else {
      if (marks.length >= 200) {
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
      const free = tool === "arrow" && freeArrow;
      let mark: Mark = {
        id: crypto.randomUUID(),
        kind: tool,
        color,
        points: [p],
        ...(tool === "arrow" && dashedArrow ? { dashed: true } : {}),
        ...(isEquipmentKind(tool)
          ? { scale: equipmentScale }
          : half && isPlayerKind(tool) && playerScale !== 1
            ? { scale: playerScale }
            : {}),
        label:
          tool === "text"
            ? label.trim()
            : isPlayerKind(tool)
              ? label.trim().slice(0, 4)
              : "",
      };
      if (tool === "circle" || (tool === "arrow" && !free)) mark.points.push(p);
      if (isPointMark(tool)) mark = view.move(mark, 0, 0);
      drag.current = {
        pointer: e.pointerId,
        start: p,
        mark,
        moving: false,
        freeArrow: free,
      };
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
    const { x, y } = point(e);
    const p = view.unproject(x, y);
    if (gesture.moving)
      setPreview(
        view.move(gesture.mark, p.x - gesture.start.x, p.y - gesture.start.y),
      );
    else {
      if (gesture.freeArrow) gesture.mark = extendArrow(gesture.mark, p);
      else if (gesture.mark.kind === "pen" && gesture.mark.points.length < 600)
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
      const { x, y } = point(e);
      const p = view.unproject(x, y);
      const mark = gesture.moving
        ? view.move(gesture.mark, p.x - gesture.start.x, p.y - gesture.start.y)
        : gesture.freeArrow
          ? extendArrow(gesture.mark, p)
          : ["arrow", "circle"].includes(gesture.mark.kind)
            ? { ...gesture.mark, points: [gesture.start, p] }
            : gesture.mark;
      if (
        gesture.moving ||
        !["arrow", "circle"].includes(mark.kind) ||
        mark.points.some(
          (point) =>
            Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) >
            5,
        )
      )
        commitMarks(
          gesture.moving
            ? marks.map((m) => (m.id === mark.id ? mark : m))
            : [...marks, mark],
        );
    }
    drag.current = null;
    setPreview(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const fileName =
    title
      .replace(/[^\p{L}\p{N} -]/gu, "")
      .slice(0, 80)
      .trim() || "lavagna-eburum";
  const exportFile = () =>
    void run(async () => {
      validateBoard(doc);
      if (!current()) return;
      saveDownload(
        new Blob(
          [
            JSON.stringify({
              format: "eburum-whiteboard-1",
              title: title.trim() || "Lavagna tattica",
              document: doc,
            }),
          ],
          { type: "application/json" },
        ),
        fileName + ".json",
      );
      setNotice("File modificabile esportato.");
    });
  const copyLink = () =>
    void run(async () => {
      if (!board?.revision || dirty || !current()) return;
      if (!navigator.clipboard?.writeText)
        throw Error("Copia l’indirizzo della lavagna dalla barra del browser.");
      const url = new URL(window.location.pathname, window.location.origin);
      url.hash = `/whiteboard?board=${encodeURIComponent(board.id)}`;
      await navigator.clipboard.writeText(url.href);
      if (current())
        setNotice(
          "Link copiato. Lo può aprire lo staff tecnico della squadra.",
        );
    });
  const exportPng = () =>
    void run(async () => {
      if (!svg.current) return;
      const blob = await renderWhiteboardImage(
        svg.current,
        title,
        doc.background === "pitch" && doc.whitePitch === true,
      );
      if (!current()) return;
      saveDownload(blob, fileName + ".png");
      setNotice(
        "Immagine esportata. Contiene anche le modifiche non ancora salvate.",
      );
    });

  const activityRows = runtime.state.activities.filter(
    (a) => a.activity_type !== "Riunione",
  );
  const shown = (
    animated ??
    (preview ? [...marks.filter((m) => m.id !== preview.id), preview] : marks)
  ).map((m) => {
    const positioned = view.move(m, 0, 0);
    return { ...positioned, points: positioned.points.map(view.projectMark) };
  });

  return {
    addPhase,
    activity,
    activityRows,
    allowed,
    api,
    board,
    boards,
    busy,
    canLeave,
    close,
    color,
    commit,
    commitMarks,
    compact,
    copyLink,
    create,
    current,
    dashedArrow,
    dirty,
    doc,
    drag,
    duplicateBoard,
    duplicateSelected,
    error,
    exportFile,
    exportPng,
    equipmentScale,
    finishPointer,
    filter,
    freeArrow,
    goToPhase,
    hasMore,
    history,
    importFile,
    insertFormation,
    label,
    loadList,
    loading,
    location,
    markerId,
    marks,
    navigate,
    notice,
    open,
    params,
    pending,
    phase,
    phaseCount: phases.length,
    photo,
    playerScale,
    playing,
    pointerDown,
    pointerMove,
    portrait,
    removeSelected,
    removePhase,
    resizeElement,
    role,
    run,
    save,
    selected,
    setActivity,
    setBoard,
    setBoards,
    setColor,
    setDashedArrow,
    setFreeArrow,
    setError,
    setLabel,
    setNotice,
    setParams,
    setPreview,
    setSelected,
    setSettingsOpen,
    setTitle,
    setTool,
    settingsOpen,
    shown,
    svg,
    title,
    togglePlayback,
    tool,
    undo,
    updateSelected,
    view,
  };
}
