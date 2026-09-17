import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useDeployedUpdateNotice } from "@/hooks/useDeployedUpdateNotice";
import { clampDialogPixelPosition } from "@/lib/dialog-drag";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SystemInfoPanel } from "./settings/SystemInfoPanel";

type DialogDragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  startPointerX: number;
  startPointerY: number;
};

export const SystemInfoDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { t } = useTranslation();
  const { markSeen } = useDeployedUpdateNotice();
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DialogDragSession | null>(null);
  const positionRef = useRef<{ x: number; y: number } | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (open) markSeen();
  }, [markSeen, open]);

  useEffect(() => {
    if (open) return;
    dragRef.current = null;
    positionRef.current = null;
    setPosition(null);
    setDragging(false);
  }, [open]);

  const setContentNode = (node: HTMLDivElement | null) => {
    contentRef.current = node;
    if (!node || positionRef.current) return;
    const rect = node.getBoundingClientRect();
    const next = { x: rect.left, y: rect.top };
    positionRef.current = next;
    setPosition(next);
  };

  const updatePosition = (next: { x: number; y: number }) => {
    positionRef.current = next;
    setPosition(next);
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const content = contentRef.current;
    if (!drag || !content || event.pointerId !== drag.pointerId) return;
    updatePosition(clampDialogPixelPosition({
      x: drag.startX + (event.clientX - drag.startPointerX),
      y: drag.startY + (event.clientY - drag.startPointerY),
      width: content.offsetWidth,
      height: content.offsetHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
  };

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleContentPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element | null;
    if (!target?.closest("[data-dialog-drag-handle]")) return;
    if (target.closest("button, a, input, textarea, [role='button']")) return;
    const content = contentRef.current;
    const current = positionRef.current;
    if (!content || !current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: current.x,
      startY: current.y,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
    };
    setDragging(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={setContentNode}
        unstyledPosition
        className={cn(
          "grid max-h-[min(720px,calc(100dvh-2rem))] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden p-0",
          dragging && "cursor-grabbing",
        )}
        data-offset-x={position?.x ?? ""}
        data-offset-y={position?.y ?? ""}
        onLostPointerCapture={stopDragging}
        onPointerCancel={stopDragging}
        onPointerDown={handleContentPointerDown}
        onPointerMove={handleDragMove}
        onPointerUp={stopDragging}
        style={position
          ? { left: position.x, top: position.y, transform: "none" }
          : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
      >
        <DialogHeader
          className={cn(
            "touch-none select-none px-4 pr-12 pt-4 text-left sm:px-6 sm:pt-6",
            dragging ? "cursor-grabbing" : "cursor-grab",
          )}
          data-dialog-drag-handle="true"
        >
          <DialogTitle>{t("systemInfo.title")}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-4 sm:px-6">
          <SystemInfoPanel />
        </div>
        <div className="flex justify-end px-4 pb-4 sm:px-6 sm:pb-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
