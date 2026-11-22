import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronRight } from 'lucide-react';
import { PerformanceRecord } from '../types/ops';
import {
  formatCompactIDR,
  formatPercentID,
  getCycleLimit,
  getPerformanceStatus,
  parsePeriodSortKey,
} from '../utils/format';
import { CollectorAvatar } from './CollectorAvatar';
import { TrendChart } from './TrendChart';
import { SpotlightCard } from './SpotlightCard';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface CollectorSearchTabProps {
  allRecords: PerformanceRecord[];
  onSelectCollector: (record: PerformanceRecord) => void;
}

export const CollectorSearchTab: React.FC<CollectorSearchTabProps> = ({
  allRecords,
  onSelectCollector,
}) => {
  const [query, setQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<PerformanceRecord[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const uniqueCollectors = useMemo(() => {
    const map = new Map<string, PerformanceRecord>();
    for (const r of allRecords) {
      const key = `${r.collId}|${r.collName}`;
      const existing = map.get(key);
      if (!existing || parsePeriodSortKey(r.periode) > parsePeriodSortKey(existing.periode)) {
        map.set(key, r);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.collName.localeCompare(b.collName));
  }, [allRecords]);

  const localMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return uniqueCollectors.slice(0, 14);
    return uniqueCollectors.filter(
      (c) =>
        c.collName.toLowerCase().includes(q) ||
        c.collId.toLowerCase().includes(q) ||
        c.posName.toLowerCase().includes(q)
    );
  }, [query, uniqueCollectors]);

  const handleServerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setRemoteResults(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    setHoveredKey(null);
    try {
      const resp = await fetch(`/api/ops/collector/${encodeURIComponent(q)}`);
      const data = (await resp.json()) as {
        success: boolean;
        records?: PerformanceRecord[];
        message?: string;
      };
      if (!data.success) {
        setSearchError(data.message || 'Data tidak ditemukan.');
        setRemoteResults([]);
      } else {
        setRemoteResults(data.records || []);
      }
    } catch {
      setSearchError('Gagal menghubungi server pusat.');
    } finally {
      setSearching(false);
    }
  };

  const featuredCollector = useMemo(() => {
    const list = remoteResults && remoteResults.length > 0 ? remoteResults : localMatches;
    if (list.length === 0) return null;
    if (hoveredKey) {
      const matched = list.find((item) => `${item.collId}|${item.collName}` === hoveredKey);
      if (matched) return matched;
    }
    return list[0];
  }, [remoteResults, localMatches, hoveredKey]);

  const featuredHistory = useMemo(() => {
    if (!featuredCollector) return [];
    const source = remoteResults && remoteResults.length > 0 ? remoteResults : allRecords;
    return source
      .filter(
        (r) =>
          (featuredCollector.collId && r.collId === featuredCollector.collId) ||
          r.collName.toLowerCase() === featuredCollector.collName.toLowerCase()
      )
      .sort((a, b) => parsePeriodSortKey(a.periode) - parsePeriodSortKey(b.periode));
  }, [featuredCollector, remoteResults, allRecords]);

  return (
    <div className="space-y-6">
      <section className="luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl p-4 sm:p-5">
        <h2 className="text-base font-bold text-stone-900 dark:text-white">
          Pencarian Cepat Personil
        </h2>
        <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5 mb-3">
          Arahkan kursor atau ketuk personil untuk meninjau grafik tren &amp; histori pencapaian.
        </p>

        <form onSubmit={handleServerSearch} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) setRemoteResults(null);
              }}
              placeholder="Ketik nama personil (contoh: Wahyu, Sigit, Rayhan)..."
              aria-label="Cari nama personil"
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <motion.button
            type="submit"
            whileTap={{ scale: 0.97 }}
            disabled={searching}
            className="min-h-[44px] px-5 rounded-xl bg-stone-900 dark:bg-amber-500 text-white dark:text-slate-950 text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            {searching ? 'Mencari...' : 'Cari ke Server'}
          </motion.button>
        </form>

        {searchError && (
          <p className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400">
            {searchError}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <section className="lg:col-span-5 luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              {remoteResults ? 'Hasil Pencarian Server' : 'Daftar Personil Aktif'}
            </h3>
            <span className="text-xs font-mono text-stone-500 dark:text-slate-400 tabular-nums">
              {localMatches.length} orang
            </span>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-slate-800/90 max-h-[460px] overflow-y-auto">
            {localMatches.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-500 dark:text-slate-400">
                Tidak ada personil yang cocok dengan "{query}".
              </div>
            ) : (
              localMatches.map((person, idx) => {
                const personKey = `${person.collId}|${person.collName}`;
                const isPreviewed =
                  featuredCollector &&
                  `${featuredCollector.collId}|${featuredCollector.collName}` === personKey;
                const st = getPerformanceStatus(person.inPercent, person.ca);
                const cls =
                  st.tone === 'emerald'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : st.tone === 'amber'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-rose-700 dark:text-rose-400';

                return (
                  <motion.button
                    key={`${personKey}-${idx}`}
                    type="button"
                    whileTap={{ scale: 0.99 }}
                    onMouseEnter={() => setHoveredKey(personKey)}
                    onFocus={() => setHoveredKey(personKey)}
                    onClick={() => {
                      setHoveredKey(personKey);
                      onSelectCollector(person);
                    }}
                    className={`group w-full text-left px-4 py-3 min-h-[60px] flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isPreviewed
                        ? 'bg-amber-50/70 dark:bg-amber-950/20'
                        : 'hover:bg-stone-50/90 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CollectorAvatar name={person.collName} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                          {person.collName}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-slate-400 truncate">
                          {person.posName} <span aria-hidden="true">·</span> {person.periode}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-mono font-bold tabular-nums ${cls}`}>
                        {formatPercentID(person.inPercent)} · {st.label}
                      </span>
                      <ChevronRight
                        className="w-4 h-4 text-stone-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-transform"
                        aria-hidden="true"
                      />
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>
        </section>

        <SpotlightCard className="lg:col-span-7 p-5">
          <AnimatePresence mode="wait">
            {featuredCollector ? (
              <motion.div
                key={`${featuredCollector.collId}-${featuredCollector.collName}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CollectorAvatar name={featuredCollector.collName} size="md" />
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-stone-900 dark:text-white truncate">
                        {featuredCollector.collName}
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-slate-400 truncate">
                        {featuredCollector.posName} <span aria-hidden="true">·</span> SPV{' '}
                        {featuredCollector.spvName} <span aria-hidden="true">·</span> ID{' '}
                        {featuredCollector.collId}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onSelectCollector(featuredCollector)}
                    className="min-h-[40px] px-3.5 rounded-xl border border-stone-200 dark:border-slate-700 text-xs font-semibold text-stone-700 dark:text-slate-200 hover:border-amber-500/60 hover:bg-stone-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    Buka Rincian
                  </motion.button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-stone-50/90 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-800">
                    <div className="text-[11px] text-stone-500 dark:text-slate-400">Periode Terakhir</div>
                    <div className="text-sm font-bold font-mono text-stone-900 dark:text-white mt-0.5">
                      {featuredCollector.periode}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-50/90 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-800">
                    <div className="text-[11px] text-stone-500 dark:text-slate-400">Rolling</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-stone-900 dark:text-white mt-0.5 truncate">
                      {formatCompactIDR(featuredCollector.rolling)}
                    </div>
                  </div>
                  {(() => {
                    const st = getPerformanceStatus(featuredCollector.inPercent, featuredCollector.ca);
                    const cls =
                      st.tone === 'emerald'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : st.tone === 'amber'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-rose-700 dark:text-rose-400';
                    return (
                      <div className="p-3 rounded-xl bg-stone-50/90 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-800">
                        <div className="text-[11px] text-stone-500 dark:text-slate-400">
                          Rolling IN% ({st.label})
                        </div>
                        <div className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${cls}`}>
                          {formatPercentID(featuredCollector.inPercent)}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <TrendChart
                  points={featuredHistory.map((h) => ({
                    label: h.periode,
                    value: h.inPercent,
                    subLabel: h.ca,
                  }))}
                  unitLabel="Riwayat IN%"
                  benchmarkValue={getCycleLimit(featuredCollector.ca)}
                  benchmarkLabel={`Batas ${featuredCollector.ca} ≤ ${getCycleLimit(featuredCollector.ca)}%`}
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty-featured"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 text-center text-sm text-stone-500 dark:text-slate-400"
              >
                Pilih atau cari nama personil untuk melihat ringkasan tren.
              </motion.div>
            )}
          </AnimatePresence>
        </SpotlightCard>
      </div>
    </div>
  );
};
