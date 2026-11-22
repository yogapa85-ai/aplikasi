import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { LiveOpsState, QueueItem } from '../types/ops';
import { formatTimeID } from '../utils/format';
import { SpotlightCard } from './SpotlightCard';
import { AnimatedNumber, EASE_OUT_EXPO, StaggerGrid, StaggerItem } from './MotionPrimitives';

interface LiveOpsTabProps {
  liveState: LiveOpsState;
  sseConnected: boolean;
}

type QueueFilter = 'ALL' | QueueItem['status'];

function getQueueStatusLabel(status: QueueItem['status']): {
  label: string;
  colorClass: string;
} {
  if (status === 'success') {
    return { label: 'Terkirim', colorClass: 'text-emerald-700 dark:text-emerald-400' };
  }
  if (status === 'validating') {
    return { label: 'Validasi', colorClass: 'text-amber-700 dark:text-amber-400' };
  }
  if (status === 'failed') {
    return { label: 'Gagal', colorClass: 'text-rose-700 dark:text-rose-400' };
  }
  return { label: 'Antrean', colorClass: 'text-stone-600 dark:text-slate-400' };
}

export const LiveOpsTab: React.FC<LiveOpsTabProps> = ({ liveState, sseConnected }) => {
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL');
  const streamLive = sseConnected && liveState.upstreamSocketConnected;

  const gatewayLabel =
    liveState.gatewayStatus === 'connected'
      ? 'TERHUBUNG'
      : liveState.gatewayStatus === 'disconnected'
      ? 'TERPUTUS'
      : 'MENUNGGU SINYAL';

  const gatewayTone =
    liveState.gatewayStatus === 'connected'
      ? 'text-emerald-700 dark:text-emerald-400'
      : liveState.gatewayStatus === 'disconnected'
      ? 'text-rose-700 dark:text-rose-400'
      : 'text-amber-700 dark:text-amber-400';

  const filteredQueueItems = useMemo(() => {
    if (queueFilter === 'ALL') return liveState.queueItems;
    return liveState.queueItems.filter((item) => item.status === queueFilter);
  }, [liveState.queueItems, queueFilter]);

  const progressRatio =
    liveState.queueCounts.total > 0
      ? Math.min(1, liveState.queueCounts.success / liveState.queueCounts.total)
      : 0;

  const counterTiles: {
    status: QueueItem['status'];
    label: string;
    count: number;
    icon: React.FC<{ className?: string }>;
    iconClass: string;
    valueClass: string;
  }[] = [
    {
      status: 'pending',
      label: 'Antrean',
      count: liveState.queueCounts.pending,
      icon: Clock,
      iconClass: 'text-stone-400 dark:text-slate-400',
      valueClass: 'text-stone-900 dark:text-white',
    },
    {
      status: 'validating',
      label: 'Validasi',
      count: liveState.queueCounts.validating,
      icon: Radio,
      iconClass: 'text-amber-500',
      valueClass: 'text-amber-600 dark:text-amber-400',
    },
    {
      status: 'success',
      label: 'Berhasil',
      count: liveState.queueCounts.success,
      icon: CheckCircle2,
      iconClass: 'text-emerald-500',
      valueClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      status: 'failed',
      label: 'Gagal',
      count: liveState.queueCounts.failed,
      icon: AlertCircle,
      iconClass: 'text-rose-500',
      valueClass: 'text-rose-600 dark:text-rose-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Live Stream & Gateway Telemetry */}
      <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StaggerItem>
          <SpotlightCard className="h-full p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-stone-500 dark:text-slate-400">
                  Koneksi Real-Time Server Pusat
                </p>
                <p
                  className={`text-lg font-bold mt-1 ${
                    streamLive
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {streamLive
                    ? 'STREAM AKTIF'
                    : sseConnected
                    ? 'MENYAMBUNG KE PUSAT...'
                    : 'RECONNECTING...'}
                </p>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                  Update terakhir: {formatTimeID(liveState.lastEventAt)}
                </p>
              </div>
              <div className="relative w-12 h-12 rounded-2xl bg-stone-100 dark:bg-slate-800/90 flex items-center justify-center shrink-0">
                {streamLive && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-2xl border-2 border-emerald-500/40"
                    initial={{ scale: 0.9, opacity: 0.8 }}
                    animate={{ scale: 1.35, opacity: 0 }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <Radio
                  className={`w-6 h-6 ${
                    streamLive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                  aria-hidden="true"
                />
              </div>
            </div>
          </SpotlightCard>
        </StaggerItem>

        <StaggerItem>
          <SpotlightCard className="h-full p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-stone-500 dark:text-slate-400">
                  Status Gateway Operasional (Blast)
                </p>
                <p className={`text-lg font-bold mt-1 ${gatewayTone}`}>{gatewayLabel}</p>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-1">
                  Mode Anti-Spam 43–200 detik dikelola server pusat
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-slate-800/90 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              </div>
            </div>
          </SpotlightCard>
        </StaggerItem>
      </StaggerGrid>

      {/* Interactive Queue Status Filter Counters */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {counterTiles.map((tile) => {
          const Icon = tile.icon;
          const isSelected = queueFilter === tile.status;
          return (
            <StaggerItem key={tile.status}>
              <SpotlightCard
                interactive
                active={isSelected}
                onClick={() => setQueueFilter(isSelected ? 'ALL' : tile.status)}
                className="p-4"
              >
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-stone-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${tile.iconClass}`} aria-hidden="true" />
                    <span>{tile.label}</span>
                  </span>
                  {isSelected && (
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      Filter Aktif
                    </span>
                  )}
                </div>
                <p className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${tile.valueClass}`}>
                  <AnimatedNumber value={tile.count} formatter={(v) => String(Math.round(v))} />
                </p>
              </SpotlightCard>
            </StaggerItem>
          );
        })}
      </StaggerGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Live Queue List */}
        <section className="luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-stone-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                  Antrean Pengiriman Aktif
                </h3>
                {queueFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setQueueFilter('ALL')}
                    className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Tampilkan Semua
                  </button>
                )}
              </div>
              <span className="text-xs font-mono text-stone-500 dark:text-slate-400 tabular-nums">
                {filteredQueueItems.length} / {liveState.queueCounts.total} nomor
              </span>
            </div>
            {liveState.queueCounts.total > 0 && (
              <div className="h-1 w-full rounded-full bg-stone-100 dark:bg-slate-800 overflow-hidden">
                <motion.div
                  animate={{ scaleX: progressRatio }}
                  transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                  style={{ transformOrigin: 'left' }}
                  className="h-full w-full rounded-full bg-emerald-600 dark:bg-emerald-500"
                />
              </div>
            )}
          </div>
          {filteredQueueItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-500 dark:text-slate-400">
              {liveState.queueItems.length === 0
                ? 'Belum ada antrean blast aktif dari Command Center. Daftar nomor akan muncul otomatis di sini saat eksekusi berjalan.'
                : 'Tidak ada nomor dengan filter status tersebut saat ini.'}
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-slate-800/90 max-h-80 overflow-y-auto">
              <AnimatePresence initial={false}>
                {filteredQueueItems.map((item) => {
                  const st = getQueueStatusLabel(item.status);
                  return (
                    <motion.div
                      key={item.phone}
                      layout="position"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                      className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-stone-900 dark:text-white">
                          {item.phone}
                        </span>
                        <div className="text-[11px] text-stone-400 dark:text-slate-500 font-mono tabular-nums mt-0.5">
                          {formatTimeID(item.updatedAt)}
                        </div>
                      </div>
                      <span className={`font-semibold ${st.colorClass}`}>{st.label}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Live Event Feed */}
        <section className="luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              Log Aktivitas Real-Time
            </h3>
            <span className="text-xs font-mono text-stone-500 dark:text-slate-400 tabular-nums">
              {liveState.events.length} event
            </span>
          </div>
          {liveState.events.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-500 dark:text-slate-400">
              Menunggu pembaruan status dari server operasional...
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-slate-800/90 max-h-80 overflow-y-auto">
              <AnimatePresence initial={false}>
                {liveState.events.map((ev) => {
                  const titleColor =
                    ev.tone === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : ev.tone === 'warning'
                      ? 'text-amber-700 dark:text-amber-400'
                      : ev.tone === 'error'
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-stone-900 dark:text-white';
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                      className="px-4 sm:px-5 py-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-semibold ${titleColor}`}>{ev.title}</span>
                        <span className="font-mono text-[11px] text-stone-400 dark:text-slate-500 tabular-nums shrink-0">
                          {formatTimeID(ev.timestamp)}
                        </span>
                      </div>
                      <p className="text-stone-500 dark:text-slate-400 mt-0.5">{ev.detail}</p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
