'use client';
import { useSyncExternalStore } from 'react';
const subscribe = (listener:()=>void) => { window.addEventListener('online',listener); window.addEventListener('offline',listener); return () => {window.removeEventListener('online',listener);window.removeEventListener('offline',listener);}; };
export function OfflineNotice() {
  const online = useSyncExternalStore(subscribe,()=>navigator.onLine,()=>true);
  return online ? null : <p role="alert">You are offline. Changes cannot be saved until the connection returns. No demo fallback is active.</p>;
}
