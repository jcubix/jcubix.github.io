import {
  Download,
  ImagePlus,
  Presentation,
  Redo2,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { confirmDialog } from "../../app-confirm.js";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { boardColors, boardPhoto, moveMark } from "../whiteboard-model";
import "../whiteboard.css";
import { Ink } from "./ink";
import { colorNames, date, tools } from "./model";
import { Pitch } from "./pitch";
import { useWhiteboard } from "./use-whiteboard";
export function WhiteboardEditor({
  model,
}: {
  model: ReturnType<typeof useWhiteboard>;
}) {
  const {
    activity,
    activityRows,
    api,
    board,
    busy,
    canLeave,
    color,
    commit,
    compact,
    current,
    dirty,
    doc,
    drag,
    exportPng,
    finishPointer,
    history,
    label,
    markerId,
    pending,
    photo,
    pointerDown,
    pointerMove,
    portrait,
    removeSelected,
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
  } = model;
  if (!board) return null;
  return (
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
              <Button
                variant="secondary"
                aria-label="Esporta immagine"
                disabled={busy}
                onClick={exportPng}
              >
                <Download />
                <span className="wb-export-label">Esporta immagine</span>
              </Button>
              <Button
                disabled={
                  busy || (!dirty && !!board.updated_at) || !title.trim()
                }
                aria-label="Salva lavagna"
                onClick={save}
              >
                <Save />
                Salva<span className="wb-save-long-label"> lavagna</span>
              </Button>
            </div>
          </div>
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
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  e.key,
                )
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
                  marks: doc.marks.map((v) => (v.id === selected ? next : v)),
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
            <g transform={portrait ? "translate(640 0) rotate(90)" : undefined}>
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
        Foto JPG, PNG e WebP fino a 10 MB, ridimensionate per il salvataggio. Lo
        sfondo e i disegni si possono annullare separatamente.
      </p>
      <details className="wb-elements">
        <summary>Elementi sulla lavagna ({doc.marks.length}/200)</summary>
        <p className="sc-helper">
          Seleziona un elemento, poi usa Sposta e le frecce della tastiera. Canc
          elimina l’elemento.
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
      <div className="wb-close">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            if (await canLeave()) {
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
                  setBoards((rows) => rows.filter((b) => b.id !== board.id));
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
  );
}
