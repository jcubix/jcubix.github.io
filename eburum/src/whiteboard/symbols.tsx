import type { EquipmentKind } from "../whiteboard-model";

// The palette and the field share the same silhouettes, including PNG exports.
export function PlayerSymbol({ away = false }: { away?: boolean }) {
  return away ? (
    <path
      d="M0-22 22 0 0 22-22 0Z"
      fill="#ffd3da"
      stroke="#7c2638"
      strokeWidth="3"
      strokeLinejoin="round"
    />
  ) : (
    <circle r="22" fill="#d9e7ff" stroke="#243f70" strokeWidth="3" />
  );
}

export function EquipmentSymbol({
  kind,
  color = "#f4cf63",
}: {
  kind: EquipmentKind;
  color?: string;
}) {
  const shape = (() => {
    switch (kind) {
      case "disc":
        return (
          <>
            <ellipse rx="29" ry="10" fill={color} />
            <ellipse cy="-2" rx="9" ry="3" fill="#14213b" />
          </>
        );
      case "cone":
        return (
          <>
            <path d="M-21 25 0-27 21 25Z" fill={color} />
            <path d="M-12 3H12M-18 16H18" stroke="#ffffff" strokeWidth="6" />
            <path d="M-23 27H23" />
          </>
        );
      case "pole":
        return (
          <>
            <path d="M0-37V34" stroke={color} strokeWidth="9" />
            <path d="M-10 37H10M-4-18H4M-4 0H4" />
          </>
        );
      case "mannequin":
        return (
          <>
            <circle cy="-28" r="9" fill={color} />
            <path d="M-14-16H14L21 15H8V35H-8V15H-21Z" fill={color} />
            <path d="M-18 37H18M-10-6H10M-12 4H12" />
          </>
        );
      case "ball":
        return (
          <>
            <circle r="21" fill="#ffffff" />
            <path
              d="m0-9 9 7-3 11H-6L-9-2Zm0-12v7M20-7l-8 3M13 17l-5-6M-13 17l5-6M-20-7l8 3"
              fill="#14213b"
            />
          </>
        );
      case "hurdle":
        return (
          <>
            <path d="M-27 20V-19H27V20" stroke={color} strokeWidth="7" />
            <path d="M-34 21H-20M20 21H34M-24-10H24" />
          </>
        );
      case "ladder":
        return (
          <>
            <path d="M-24-42V42M24-42V42" stroke={color} strokeWidth="5" />
            <path
              d="M-24-32H24M-24-16H24M-24 0H24M-24 16H24M-24 32H24"
              stroke={color}
              strokeWidth="5"
            />
          </>
        );
      case "mini_goal":
        return (
          <>
            <path
              d="M-40 24V-23H27L40-8V24Z"
              fill="#14213b"
              fillOpacity=".35"
            />
            <path
              d="M-29-21V23M-17-21V23M-5-21V23M7-21V23M19-21V23M-39-8H38M-39 7H39"
              stroke="#ffffff"
              strokeWidth="2"
            />
            <path
              d="M-40 24V-23H27V24M27-23 40-8V24M-40 24H40"
              stroke={color}
              strokeWidth="5"
            />
          </>
        );
      case "hoop":
        return (
          <>
            <circle r="24" fill="none" stroke={color} strokeWidth="7" />
            <circle r="19" fill="none" stroke="#14213b" strokeWidth="2" />
          </>
        );
    }
  })();
  return (
    <g
      fill="none"
      stroke="#14213b"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {shape}
    </g>
  );
}
