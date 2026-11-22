import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  ArrowUpDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Calendar,
  FolderArchive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react';
import { OcmRealtimeResponse, PerformanceRecord, PosSummary } from '../types/ops';
import {
  formatCompactIDR,
  formatFullIDR,
  formatPercentID,
  formatTimeID,
  getPerformanceStatus,
} from '../utils/format';
import { CollectorAvatar } from './CollectorAvatar';
import { AnimatedNumber, EASE_OUT_EXPO, StaggerGrid, StaggerItem } from './MotionPrimitives';
import { SpotlightCard } from './SpotlightCard';
import { RollingGauge } from './RollingGauge';

interface OcmDateValue {
  year: number;
  month: number;
  day: number;
}

interface OverviewTabProps {
  records: PerformanceRecord[];
  periods: string[];
  posList: string[];
  cycles: string[];
  selectedPeriod: string;
  onChangePeriod: (p: string) => void;
  loading: boolean;
  stale: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectCollector: (record: PerformanceRecord) => void;
  ocmDate: OcmDateValue;
  onChangeOcmDate: (next: OcmDateValue) => void;
  ocmPollSeconds: number;
  onChangeOcmPollSeconds: (seconds: number) => void;
  ocmData: OcmRealtimeResponse | null;
  ocmLoading: boolean;
  ocmMatchedCount: number;
  onRefreshOcm: () => void;
  periodPrefix: string;
}

const MONTH_OPTIONS = [
  { value: 1, label: '01 · Januari' },
  { value: 2, label: '02 · Februari' },
  { value: 3, label: '03 · Maret' },
  { value: 4, label: '04 · April' },
  { value: 5, label: '05 · Mei' },
  { value: 6, label: '06 · Juni' },
  { value: 7, label: '07 · Juli' },
  { value: 8, label: '08 · Agustus' },
  { value: 9, label: '09 · September' },
  { value: 10, label: '10 · Oktober' },
  { value: 11, label: '11 · November' },
  { value: 12, label: '12 · Desember' },
];

type SortKey = 'in_asc' | 'in_desc' | 'rolling_asc' | 'rolling_desc' | 'bahan_desc' | 'name_asc';

