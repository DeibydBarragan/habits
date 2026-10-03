"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button, Spinner } from "@heroui/react";
import { useLang } from "@/components/language";
import { GlassModal } from "@/components/glass-modal";

/** Confirmación destructiva dedicada con glassmorphism estilo flashcard */
export function DeleteModal({
  title,
  message,
  ariaLabel,
  onConfirm,
}: {
  title: string;
  message: string;
  ariaLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await onConfirm();
      setIsOpen(false);
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label={ariaLabel}
        onPress={() => setIsOpen(true)}
        className="h-8 w-8 rounded-xl text-muted hover:text-danger hover:bg-danger/10 transition-colors"
      >
        <X size={15} />
      </Button>

      <GlassModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidth="sm"
        hideHeaderDivider={true}
      >
        <div className="flex flex-col items-center text-center gap-4 py-2">
          {/* Centered Flashcard-style Icon Badge */}
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/15 text-danger border border-danger/25 shadow-xs">
            <AlertTriangle size={32} />
          </span>

          {/* Title & Message */}
          <div className="flex flex-col gap-1.5 max-w-xs">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              {message}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full pt-3">
            <Button
              fullWidth
              variant="secondary"
              className="rounded-xl h-10 font-medium glass-btn"
              onPress={() => setIsOpen(false)}
              isDisabled={pending}
            >
              {t.del.cancel}
            </Button>
            <Button
              fullWidth
              variant="danger"
              className="rounded-xl h-10 font-semibold shadow-xs"
              onPress={handleConfirm}
              isDisabled={pending}
            >
              {pending ? <Spinner size="sm" color="current" /> : t.del.confirm}
            </Button>
          </div>
        </div>
      </GlassModal>
    </>
  );
}
