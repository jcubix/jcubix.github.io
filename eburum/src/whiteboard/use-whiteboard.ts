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
  boardViewPoint,
  emptyBoard,
  moveMark,
  type Board,
  type BoardDocument,
  type BoardSummary,
  type Mark,
  type Point,
} from "../whiteboard-model";
import "../whiteboard.css";
import { date, fingerprint, Tool } from "./model";
import { renderWhiteboardImage } from "./render-image";
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
  const current = useCallback(() => alive.current && api.current(), [api]);
  const commit = (next: BoardDocument) => {
    if (JSON.stringify(next) === JSON.stringify(doc)) return;
    setHistory((h) => ({
      past: [...h.past.slice(-39), h.doc],
      doc: next,
      future: [],
    }));
    setNotice("");
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
    setSelected("");
    setPreview(null);
    drag.current = null;
    setError("");
    setNotice("");
  };
  const create = async (linked = "") => {
    if (!(await canLeave())) return;
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
  const loadList = useCallback(
    async (offset = 0) => {
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
      const blob = await renderWhiteboardImage(svg.current, title, portrait);
      if (!current()) return;
      saveDownload(
        blob,
        (title.replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 80) ||
          "lavagna-eburum") + ".png",
      );
      setNotice(
        "Immagine esportata. Contiene anche le modifiche non ancora salvate.",
      );
    });

  const activityRows = runtime.state.activities.filter(
    (a) => a.activity_type !== "Riunione",
  );
  const shown = (
    preview
      ? [...doc.marks.filter((m) => m.id !== preview.id), preview]
      : doc.marks
  ).map((m) => moveMark(m, 0, 0, portrait));

  return {
    activity,
    activityRows,
    allowed,
    api,
    board,
    boards,
    busy,
    canLeave,
    color,
    commit,
    compact,
    create,
    current,
    dirty,
    doc,
    drag,
    error,
    exportPng,
    finishPointer,
    hasMore,
    history,
    label,
    loadList,
    loading,
    location,
    markerId,
    navigate,
    notice,
    open,
    params,
    pending,
    photo,
    pointerDown,
    pointerMove,
    portrait,
    removeSelected,
    role,
    run,
    save,
    selected,
    setActivity,
    setBoard,
    setBoards,
    setColor,
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
    tool,
    undo,
  };
}
