"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { Button, Modal, Spinner } from "@heroui/react";
import { useLang } from "@/components/language";

/** Confirmación destructiva dedicada (nunca `confirm()`), como en expenses. */
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
  const [pending, startTransition] = useTransition();

  return (
    <Modal>
      <Button variant="ghost" size="sm" isIconOnly aria-label={ariaLabel}>
        <X size={16} />
      </Button>
      <Modal.Backdrop className="bg-background/60 backdrop-blur-sm">
        <Modal.Container placement="center">
          <Modal.Dialog className="sm:max-w-[340px]">
            {({ close }) => {
              function handle() {
                startTransition(async () => {
                  await onConfirm();
                  close();
                });
              }
              return (
                <>
                  <Modal.CloseTrigger />
                  <Modal.Header>
                    <Modal.Heading>{title}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
                    <p className="text-sm text-muted">{message}</p>
                  </Modal.Body>
                  <Modal.Footer>
                    <Button slot="close" variant="secondary">
                      {t.del.cancel}
                    </Button>
                    <Button variant="danger" onPress={handle} isDisabled={pending}>
                      {pending ? <Spinner size="sm" color="current" /> : t.del.confirm}
                    </Button>
                  </Modal.Footer>
                </>
              );
            }}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
