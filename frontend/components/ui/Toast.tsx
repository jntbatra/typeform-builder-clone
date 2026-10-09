"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

/** `const toast = useToast(); toast("Form published")` */
export const useToast = () => useContext(ToastContext);

const VISIBLE_MS = 3200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), VISIBLE_MS);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg"
            >
              <span className={t.kind === "error" ? "text-red-400" : "text-emerald-400"}>
                {t.kind === "error" ? "✕" : "✓"}
              </span>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
