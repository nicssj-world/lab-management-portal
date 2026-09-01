"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type QualityTaskDialogProps = {
  labelledBy: string;
  describedBy?: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  panelStyle?: React.CSSProperties;
  closeOnBackdrop?: boolean;
  closeTone?: "default" | "danger";
  closeDisabled?: boolean;
};

/**
 * Shared dialog behavior for the Quality Tasks surfaces.
 *
 * It deliberately stays local to this module so existing application dialogs
 * are not changed as part of the incremental Quality Tasks rollout.
 */
export function QualityTaskDialog({
  labelledBy,
  describedBy,
  closeLabel,
  onClose,
  children,
  panelStyle,
  closeOnBackdrop = false,
  // Every dismiss affordance uses the same danger treatment so it remains
  // easy to find on long, scrollable dialogs.
  closeTone = "danger",
  closeDisabled = false,
}: QualityTaskDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    const previousHtmlOverflow = html.style.overflow;
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    html.style.overflow = "hidden";

    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>("[data-dialog-autofocus]") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      panel;
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!panel) return;
      const dialogs = [
        ...document.querySelectorAll<HTMLElement>("[data-quality-task-dialog]"),
      ];
      if (dialogs[dialogs.length - 1] !== panel) return;

      if (event.key === "Escape") {
        event.preventDefault();
        if (!closeDisabledRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ].filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstFocusable = focusable[0]!;
      const lastFocusable = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === firstFocusable || !panel.contains(active))) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && (active === lastFocusable || !panel.contains(active))) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      html.style.overflow = previousHtmlOverflow;
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, []);

  return (
    <div
      style={dialogOverlayStyle}
      role="presentation"
      onWheelCapture={(event) => {
        const target = event.target;
        if (!(target instanceof Node) || !panelRef.current?.contains(target)) {
          event.preventDefault();
        }
      }}
      onTouchMoveCapture={(event) => {
        const target = event.target;
        if (!(target instanceof Node) || !panelRef.current?.contains(target)) {
          event.preventDefault();
        }
      }}
      onPointerDown={(event) => {
        if (
          closeOnBackdrop &&
          !closeDisabledRef.current &&
          event.target === event.currentTarget
        ) {
          onCloseRef.current();
        }
      }}
    >
      <div
        ref={panelRef}
        className="quality-task-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        data-quality-task-dialog="true"
        tabIndex={-1}
        style={{
          ...panelStyle,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="quality-task-dialog-body">{children}</div>
        <button
          type="button"
          className={`quality-task-dialog-close${closeTone === "danger" ? " quality-task-dialog-close-danger" : ""}`}
          aria-label={closeLabel}
          title={closeLabel}
          disabled={closeDisabled}
          onClick={() => onCloseRef.current()}
        >
          <Icon name="x" size={20} stroke={2.2} />
        </button>
      </div>
    </div>
  );
}

const dialogOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: "rgba(15,23,42,.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  overscrollBehavior: "contain",
};
