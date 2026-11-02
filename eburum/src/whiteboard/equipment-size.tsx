import { useId, useRef } from "react";

export function EquipmentSize({
  value,
  label,
  busy,
  onChange,
}: {
  value: number;
  label: string;
  busy: boolean;
  onChange: (value: number, coalesce: boolean) => void;
}) {
  const id = useId();
  const gesture = useRef(false);
  const end = () => {
    gesture.current = false;
  };
  return (
    <div className="wb-size">
      <div>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{Math.round(value * 100)}%</output>
      </div>
      <input
        id={id}
        type="range"
        min="25"
        max="200"
        step="5"
        value={Math.round(value * 100)}
        aria-valuetext={`${Math.round(value * 100)} per cento`}
        disabled={busy}
        onPointerDown={end}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyUp={end}
        onBlur={end}
        onChange={(event) => {
          onChange(Number(event.target.value) / 100, gesture.current);
          gesture.current = true;
        }}
      />
    </div>
  );
}
