import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Install Android</span>
      </button>
    );
  }

  if (isIOS || isAndroid) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Pasang App</span>
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            onClick={() => setShowGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isIOS ? 'Pasang di iPhone / iPad' : 'Pasang di Layar Utama Android'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Tutup panduan"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {isIOS ? (
                <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-300 list-decimal pl-4">
                  <li>Ketuk tombol <strong>Bagikan (Share)</strong> pada bilah Safari.</li>
                  <li>Gulir ke bawah dan pilih <strong>Tambahkan ke Layar Utama</strong>.</li>
                </ol>
              ) : (
                <ol className="space-y-2 text-sm text-slate-600 dark:text-slate-300 list-decimal pl-4">
                  <li>Buka halaman ini langsung di browser <strong>Chrome Android</strong>.</li>
                  <li>Ketuk ikon menu <strong>titik tiga (⋮)</strong> di kanan atas.</li>
                  <li>Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.</li>
                </ol>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