export const OverviewTab: React.FC<OverviewTabProps> = ({
  records,
  periods,
  posList,
  cycles,
  selectedPeriod,
  onChangePeriod,
  loading,
  stale,
  error,
  onRefresh,
  onSelectCollector,
  ocmDate,
  onChangeOcmDate,
  ocmPollSeconds,
  onChangeOcmPollSeconds,
  ocmData,
  ocmLoading,
  ocmMatchedCount,
  onRefreshOcm,
  periodPrefix,
}) => {
  const [selectedPos, setSelectedPos] = useState<string>('ALL');
  const [selectedCycle, setSelectedCycle] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortKey>('in_asc');
  const [showOcmTable, setShowOcmTable] = useState<boolean>(true);
  const [selectedOcmCycle, setSelectedOcmCycle] = useState<string>('ALL');
  const [ocmTableFilter, setOcmTableFilter] = useState<string>('');

  const daysInSelectedMonth = useMemo(() => {
    return new Date(Date.UTC(ocmDate.year, ocmDate.month, 0)).getUTCDate();
  }, [ocmDate.month, ocmDate.year]);

  const yearOptions = useMemo(() => {
    const curYear = new Date().getFullYear();
    const set = new Set<number>([curYear - 1, curYear, curYear + 1, ocmDate.year]);
    return Array.from(set).sort((a, b) => b - a);
  }, [ocmDate.year]);

  const computedPeriodLabel = `${periodPrefix}/${String(ocmDate.month).padStart(2, '0')}/${ocmDate.year}`;

  const handleDatePartChange = (part: 'day' | 'month' | 'year', rawVal: string) => {
    const num = Number(rawVal);
    if (!Number.isInteger(num)) return;
    const nextYear = part === 'year' ? num : ocmDate.year;
    const nextMonth = part === 'month' ? num : ocmDate.month;
    const maxDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
    const rawDay = part === 'day' ? num : ocmDate.day;
    const nextDay = Math.min(Math.max(1, rawDay), maxDay);
    onChangeOcmDate({ year: nextYear, month: nextMonth, day: nextDay });
  };

  const handleJumpToAvailableFile = (fileName: string) => {
    const m = fileName.match(/_(\d{4})(\d{2})(\d{2})_/);
    if (!m) return;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      onChangeOcmDate({ year, month, day });
    }
  };

  const ocmAvailableCycles = useMemo(() => {
    return ocmData?.availableCycles || [];
  }, [ocmData?.availableCycles]);

  const effectiveOcmCycle =
    selectedOcmCycle !== 'ALL' && ocmAvailableCycles.includes(selectedOcmCycle)
      ? selectedOcmCycle
      : 'ALL';

  const ocmCollRows = useMemo(() => {
    if (!ocmData) return [];
    const sourceMap =
      effectiveOcmCycle !== 'ALL' && ocmData.metricsByCycle?.[effectiveOcmCycle]
        ? ocmData.metricsByCycle[effectiveOcmCycle]
        : ocmData.metricsByCollId;
    if (!sourceMap) return [];
    const q = ocmTableFilter.trim().toLowerCase();
    return Object.values(sourceMap)
      .filter((row) => {
        if (!q) return true;
        return (
          row.collId.toLowerCase().includes(q) ||
          (row.collName || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.inPercent - b.inPercent || a.collId.localeCompare(b.collId));
  }, [effectiveOcmCycle, ocmData, ocmTableFilter]);

  const ocmMaxInPercent = useMemo(() => {
    if (ocmCollRows.length === 0) return 25;
    const maxVal = Math.max(...ocmCollRows.map((r) => r.inPercent));
    return Math.max(25, maxVal);
  }, [ocmCollRows]);

  const periodRecords = useMemo(() => {
    if (!selectedPeriod) return records;
    return records.filter((r) => r.periode === selectedPeriod);
  }, [records, selectedPeriod]);

  const posSummaries = useMemo<PosSummary[]>(() => {
    const map = new Map<
      string,
      {
        posId: string;
        collectors: Set<string>;
        totalBahan: number;
        totalRolling: number;
        sumIn: number;
        count: number;
        spvs: Set<string>;
      }
    >();

    for (const r of periodRecords) {
      if (selectedCycle !== 'ALL' && r.ca !== selectedCycle) continue;
      const key = r.posName || 'Lainnya';
      const existing = map.get(key) ?? {
        posId: r.posId,
        collectors: new Set<string>(),
        totalBahan: 0,
        totalRolling: 0,
        sumIn: 0,
        count: 0,
        spvs: new Set<string>(),
      };
      existing.collectors.add(`${r.collId}-${r.collName}`);
      existing.totalBahan += r.bahan;
      existing.totalRolling += r.rolling;
      existing.sumIn += r.inPercent;
      existing.count += 1;
      if (r.spvName && r.spvName !== '-') existing.spvs.add(r.spvName);
      map.set(key, existing);
    }

    return Array.from(map.entries())
      .map(([posName, agg]) => ({
        posName,
        posId: agg.posId,
        collectorCount: agg.collectors.size,
        totalBahan: agg.totalBahan,
        totalRolling: agg.totalRolling,
        avgInPercent: agg.count > 0 ? agg.sumIn / agg.count : 0,
        weightedInPercent: agg.totalBahan > 0 ? (agg.totalRolling / agg.totalBahan) * 100 : 0,
        spvs: Array.from(agg.spvs),
      }))
      .sort((a, b) => a.weightedInPercent - b.weightedInPercent);
  }, [periodRecords, selectedCycle]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = periodRecords.filter((r) => {
      if (selectedPos !== 'ALL' && r.posName !== selectedPos) return false;
      if (selectedCycle !== 'ALL' && r.ca !== selectedCycle) return false;
      if (q) {
        const hay = `${r.collName} ${r.collId} ${r.spvName} ${r.posName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'in_asc') return a.inPercent - b.inPercent;
      if (sortBy === 'in_desc') return b.inPercent - a.inPercent;
      if (sortBy === 'rolling_asc') return a.rolling - b.rolling;
      if (sortBy === 'rolling_desc') return b.rolling - a.rolling;
      if (sortBy === 'bahan_desc') return b.bahan - a.bahan;
      return a.collName.localeCompare(b.collName);
    });
  }, [periodRecords, selectedPos, selectedCycle, searchQuery, sortBy]);

  const kpis = useMemo(() => {
    const totalBahan = filteredRecords.reduce((acc, r) => acc + r.bahan, 0);
    const totalRolling = filteredRecords.reduce((acc, r) => acc + r.rolling, 0);
    const weightedIn = totalBahan > 0 ? (totalRolling / totalBahan) * 100 : 0;
    const uniqueCount = new Set(filteredRecords.map((r) => `${r.collId}|${r.collName}`)).size;

    let optimalCount = 0;
    let warnCount = 0;
    let poorCount = 0;
    for (const r of filteredRecords) {
      const st = getPerformanceStatus(r.inPercent, r.ca);
      if (st.tone === 'emerald') optimalCount++;
      else if (st.tone === 'amber') warnCount++;
      else poorCount++;
    }

    return {
      totalBahan,
      totalRolling,
      weightedIn,
      uniqueCount,
      optimalCount,
      warnCount,
      poorCount,
    };
  }, [filteredRecords]);

  const cycleOptions = ['ALL', ...cycles];

  return (
    <div className="space-y-6">
      {(error || stale) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {error ? `Peringatan sinkronisasi: ${error}` : 'Menampilkan snapshot data terakhir.'}
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="min-h-[36px] px-3 rounded-lg bg-amber-600 text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Coba Lagi
          </button>
        </motion.div>
      )}

      {/* Executive Branch Command Split (Gauge Focal Anchor + 3 Metric Instruments) */}
      <section aria-label="Ringkasan Eksekutif Cabang" className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <SpotlightCard className="lg:col-span-5 p-5 flex items-center justify-between gap-5">
          <div className="min-w-0 space-y-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Indikator Cabang · {selectedPeriod || 'Terbaru'}
              </p>
              <h2 className="text-lg font-extrabold text-stone-900 dark:text-white mt-0.5">
                Rasio Rolling IN%
              </h2>
              <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Makin kecil rolling makin bagus, makin besar makin busuk (Batas C0 ≤ 9% · C1 ≤ 11%).
              </p>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium">
              <span className="text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {kpis.optimalCount} Bagus
              </span>
              <span className="text-stone-300 dark:text-slate-700" aria-hidden="true">·</span>
              <span className="text-amber-700 dark:text-amber-400 font-mono tabular-nums">
                {kpis.warnCount} Waspada
              </span>
              <span className="text-stone-300 dark:text-slate-700" aria-hidden="true">·</span>
              <span className="text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                {kpis.poorCount} Busuk
              </span>
            </div>
          </div>

          <RollingGauge
            value={kpis.weightedIn}
            cycle={selectedCycle === 'ALL' ? undefined : selectedCycle}
            size={146}
          />
        </SpotlightCard>

        <StaggerGrid className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <StaggerItem className="h-full">
            <SpotlightCard className="h-full p-5 flex flex-col justify-between">
              <p className="text-xs font-medium text-stone-500 dark:text-slate-400">Total Rolling</p>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-stone-900 dark:text-white mt-2 truncate">
                <AnimatedNumber value={kpis.totalRolling} formatter={formatCompactIDR} />
              </p>
              <p className="text-xs text-stone-500 dark:text-slate-400 mt-2">
                Saldo bergulir periode aktif
              </p>
            </SpotlightCard>
          </StaggerItem>

          <StaggerItem className="h-full">
            <SpotlightCard className="h-full p-5 flex flex-col justify-between">
              <p className="text-xs font-medium text-stone-500 dark:text-slate-400">Total Bahan</p>
              <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-stone-900 dark:text-white mt-2 truncate">
                <AnimatedNumber value={kpis.totalBahan} formatter={formatCompactIDR} />
              </p>
              <p className="text-xs text-stone-500 dark:text-slate-400 mt-2">
                Total beban kelolaan aktif
              </p>
            </SpotlightCard>
          </StaggerItem>

          <StaggerItem className="h-full">
            <SpotlightCard className="h-full p-5 flex flex-col justify-between">
              <p className="text-xs font-medium text-stone-500 dark:text-slate-400">Tim Lapangan</p>
              <p className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-stone-900 dark:text-white mt-2">
                <AnimatedNumber value={kpis.uniqueCount} formatter={(v) => String(Math.round(v))} />
              </p>
              <p className="text-xs text-stone-500 dark:text-slate-400 mt-2">
                Personil aktif terpantau
              </p>
            </SpotlightCard>
          </StaggerItem>
        </StaggerGrid>
      </section>

      {/* Realtime OCM Period & Sync Controls */}
      <section
        aria-label="Kontrol Periode dan Sumber OCM Realtime"
        className="luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FolderArchive className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-stone-900 dark:text-white">
                Pembacaan Data Realtime OCM
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-slate-400 font-mono tabular-nums break-all">
                Periode: {computedPeriodLabel} · File: Regional_Operation_OCM_{ocmDate.year}
                {String(ocmDate.month).padStart(2, '0')}_{ocmDate.year}
                {String(ocmDate.month).padStart(2, '0')}
                {String(ocmDate.day).padStart(2, '0')}_41400
              </p>
            </div>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={onRefreshOcm}
            disabled={ocmLoading}
            className="min-h-[40px] px-3.5 rounded-xl bg-stone-900 dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold hover:opacity-90 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${ocmLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Sinkronkan OCM</span>
          </motion.button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="ocm-day" className="block text-xs font-medium text-stone-500 dark:text-slate-400 mb-1">
              Tanggal (1–31)
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <select
                id="ocm-day"
                value={ocmDate.day}
                onChange={(e) => handleDatePartChange('day', e.target.value)}
                className="w-full min-h-[44px] pl-8 pr-3 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d} disabled={d > daysInSelectedMonth}>
                    {String(d).padStart(2, '0')}
                    {d > daysInSelectedMonth ? ' (Tidak valid)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ocm-month" className="block text-xs font-medium text-stone-500 dark:text-slate-400 mb-1">
              Bulan (01–12)
            </label>
            <select
              id="ocm-month"
              value={ocmDate.month}
              onChange={(e) => handleDatePartChange('month', e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm font-semibold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ocm-year" className="block text-xs font-medium text-stone-500 dark:text-slate-400 mb-1">
              Tahun
            </label>
            <select
              id="ocm-year"
              value={ocmDate.year}
              onChange={(e) => handleDatePartChange('year', e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm font-semibold font-mono tabular-nums text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ocm-poll" className="block text-xs font-medium text-stone-500 dark:text-slate-400 mb-1">
              Polling Realtime
            </label>
            <select
              id="ocm-poll"
              value={ocmPollSeconds}
              onChange={(e) => onChangeOcmPollSeconds(Number(e.target.value))}
              className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm font-semibold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value={1}>Setiap 1 Detik</option>
              <option value={3}>Setiap 3 Detik</option>
              <option value={5}>Setiap 5 Detik</option>
              <option value={10}>Setiap 10 Detik</option>
              <option value={30}>Setiap 30 Detik</option>
              <option value={0}>Manual (Nonaktif)</option>
            </select>
          </div>
        </div>

        {/* Realtime OCM Connection, Matching Status & Available Files */}
        {ocmData && (
          <div
            className={`rounded-xl px-3.5 py-2.5 border text-xs space-y-2 ${
              ocmData.status === 'ok'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                {ocmData.status === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="min-w-0 space-y-0.5">
                  {ocmData.status === 'ok' ? (
                    <p className="font-semibold">
                      OCM Terbaca ({ocmData.entryName}) · {ocmMatchedCount} personil dashboard cocok dari{' '}
                      {ocmData.collectorCount} COLL_ID ({ocmData.rowCount.toLocaleString('id-ID')} baris)
                      {ocmData.fileSizeBytes
                        ? ` · ${(ocmData.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
                        : ''}
                    </p>
                  ) : (
                    <p className="font-semibold">{ocmData.errorMessage}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[11px] opacity-80 whitespace-nowrap">
                  Cek {formatTimeID(ocmData.checkedAt)}
                </span>
                {ocmData.status === 'ok' && ocmData.collectorCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowOcmTable((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-emerald-300/70 dark:border-emerald-700/70 text-[11px] font-semibold cursor-pointer"
                  >
                    <span>
                      Rekap COLL_ID ({effectiveOcmCycle === 'ALL' ? ocmData.collectorCount : ocmCollRows.length})
                    </span>
                    {showOcmTable ? (
                      <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {ocmData.status !== 'ok' && ocmData.availableFiles && ocmData.availableFiles.length > 0 && (
              <div className="pt-1 border-t border-amber-200/70 dark:border-amber-800/50 space-y-1.5">
                <p className="text-[11px] font-medium">
                  File OCM tersedia di Google Drive (ketuk untuk lompat ke tanggal file):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ocmData.availableFiles.map((fname) => (
                    <button
                      key={fname}
                      type="button"
                      onClick={() => handleJumpToAvailableFile(fname)}
                      className="px-2 py-1 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-amber-300/80 dark:border-amber-700/80 font-mono text-[11px] hover:border-amber-500 cursor-pointer"
                    >
                      {fname}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showOcmTable && ocmData.status === 'ok' && (
              <div className="pt-2.5 border-t border-emerald-200/70 dark:border-emerald-800/50 space-y-3">
                {/* Filter Controls: CYCLE (CYCLE_AWAL) + Search COLL_ID / COLL_NAME */}
                <div className="flex flex-wrap items-end justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div>
                      <label
                        htmlFor="ocm-cycle-filter"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-900/80 dark:text-emerald-200/80 mb-1"
                      >
                        CYCLE
                      </label>
                      <select
                        id="ocm-cycle-filter"
                        value={effectiveOcmCycle}
                        onChange={(e) => setSelectedOcmCycle(e.target.value)}
                        className="min-h-[36px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300/80 dark:border-emerald-700/80 text-xs font-semibold font-mono text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="ALL">Semua Cycle</option>
                        {ocmAvailableCycles.map((cy) => (
                          <option key={cy} value={cy}>
                            {cy}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="ocm-coll-search"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-900/80 dark:text-emerald-200/80 mb-1"
                      >
                        Cari Personil
                      </label>
                      <input
                        id="ocm-coll-search"
                        type="search"
                        value={ocmTableFilter}
                        onChange={(e) => setOcmTableFilter(e.target.value)}
                        placeholder="Cari COLL_ID atau COLL_NAME..."
                        className="min-h-[36px] min-w-[220px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300/80 dark:border-emerald-700/80 text-xs text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <span className="font-mono text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                    {ocmCollRows.length} personil · CYCLE_AWAL: {effectiveOcmCycle === 'ALL' ? 'Semua' : effectiveOcmCycle}
                  </span>
                </div>

                {/* Grafik IN% Paling Rendah -> Paling Tinggi */}
                <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-800/60 bg-white/95 dark:bg-slate-900/95 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                      <h3 className="text-xs font-bold text-stone-900 dark:text-white">
                        Grafik Peringkat IN% (Terendah → Tertinggi)
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-medium text-stone-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                        Bagus
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                        Waspada
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500" aria-hidden="true" />
                        Busuk
                      </span>
                    </div>
                  </div>

                  {ocmCollRows.length === 0 ? (
                    <p className="py-4 text-center text-xs text-stone-500 dark:text-slate-400">
                      Tidak ada data personil untuk filter CYCLE / pencarian ini.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto pr-1 space-y-1.5">
                      {ocmCollRows.map((row, idx) => {
                        const st = getPerformanceStatus(
                          row.inPercent,
                          effectiveOcmCycle === 'ALL' ? undefined : effectiveOcmCycle
                        );
                        const barColor =
                          st.tone === 'emerald'
                            ? 'bg-emerald-500'
                            : st.tone === 'amber'
                            ? 'bg-amber-500'
                            : 'bg-rose-500';
                        const textTone =
                          st.tone === 'emerald'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : st.tone === 'amber'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-rose-700 dark:text-rose-400';
                        const widthPct = Math.min(
                          100,
                          Math.max(2, (row.inPercent / ocmMaxInPercent) * 100)
                        );
                        const displayName =
                          row.collName && row.collName !== '-' ? row.collName : row.collId;

                        return (
                          <div
                            key={`chart-${effectiveOcmCycle}-${row.collId}`}
                            className="grid grid-cols-12 items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-stone-50 dark:hover:bg-slate-800/60"
                          >
                            <div className="col-span-5 sm:col-span-4 flex items-center gap-2 min-w-0">
                              <span className="w-5 text-right font-mono text-[11px] text-stone-400 dark:text-slate-500 tabular-nums shrink-0">
                                {idx + 1}.
                              </span>
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-stone-900 dark:text-white truncate">
                                  {displayName}
                                </p>
                                <p className="text-[10px] font-mono text-stone-500 dark:text-slate-400 truncate">
                                  {row.collId}
                                </p>
                              </div>
                            </div>

                            <div className="col-span-5 sm:col-span-6">
                              <div className="h-3 w-full rounded-full bg-stone-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                  style={{ width: `${widthPct}%` }}
                                />
                              </div>
                            </div>

                            <div className="col-span-2 text-right font-mono tabular-nums">
                              <span className={`text-xs font-bold ${textTone}`}>
                                {formatPercentID(row.inPercent)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Tabel Detail: COLL_ID | COLL_NAME | ROLLING | PKK_AW (LKP) | IN% */}
                <div className="max-h-64 overflow-y-auto rounded-xl border border-emerald-200/70 dark:border-emerald-800/60 bg-white/95 dark:bg-slate-900/95">
                  <table className="w-full text-left text-xs tabular-nums">
                    <thead className="sticky top-0 bg-emerald-100/95 dark:bg-slate-800 text-[11px] font-bold text-stone-700 dark:text-slate-200">
                      <tr>
                        <th className="px-3 py-2 font-mono">COLL_ID</th>
                        <th className="px-3 py-2">COLL_NAME</th>
                        <th className="px-3 py-2 text-right font-mono">ROLLING</th>
                        <th className="px-3 py-2 text-right font-mono">PKK_AW (LKP)</th>
                        <th className="px-3 py-2 text-right font-mono">IN%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-slate-800 text-stone-800 dark:text-slate-200">
                      {ocmCollRows.map((row) => (
                        <tr key={`tbl-${effectiveOcmCycle}-${row.collId}`}>
                          <td className="px-3 py-1.5 font-mono font-semibold whitespace-nowrap">
                            {row.collId}
                          </td>
                          <td className="px-3 py-1.5 font-medium">
                            {row.collName || '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap">
                            {formatFullIDR(row.rolling)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap">
                            {formatFullIDR(row.pkkAwTotal)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold whitespace-nowrap">
                            {formatPercentID(row.inPercent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Filter Bar */}
      <section aria-label="Filter operasional" className="luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="period-filter" className="block text-xs font-medium text-stone-500 dark:text-slate-400 mb-1">
              Periode Operasional
            </label>
            <select
              id="period-filter"
              value={selectedPeriod}
              onChange={(e) => onChangePeriod(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm font-semibold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pos-filter" className="block text-xs font-medium text-stone-500 dark:text-slate-400 mb-1">
              Wilayah / POS
            </label>
            <select
              id="pos-filter"
              value={selectedPos}
              onChange={(e) => setSelectedPos(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm font-semibold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">Semua POS ({posList.length})</option>
              {posList.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-stone-500 dark:text-slate-400 mb-1">
              Cycle (CA)
            </span>
            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-slate-800 rounded-xl min-h-[44px]">
              {cycleOptions.map((c) => {
                const active = selectedCycle === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedCycle(c)}
                    className={`relative flex-1 min-h-[36px] px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'text-stone-900 dark:text-white'
                        : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="cycle-active-pill"
                        transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                        className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-xs"
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative z-10">{c === 'ALL' ? 'Semua' : c}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="sort-filter" className="block text-xs font-medium text-stone-500 dark:text-slate-400 mb-1">
              Urutkan Data
            </label>
            <div className="relative">
              <ArrowUpDown className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <select
                id="sort-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm font-medium text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="in_asc">IN% Terkecil (Terbagus)</option>
                <option value="in_desc">IN% Terbesar (Terbusuk)</option>
                <option value="rolling_asc">Rolling Terkecil</option>
                <option value="rolling_desc">Rolling Terbesar</option>
                <option value="bahan_desc">Bahan Terbesar</option>
                <option value="name_asc">Nama Personil A–Z</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter cepat nama kolektor, SPV, atau ID..."
              aria-label="Filter cepat nama kolektor"
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onRefresh}
            disabled={loading}
            aria-label="Muat ulang data operasional"
            className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-stone-50 dark:hover:bg-slate-800 text-stone-700 dark:text-slate-200 flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">Segarkan</span>
          </motion.button>
        </div>
      </section>

      {/* POS / Area Breakdown */}
      {posSummaries.length > 0 && (
        <section aria-label="Performa per POS">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-stone-900 dark:text-white">
              Peringkat Wilayah POS
            </h2>
            {selectedPos !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedPos('ALL')}
                className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Tampilkan Semua POS
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {posSummaries.map((pos, idx) => {
              const active = selectedPos === pos.posName;
              const barRatio = Math.min(1, Math.max(0.05, pos.weightedInPercent / 25));
              const posStatus = getPerformanceStatus(
                pos.weightedInPercent,
                selectedCycle === 'ALL' ? undefined : selectedCycle
              );
              const posTextClass =
                posStatus.tone === 'emerald'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : posStatus.tone === 'amber'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-rose-700 dark:text-rose-400';
              const posBarClass =
                posStatus.tone === 'emerald'
                  ? 'bg-emerald-600 dark:bg-emerald-500'
                  : posStatus.tone === 'amber'
                  ? 'bg-amber-500'
                  : 'bg-rose-600 dark:bg-rose-500';
              return (
                <SpotlightCard
                  key={pos.posName}
                  interactive
                  active={active}
                  onClick={() => setSelectedPos(active ? 'ALL' : pos.posName)}
                  className="p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-stone-900 dark:text-white truncate">
                      <span className="font-mono text-xs text-stone-400 dark:text-slate-500 mr-1.5">
                        0{idx + 1}.
                      </span>
                      {pos.posName}
                    </span>
                    <span className={`font-mono font-bold text-sm tabular-nums shrink-0 ${posTextClass}`}>
                      {formatPercentID(pos.weightedInPercent)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 truncate">
                    {posStatus.label} <span aria-hidden="true">·</span> {pos.collectorCount} personil{' '}
                    <span aria-hidden="true">·</span> {formatCompactIDR(pos.totalRolling)}
                  </p>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-stone-100 dark:bg-slate-800 overflow-hidden">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: barRatio }}
                      transition={{ duration: 0.5, delay: idx * 0.05, ease: EASE_OUT_EXPO }}
                      style={{ transformOrigin: 'left' }}
                      className={`h-full w-full rounded-full ${posBarClass}`}
                    />
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        </section>
      )}

      {/* Field Team Roster with Smooth Layout Reordering */}
      <section aria-label="Daftar Performa Personil Lapangan" className="luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-stone-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-white">
              Daftar Personil Lapangan
            </h2>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              Ketuk baris personil untuk melihat rincian &amp; grafik tren interaktif
            </p>
          </div>
          <span className="font-mono text-xs font-semibold text-stone-500 dark:text-slate-400 tabular-nums shrink-0">
            {filteredRecords.length} data
          </span>
        </div>

        {loading && records.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500 dark:text-slate-400">
            Memuat data operasional real-time dari server pusat...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500 dark:text-slate-400">
            Tidak ada data personil yang cocok dengan filter saat ini.
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-slate-800/90">
            {filteredRecords.map((rec, idx) => {
              const status = getPerformanceStatus(rec.inPercent, rec.ca);
              const statusColor =
                status.tone === 'emerald'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : status.tone === 'amber'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-rose-700 dark:text-rose-400';
              const barTone =
                status.tone === 'emerald'
                  ? 'bg-emerald-600 dark:bg-emerald-500'
                  : status.tone === 'amber'
                  ? 'bg-amber-500'
                  : 'bg-rose-600 dark:bg-rose-500';
              const barRatio = Math.min(1, Math.max(0.06, rec.inPercent / 25));

              return (
                <motion.button
                  key={`${rec.periode}-${rec.ca}-${rec.collId}-${rec.collName}`}
                  layout={idx < 30 ? 'position' : false}
                  transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
                  type="button"
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onSelectCollector(rec)}
                  className="group w-full text-left px-4 sm:px-5 py-3.5 min-h-[72px] flex items-center justify-between gap-3 hover:bg-stone-50/90 dark:hover:bg-slate-800/50 active:bg-stone-100 dark:active:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="hidden sm:inline-block w-6 text-right font-mono text-xs text-stone-400 dark:text-slate-500 tabular-nums shrink-0">
                      {idx + 1}.
                    </span>
                    <CollectorAvatar name={rec.collName} size="md" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-stone-900 dark:text-white truncate">
                        {rec.collName}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-slate-400 truncate mt-0.5">
                        {rec.posName} <span aria-hidden="true">·</span> SPV {rec.spvName}{' '}
                        <span aria-hidden="true">·</span> {rec.ca}
                      </div>
                      <div className="text-xs font-mono tabular-nums text-stone-600 dark:text-slate-300 mt-0.5 sm:hidden">
                        Rolling {formatCompactIDR(rec.rolling)} / {formatCompactIDR(rec.bahan)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                    <div className="hidden sm:block text-right">
                      <div className="text-xs font-mono font-semibold tabular-nums text-stone-900 dark:text-white">
                        {formatCompactIDR(rec.rolling)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-stone-500 dark:text-slate-400">
                        Bahan {formatCompactIDR(rec.bahan)}
                      </div>
                    </div>

                    <div className="text-right min-w-[82px]">
                      <div className={`text-base font-bold font-mono tabular-nums ${statusColor}`}>
                        {formatPercentID(rec.inPercent)}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className={`text-[11px] font-semibold ${statusColor}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="mt-1 h-1 w-16 ml-auto rounded-full bg-stone-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barTone}`}
                          style={{ width: `${Math.round(barRatio * 100)}%` }}
                        />
                      </div>
                    </div>

                    <ChevronRight
                      className="w-4 h-4 text-stone-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
