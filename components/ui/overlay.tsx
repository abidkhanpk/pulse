"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

function useOverlay(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="absolute inset-0 bg-slate-950/45 backdrop-blur-md dark:bg-slate-950/60"
      onClick={onClose}
      aria-hidden
    />
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Close"
      className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-slate-400 transition-all duration-200 hover:rotate-90 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

export function Dialog({ open, onClose, children, className }: OverlayProps) {
  useOverlay(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Backdrop onClose={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cn(
              "card-sheen relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200/70 bg-white p-6 shadow-pop dark:border-slate-700/60 dark:bg-slate-900",
              className
            )}
          >
            <CloseButton onClose={onClose} />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("pr-8 text-lg font-semibold tracking-tight text-slate-900 dark:text-white", className)} {...props} />;
}

export function Sheet({ open, onClose, children, className }: OverlayProps) {
  useOverlay(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <Backdrop onClose={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            className={cn(
              "absolute right-0 top-0 flex h-full w-full max-w-md flex-col rounded-l-3xl border-l border-slate-200/70 bg-white shadow-pop dark:border-slate-700/60 dark:bg-slate-900",
              className
            )}
          >
            <CloseButton onClose={onClose} />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-slate-100 px-6 py-5 dark:border-slate-800/80", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("pr-8 text-lg font-semibold tracking-tight text-slate-900 dark:text-white", className)} {...props} />;
}

export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 dark:border-slate-800/80 dark:bg-slate-800/40", className)} {...props} />
  );
}
