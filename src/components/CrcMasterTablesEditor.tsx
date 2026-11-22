import React from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Table2, Award, TrendingUp, Layers } from 'lucide-react';
import { CrcCycleType, MasterCrcConfig } from '../types/crc';
import { DEFAULT_MASTER_CRC } from '../utils/crcCalculator';
import { formatCompactIDR } from '../utils/format';
import { SpotlightCard } from './SpotlightCard';

interface CrcMasterTablesEditorProps {
  master: MasterCrcConfig;
  onChange: (next: MasterCrcConfig) => void;
}

export const CrcMasterTablesEditor: React.FC<CrcMasterTablesEditorProps> = ({
  master,
  onChange,
}) => {
  const updateCluster = (
    clusterNum: number,
    field: 'targetR1R2' | 'class1' | 'class2' | 'class3',
    rawValue: string
  ) => {
    const nextClusters = master.clusters.map((row) => {
      if (row.cluster !== clusterNum) return row;
      if (field === 'targetR1R2') {
        return { ...row, targetR1R2: rawValue };
      }
      const parsed = Math.max(0, Number(rawValue) || 0);
      return { ...row, [field]: parsed };
    });
    onChange({ ...master, clusters: nextClusters });
  };

  const updateLevel = (
    id: string,
    field: 'levelLabel' | 'min' | 'max' | 'multiplierPercent',
    rawValue: string
  ) => {
    const nextLevels = master.achievementLevels.map((row) => {
      if (row.id !== id) return row;
      if (field === 'levelLabel') return { ...row, levelLabel: rawValue };
      if (field === 'max') {
        if (rawValue.trim() === '') return { ...row, max: null };
        return { ...row, max: Math.max(0, Number(rawValue) || 0) };
      }
      return { ...row, [field]: Math.max(0, Number(rawValue) || 0) };
    });
    onChange({ ...master, achievementLevels: nextLevels });
  };

  const updateRollback = (
    id: string,
    field: 'label' | 'min' | 'max' | 'indexPercent',
    rawValue: string
  ) => {
    const nextRb = master.rollbackIndices.map((row) => {
      if (row.id !== id) return row;
      if (field === 'label') return { ...row, label: rawValue };
      if (field === 'max') {
        if (rawValue.trim() === '') return { ...row, max: null };
        return { ...row, max: Math.max(0, Number(rawValue) || 0) };
      }
      return { ...row, [field]: Math.max(0, Number(rawValue) || 0) };
    });
    onChange({ ...master, rollbackIndices: nextRb });
  };

  const updateCycleThreshold = (
    cycle: CrcCycleType,
    field: 'kelas2Min' | 'kelas2Max',
    rawValue: string
  ) => {
    const base = master.cycleThresholds || DEFAULT_MASTER_CRC.cycleThresholds;
    const next = base.map((row) => {
      if (row.cycle !== cycle) return row;
      const parsed = Math.max(0, Number(rawValue) || 0);
      return { ...row, [field]: parsed };
    });
    onChange({ ...master, cycleThresholds: next });
  };

  const inputClass =
    'w-full min-h-[38px] px-2.5 rounded-lg bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-xs font-mono tabular-nums text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500';

  return (
    <div className="space-y-6">
      <div className="luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-stone-900 dark:text-white">
            Konfigurasi Master Tabel Referensi CRC
          </h2>
          <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
            Setiap perubahan pada matrix dasar, level achievement, atau indeks RB 1 langsung memperbarui kalkulator secara real-time.
          </p>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => onChange(DEFAULT_MASTER_CRC)}
          className="min-h-[42px] px-4 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-amber-500/60 text-xs font-semibold text-stone-700 dark:text-slate-200 inline-flex items-center gap-2 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span>Reset Master ke Default</span>
        </motion.button>
      </div>

      {/* Table A: Matrix Insentif Dasar CRC */}
      <SpotlightCard className="p-4 sm:p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <Table2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              A. Matrix Insentif Dasar CRC (Cluster Cabang × Kelas Beban)
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-slate-400">
              Nilai nominal dalam Rupiah (Rp) untuk masing-masing Kelas 1, Kelas 2, dan Kelas 3
            </p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                <th className="py-2.5 pr-3">Cluster</th>
                <th className="py-2.5 px-2">Target R1/R2</th>
                <th className="py-2.5 px-2">Kelas 1 (Rp)</th>
                <th className="py-2.5 px-2">Kelas 2 (Rp)</th>
                <th className="py-2.5 pl-2">Kelas 3 (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-slate-800/80 text-xs">
              {master.clusters.map((row) => (
                <tr key={row.cluster}>
                  <td className="py-2 pr-3 font-bold text-stone-900 dark:text-white whitespace-nowrap">
                    Cluster {row.cluster}
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      aria-label={`Target R1/R2 Cluster ${row.cluster}`}
                      value={row.targetR1R2}
                      onChange={(e) => updateCluster(row.cluster, 'targetR1R2', e.target.value)}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      step={50000}
                      min={0}
                      aria-label={`Insentif Kelas 1 Cluster ${row.cluster}`}
                      value={row.class1}
                      onChange={(e) => updateCluster(row.cluster, 'class1', e.target.value)}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      step={50000}
                      min={0}
                      aria-label={`Insentif Kelas 2 Cluster ${row.cluster}`}
                      value={row.class2}
                      onChange={(e) => updateCluster(row.cluster, 'class2', e.target.value)}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 pl-2">
                    <input
                      type="number"
                      step={50000}
                      min={0}
                      aria-label={`Insentif Kelas 3 Cluster ${row.cluster}`}
                      value={row.class3}
                      onChange={(e) => updateCluster(row.cluster, 'class3', e.target.value)}
                      className={inputClass}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SpotlightCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Table B: Tabel Pengali Achievement */}
        <SpotlightCard className="p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                B. Tabel Pengali Achievement (Level Ach)
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-slate-400">
                Kosongkan kolom Maks (%) untuk batas terbuka ke atas (≥)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[420px] text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                  <th className="py-2 pr-2">Level</th>
                  <th className="py-2 px-1.5">Min (%)</th>
                  <th className="py-2 px-1.5">Maks (%)</th>
                  <th className="py-2 pl-1.5">Pengali (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-slate-800/80 text-xs">
                {master.achievementLevels.map((lvl) => (
                  <tr key={lvl.id}>
                    <td className="py-1.5 pr-2">
                      <input
                        type="text"
                        aria-label={`Label ${lvl.levelLabel}`}
                        value={lvl.levelLabel}
                        onChange={(e) => updateLevel(lvl.id, 'levelLabel', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <input
                        type="number"
                        step="0.01"
                        aria-label={`Min % ${lvl.levelLabel}`}
                        value={lvl.min}
                        onChange={(e) => updateLevel(lvl.id, 'min', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="∞"
                        aria-label={`Maks % ${lvl.levelLabel}`}
                        value={lvl.max === null ? '' : lvl.max}
                        onChange={(e) => updateLevel(lvl.id, 'max', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 pl-1.5">
                      <input
                        type="number"
                        step="1"
                        aria-label={`Pengali % ${lvl.levelLabel}`}
                        value={lvl.multiplierPercent}
                        onChange={(e) => updateLevel(lvl.id, 'multiplierPercent', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SpotlightCard>

        {/* Table C: Tabel Indeks Rollback (RB 1) */}
        <SpotlightCard className="p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                C. Tabel Indeks Rollback (RB 1)
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-slate-400">
                Pengali khusus fase CLOSING berdasarkan realisasi Ach RB 1 (%)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[420px] text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                  <th className="py-2 pr-2">Rentang Ach RB 1</th>
                  <th className="py-2 px-1.5">Min (%)</th>
                  <th className="py-2 px-1.5">Maks (%)</th>
                  <th className="py-2 pl-1.5">Indeks RB (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-slate-800/80 text-xs">
                {master.rollbackIndices.map((rb) => (
                  <tr key={rb.id}>
                    <td className="py-1.5 pr-2">
                      <input
                        type="text"
                        aria-label={`Rentang ${rb.label}`}
                        value={rb.label}
                        onChange={(e) => updateRollback(rb.id, 'label', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <input
                        type="number"
                        step="0.01"
                        aria-label={`Min RB % ${rb.label}`}
                        value={rb.min}
                        onChange={(e) => updateRollback(rb.id, 'min', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="∞"
                        aria-label={`Maks RB % ${rb.label}`}
                        value={rb.max === null ? '' : rb.max}
                        onChange={(e) => updateRollback(rb.id, 'max', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 pl-1.5">
                      <input
                        type="number"
                        step="1"
                        aria-label={`Indeks RB % ${rb.label}`}
                        value={rb.indexPercent}
                        onChange={(e) => updateRollback(rb.id, 'indexPercent', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SpotlightCard>
      </div>

      {/* Table D: Matrix Batas IN Amount Kelas Beban CRC (C0 / C1 / C0C1) */}
      <SpotlightCard className="p-4 sm:p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              D. Matrix Batas IN Amount Kelas Beban CRC (C0 / C1 / C0C1)
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-slate-400">
              Klasifikasi otomatis Kelas 1 (&lt; batas bawah), Kelas 2 (rentang tengah), dan Kelas 3 (&gt; batas atas)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full min-w-[680px] text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
                <th className="py-2 pr-3">Kategori CRC</th>
                <th className="py-2 px-2">Batas Kelas 2 Min (Rp)</th>
                <th className="py-2 px-2">Batas Kelas 2 Maks (Rp)</th>
                <th className="py-2 px-2">Kelas 1 (&lt;)</th>
                <th className="py-2 px-2">Kelas 2 (Rentang)</th>
                <th className="py-2 pl-2">Kelas 3 (&gt;)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-slate-800/80 text-xs">
              {(master.cycleThresholds || DEFAULT_MASTER_CRC.cycleThresholds).map((ct) => (
                <tr key={ct.cycle}>
                  <td className="py-2 pr-3 font-bold text-stone-900 dark:text-white whitespace-nowrap">
                    {ct.label}
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      step={500000000}
                      min={0}
                      aria-label={`Batas Kelas 2 Min ${ct.label}`}
                      value={ct.kelas2Min}
                      onChange={(e) => updateCycleThreshold(ct.cycle, 'kelas2Min', e.target.value)}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      step={500000000}
                      min={0}
                      aria-label={`Batas Kelas 2 Maks ${ct.label}`}
                      value={ct.kelas2Max}
                      onChange={(e) => updateCycleThreshold(ct.cycle, 'kelas2Max', e.target.value)}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-2 px-2 font-mono text-[11px] text-stone-600 dark:text-slate-300 whitespace-nowrap">
                    &lt; {formatCompactIDR(ct.kelas2Min)}
                  </td>
                  <td className="py-2 px-2 font-mono text-[11px] text-amber-700 dark:text-amber-400 font-semibold whitespace-nowrap">
                    {formatCompactIDR(ct.kelas2Min)} – {formatCompactIDR(ct.kelas2Max)}
                  </td>
                  <td className="py-2 pl-2 font-mono text-[11px] text-stone-600 dark:text-slate-300 whitespace-nowrap">
                    &gt; {formatCompactIDR(ct.kelas2Max)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SpotlightCard>
    </div>
  );
};
