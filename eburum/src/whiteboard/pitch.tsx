import { memo } from "react";
import type { Point } from "../whiteboard-model";
import type { pitchView } from "./pitch-view";

type Position = [number, number];

const leftLines: Position[][] = [
  [
    [32, 165],
    [190, 165],
    [190, 475],
    [32, 475],
  ],
  [
    [32, 245],
    [95, 245],
    [95, 395],
    [32, 395],
  ],
  [
    [32, 300],
    [18, 300],
    [18, 340],
    [32, 340],
  ],
];

function arc(x: number, start: number, end: number, radius = 78): Position[] {
  return Array.from({ length: 49 }, (_, i) => {
    const angle = start + ((end - start) * i) / 48;
    return [x + radius * Math.cos(angle), 320 + radius * Math.sin(angle)];
  });
}

export const Pitch = memo(function Pitch({
  white,
  view,
}: {
  white: boolean;
  view: ReturnType<typeof pitchView>;
}) {
  const line = white ? "#4b5563" : "#e1efe8";
  const edge = view.half ? 500 : 968;
  const penaltyAngle = Math.asin(65 / 78);
  const penaltyArc = arc(
    190 - 78 * Math.cos(penaltyAngle),
    -penaltyAngle,
    penaltyAngle,
  );
  const lines: Position[][] = [
    [
      [32, 32],
      [edge, 32],
      [edge, 608],
      [32, 608],
      [32, 32],
    ],
    ...leftLines,
    penaltyArc,
    arc(500, Math.PI / 2, view.half ? (3 * Math.PI) / 2 : (5 * Math.PI) / 2),
  ];
  if (!view.half) {
    lines.push(
      [
        [500, 32],
        [500, 608],
      ],
      ...[...leftLines, penaltyArc].map((line) =>
        line.map(([x, y]): Position => [1000 - x, y]),
      ),
    );
  }
  const project = ([x, y]: Position): Point => view.projectPitch({ x, y });
  const path = lines
    .map((line) =>
      line
        .map((position, i) => {
          const { x, y } = project(position);
          return `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(""),
    )
    .join(" ");
  const spots = (view.half ? [140, 500] : [140, 500, 860]).map((x) =>
    project([x, 320]),
  );
  return (
    <g aria-hidden="true" data-pitch={view.half ? "half" : "full"}>
      <path
        d={path}
        stroke={line}
        strokeWidth="2.5"
        fill="none"
        opacity={white ? 1 : 0.8}
      />
      {spots.map(({ x, y }, i) => (
        <circle key={i} cx={x} cy={y} r="4" fill={line} />
      ))}
    </g>
  );
});
