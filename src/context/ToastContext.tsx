'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full sm:w-96">
        {toasts.map((toast) => {
          let icon = <Info className="h-5 w-5 text-cyan-400" />;
          let borderClass = 'border-cyan-500/30';
          let bgClass = 'bg-[#0f172a]/80';
          let glowClass = 'shadow-[0_0_15px_rgba(6,182,212,0.15)]';

          if (toast.type === 'success') {
            icon = <CheckCircle className="h-5 w-5 text-emerald-400" />;
            borderClass = 'border-emerald-500/30';
            glowClass = 'shadow-[0_0_15px_rgba(16,185,129,0.15)]';
          } else if (toast.type === 'error') {
            icon = <AlertCircle className="h-5 w-5 text-rose-400" />;
            borderClass = 'border-rose-500/30';
            glowClass = 'shadow-[0_0_15px_rgba(244,63,94,0.15)]';
          } else if (toast.type === 'warning') {
            icon = <AlertTriangle className="h-5 w-5 text-amber-400" />;
            borderClass = 'border-amber-500/30';
            glowClass = 'shadow-[0_0_15px_rgba(245,158,11,0.15)]';
          }

          return (
            <div
              key={toast.id}
              className={`flex items-start justify-between p-4 rounded-xl border backdrop-blur-md transition-all duration-300 animate-slide-in ${bgClass} ${borderClass} ${glowClass}`}
            >
              <div className="flex gap-3 items-center">
                <div className="flex-shrink-0">{icon}</div>
                <p className="text-sm font-medium text-slate-200">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-4 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateY(1rem) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
