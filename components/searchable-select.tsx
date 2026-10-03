"use client";

import { useId, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";

export type SearchableOption = {
  id: string;
  label: string;
  sublabel?: string;
  color?: string;
  icon?: string;
};

type Props = {
  options: SearchableOption[];
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  label?: string;
  emptyLabel?: string;
  allowClear?: boolean;
  className?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Elegir…",
  label,
  emptyLabel = "Ninguno",
  allowClear = true,
  className = "",
  searchPlaceholder = "Buscar…",
  disabled = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: "top" | "bottom";
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownId = useId();

  const selected = useMemo(() => {
    return options.find((o) => o.id === value);
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, query]);

  // Compute fixed position with collision detection (opens upwards if near bottom of screen)
  useEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // If space below is less than 220px and more space above, open upwards!
      const openUpwards = spaceBelow < 220 && spaceAbove > spaceBelow;

      if (openUpwards) {
        const maxHeight = Math.max(120, Math.min(spaceAbove - 16, 260));
        setCoords({
          bottom: viewportHeight - rect.top + 6,
          left: rect.left,
          width: Math.max(rect.width, 240),
          maxHeight,
          placement: "top",
        });
      } else {
        const maxHeight = Math.max(120, Math.min(spaceBelow - 16, 260));
        setCoords({
          top: rect.bottom + 6,
          left: rect.left,
          width: Math.max(rect.width, 240),
          maxHeight,
          placement: "bottom",
        });
      }
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Click outside listener (checking both container and portaled popover)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inPopover = popoverRef.current?.contains(target);
      if (!inContainer && !inPopover) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`} ref={containerRef}>
      {label && <label className="text-xs font-medium text-muted">{label}</label>}

      <div className="relative w-full">
        {/* Trigger Button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={dropdownId}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-sm transition-all ${
            isOpen
              ? "glass-input border-accent ring-2 ring-accent/20 shadow-xs"
              : "glass-input cursor-pointer"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {selected?.color ? (
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                style={{ backgroundColor: selected.color }}
              />
            ) : selected?.icon ? (
              <span className="shrink-0 text-muted">
                <CategoryIcon icon={selected.icon} size={15} />
              </span>
            ) : null}

            <div className="min-w-0 flex-1 truncate">
              {selected ? (
                <span className="font-medium text-foreground truncate block">
                  {selected.label}
                </span>
              ) : (
                <span className="text-muted truncate block">{placeholder}</span>
              )}
            </div>
          </div>

          <ChevronDown
            size={16}
            className={`text-muted shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-foreground" : ""
            }`}
          />
        </button>

        {/* Dropdown Popover (Portaled to document.body to avoid Backdrop Root nesting) */}
        {isOpen && coords && typeof document !== "undefined" && createPortal(
          <div
            ref={popoverRef}
            id={dropdownId}
            role="listbox"
            onKeyDown={handleKeyDown}
            style={{
              position: "fixed",
              ...(coords.placement === "top"
                ? { bottom: `${coords.bottom}px` }
                : { top: `${coords.top}px` }),
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`,
              zIndex: 10005,
            }}
            className="glass-dropdown p-1.5 animate-in fade-in-0 duration-150 flex flex-col"
          >
            {/* Search Input */}
            <div className="relative px-2.5 py-1.5 border-b border-white/10 mb-1 flex items-center gap-2 rounded-xl bg-white/30 dark:bg-white/[0.04] shrink-0">
              <Search size={14} className="text-muted shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted outline-none"
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-0.5 rounded-md text-muted hover:text-foreground hover:bg-default/20 transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Options List */}
            <div
              style={{ maxHeight: `${Math.max(coords.maxHeight - 55, 100)}px` }}
              className="overflow-y-auto overscroll-contain flex flex-col gap-0.5 custom-scrollbar p-0.5"
            >
              {allowClear && (
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    !value
                      ? "bg-accent/15 text-accent font-semibold"
                      : "text-muted hover:bg-default/15 hover:text-foreground"
                  }`}
                >
                  <span>{emptyLabel}</span>
                  {!value && <Check size={14} className="text-accent shrink-0" />}
                </button>
              )}

              {filtered.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted">
                  No hay resultados
                </div>
              ) : (
                filtered.map((opt) => {
                  const isSelected = opt.id === value;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(opt.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                        isSelected
                          ? "bg-accent/15 text-accent font-semibold"
                          : "text-foreground hover:bg-default/15"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {opt.color ? (
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: opt.color }}
                          />
                        ) : opt.icon ? (
                          <span className="shrink-0 text-muted">
                            <CategoryIcon icon={opt.icon} size={14} />
                          </span>
                        ) : null}
                        <div className="truncate min-w-0 flex-1">
                          <span className="truncate block font-medium">{opt.label}</span>
                          {opt.sublabel && (
                            <span className="text-[10px] text-muted truncate block">
                              {opt.sublabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <Check size={14} className="text-accent shrink-0 ml-1" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
