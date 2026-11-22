export interface PerformanceRecord {
  periode: string;
  year: string;
  month: number;
  ca: string;
  collId: string;
  collName: string;
  spvId: string;
  spvName: string;
  posId: string;
  posName: string;
  bahan: number;
  rolling: number;
  inPercent: number;
}

export interface PosSummary {
  posName: string;
  posId: string;
  collectorCount: number;
  totalBahan: number;
  totalRolling: number;
  avgInPercent: number;
  weightedInPercent: number;
  spvs: string[];
}

export interface OverviewResponse {
  success: boolean;
  fetchedAt: string;
  stale: boolean;
  upstreamUrl: string;
  appRevision?: string;
  entryScript?: string | null;
  dataSignature?: string;
  periods: string[];
  years: string[];
  posList: string[];
  cycles: string[];
  records: PerformanceRecord[];
  error?: string;
}

export interface QueueItem {
  phone: string;
  status: 'pending' | 'validating' | 'success' | 'failed';
  updatedAt: string;
}

export interface LiveEvent {
  id: string;
  type: 'connection' | 'gateway' | 'queue' | 'completed' | 'system';
  title: string;
  detail: string;
  timestamp: string;
  tone: 'neutral' | 'success' | 'warning' | 'error';
}

export interface LiveOpsState {
  upstreamSocketConnected: boolean;
  gatewayStatus: 'connected' | 'disconnected' | 'unknown';
  appRevision?: string;
  entryScript?: string | null;
  dataSignature?: string;
  queueCounts: {
    pending: number;
    validating: number;
    success: number;
    failed: number;
    total: number;
  };
  queueItems: QueueItem[];
  events: LiveEvent[];
  lastEventAt: string | null;
}

export interface IncentiveRecord {
  periode: string;
  nama: string;
  npk: string;
  handlingCycle: string;
  finalIncColl: number;
}

export interface OcmCollMetrics {
  collId: string;
  collName: string;
  rolling: number;
  pkkAwTotal: number;
  inPercent: number;
  lkpRowCount: number;
  rollingRowCount: number;
}

export type OcmRealtimeStatus =
  | 'ok'
  | 'permission_required'
  | 'unreachable'
  | 'zip_not_found'
  | 'txt_not_found'
  | 'invalid_columns'
  | 'error';

export interface OcmRealtimeResponse {
  success: boolean;
  status: OcmRealtimeStatus;
  date: {
    year: number;
    month: number;
    day: number;
    yyyymm: string;
    ddMinus1: string;
    yyyymmdd: string;
    periodLabel: string;
  };
  targetPath: string;
  entryName: string | null;
  rowCount: number;
  collectorCount: number;
  checkedAt: string;
  fileMtimeMs: number | null;
  fileSizeBytes?: number | null;
  fromCache?: boolean;
  availableFiles?: string[];
  availableCycles?: string[];
  errorMessage?: string;
  metricsByCollId: Record<string, OcmCollMetrics>;
  metricsByCycle?: Record<string, Record<string, OcmCollMetrics>>;
}
