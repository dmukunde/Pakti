"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { LIFE_CAPITALS, type LifeCapital } from "@/lib/domain/capitals";

export function CapitalChips() {
  const [selected, setSelected] = useState<LifeCapital[]>(["career", "financial"]);
  return (
    <div className="flex flex-wrap gap-2">
      {LIFE_CAPITALS.map((c) => (
        <Chip
          key={c.key}
          selected={selected.includes(c.key)}
          onClick={() =>
            setSelected((s) => (s.includes(c.key) ? s.filter((k) => k !== c.key) : [...s, c.key]))
          }
        >
          {c.label}
        </Chip>
      ))}
    </div>
  );
}

export function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button block variant="secondary" onClick={() => setOpen(true)}>
        Open bottom sheet
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Log progress">
        <p className="text-ink-muted">The log sheet is built in a later phase.</p>
      </Sheet>
    </>
  );
}
