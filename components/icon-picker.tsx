"use client";

import { useState } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { CATEGORY_ICON_KEYS } from "@/lib/category-icons";

export function IconPicker({
  label,
  defaultValue,
}: {
  label: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(
    defaultValue && (CATEGORY_ICON_KEYS as readonly string[]).includes(defaultValue)
      ? defaultValue
      : CATEGORY_ICON_KEYS[0]
  );

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={label}>
        {CATEGORY_ICON_KEYS.map((key) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              aria-label={key}
              onClick={() => setValue(key)}
              className={`flex h-9 items-center justify-center rounded-xl transition-all cursor-pointer ${
                selected
                  ? "bg-accent text-accent-foreground shadow-xs ring-1 ring-accent/30"
                  : "bg-surface/60 dark:bg-zinc-900/60 border border-white/10 dark:border-white/5 text-muted hover:text-foreground hover:bg-surface/90"
              }`}
            >
              <CategoryIcon icon={key} size={17} />
            </button>
          );
        })}
      </div>
      <input type="hidden" name="icon" value={value} />
    </div>
  );
}
