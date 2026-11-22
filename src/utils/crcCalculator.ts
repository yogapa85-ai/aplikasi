import {
  AchievementLevelRule,
  BurdenClass,
  ClusterRule,
  CrcCycleType,
  CycleClassThreshold,
  MasterCrcConfig,
  PhaseCalculated,
  PhaseId,
  RollbackIndexRule,
  SimulationInput,
  SimulationResult,
} from '../types/crc';
import { formatFullIDR } from './format';

export const DEFAULT_MASTER_CRC: MasterCrcConfig = {
  clusters: [
    { cluster: 1, targetR1R2: '9,00% - 10,00%', class1: 4000000, class2: 4500000, class3: 5000000 },
    { cluster: 2, targetR1R2: '10,01% - 11,00%', class1: 3500000, class2: 4000000, class3: 4500000 },
    { cluster: 3, targetR1R2: '11,01% - 12,00%', class1: 3000000, class2: 3500000, class3: 4000000 },
    { cluster: 4, targetR1R2: '12,01% - 13,00%', class1: 2500000, class2: 3000000, class3: 3500000 },
    { cluster: 5, targetR1R2: '13,01% - 14,00%', class1: 2000000, class2: 2500000, class3: 3000000 },
    { cluster: 6, targetR1R2: '14,01% - 15,00%', class1: 1500000, class2: 2000000, class3: 2500000 },
    { cluster: 7, targetR1R2: '15,01% - 17,00%', class1: 1000000, class2: 1500000, class3: 2000000 },
  ],
  cycleThresholds: [
    { cycle: 'C0', label: 'CRC C0', kelas2Min: 9500000000, kelas2Max: 12000000000 },
    { cycle: 'C1', label: 'CRC C1', kelas2Min: 4000000000, kelas2Max: 5500000000 },
    { cycle: 'C0C1', label: 'CRC C0C1', kelas2Min: 6500000000, kelas2Max: 9500000000 },
  ],
  achievementLevels: [
    { id: 'lvl-0', levelLabel: 'Level 0', min: 0, max: 84.99, multiplierPercent: 0 },
    { id: 'lvl-1', levelLabel: 'Level 1', min: 85, max: 99.99, multiplierPercent: 85 },
    { id: 'lvl-2', levelLabel: 'Level 2', min: 100, max: 109.99, multiplierPercent: 100 },
    { id: 'lvl-3', levelLabel: 'Level 3', min: 110, max: 119.99, multiplierPercent: 110 },
    { id: 'lvl-4', levelLabel: 'Level 4', min: 120, max: 129.99, multiplierPercent: 120 },
    { id: 'lvl-5', levelLabel: 'Level 5', min: 130, max: 139.99, multiplierPercent: 130 },
    { id: 'lvl-6', levelLabel: 'Level 6', min: 140, max: 149.99, multiplierPercent: 140 },
    { id: 'lvl-7', levelLabel: 'Level 7', min: 150, max: 159.99, multiplierPercent: 150 },
    { id: 'lvl-8', levelLabel: 'Level 8', min: 160, max: 199.99, multiplierPercent: 160 },
    { id: 'lvl-x', levelLabel: 'Level X', min: 200, max: null, multiplierPercent: 200 },
  ],
  rollbackIndices: [
    { id: 'rb-1', label: '0,00% - 84,99%', min: 0, max: 84.99, indexPercent: 85 },
    { id: 'rb-2', label: '85,00% - 100,00%', min: 85, max: 100, indexPercent: 100 },
    { id: 'rb-3', label: '100,01% - 110,00%', min: 100.01, max: 110, indexPercent: 110 },
    { id: 'rb-4', label: '110,01% - 120,00%', min: 110.01, max: 120, indexPercent: 120 },
    { id: 'rb-5', label: '120,01% - 130,00%', min: 120.01, max: 130, indexPercent: 130 },
    { id: 'rb-6', label: '130,01% - 140,00%', min: 130.01, max: 140, indexPercent: 140 },
    { id: 'rb-7', label: '>= 140,01%', min: 140.01, max: null, indexPercent: 150 },
  ],
};

