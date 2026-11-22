import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, UserCheck, Layers } from 'lucide-react';
import { PerformanceRecord } from '../types/ops';
import {
  formatCompactIDR,
  formatFullIDR,
  formatPercentID,
  getCycleLimit,
  getPerformanceStatus,
  parsePeriodSortKey,
} from '../utils/format';
import { CollectorAvatar } from './CollectorAvatar';
import { TrendChart } from './TrendChart';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface CollectorDetailSheetProps {
  record: PerformanceRecord | null;
  allRecords: PerformanceRecord[];
  onClose: () => void;
}

export const CollectorDetailSheet: React.FC<CollectorDetailSheetProps> = ({
  record,
  allRecords,
  onClose,
}) => {
  const history = useMemo(() => {
    if (!record) return [];
    return allRecords
      .filter(
        (r) =>
          (record.collId && r.collId === record.collId) ||
          r.collName.toLowerCase() === record.collName.toLowerCase()
      )
      .sort((a, b) => parsePeriodSortKey(a.periode) - parsePeriodSortKey(b.periode));
  }, [record, allRecords]);

  return (
    <AnimatePresence>
      {record && (
        <motion.div
          key="collector-sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-sm sm:p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Detail performa ${record.collName}`}
        >
          <motion.div
            key={`collector-sheet-${record.collId}-${record.periode}`}
            initial={{ opacity: 0, y: 48, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 36, scale: 0.97 }}
            transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
            className="w-full sm:max-w-xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0E1219] border border-stone-200/90 dark:border-slate-800/90 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1.5 rounded-full bg-stone-300 dark:bg-slate-700" />
            </div>

            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-stone-100 dark:border-slate-800">
              <div className="flex items-center gap-3.5 min-w-0">
                <CollectorAvatar name={record.collName} size="lg" />
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white truncate">
                    {record.collName}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5 truncate">
                    ID {record.collId} <span aria-hidden="true">·</span> {record.periode}{' '}
                    <span aria-hidden="true">·</span> Cycle {record.ca}
                  </p>
                  {(() => {
                    const status = getPerformanceStatus(record.inPercent, record.ca);
                    const statusColor =
                      status.tone === 'emerald'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : status.tone === 'amber'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-rose-700 dark:text-rose-400';
                    return (
                      <p className={`text-xs font-semibold mt-1 ${statusColor}`}>
                        Status: {status.label} ({formatPercentID(record.inPercent)})
                      </p>
                    );
                  })()}
                </div>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                aria-label="Tutup detail personil"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {(() => {
                  const st = getPerformanceStatus(record.inPercent, record.ca);
                  const toneClass =
                    st.tone === 'emerald'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : st.tone === 'amber'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-rose-700 dark:text-rose-400';
                  return (
                    <div className="p-3.5 rounded-xl bg-stone-50/90 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-800">
                      <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400">Rolling IN%</p>
                      <p className={`text-xl font-bold font-mono tabular-nums mt-1 ${toneClass}`}>
                        {formatPercentID(record.inPercent)}
                      </p>
                      <p className="text-[10px] text-stone-400 dark:text-slate-500 mt-0.5">
                        Makin kecil makin bagus · Batas {record.ca} ≤ {st.limit}%
                      </p>
                    </div>
                  );
                })()}
                <div className="p-3.5 rounded-xl bg-stone-50/90 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-800">
                  <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400">Rolling</p>
                  <p className="text-base sm:text-lg font-bold font-mono tabular-nums text-stone-900 dark:text-white mt-1 truncate">
                    {formatCompactIDR(record.rolling)}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50/90 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-800">
                  <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400">Bahan</p>
                  <p className="text-base sm:text-lg font-bold font-mono tabular-nums text-stone-900 dark:text-white mt-1 truncate">
                    {formatCompactIDR(record.bahan)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs border-y border-stone-100 dark:border-slate-800 py-3.5">
                <div className="flex items-center gap-2 text-stone-600 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    POS: <strong className="text-stone-900 dark:text-white">{record.posName}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-stone-600 dark:text-slate-300">
                  <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    SPV: <strong className="text-stone-900 dark:text-white">{record.spvName}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-stone-600 dark:text-slate-300">
                  <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    Cycle: <strong className="text-stone-900 dark:text-white">{record.ca}</strong>
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-white mb-2">
                  Tren IN% Lintas Periode
                </h4>
                <TrendChart
                  points={history.map((h) => ({
                    label: h.periode,
                    value: h.inPercent,
                    subLabel: h.ca,
                  }))}
                  unitLabel="Pencapaian IN%"
                  benchmarkValue={getCycleLimit(record.ca)}
                  benchmarkLabel={`Batas ${record.ca} ≤ ${getCycleLimit(record.ca)}%`}
                />
              </div>

              {history.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-white mb-2">
                    Riwayat Periode ({history.length})
                  </h4>
                  <div className="divide-y divide-stone-100 dark:divide-slate-800 border border-stone-200/90 dark:border-slate-800 rounded-xl overflow-hidden">
                    {[...history].reverse().map((item, idx) => {
                      const itemStatus = getPerformanceStatus(item.inPercent, item.ca);
                      const itemTone =
                        itemStatus.tone === 'emerald'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : itemStatus.tone === 'amber'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-rose-700 dark:text-rose-400';
                      return (
                        <div
                          key={`${item.periode}-${item.ca}-${idx}`}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs bg-white dark:bg-[#0E1219]"
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-semibold text-stone-900 dark:text-white">
                              {item.periode}
                            </span>
                            <span className="text-stone-400 mx-1.5" aria-hidden="true">·</span>
                            <span className="text-stone-500 dark:text-slate-400">{item.ca}</span>
                            <div className="text-[11px] text-stone-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                              {formatFullIDR(item.rolling)} / {formatCompactIDR(item.bahan)}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`font-mono font-bold tabular-nums text-sm ${itemTone}`}>
                              {formatPercentID(item.inPercent)}
                            </span>
                            <div className={`text-[10px] font-semibold ${itemTone}`}>
                              {itemStatus.label}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
