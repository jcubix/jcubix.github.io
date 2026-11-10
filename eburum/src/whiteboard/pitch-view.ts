import {
  boardPoint,
  moveMark,
  type Mark,
  type Point,
} from "../whiteboard-model";

export function pitchView(half: boolean, portrait: boolean, raised: boolean) {
  // A real half is wider than it is deep. Leave writing space on the portrait sheet.
  const rotated = portrait || half;
  const length = half ? (portrait ? 700 : 532) : 1000;
  const width = rotated ? 640 : length;
  const depth = rotated ? length : 640;
  const tilt = raised ? 0.84 : 1;
  const inset = raised ? 20 : 0;
  const height = depth * tilt + 2 * inset;
  const taper = (y: number) => (raised ? 0.82 + 0.18 * (y / depth) : 1);

  const toScreen = ({ x, y }: Point) =>
    rotated ? { x: 640 - y, y: x } : { x, y };
  const fromScreen = ({ x, y }: Point) =>
    rotated ? { x: y, y: 640 - x } : { x, y };
  const projectPitch = (point: Point): Point => {
    if (!raised) return point;
    const { x, y } = toScreen(point);
    return fromScreen({
      x: width / 2 + (x - width / 2) * taper(y),
      y: inset + y * tilt,
    });
  };
  const projectMark = ({ x, y }: Point): Point =>
    projectPitch({ x: half ? 16 + x / 2 : x, y });
  const unproject = (x: number, y: number): Point => {
    const depthPosition = Math.max(0, Math.min(depth, (y - inset) / tilt));
    const point = fromScreen({
      x: width / 2 + (x - width / 2) / taper(depthPosition),
      y: depthPosition,
    });
    return boardPoint(half ? (point.x - 16) * 2 : point.x, point.y);
  };
  const nudge = (p: Point, dx: number, dy: number) => {
    const screen = toScreen(projectMark(p));
    const next = unproject(screen.x + dx, screen.y + dy);
    return { x: next.x - p.x, y: next.y - p.y };
  };
  return {
    width,
    height,
    rotated,
    half,
    projectPitch,
    projectMark,
    unproject,
    nudge,
    move: (mark: Mark, dx: number, dy: number) => {
      const noteTilt = mark.kind === "text" ? tilt : 1;
      return moveMark(
        mark,
        dx,
        dy,
        rotated,
        (half ? 0.5 : 1) * (rotated ? noteTilt : 1),
        rotated ? 1 : noteTilt,
      );
    },
    drawingHeight: half && portrait ? inset + 532 * tilt : height,
  };
}
