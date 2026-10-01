"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PALETTE_12 } from "@/lib/types";

/** Color elegible (no aleatorio). Default = color de la categoría. */
export function ColorPicker({
  label,
  hint,
  defaultValue,
  name = "color",
}: {
  label: string;
  hint?: string;
  defaultValue: string;
  name?: string;
}) {
  const initial = (PALETTE_12 as readonly string[]).includes(defaultValue)
    ? defaultValue
    : PALETTE_12[0];
  const [value, setValue] = useState(initial);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="grid grid-cols-6 gap-1.5" role="group" aria-label={label}>
        {PALETTE_12.map((c) => {
          const selected = value === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={selected}
              aria-label={c}
              onClick={() => setValue(c)}
              className={`flex h-9 items-center justify-center rounded-xl transition ${
                selected ? "ring-2 ring-offset-2 ring-accent" : "hover:scale-105"
              }`}
              style={{ backgroundColor: c + "40" }}
            >
              <span style={{ color: c }}>
                {selected ? <Check size={16} strokeWidth={2.5} /> : <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c }} />}
              </span>
            </button>
          );
        })}
      </div>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
