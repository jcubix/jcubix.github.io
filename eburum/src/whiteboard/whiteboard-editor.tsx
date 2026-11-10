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
import {
  boardColors,
  boardEquipment,
  boardPhoto,
  isEquipmentKind,
  isPlayerKind,
  playerRadius,
  pitchLayouts,
  type PitchLayout,
} from "../whiteboard-model";
import "../whiteboard.css";
import { Ink } from "./ink";
import { ElementSize } from "./element-size";
import { colorNames, date, markLabel, tools } from "./model";
import { Pitch } from "./pitch";
import { PlacementTools } from "./placement-tools";
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
    close,
    color,
    commit,
    compact,
    current,
    dashedArrow,
    dirty,
    doc,
    drag,
    exportPng,
    equipmentScale,
    finishPointer,
    freeArrow,
    history,
    label,
    markerId,
    pending,
    photo,
    playerScale,
    pointerDown,
    pointerMove,
    portrait,
    removeSelected,
    resizeElement,
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
    tool,
    undo,
    view,
  } = model;
  if (!board) return null;
  const selectedMark = doc.marks.find((m) => m.id === selected);
  const sizeKind = selectedMark?.kind ?? tool;
  const sizeEquipment = isEquipmentKind(sizeKind);
  const sizePlayer = view.half && isPlayerKind(sizeKind);
  const playerTool = isPlayerKind(tool);
  const whitePitch = doc.background === "pitch" && doc.whitePitch === true;
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
      {doc.background === "pitch" ? (
        <fieldset className="wb-fields wb-pitch-settings" disabled={busy}>
          <label>
            Formato campo
            <select
              value={doc.pitchLayout ?? "auto"}
              onChange={(e) =>
                commit({ ...doc, pitchLayout: e.target.value as PitchLayout })
              }
            >
              {Object.entries(pitchLayouts).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sfondo del campo
            <select
              value={whitePitch ? "white" : "green"}
              onChange={(e) =>
                commit({ ...doc, whitePitch: e.target.value === "white" })
              }
            >
              <option value="green">Verde</option>
              <option value="white">Bianco</option>
            </select>
          </label>
          <label>
            Vista del campo
            <select
              value={doc.raisedPitch ? "raised" : "flat"}
              onChange={(e) =>
                commit({ ...doc, raisedPitch: e.target.value === "raised" })
              }
            >
              <option value="flat">Dall’alto</option>
              <option value="raised">Rialzata</option>
            </select>
          </label>
        </fieldset>
      ) : null}
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
                  setLabel("");
                  setSelected("");
                  setError("");
                }}
              >
                <Icon />
                <span>{name}</span>
              </Button>
            ))}
          </div>
          <PlacementTools
            tool={tool}
            busy={busy}
            color={color}
            onSelect={(kind) => {
              setTool(kind);
              setLabel("");
              setSelected("");
              setError("");
            }}
          />
          <div
            className="wb-options"
            data-sizing={tool === "select" || isEquipmentKind(tool)}
          >
            {!playerTool ? (
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
            ) : null}
            {sizeEquipment || sizePlayer ? (
              <ElementSize
                key={selectedMark?.id ?? tool}
                value={
                  selectedMark
                    ? (selectedMark.scale ?? 1)
                    : sizeEquipment
                      ? equipmentScale
                      : playerScale
                }
                label={
                  selectedMark
                    ? `Dimensione · ${sizeEquipment ? boardEquipment[sizeKind].label : sizeKind === "home" ? "Eburum" : "Avversario"}`
                    : sizeEquipment
                      ? "Dimensione nuovi attrezzi"
                      : "Dimensione nuove sagome"
                }
                busy={busy}
                onChange={resizeElement}
              />
            ) : null}
            {tool === "arrow" ? (
              <div
                className="wb-arrow-options"
                role="group"
                aria-label="Opzioni freccia"
              >
                <Button
                  variant="secondary"
                  aria-pressed={freeArrow}
                  disabled={busy}
                  onClick={() => setFreeArrow(!freeArrow)}
                >
                  Linea libera
                </Button>
                <Button
                  variant="secondary"
                  aria-pressed={dashedArrow}
                  disabled={busy}
                  onClick={() => setDashedArrow(!dashedArrow)}
                >
                  Tratteggiata
                </Button>
              </div>
            ) : tool === "text" ? (
              <label className="wb-label">
                Testo della nota
                <textarea
                  rows={2}
                  value={label}
                  maxLength={80}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={busy}
                  placeholder="Scrivi la nota, poi tocca il campo"
                />
              </label>
            ) : playerTool ? (
              <label className="wb-label">
                Numero o sigla (facoltativo)
                <Input
                  value={label}
                  maxLength={4}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={busy}
                  placeholder="Lascia vuoto per la sagoma"
                />
              </label>
            ) : !sizeEquipment && !sizePlayer ? (
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
            ) : null}
          </div>
        </div>
        <div className="wb-stage" data-portrait={portrait}>
          <svg
            ref={svg}
            viewBox={`0 0 ${view.width} ${view.height}`}
            data-tool={tool}
            role="application"
            aria-label="Lavagna interattiva: usa gli strumenti per disegnare o seleziona un elemento dall’elenco sottostante"
            aria-describedby={`${markerId}-help`}
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
                const delta = view.nudge(m.points[0], dx, dy);
                const next = view.move(m, delta.x, delta.y);
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
                  markerWidth="28"
                  markerHeight="26"
                  refX="24"
                  refY="13"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path
                    d="M4 3L24 13L4 23Z"
                    fill={c}
                    stroke="#0b1220"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </marker>
              ))}
            </defs>
            <rect
              width={view.width}
              height={view.height}
              fill={
                doc.background === "pitch"
                  ? whitePitch
                    ? "#ffffff"
                    : "#17483e"
                  : "#0b1220"
              }
              aria-hidden="true"
            />
            <g
              transform={
                view.rotated ? "translate(640 0) rotate(90)" : undefined
              }
            >
              {doc.background === "pitch" ? (
                <Pitch white={whitePitch} view={view} />
              ) : (
                <image
                  href={doc.background}
                  width="1000"
                  height="640"
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              {shown.map((m, i) => (
                <g
                  key={m.id}
                  data-mark={m.id}
                  role="img"
                  aria-label={markLabel(m, i)}
                  style={{
                    cursor: tool === "select" ? "grab" : "crosshair",
                  }}
                >
                  {tool === "select" ? (
                    <circle
                      data-hit="true"
                      cx={m.points[0].x}
                      cy={m.points[0].y}
                      r={
                        view.half && isPlayerKind(m.kind)
                          ? Math.max(
                              compact ? 40 : 22,
                              playerRadius(m, view.rotated) + 4,
                            )
                          : compact
                            ? portrait
                              ? 56
                              : 80
                            : 48
                      }
                      fill="transparent"
                    />
                  ) : null}
                  <Ink mark={m} markerId={markerId} portrait={view.rotated} />
                  {selected === m.id ? (
                    <circle
                      data-selection="true"
                      cx={m.points[0].x}
                      cy={m.points[0].y}
                      r={
                        isPlayerKind(m.kind) && m.scale !== undefined
                          ? playerRadius(m, view.rotated) + 5
                          : 30
                      }
                      fill="none"
                      stroke={whitePitch ? "#14213b" : "#ffffff"}
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
        <p id={`${markerId}-help`} className="sc-helper">
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
              {markLabel(m, i)}
            </Button>
          ))}
        </div>
      </details>
      <div className="wb-close">
        <Button variant="ghost" disabled={busy} onClick={close}>
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
