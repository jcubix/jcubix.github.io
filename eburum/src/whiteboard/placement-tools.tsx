import { Shapes } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import {
  boardEquipment,
  isEquipmentKind,
  type EquipmentKind,
} from "../whiteboard-model";
import type { Tool } from "./model";
import { EquipmentSymbol, PlayerSymbol } from "./symbols";

const equipmentKinds = Object.keys(boardEquipment) as EquipmentKind[];
export function PlacementTools({
  tool,
  busy,
  color,
  onSelect,
}: {
  tool: Tool;
  busy: boolean;
  color: string;
  onSelect: (tool: Tool) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const equipment = isEquipmentKind(tool) ? tool : null;
  return (
    <>
      <div
        className="wb-placement"
        role="group"
        aria-label="Giocatori e attrezzi"
      >
        {(["home", "away"] as const).map((kind) => (
          <Button
            key={kind}
            variant="secondary"
            disabled={busy}
            aria-pressed={tool === kind}
            aria-label={kind === "home" ? "Eburum" : "Avversario"}
            onClick={() => onSelect(kind)}
          >
            <svg viewBox="-28 -28 56 56" aria-hidden="true">
              <PlayerSymbol away={kind === "away"} />
            </svg>
            <span>{kind === "home" ? "Eburum" : "Avversari"}</span>
          </Button>
        ))}
        <Button
          ref={trigger}
          variant="secondary"
          disabled={busy}
          aria-label={`Attrezzi: ${equipment ? boardEquipment[equipment].label : "scegli un attrezzo"}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-pressed={!!equipment}
          onClick={() => setOpen(true)}
        >
          {equipment ? (
            <svg viewBox="-50 -50 100 100" aria-hidden="true">
              <EquipmentSymbol kind={equipment} color={color} />
            </svg>
          ) : (
            <Shapes />
          )}
          <span>
            {equipment ? boardEquipment[equipment].label : "Attrezzi"}
          </span>
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Attrezzi da allenamento"
        description="Scegli un attrezzo, poi tocca il campo per posizionarlo. Puoi inserirlo più volte e spostarlo con Sposta."
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus({ preventScroll: true });
        }}
      >
        <div className="wb-equipment-picker">
          {equipmentKinds.map((kind) => (
            <Button
              key={kind}
              variant="secondary"
              aria-pressed={tool === kind}
              disabled={busy}
              onClick={() => {
                onSelect(kind);
                setOpen(false);
              }}
            >
              <svg viewBox="-50 -50 100 100" aria-hidden="true">
                <EquipmentSymbol kind={kind} color={color} />
              </svg>
              <span>{boardEquipment[kind].label}</span>
            </Button>
          ))}
        </div>
      </Dialog>
    </>
  );
}
