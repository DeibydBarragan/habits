"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/react";
import { X } from "lucide-react";

export type GlassModalProps = {
  isOpen?: boolean;
  onClose?: () => void;
  state?: { isOpen: boolean; close: () => void; open?: () => void };
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  className?: string;
  isDismissable?: boolean;
  hideCloseButton?: boolean;
  hideHeaderDivider?: boolean;
  centeredLayout?: boolean;
};

const MAX_WIDTH_MAP = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

export function GlassModal({
  isOpen: directIsOpen,
  onClose: directOnClose,
  state,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = "md",
  className = "",
  isDismissable = true,
  hideCloseButton = false,
  hideHeaderDivider = false,
  centeredLayout = false,
}: GlassModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isOpen = state ? state.isOpen : !!directIsOpen;
  const onClose = useCallback(() => {
    if (state) {
      state.close();
    } else if (directOnClose) {
      directOnClose();
    }
  }, [state, directOnClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDismissable) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDismissable, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
      {/* Sibling 1: Backdrop overlay (independiente para no interferir con el blur del panel) */}
      <div
        className="fixed inset-0 glass-backdrop"
        onClick={() => {
          if (isDismissable) onClose();
        }}
        aria-hidden="true"
      />

      {/* Sibling 2: Contenedor de posicionamiento centrado con scroll garantizado */}
      <div className="fixed inset-0 z-10 flex items-center justify-center p-3 sm:p-5 overflow-y-auto pointer-events-none">
        <div
          className={`w-full ${MAX_WIDTH_MAP[maxWidth] ?? "max-w-md"} max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3.5rem)] my-auto shrink-0 glass-panel p-6 sm:p-7 flex flex-col pointer-events-auto relative ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Floating Close Button */}
          {!hideCloseButton && (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="Cerrar"
              className="absolute top-4 right-4 h-8 w-8 rounded-full text-muted hover:text-foreground hover:bg-white/15 dark:hover:bg-white/10 shrink-0 z-20"
              onPress={onClose}
            >
              <X size={17} />
            </Button>
          )}

          {/* Modal Header if title is provided */}
          {title && (
            <div
              className={`flex items-start justify-between gap-3 shrink-0 ${
                hideHeaderDivider ? "pb-1 mb-3" : "border-b border-white/10 pb-4 mb-4"
              } ${centeredLayout ? "flex-col items-center text-center pr-0" : "pr-8"}`}
            >
              <div className={`flex ${centeredLayout ? "flex-col items-center text-center" : "items-center"} gap-3 min-w-0`}>
                {icon && (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent border border-accent/25 shadow-xs">
                    {icon}
                  </span>
                )}
                <div className="flex flex-col min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="text-xs text-muted font-medium mt-0.5 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal Body with guaranteed internal scroll */}
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-1 -mr-1">
            {children}
          </div>

          {/* Modal Footer */}
          {footer && (
            <div className="border-t border-white/10 pt-4 mt-4 flex items-center justify-end gap-2.5 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
