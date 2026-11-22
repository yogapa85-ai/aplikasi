export type BurdenClass = 1 | 2 | 3;

export type CrcCycleType = 'C0' | 'C1' | 'C0C1';

export type PhaseId = 'PS1' | 'PS2' | 'CLOSING';

export interface ClusterRule {
  cluster: number;
  targetR1R2: string;
  class1: number;
  class2: number;
  class3: number;
}

export interface AchievementLevelRule {
  id: string;
  levelLabel: string;
  min: number;
  max: number | null;
  multiplierPercent: number;
}

export interface RollbackIndexRule {
  id: string;
  label: string;
  min: number;
  max: number | null;
  indexPercent: number;
}

export interface CycleClassThreshold {
  cycle: CrcCycleType;
  label: string;
  /** Batas bawah Kelas 2 (Rp). Nilai < kelas2Min masuk Kelas 1. */
  kelas2Min: number;
  /** Batas atas Kelas 2 (Rp). Nilai > kelas2Max masuk Kelas 3. */
  kelas2Max: number;
}

export interface MasterCrcConfig {
  clusters: ClusterRule[];
  cycleThresholds: CycleClassThreshold[];
  achievementLevels: AchievementLevelRule[];
  rollbackIndices: RollbackIndexRule[];
}

export interface PhaseInput {
  id: PhaseId;
  name: string;
  weightPercent: number;
  achReguler: number;
  achFinatra: number;
}

export interface SimulationInput {
  coordinatorName: string;
  cluster: number;
  crcType: CrcCycleType;
  inAmount: number;
  regulerWeightPercent: number;
  finatraWeightPercent: number;
  achRb1Percent: number;
  phases: Record<PhaseId, PhaseInput>;
}

export interface PhaseCalculated {
  id: PhaseId;
  name: string;
  weightPercent: number;
  baseIncentive: number;
  achReguler: number;
  achFinatra: number;
  achFinalWeighted: number;
  finatraPointContribution: number;
  regulerPointContribution: number;
  levelLabel: string;
  achMultiplierPercent: number;
  rbMultiplierPercent: number;
  finalIncentive: number;
  statusCategory: 'hangus' | 'warning' | 'optimal';
  statusText: string;
}

export interface SimulationResult {
  totalBaseIncentive: number;
  resolvedBurdenClass: BurdenClass;
  activeCycleThreshold: CycleClassThreshold;
  weightedAvgAchFinal: number;
  totalFinalIncentive: number;
  realizationRatioPercent: number;
  activeClusterRule: ClusterRule;
  rb1Rule: RollbackIndexRule;
  phases: PhaseCalculated[];
  totalWeightPercent: number;
  weightedFinatraContribution: number;
}
