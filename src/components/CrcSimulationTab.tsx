import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCcw,
  Copy,
  Check,
  Download,
  SlidersHorizontal,
  ShieldAlert,
  TrendingUp,
  PieChart,
  Layers,
  Table2,
  Calculator,
} from 'lucide-react';
import {
  BurdenClass,
  CrcCycleType,
  MasterCrcConfig,
  PhaseId,
  SimulationInput,
} from '../types/crc';
import {
  DEFAULT_MASTER_CRC,
  DEFAULT_SIMULATION_INPUT,
  buildSimulationShareText,
  calculateCrcSimulation,
  formatNumberID,
  getIncentiveByClass,
  lookupClusterRule,
  round2,
} from '../utils/crcCalculator';
import { formatCompactIDR, formatFullIDR } from '../utils/format';
import { SpotlightCard } from './SpotlightCard';
import { AnimatedNumber, EASE_OUT_EXPO } from './MotionPrimitives';
import { CrcMasterTablesEditor } from './CrcMasterTablesEditor';

const MASTER_STORAGE_KEY = 'cr41400_crc_master_v1';
const SIM_INPUT_STORAGE_KEY = 'cr41400_crc_sim_v1';

type SubView = 'simulator' | 'master';

export const CrcSimulationTab: React.FC = () => {
  const [subView, setSubView] = useState<SubView>('simulator');
  const [copied, setCopied] = useState(false);

  const [master, setMaster] = useState<MasterCrcConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_MASTER_CRC;
    try {
      const raw = window.localStorage.getItem(MASTER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MasterCrcConfig>;
        return {
          ...DEFAULT_MASTER_CRC,
          ...parsed,
          cycleThresholds:
            parsed.cycleThresholds && parsed.cycleThresholds.length > 0
              ? parsed.cycleThresholds
              : DEFAULT_MASTER_CRC.cycleThresholds,
        };
      }
    } catch {
      return DEFAULT_MASTER_CRC;
    }
    return DEFAULT_MASTER_CRC;
  });

  const [input, setInput] = useState<SimulationInput>(() => {
    if (typeof window === 'undefined') return DEFAULT_SIMULATION_INPUT;
    try {
      const raw = window.localStorage.getItem(SIM_INPUT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SimulationInput>;
        const validCycle =
          parsed.crcType === 'C0' || parsed.crcType === 'C1' || parsed.crcType === 'C0C1'
            ? parsed.crcType
            : DEFAULT_SIMULATION_INPUT.crcType;
        return {
          ...DEFAULT_SIMULATION_INPUT,
          ...parsed,
          crcType: validCycle,
          inAmount:
            typeof parsed.inAmount === 'number'
              ? parsed.inAmount
              : DEFAULT_SIMULATION_INPUT.inAmount,
        };
      }
    } catch {
      return DEFAULT_SIMULATION_INPUT;
    }
    return DEFAULT_SIMULATION_INPUT;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify(master));
    } catch {
      // Ignore storage quota errors
    }
  }, [master]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIM_INPUT_STORAGE_KEY, JSON.stringify(input));
    } catch {
      // Ignore storage quota errors
    }
  }, [input]);

  const result = useMemo(() => calculateCrcSimulation(input, master), [input, master]);

  const handleRegulerWeightChange = (raw: string) => {
    const val = Math.min(100, Math.max(0, Number(raw) || 0));
    const rounded = round2(val);
    setInput((prev) => ({
      ...prev,
      regulerWeightPercent: rounded,
      finatraWeightPercent: round2(100 - rounded),
    }));
  };

  const handleFinatraWeightChange = (raw: string) => {
    const val = Math.min(100, Math.max(0, Number(raw) || 0));
    const rounded = round2(val);
    setInput((prev) => ({
      ...prev,
      finatraWeightPercent: rounded,
      regulerWeightPercent: round2(100 - rounded),
    }));
  };

  const handlePhaseChange = (
    phaseId: PhaseId,
    field: 'achReguler' | 'achFinatra',
    raw: string
  ) => {
    const val = Math.max(0, Number(raw) || 0);
    setInput((prev) => ({
      ...prev,
      phases: {
        ...prev.phases,
        [phaseId]: {
          ...prev.phases[phaseId],
          [field]: val,
        },
      },
    }));
  };

  const handleResetDefault = () => {
    setInput(DEFAULT_SIMULATION_INPUT);
  };

  const handleCopySummary = async () => {
    const text = buildSimulationShareText(input, result);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback copy via temporary textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Fase',
      'Bobot (%)',
      'Insentif Dasar (Rp)',
      'Ach Reguler (%)',
      'Ach Finatra (%)',
      'Ach Final Weighted (%)',
      'Level',
      'Pengali Ach (%)',
      'Indeks RB 1 (%)',
      'Insentif Akhir (Rp)',
      'Status',
    ];
    const rows = result.phases.map((p) => [
      p.name,
      p.weightPercent.toFixed(2),
      Math.round(p.baseIncentive),
      p.achReguler.toFixed(2),
      p.achFinatra.toFixed(2),
      p.achFinalWeighted.toFixed(2),
      p.levelLabel,
      p.achMultiplierPercent.toFixed(2),
      p.rbMultiplierPercent.toFixed(2),
      Math.round(p.finalIncentive),
      p.statusText,
    ]);
    rows.push([
      'TOTAL / KESIMPULAN',
      result.totalWeightPercent.toFixed(2),
      Math.round(result.totalBaseIncentive),
      '-',
      '-',
      result.weightedAvgAchFinal.toFixed(2),
      '-',
      '-',
      '-',
      Math.round(result.totalFinalIncentive),
      `Realisasi ${result.realizationRatioPercent.toFixed(2)}%`,
    ]);

    const csvContent = [
      `Koordinator,"${input.coordinatorName.replace(/"/g, '""')}"`,
      `Cluster,"Cluster ${input.cluster}"`,
      `Kategori CRC,"CRC ${input.crcType}"`,
      `IN Amount,${input.inAmount}`,
      `Kelas Beban (Otomatis),Kelas ${result.resolvedBurdenClass}`,
      `Bobot Reguler / Finatra,${input.regulerWeightPercent}% / ${input.finatraWeightPercent}%`,
      `Ach RB 1,${input.achRb1Percent}%`,
      '',
      headers.join(','),
      ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulasi-insentif-crc-${input.crcType.toLowerCase()}-c${input.cluster}-kelas${result.resolvedBurdenClass}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Strategic Managerial Insights Computation ---
  const insights = useMemo(() => {
    const rule = result.activeClusterRule;
    const currentClass = result.resolvedBurdenClass;
    const currentBase = result.totalBaseIncentive;
    const prevClassBase =
      currentClass > 1
        ? getIncentiveByClass(rule, (currentClass - 1) as BurdenClass)
        : null;
    const nextClassBase =
      currentClass < 3
        ? getIncentiveByClass(rule, (currentClass + 1) as BurdenClass)
        : null;
    const betterClusterRule =
      input.cluster > 1 ? lookupClusterRule(master, input.cluster - 1) : null;
    const betterClusterBase = betterClusterRule
      ? getIncentiveByClass(betterClusterRule, currentClass)
      : null;

    // 2. Risk Mitigation (Phases in Level 0 / multiplier === 0)
    const sortedLevels = [...master.achievementLevels].sort((a, b) => a.min - b.min);
    const safeLevel = sortedLevels.find((l) => l.multiplierPercent > 0) || sortedLevels[1];
    const safeThreshold = safeLevel ? safeLevel.min : 85;
    const safeMultiplier = safeLevel ? safeLevel.multiplierPercent : 85;

    const hangusPhases = result.phases
      .filter((p) => p.achMultiplierPercent === 0)
      .map((p) => {
        const gap = Math.max(0, safeThreshold - p.achFinalWeighted);
        const potentialSave =
          p.id === 'CLOSING'
            ? p.baseIncentive * (safeMultiplier / 100) * (p.rbMultiplierPercent / 100)
            : p.baseIncentive * (safeMultiplier / 100);
        return { ...p, gap, potentialSave };
      });

    // Next level opportunity if no phase is hangus
    const nonMaxPhases = result.phases
      .map((p) => {
        const nextLvl = sortedLevels.find((l) => l.min > round2(p.achFinalWeighted));
        if (!nextLvl) return null;
        const gap = Math.max(0, nextLvl.min - p.achFinalWeighted);
        const gain =
          p.id === 'CLOSING'
            ? p.baseIncentive *
              ((nextLvl.multiplierPercent - p.achMultiplierPercent) / 100) *
              (p.rbMultiplierPercent / 100)
            : p.baseIncentive * ((nextLvl.multiplierPercent - p.achMultiplierPercent) / 100);
        return { phaseName: p.name, nextLvl, gap, gain };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.gain > 0);

    // 3. Closing & Rollback Optimization
    const closingPhase = result.phases.find((p) => p.id === 'CLOSING')!;
    const nextClosingLvl = sortedLevels.find(
      (l) => l.min > round2(closingPhase.achFinalWeighted)
    );
    const closingAchUpside = nextClosingLvl
      ? closingPhase.baseIncentive *
        ((nextClosingLvl.multiplierPercent - closingPhase.achMultiplierPercent) / 100) *
        (closingPhase.rbMultiplierPercent / 100)
      : 0;

    const sortedRb = [...master.rollbackIndices].sort((a, b) => a.min - b.min);
    const nextRbRule = sortedRb.find((r) => r.indexPercent > result.rb1Rule.indexPercent);
    const rbUpside = nextRbRule
      ? closingPhase.baseIncentive *
        (closingPhase.achMultiplierPercent / 100) *
        ((nextRbRule.indexPercent - result.rb1Rule.indexPercent) / 100)
      : 0;

    // 4. Finatra Synchronization
    const finatraLiftingPhases = result.phases.filter(
      (p) => p.achFinatra > p.achReguler
    );
    const finatraLaggingPhases = result.phases.filter(
      (p) => p.achFinatra < p.achReguler
    );

    return {
      currentBase,
      prevClassBase,
      nextClassBase,
      betterClusterRule,
      betterClusterBase,
      safeThreshold,
      hangusPhases,
      nonMaxPhases,
      closingPhase,
      nextClosingLvl,
      closingAchUpside,
      nextRbRule,
      rbUpside,
      finatraLiftingPhases,
      finatraLaggingPhases,
    };
  }, [result, input, master]);

  const inputClass =
    'w-full min-h-[44px] px-3.5 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm font-medium text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500';

  const statusBadge = (category: 'hangus' | 'warning' | 'optimal', text: string) => {
    if (category === 'hangus') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 whitespace-nowrap">
          {text}
        </span>
      );
    }
    if (category === 'warning') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 whitespace-nowrap">
          {text}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 whitespace-nowrap">
        {text}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation & Action Controls */}
      <div className="luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Mode Simulasi Insentif CRC"
          className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-slate-800 rounded-xl"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subView === 'simulator'}
            onClick={() => setSubView('simulator')}
            className={`relative min-h-[38px] px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              subView === 'simulator'
                ? 'text-stone-900 dark:text-white'
                : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            {subView === 'simulator' && (
              <motion.span
                layoutId="crc-subtab-pill"
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                className="absolute inset-0 rounded-lg bg-white dark:bg-slate-900 shadow-xs"
                aria-hidden="true"
              />
            )}
            <Calculator className="w-3.5 h-3.5 relative z-10 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span className="relative z-10">Kalkulator Simulasi</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subView === 'master'}
            onClick={() => setSubView('master')}
            className={`relative min-h-[38px] px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              subView === 'master'
                ? 'text-stone-900 dark:text-white'
                : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            {subView === 'master' && (
              <motion.span
                layoutId="crc-subtab-pill"
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                className="absolute inset-0 rounded-lg bg-white dark:bg-slate-900 shadow-xs"
                aria-hidden="true"
              />
            )}
            <Table2 className="w-3.5 h-3.5 relative z-10 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span className="relative z-10">Master Tabel Referensi</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={handleResetDefault}
            className="min-h-[40px] px-3.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-amber-500/60 text-xs font-semibold text-stone-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-stone-500 dark:text-slate-400" aria-hidden="true" />
            <span>Reset ke Contoh Default</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={handleExportCsv}
            className="min-h-[40px] px-3.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-amber-500/60 text-xs font-semibold text-stone-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-stone-500 dark:text-slate-400" aria-hidden="true" />
            <span>Export CSV</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => void handleCopySummary()}
            className="min-h-[40px] px-4 rounded-xl bg-stone-900 dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold hover:opacity-90 inline-flex items-center gap-1.5 cursor-pointer transition-opacity"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ringkasan Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Salin Ringkasan Simulasi</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {subView === 'master' ? (
          <motion.div
            key="crc-master-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
          >
            <CrcMasterTablesEditor master={master} onChange={setMaster} />
          </motion.div>
        ) : (
          <motion.div
            key="crc-sim-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            className="space-y-6"
          >
            {/* Executive KPI Hero Strip */}
            <section aria-label="Ringkasan Estimasi Insentif CRC" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <SpotlightCard className="p-5 sm:col-span-2 lg:col-span-1 flex flex-col justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Estimasi Insentif Akhir
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-stone-900 dark:text-white mt-1.5">
                  <AnimatedNumber value={result.totalFinalIncentive} formatter={formatFullIDR} />
                </p>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-stone-500 dark:text-slate-400">
                    <span>Realisasi vs Dasar</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">
                      {formatNumberID(result.realizationRatioPercent)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-stone-100 dark:bg-slate-800 overflow-hidden">
                    <motion.div
                      animate={{ scaleX: Math.min(1, Math.max(0, result.realizationRatioPercent / 150)) }}
                      transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                      style={{ transformOrigin: 'left' }}
                      className="h-full w-full rounded-full bg-amber-600 dark:bg-amber-400"
                    />
                  </div>
                </div>
              </SpotlightCard>

              <SpotlightCard className="p-5 flex flex-col justify-between">
                <p className="text-xs font-medium text-stone-500 dark:text-slate-400">
                  Total Insentif Dasar
                </p>
                <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-stone-900 dark:text-white mt-2">
                  <AnimatedNumber value={result.totalBaseIncentive} formatter={formatFullIDR} />
                </p>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-2">
                  Cluster {input.cluster} · CRC {input.crcType} · Kelas {result.resolvedBurdenClass} (Otomatis)
                </p>
              </SpotlightCard>

              <SpotlightCard className="p-5 flex flex-col justify-between">
                <p className="text-xs font-medium text-stone-500 dark:text-slate-400">
                  Rata-rata Tertimbang Ach Final
                </p>
                <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-stone-900 dark:text-white mt-2">
                  <AnimatedNumber
                    value={result.weightedAvgAchFinal}
                    formatter={(v) => `${formatNumberID(v)}%`}
                  />
                </p>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-2">
                  Reguler {formatNumberID(input.regulerWeightPercent, 0)}% · Finatra{' '}
                  {formatNumberID(input.finatraWeightPercent, 0)}%
                </p>
              </SpotlightCard>

              <SpotlightCard className="p-5 flex flex-col justify-between">
                <p className="text-xs font-medium text-stone-500 dark:text-slate-400">
                  Indeks Pengali RB 1 (Closing)
                </p>
                <p className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-2">
                  <AnimatedNumber
                    value={result.rb1Rule.indexPercent}
                    formatter={(v) => `${formatNumberID(v)}%`}
                  />
                </p>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-2">
                  Ach RB 1: {formatNumberID(input.achRb1Percent)}% ({result.rb1Rule.label})
                </p>
              </SpotlightCard>
            </section>

            {/* BAGIAN I: INPUT PARAMETER UTAMA KOORDINATOR & PORTOFOLIO */}
            <section
              aria-label="Bagian I: Input Parameter Utama Koordinator dan Portofolio"
              className="luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">
                      Bagian I · Parameter Utama Koordinator &amp; Portofolio
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                      Atur profil koordinator, cluster cabang, kelas beban, serta komposisi bobot portofolio
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubView('master')}
                  className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer shrink-0"
                >
                  Edit Matrix Referensi
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label
                    htmlFor="crc-coord-name"
                    className="block text-xs font-medium text-stone-600 dark:text-slate-300 mb-1"
                  >
                    Nama Koordinator / ID
                  </label>
                  <input
                    id="crc-coord-name"
                    type="text"
                    value={input.coordinatorName}
                    onChange={(e) =>
                      setInput((prev) => ({ ...prev, coordinatorName: e.target.value }))
                    }
                    placeholder="Contoh: Yoga Pangestu (YGP)"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="crc-cluster"
                    className="block text-xs font-medium text-stone-600 dark:text-slate-300 mb-1"
                  >
                    Cluster Cabang
                  </label>
                  <select
                    id="crc-cluster"
                    value={input.cluster}
                    onChange={(e) =>
                      setInput((prev) => ({ ...prev, cluster: Number(e.target.value) }))
                    }
                    className={inputClass}
                  >
                    {master.clusters.map((c) => (
                      <option key={c.cluster} value={c.cluster}>
                        Cluster {c.cluster}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span
                    id="crc-cycle-label"
                    className="block text-xs font-medium text-stone-600 dark:text-slate-300 mb-1"
                  >
                    CRC C Berapa
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="crc-cycle-label"
                    className="grid grid-cols-3 gap-1 p-1 min-h-[44px] rounded-xl bg-stone-100 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700"
                  >
                    {(['C0', 'C1', 'C0C1'] as CrcCycleType[]).map((cycle) => {
                      const active = input.crcType === cycle;
                      return (
                        <button
                          key={cycle}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setInput((prev) => ({ ...prev, crcType: cycle }))}
                          className={`relative min-h-[34px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            active
                              ? 'text-stone-900 dark:text-white'
                              : 'text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="crc-cycle-active-pill"
                              transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                              className="absolute inset-0 rounded-lg bg-white dark:bg-slate-900 shadow-xs border border-amber-500/40"
                              aria-hidden="true"
                            />
                          )}
                          <span className="relative z-10">CRC {cycle}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                    K1 &lt; {formatCompactIDR(result.activeCycleThreshold.kelas2Min)} · K2{' '}
                    {formatCompactIDR(result.activeCycleThreshold.kelas2Min)}–
                    {formatCompactIDR(result.activeCycleThreshold.kelas2Max)} · K3 &gt;{' '}
                    {formatCompactIDR(result.activeCycleThreshold.kelas2Max)}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="crc-in-amount"
                    className="block text-xs font-medium text-stone-600 dark:text-slate-300 mb-1"
                  >
                    IN Amount (Rp)
                  </label>
                  <input
                    id="crc-in-amount"
                    type="number"
                    step={50000000}
                    min={0}
                    value={input.inAmount}
                    onChange={(e) =>
                      setInput((prev) => ({
                        ...prev,
                        inAmount: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    placeholder="Contoh: 3360874201"
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold mt-1 font-mono tabular-nums">
                    {formatCompactIDR(input.inAmount)} · Otomatis: Kelas {result.resolvedBurdenClass} (CRC{' '}
                    {input.crcType})
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
                <div>
                  <label
                    htmlFor="crc-reg-weight"
                    className="block text-xs font-medium text-stone-600 dark:text-slate-300 mb-1"
                  >
                    Bobot Portofolio Reguler (%)
                  </label>
                  <input
                    id="crc-reg-weight"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={input.regulerWeightPercent}
                    onChange={(e) => handleRegulerWeightChange(e.target.value)}
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="crc-fin-weight"
                    className="block text-xs font-medium text-stone-600 dark:text-slate-300 mb-1"
                  >
                    Bobot Portofolio Finatra (%)
                  </label>
                  <input
                    id="crc-fin-weight"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={input.finatraWeightPercent}
                    onChange={(e) => handleFinatraWeightChange(e.target.value)}
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                  <p className="text-[11px] text-stone-500 dark:text-slate-400 font-mono tabular-nums mt-1">
                    Total Bobot: {formatNumberID(input.regulerWeightPercent + input.finatraWeightPercent)}% (Terkunci 100%)
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="crc-rb1"
                    className="block text-xs font-medium text-stone-600 dark:text-slate-300 mb-1"
                  >
                    Realisasi Ach RB 1 (%)
                  </label>
                  <input
                    id="crc-rb1"
                    type="number"
                    step="0.01"
                    min="0"
                    value={input.achRb1Percent}
                    onChange={(e) =>
                      setInput((prev) => ({
                        ...prev,
                        achRb1Percent: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-mono font-semibold mt-1">
                    Indeks RB Closing: {formatNumberID(result.rb1Rule.indexPercent)}%
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/50 flex flex-col justify-center">
                  <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                    Total Insentif Dasar (CRC {input.crcType} · Kelas {result.resolvedBurdenClass})
                  </span>
                  <span className="text-lg font-extrabold font-mono tabular-nums text-stone-900 dark:text-white mt-0.5">
                    {formatFullIDR(result.totalBaseIncentive)}
                  </span>
                </div>
              </div>
            </section>

            {/* BAGIAN II: TABEL SIMULASI PERHITUNGAN KINERJA & INSENTIF PER FASE */}
            <section
              aria-label="Bagian II: Tabel Simulasi Perhitungan Kinerja dan Insentif Per Fase"
              className="luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl overflow-hidden"
            >
              <div className="px-4 sm:px-5 py-3.5 border-b border-stone-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">
                    Bagian II · Simulasi Perhitungan Kinerja &amp; Insentif Per Fase
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-slate-400">
                    Ubah nilai Ach Reguler (%) dan Ach Finatra (%) pada setiap fase untuk simulasi instan
                  </p>
                </div>
              </div>

              {/* Desktop / Tablet Structured Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                      <th className="py-3 pl-5 pr-2">Fase Penagihan</th>
                      <th className="py-3 px-2 text-right">Bobot Fase</th>
                      <th className="py-3 px-2 text-right">Insentif Dasar Fase</th>
                      <th className="py-3 px-2 w-32">Ach Reguler (%)</th>
                      <th className="py-3 px-2 w-32">Ach Finatra (%)</th>
                      <th className="py-3 px-2 text-right">Ach Final</th>
                      <th className="py-3 px-2">Level &amp; Pengali</th>
                      <th className="py-3 px-2 text-right">Indeks RB 1</th>
                      <th className="py-3 px-2 text-right">Insentif Akhir</th>
                      <th className="py-3 pl-2 pr-5">Status Insentif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-slate-800/90 text-xs">
                    {result.phases.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-stone-50/70 dark:hover:bg-slate-800/35 transition-colors"
                      >
                        <td className="py-3.5 pl-5 pr-2 font-bold text-stone-900 dark:text-white whitespace-nowrap">
                          {p.name}
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono tabular-nums text-stone-600 dark:text-slate-300">
                          {formatNumberID(p.weightPercent)}%
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono tabular-nums font-semibold text-stone-900 dark:text-white whitespace-nowrap">
                          {formatFullIDR(p.baseIncentive)}
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            aria-label={`Ach Reguler ${p.name}`}
                            value={input.phases[p.id].achReguler}
                            onChange={(e) => handlePhaseChange(p.id, 'achReguler', e.target.value)}
                            className="w-full min-h-[38px] px-2.5 rounded-lg bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 font-mono tabular-nums text-xs font-semibold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            aria-label={`Ach Finatra ${p.name}`}
                            value={input.phases[p.id].achFinatra}
                            onChange={(e) => handlePhaseChange(p.id, 'achFinatra', e.target.value)}
                            className="w-full min-h-[38px] px-2.5 rounded-lg bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 font-mono tabular-nums text-xs font-semibold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono tabular-nums font-bold text-stone-900 dark:text-white">
                          {formatNumberID(p.achFinalWeighted)}%
                        </td>
                        <td className="py-3.5 px-2 whitespace-nowrap font-mono tabular-nums text-stone-700 dark:text-slate-200">
                          <span className="font-semibold">{p.levelLabel}</span>{' '}
                          <span className="text-stone-400">·</span>{' '}
                          <span>{formatNumberID(p.achMultiplierPercent)}%</span>
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono tabular-nums text-stone-700 dark:text-slate-200">
                          {p.id === 'CLOSING' ? (
                            <span className="font-bold text-amber-700 dark:text-amber-400">
                              {formatNumberID(p.rbMultiplierPercent)}%
                            </span>
                          ) : (
                            <span className="text-stone-400 dark:text-slate-500">100,00%</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono tabular-nums font-extrabold text-sm text-stone-900 dark:text-white whitespace-nowrap">
                          <AnimatedNumber value={p.finalIncentive} formatter={formatFullIDR} />
                        </td>
                        <td className="py-3.5 pl-2 pr-5">
                          {statusBadge(p.statusCategory, p.statusText)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20 text-xs font-bold">
                      <td className="py-4 pl-5 pr-2 text-stone-900 dark:text-white whitespace-nowrap">
                        TOTAL / KESIMPULAN
                      </td>
                      <td className="py-4 px-2 text-right font-mono tabular-nums text-stone-900 dark:text-white">
                        {formatNumberID(result.totalWeightPercent)}%
                      </td>
                      <td className="py-4 px-2 text-right font-mono tabular-nums text-stone-900 dark:text-white whitespace-nowrap">
                        {formatFullIDR(result.totalBaseIncentive)}
                      </td>
                      <td colSpan={2} className="py-4 px-2 text-center text-stone-500 dark:text-slate-400 font-medium">
                        Rata-rata Tertimbang Ach Final
                      </td>
                      <td className="py-4 px-2 text-right font-mono tabular-nums text-stone-900 dark:text-white">
                        {formatNumberID(result.weightedAvgAchFinal)}%
                      </td>
                      <td colSpan={2} className="py-4 px-2 text-right text-stone-500 dark:text-slate-400 font-medium">
                        Estimasi Diterima:
                      </td>
                      <td className="py-4 px-2 text-right font-mono tabular-nums text-base font-extrabold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        <AnimatedNumber value={result.totalFinalIncentive} formatter={formatFullIDR} />
                      </td>
                      <td className="py-4 pl-2 pr-5 font-mono text-[11px] text-amber-800 dark:text-amber-300 whitespace-nowrap">
                        {formatNumberID(result.realizationRatioPercent)}% dari Dasar
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile Stacked Phase Cards (Android Touch Optimized) */}
              <div className="md:hidden divide-y divide-stone-100 dark:divide-slate-800">
                {result.phases.map((p) => (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-extrabold text-stone-900 dark:text-white">
                          {p.name}
                        </span>
                        <span className="text-xs text-stone-500 dark:text-slate-400 ml-2 font-mono">
                          Bobot {formatNumberID(p.weightPercent, 0)}% · Dasar{' '}
                          {formatFullIDR(p.baseIncentive)}
                        </span>
                      </div>
                      {statusBadge(p.statusCategory, p.statusText)}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor={`mob-reg-${p.id}`}
                          className="block text-[11px] font-medium text-stone-500 dark:text-slate-400 mb-1"
                        >
                          Ach Reguler (%)
                        </label>
                        <input
                          id={`mob-reg-${p.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={input.phases[p.id].achReguler}
                          onChange={(e) => handlePhaseChange(p.id, 'achReguler', e.target.value)}
                          className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 font-mono tabular-nums text-sm font-semibold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`mob-fin-${p.id}`}
                          className="block text-[11px] font-medium text-stone-500 dark:text-slate-400 mb-1"
                        >
                          Ach Finatra (%)
                        </label>
                        <input
                          id={`mob-fin-${p.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={input.phases[p.id].achFinatra}
                          onChange={(e) => handlePhaseChange(p.id, 'achFinatra', e.target.value)}
                          className="w-full min-h-[44px] px-3 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 font-mono tabular-nums text-sm font-semibold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                      <div className="p-2.5 rounded-lg bg-stone-50 dark:bg-slate-800/60">
                        <div className="text-[10px] text-stone-500 dark:text-slate-400">Ach Final</div>
                        <div className="font-mono font-bold text-stone-900 dark:text-white mt-0.5">
                          {formatNumberID(p.achFinalWeighted)}%
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-stone-50 dark:bg-slate-800/60">
                        <div className="text-[10px] text-stone-500 dark:text-slate-400">
                          Pengali {p.id === 'CLOSING' ? '· RB 1' : ''}
                        </div>
                        <div className="font-mono font-bold text-stone-900 dark:text-white mt-0.5">
                          {formatNumberID(p.achMultiplierPercent, 0)}%
                          {p.id === 'CLOSING' ? ` × ${formatNumberID(p.rbMultiplierPercent, 0)}%` : ''}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 text-right">
                        <div className="text-[10px] text-amber-800 dark:text-amber-300">Insentif Akhir</div>
                        <div className="font-mono font-extrabold text-amber-700 dark:text-amber-400 mt-0.5 truncate">
                          {formatFullIDR(p.finalIncentive)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-white">
                      TOTAL / KESIMPULAN ({formatNumberID(result.totalWeightPercent, 0)}%)
                    </div>
                    <div className="text-[11px] font-mono text-stone-500 dark:text-slate-400 mt-0.5">
                      Rata-rata Ach Final {formatNumberID(result.weightedAvgAchFinal)}% · Dasar{' '}
                      {formatFullIDR(result.totalBaseIncentive)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-extrabold font-mono text-amber-700 dark:text-amber-400">
                      {formatFullIDR(result.totalFinalIncentive)}
                    </div>
                    <div className="text-[11px] font-mono text-stone-500 dark:text-slate-400">
                      {formatNumberID(result.realizationRatioPercent)}% realisasi
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* BAGIAN III: INSIGHT & ANALISIS STRATEGIS MANAJERIAL (DINAMIS) */}
            <section aria-label="Bagian III: Insight dan Analisis Strategis Manajerial">
              <div className="mb-3">
                <h2 className="text-base font-bold text-stone-900 dark:text-white">
                  Bagian III · Insight &amp; Analisis Strategis Manajerial
                </h2>
                <p className="text-xs text-stone-500 dark:text-slate-400">
                  Rekomendasi otomatis yang merespons parameter &amp; pencapaian simulasi secara real-time
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Pengendalian Kelas Beban CRC */}
                <SpotlightCard className="p-5 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                      1. Pengendalian Kelas Beban CRC
                    </h3>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
                    Dengan IN Amount{' '}
                    <strong className="font-mono text-stone-900 dark:text-white">
                      {formatFullIDR(input.inAmount)}
                    </strong>{' '}
                    pada kategori{' '}
                    <strong className="text-stone-900 dark:text-white">
                      CRC {input.crcType}
                    </strong>
                    , posisi otomatis masuk pada{' '}
                    <strong className="text-stone-900 dark:text-white">
                      Cluster {input.cluster} · Kelas Beban {result.resolvedBurdenClass}
                    </strong>{' '}
                    dengan plafon insentif dasar{' '}
                    <strong className="font-mono text-stone-900 dark:text-white">
                      {formatFullIDR(insights.currentBase)}
                    </strong>
                    .
                  </p>
                  <div className="text-xs text-stone-500 dark:text-slate-400 space-y-1 pt-1 border-t border-stone-100 dark:border-slate-800">
                    {insights.nextClassBase !== null ? (
                      <p>
                        • Potensi naik ke Kelas {result.resolvedBurdenClass + 1}:{' '}
                        <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                          +{formatFullIDR(insights.nextClassBase - insights.currentBase)}
                        </strong>{' '}
                        insentif dasar.
                      </p>
                    ) : (
                      <p>
                        • Sudah di kelas beban maksimal (Kelas 3). Menjaga IN Amount di kelas ini
                        mencegah penurunan plafon dasar ke Kelas 2 sebesar{' '}
                        <strong className="font-mono text-amber-700 dark:text-amber-400">
                          -{formatFullIDR(insights.currentBase - (insights.prevClassBase ?? 0))}
                        </strong>
                        .
                      </p>
                    )}
                    {insights.betterClusterBase !== null && insights.betterClusterRule && (
                      <p>
                        • Perbaikan kualitas cabang ke Cluster {insights.betterClusterRule.cluster}{' '}
                        menambah plafon{' '}
                        <strong className="font-mono text-stone-900 dark:text-white">
                          +{formatFullIDR(insights.betterClusterBase - insights.currentBase)}
                        </strong>
                        .
                      </p>
                    )}
                  </div>
                </SpotlightCard>

                {/* 2. Mitigasi Risiko Level Achievement */}
                <SpotlightCard className="p-5 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert
                      className={`w-4 h-4 shrink-0 ${
                        insights.hangusPhases.length > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                      aria-hidden="true"
                    />
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                      2. Mitigasi Risiko Level Achievement
                    </h3>
                  </div>

                  {insights.hangusPhases.length > 0 ? (
                    <div className="space-y-2 text-xs">
                      <p className="font-semibold text-rose-700 dark:text-rose-400">
                        Peringatan: {insights.hangusPhases.length} fase berada di Level 0 (&lt;
                        {formatNumberID(insights.safeThreshold)}%) dan berisiko hangus!
                      </p>
                      <div className="space-y-1.5 pt-1 border-t border-stone-100 dark:border-slate-800 text-stone-600 dark:text-slate-300">
                        {insights.hangusPhases.map((hp) => (
                          <p key={hp.id}>
                            • <strong>{hp.name}</strong> saat ini{' '}
                            <span className="font-mono font-semibold text-rose-700 dark:text-rose-400">
                              {formatNumberID(hp.achFinalWeighted)}%
                            </span>
                            : butuh tambahan{' '}
                            <strong className="font-mono text-stone-900 dark:text-white">
                              +{formatNumberID(hp.gap)}%
                            </strong>{' '}
                            untuk tembus batas aman {formatNumberID(insights.safeThreshold)}% dan
                            menyelamatkan insentif sebesar{' '}
                            <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                              +{formatFullIDR(hp.potentialSave)}
                            </strong>
                            .
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs text-stone-600 dark:text-slate-300">
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Aman: Seluruh fase telah menembus batas minimal{' '}
                        {formatNumberID(insights.safeThreshold)}% (tidak ada insentif hangus).
                      </p>
                      {insights.nonMaxPhases.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-stone-100 dark:border-slate-800 text-stone-500 dark:text-slate-400">
                          {insights.nonMaxPhases.slice(0, 2).map((np) => (
                            <p key={np.phaseName}>
                              • <strong>{np.phaseName}</strong> hanya perlu{' '}
                              <strong className="font-mono text-stone-900 dark:text-white">
                                +{formatNumberID(np.gap)}%
                              </strong>{' '}
                              ke {np.nextLvl.levelLabel} (
                              {formatNumberID(np.nextLvl.multiplierPercent, 0)}%) untuk ekstra{' '}
                              <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                                +{formatFullIDR(np.gain)}
                              </strong>
                              .
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </SpotlightCard>

                {/* 3. Optimalisasi Closing & Rollback */}
                <SpotlightCard className="p-5 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                      3. Optimalisasi Closing &amp; Rollback (RB 1)
                    </h3>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
                    Fase Closing ({formatFullIDR(insights.closingPhase.baseIncentive)} dasar) saat
                    ini menghasilkan{' '}
                    <strong className="font-mono text-stone-900 dark:text-white">
                      {formatFullIDR(insights.closingPhase.finalIncentive)}
                    </strong>{' '}
                    dengan Indeks RB 1{' '}
                    <strong className="font-mono text-amber-700 dark:text-amber-400">
                      {formatNumberID(result.rb1Rule.indexPercent)}%
                    </strong>
                    .
                  </p>
                  <div className="text-xs text-stone-500 dark:text-slate-400 space-y-1 pt-1 border-t border-stone-100 dark:border-slate-800">
                    {insights.nextClosingLvl ? (
                      <p>
                        • Menaikkan Ach Closing ke{' '}
                        <strong className="font-mono text-stone-900 dark:text-white">
                          {formatNumberID(insights.nextClosingLvl.min)}%
                        </strong>{' '}
                        ({insights.nextClosingLvl.levelLabel}) menambah total insentif{' '}
                        <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                          +{formatFullIDR(insights.closingAchUpside)}
                        </strong>
                        .
                      </p>
                    ) : (
                      <p>• Ach Closing sudah berada di level pengali tertinggi.</p>
                    )}
                    {insights.nextRbRule ? (
                      <p>
                        • Mendorong Ach RB 1 menembus{' '}
                        <strong className="font-mono text-stone-900 dark:text-white">
                          {formatNumberID(insights.nextRbRule.min)}%
                        </strong>{' '}
                        (Indeks RB {formatNumberID(insights.nextRbRule.indexPercent, 0)}%) langsung
                        mendongkrak insentif{' '}
                        <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                          +{formatFullIDR(insights.rbUpside)}
                        </strong>
                        .
                      </p>
                    ) : (
                      <p>• Realisasi Ach RB 1 sudah mencapai indeks pengali tertinggi (150%).</p>
                    )}
                  </div>
                </SpotlightCard>

                {/* 4. Sinkronisasi Portofolio Finatra */}
                <SpotlightCard className="p-5 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <PieChart className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                      4. Sinkronisasi Portofolio Finatra
                    </h3>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
                    Dengan bobot Finatra{' '}
                    <strong className="font-mono text-stone-900 dark:text-white">
                      {formatNumberID(input.finatraWeightPercent)}%
                    </strong>
                    , portofolio Finatra menyumbang rata-rata{' '}
                    <strong className="font-mono text-amber-700 dark:text-amber-400">
                      +{formatNumberID(result.weightedFinatraContribution)} poin
                    </strong>{' '}
                    terhadap Rata-rata Tertimbang Ach Final (
                    {formatNumberID(result.weightedAvgAchFinal)}%).
                  </p>
                  <div className="text-xs text-stone-500 dark:text-slate-400 space-y-1 pt-1 border-t border-stone-100 dark:border-slate-800">
                    <p>
                      • Kontribusi per fase:{' '}
                      {result.phases.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 ? ' · ' : ''}
                          {p.name}{' '}
                          <strong className="font-mono text-stone-900 dark:text-white">
                            +{formatNumberID(p.finatraPointContribution)}
                          </strong>
                        </span>
                      ))}
                    </p>
                    <p>
                      •{' '}
                      {insights.finatraLiftingPhases.length > 0
                        ? `Finatra mengangkat Ach Final pada ${insights.finatraLiftingPhases
                            .map((x) => x.name)
                            .join(', ')}.`
                        : 'Belum ada fase di mana Ach Finatra melampaui Ach Reguler.'}{' '}
                      {insights.finatraLaggingPhases.length > 0 &&
                        `Perlu akselerasi Finatra pada ${insights.finatraLaggingPhases
                          .map((x) => x.name)
                          .join(', ')} agar sinkron dengan Reguler.`}
                    </p>
                  </div>
                </SpotlightCard>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
