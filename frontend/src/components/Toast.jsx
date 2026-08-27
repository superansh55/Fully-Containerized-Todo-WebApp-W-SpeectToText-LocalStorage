import { useState, useEffect, useCallback } from 'react';

let toastId = 0;

// Singleton store — exported so App can push toasts without prop-drilling
const listeners = new Set();
let toastState = [];

export function pushToast(message, type = 'info', duration = 3500) {
  const id = ++toastId;
  const toast = { id, message, type, duration };
  toastState = [...toastState, toast];
  listeners.forEach(fn => fn(toastState));

  setTimeout(() => {
    toastState = toastState.filter(t => t.id !== id);
    listeners.forEach(fn => fn(toastState));
  }, duration);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    listeners.add(setToasts);
    return () => listeners.delete(setToasts);
  }, []);

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  );
}

function Toast({ toast }) {
  const icon = {
    success: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    error: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
      </svg>
    ),
    info: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
  }[toast.type] || null;

  return (
    <div className={`toast ${toast.type}`} role="alert">
      <span className="toast-icon">{icon}</span>
      {toast.message}
    </div>
  );
}