export const DEFAULT_SIMULATION_INPUT: SimulationInput = {
  coordinatorName: 'Yoga Pangestu (YGP)',
  cluster: 2,
  crcType: 'C0',
  inAmount: 13000000000,
  regulerWeightPercent: 95,
  finatraWeightPercent: 5,
  achRb1Percent: 100,
  phases: {
    PS1: {
      id: 'PS1',
      name: 'PS 1',
      weightPercent: 30,
      achReguler: 83.45,
      achFinatra: 81.25,
    },
    PS2: {
      id: 'PS2',
      name: 'PS 2',
      weightPercent: 40,
      achReguler: 89.12,
      achFinatra: 90.84,
    },
    CLOSING: {
      id: 'CLOSING',
      name: 'CLOSING',
      weightPercent: 30,
      achReguler: 100.21,
      achFinatra: 110.25,
    },
  },
};

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function formatNumberID(val: number, decimals = 2): string {
  if (!Number.isFinite(val)) return '0,00';
  return val.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function lookupClusterRule(master: MasterCrcConfig, clusterNum: number): ClusterRule {
  return (
    master.clusters.find((c) => c.cluster === clusterNum) ||
    master.clusters[0] ||
    DEFAULT_MASTER_CRC.clusters[0]
  );
}

export function getIncentiveByClass(rule: ClusterRule, burdenClass: BurdenClass): number {
  if (burdenClass === 1) return rule.class1;
  if (burdenClass === 2) return rule.class2;
  return rule.class3;
}

export function lookupCycleThreshold(
  master: MasterCrcConfig,
  crcType: CrcCycleType
): CycleClassThreshold {
  const list =
    master.cycleThresholds && master.cycleThresholds.length > 0
      ? master.cycleThresholds
      : DEFAULT_MASTER_CRC.cycleThresholds;
  return (
    list.find((c) => c.cycle === crcType) ||
    list[0] ||
    DEFAULT_MASTER_CRC.cycleThresholds[0]
  );
}

export function lookupBurdenClassByInAmount(
  master: MasterCrcConfig,
  crcType: CrcCycleType,
  inAmount: number
): BurdenClass {
  const val = Math.max(0, inAmount);
  const threshold = lookupCycleThreshold(master, crcType);
  if (val < threshold.kelas2Min) return 1;
  if (val <= threshold.kelas2Max) return 2;
  return 3;
}

export function lookupAchievementLevel(
  master: MasterCrcConfig,
  achPercent: number
): AchievementLevelRule {
  const val = Math.max(0, round2(achPercent));
  const sorted = [...master.achievementLevels].sort((a, b) => a.min - b.min);
  const exact = sorted.find((lvl) => val >= lvl.min && (lvl.max === null || val <= lvl.max));
  if (exact) return exact;

  const fallback = [...sorted].reverse().find((lvl) => val >= lvl.min);
  return fallback || sorted[0];
}

export function lookupRollbackIndex(
  master: MasterCrcConfig,
  achRb1Percent: number
): RollbackIndexRule {
  const val = Math.max(0, round2(achRb1Percent));
  const sorted = [...master.rollbackIndices].sort((a, b) => a.min - b.min);
  const exact = sorted.find((rb) => val >= rb.min && (rb.max === null || val <= rb.max));
  if (exact) return exact;

  const fallback = [...sorted].reverse().find((rb) => val >= rb.min);
  return fallback || sorted[0];
}

export function calculateCrcSimulation(
  input: SimulationInput,
  master: MasterCrcConfig
): SimulationResult {
  const activeClusterRule = lookupClusterRule(master, input.cluster);
  const activeCycleThreshold = lookupCycleThreshold(master, input.crcType);
  const resolvedBurdenClass = lookupBurdenClassByInAmount(
    master,
    input.crcType,
    input.inAmount
  );
  const totalBaseIncentive = getIncentiveByClass(activeClusterRule, resolvedBurdenClass);
  const rb1Rule = lookupRollbackIndex(master, input.achRb1Percent);

  const regW = input.regulerWeightPercent / 100;
  const finW = input.finatraWeightPercent / 100;

  const phaseOrder: PhaseId[] = ['PS1', 'PS2', 'CLOSING'];
  const phases: PhaseCalculated[] = phaseOrder.map((pid) => {
    const p = input.phases[pid];
    const baseIncentive = totalBaseIncentive * (p.weightPercent / 100);
    const regulerPointContribution = p.achReguler * regW;
    const finatraPointContribution = p.achFinatra * finW;
    const achFinalWeighted = regulerPointContribution + finatraPointContribution;
    const achRounded = round2(achFinalWeighted);

    const lvl = lookupAchievementLevel(master, achRounded);
    const rbMultiplierPercent = pid === 'CLOSING' ? rb1Rule.indexPercent : 100;
    const finalIncentive =
      pid === 'CLOSING'
        ? baseIncentive * (lvl.multiplierPercent / 100) * (rbMultiplierPercent / 100)
        : baseIncentive * (lvl.multiplierPercent / 100);

    let statusCategory: PhaseCalculated['statusCategory'] = 'optimal';
    let statusText = `Optimal · ${lvl.levelLabel} (${formatNumberID(lvl.multiplierPercent, 0)}%)`;

    if (lvl.multiplierPercent === 0) {
      statusCategory = 'hangus';
      statusText = `Hangus · ${lvl.levelLabel} (<85%)`;
    } else if (lvl.multiplierPercent < 100) {
      statusCategory = 'warning';
      statusText = `${lvl.levelLabel} (${formatNumberID(lvl.multiplierPercent, 0)}%)`;
    }

    return {
      id: p.id,
      name: p.name,
      weightPercent: p.weightPercent,
      baseIncentive,
      achReguler: p.achReguler,
      achFinatra: p.achFinatra,
      achFinalWeighted,
      finatraPointContribution,
      regulerPointContribution,
      levelLabel: lvl.levelLabel,
      achMultiplierPercent: lvl.multiplierPercent,
      rbMultiplierPercent,
      finalIncentive,
      statusCategory,
      statusText,
    };
  });

  const totalWeightPercent = phases.reduce((s, p) => s + p.weightPercent, 0);
  const weightedAvgAchFinal = phases.reduce(
    (s, p) => s + p.achFinalWeighted * (p.weightPercent / 100),
    0
  );
  const weightedFinatraContribution = phases.reduce(
    (s, p) => s + p.finatraPointContribution * (p.weightPercent / 100),
    0
  );
  const totalFinalIncentive = phases.reduce((s, p) => s + p.finalIncentive, 0);
  const realizationRatioPercent =
    totalBaseIncentive > 0 ? (totalFinalIncentive / totalBaseIncentive) * 100 : 0;

  return {
    totalBaseIncentive,
    resolvedBurdenClass,
    activeCycleThreshold,
    weightedAvgAchFinal,
    totalFinalIncentive,
    realizationRatioPercent,
    activeClusterRule,
    rb1Rule,
    phases,
    totalWeightPercent,
    weightedFinatraContribution,
  };
}

export function buildSimulationShareText(
  input: SimulationInput,
  result: SimulationResult
): string {
  const lines: string[] = [
    `*SIMULASI INSENTIF CRC — CR 41400*`,
    `Koordinator: ${input.coordinatorName || '-'}`,
    `Cluster Cabang: Cluster ${input.cluster}`,
    `Kategori CRC: CRC ${input.crcType}`,
    `IN Amount: ${formatFullIDR(input.inAmount)} (Otomatis Kelas ${result.resolvedBurdenClass})`,
    `Insentif Dasar: ${formatFullIDR(result.totalBaseIncentive)}`,
    `Bobot Portofolio: Reguler ${formatNumberID(input.regulerWeightPercent)}% | Finatra ${formatNumberID(input.finatraWeightPercent)}%`,
    `Realisasi Ach RB 1: ${formatNumberID(input.achRb1Percent)}% (Indeks RB: ${formatNumberID(result.rb1Rule.indexPercent)}%)`,
    ``,
    `*RINCIAN PER FASE:*`,
  ];

  for (const p of result.phases) {
    lines.push(
      `• ${p.name} (${p.weightPercent}%): Ach Final ${formatNumberID(p.achFinalWeighted)}% [${p.levelLabel} · ${formatNumberID(p.achMultiplierPercent, 0)}%]${
        p.id === 'CLOSING' ? ` × RB ${formatNumberID(p.rbMultiplierPercent, 0)}%` : ''
      } => *${formatFullIDR(p.finalIncentive)}*`
    );
  }

  lines.push(``);
  lines.push(`*RINGKASAN AKHIR:*`);
  lines.push(`Rata-rata Tertimbang Ach Final: ${formatNumberID(result.weightedAvgAchFinal)}%`);
  lines.push(
    `Total Estimasi Insentif Akhir: *${formatFullIDR(result.totalFinalIncentive)}* (${formatNumberID(result.realizationRatioPercent)}% dari dasar)`
  );

  return lines.join('\n');
}
