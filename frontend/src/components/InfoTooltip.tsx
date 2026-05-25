import { useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

export type TooltipVariant = "formula" | "assumption";

export interface TooltipContent {
  title: string;
  formula: string;
  example: string;
  source: string;
  variant?: TooltipVariant;
}

export interface InfoTooltipProps {
  content: TooltipContent;
  size?: "sm" | "md";
}

export default function InfoTooltip({ content, size = "sm" }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);
  const variant = content.variant ?? "formula";

  const clearCloseTimer = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const updatePosition = () => {
    if (!iconRef.current || !tooltipRef.current) return;
    const iconRect = iconRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const margin = 8;
    const canFitAbove = iconRect.top >= tooltipRect.height + margin + 8;
    const top = canFitAbove ? iconRect.top - tooltipRect.height - margin : iconRect.bottom + margin;
    const centeredLeft = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
    const left = Math.max(8, Math.min(centeredLeft, window.innerWidth - tooltipRect.width - 8));
    setCoords({ top, left });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isPinned && event.key === "Escape") {
        setIsPinned(false);
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isPinned]);

  useEffect(() => {
    if (!isOpen) return;
    const raf = window.requestAnimationFrame(updatePosition);
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedIcon = iconRef.current?.contains(target);
      const clickedTooltip = tooltipRef.current?.contains(target);
      if (!clickedIcon && !clickedTooltip && isPinned) {
        setIsPinned(false);
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isPinned]);

  const iconTone = useMemo(
    () =>
      variant === "assumption"
        ? "text-amber-400 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-400"
        : "text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400",
    [variant]
  );

  return (
    <span ref={containerRef} className="relative inline-flex items-center">
      <button
        ref={iconRef}
        type="button"
        aria-label={`Formula: ${content.title}`}
        className={cn(
          "ml-1.5 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-400",
          iconTone,
          isPinned &&
            (variant === "assumption"
              ? "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400"
              : "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400")
        )}
        onMouseEnter={() => {
          clearCloseTimer();
          if (!isPinned) setIsOpen(true);
        }}
        onMouseLeave={() => {
          if (!isPinned) {
            clearCloseTimer();
            closeTimer.current = window.setTimeout(() => setIsOpen(false), 150);
          }
        }}
        onClick={() => {
          clearCloseTimer();
          if (isPinned) {
            setIsPinned(false);
            setIsOpen(false);
          } else {
            setIsPinned(true);
            setIsOpen(true);
          }
        }}
      >
        <Info className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </button>

      {isOpen &&
        createPortal(
          <div
          ref={tooltipRef}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={() => {
            if (!isPinned) {
              clearCloseTimer();
              closeTimer.current = window.setTimeout(() => setIsOpen(false), 150);
            }
          }}
          className={cn(
            "fixed z-[1200] w-[min(90vw,18rem)] max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl bg-white text-left text-xs leading-relaxed shadow-xl dark:bg-slate-800",
            "border dark:border-slate-700",
            variant === "assumption"
              ? "border-amber-300 dark:border-amber-700"
              : "border-slate-200 dark:border-slate-700"
          )}
          style={{
            top: coords.top,
            left: coords.left,
            animation: "tooltipIn 150ms ease-out",
          }}
        >
          <style>
            {"@keyframes tooltipIn { from { opacity: 0; transform: translateY(4px);} to { opacity: 1; transform: translateY(0);} }"}
          </style>
          <div
            className={cn(
              "px-3 py-2.5",
              variant === "assumption" && "border-l-4 border-amber-400 dark:border-amber-600"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                    variant === "assumption"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                      : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                  )}
                >
                  {variant === "assumption" ? "⚠ ASSUMPTION" : "ƒ FORMULA"}
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {content.title}
                </span>
              </div>
              {isPinned && <span className="text-[10px] text-slate-400">📌</span>}
            </div>
          </div>
          <div className="px-3 pb-2">
            <hr className="my-1.5 border-slate-100 dark:border-slate-700" />
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Formula
            </p>
            <p
              className={cn(
                "my-1 rounded bg-slate-50 px-2 py-1 font-mono text-xs dark:bg-slate-900/50",
                variant === "assumption"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-indigo-700 dark:text-indigo-300"
              )}
            >
              {content.formula}
            </p>
            <hr className="my-1.5 border-slate-100 dark:border-slate-700" />
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Example
            </p>
            <p className="text-xs leading-snug text-slate-600 dark:text-slate-300">
              {content.example}
            </p>
            <hr className="my-1.5 border-slate-100 dark:border-slate-700" />
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Source
            </p>
            <p className="text-[11px] italic text-slate-400 dark:text-slate-500">
              {content.source}
            </p>
          </div>
        </div>,
          document.body
        )}
    </span>
  );
}
