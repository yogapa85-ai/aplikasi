import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>Mode Offline — Menampilkan data terakhir yang tersimpan di perangkat.</span>
    </div>
  );
};
