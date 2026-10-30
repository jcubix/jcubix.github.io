import {
  boardColors,
  boardNoteLayout,
  isEquipmentKind,
  type Mark,
} from "../whiteboard-model";
import { EquipmentSymbol, PlayerSymbol } from "./symbols";
import "../whiteboard.css";

export function Ink({
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
  if (isEquipmentKind(m.kind))
    return (
      <g
        transform={`translate(${p.x} ${p.y})${portrait ? " rotate(-90) scale(1.2)" : ""}`}
      >
        <EquipmentSymbol kind={m.kind} color={m.color} />
      </g>
    );
  if (m.kind === "home" || m.kind === "away")
    return (
      <g transform={upright}>
        <g
          transform={`translate(${p.x} ${p.y}) scale(${portrait ? 28 / 22 : 1})`}
        >
          <PlayerSymbol away={m.kind === "away"} />
        </g>
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
