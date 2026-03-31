import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };

  const bgColors = {
    success: 'bg-green-900/20 border-green-900/30',
    error: 'bg-red-900/20 border-red-900/30',
    info: 'bg-blue-900/20 border-blue-900/30',
  };

  return (
    <div className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-xl border ${bgColors[type]} shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300`}>
      {icons[type]}
      <p className="text-sm font-medium text-gray-100">{message}</p>
      <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md transition-colors">
        <X className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}
