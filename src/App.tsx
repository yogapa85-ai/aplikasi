import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import {
  LayoutGrid,
  Users,
  Radio,
  Wallet,
  Calculator,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';
import {
  LiveOpsState,
  OcmRealtimeResponse,
  OverviewResponse,
  PerformanceRecord,
} from './types/ops';
import { formatTimeID } from './utils/format';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OverviewTab } from './components/OverviewTab';
import { CollectorSearchTab } from './components/CollectorSearchTab';
import { LiveOpsTab } from './components/LiveOpsTab';
import { IncentiveTab } from './components/IncentiveTab';
import { CrcSimulationTab } from './components/CrcSimulationTab';
import { CollectorDetailSheet } from './components/CollectorDetailSheet';
import { KineticBackdrop } from './components/KineticBackdrop';
import { EASE_OUT_EXPO } from './components/MotionPrimitives';
import { TacticalHeroPortal, DashboardTargetTab } from './components/TacticalHeroPortal';

type TabId = 'overview' | 'collectors' | 'live' | 'incentive' | 'crcSim';

const TAB_ORDER: TabId[] = ['overview', 'collectors', 'live', 'incentive', 'crcSim'];

const TAB_META: Record<TabId, { title: string; subtitle: string }> = {
  overview: {
    title: 'Operasional Karesidenan Pati',
    subtitle: 'Ringkasan performa cabang & tim lapangan',
  },
  collectors: {
    title: 'Pencarian & Profil Personil',
    subtitle: 'Rekam jejak capaian lintas periode kolektor',
  },
  live: {
    title: 'Monitoring Stream Real-Time',
    subtitle: 'Status gateway & antrean blast Command Center',
  },
  incentive: {
    title: 'Portal Insentif Personil',
    subtitle: 'Akses personal & rekap insentif tahunan',
  },
  crcSim: {
    title: 'Simulasi Insentif CRC',
    subtitle: 'Kalkulator & Simulasi Insentif Collection Coordinator',
  },
};

const CACHE_STORAGE_KEY = 'cr41400_ops_overview_cache_v1';
const RELOAD_GUARD_KEY = 'cr41400_reloaded_rev';

const DEFAULT_LIVE_STATE: LiveOpsState = {
  upstreamSocketConnected: false,
  gatewayStatus: 'unknown',
  queueCounts: { pending: 0, validating: 0, success: 0, failed: 0, total: 0 },
  queueItems: [],
  events: [],
  lastEventAt: null,
};

const featureVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? 32 : -32,
    y: 8,
    scale: 0.98,
    filter: 'blur(4px)',
  }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.28,
      ease: EASE_OUT_EXPO,
    },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? -24 : 24,
    y: -6,
    scale: 0.985,
    filter: 'blur(3px)',
    transition: {
      duration: 0.18,
      ease: EASE_OUT_EXPO,
    },
  }),
};

export default function App() {
  const [appMode, setAppMode] = useState<'hero' | 'dashboard'>('hero');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [tabDirection, setTabDirection] = useState<number>(1);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('cr41400_theme') === 'dark';
    }
    return false;
  });

  const [overview, setOverview] = useState<OverviewResponse | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as OverviewResponse;
    } catch {
      return null;
    }
    return null;
  });

  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(!overview);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [liveState, setLiveState] = useState<LiveOpsState>(DEFAULT_LIVE_STATE);
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  const [selectedCollector, setSelectedCollector] = useState<PerformanceRecord | null>(null);

  const [ocmDate, setOcmDate] = useState<{ year: number; month: number; day: number }>(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  });
  const [ocmPollSeconds, setOcmPollSeconds] = useState<number>(5);
  const [ocmData, setOcmData] = useState<OcmRealtimeResponse | null>(null);
  const [ocmLoading, setOcmLoading] = useState<boolean>(false);

  const knownRevisionRef = useRef<string | null>(null);
  const knownDataSigRef = useRef<string | null>(null);

  const forceRefreshAppShell = useCallback(async () => {
    try {
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.includes('html') || k.includes('precache') || k.includes('workbox'))
            .map((k) => window.caches.delete(k))
        );
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      }
    } catch {
      // Ignore cache/SW errors during refresh
    } finally {
      window.location.reload();
    }
  }, []);

  const checkRevisionUpdate = useCallback(
    (incomingRev?: string, incomingScript?: string | null) => {
      const canReloadNow = (marker: string): boolean => {
        try {
          const raw = window.sessionStorage.getItem(RELOAD_GUARD_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as { marker?: string; at?: number };
            if (parsed.marker === marker && parsed.at && Date.now() - parsed.at < 15000) {
              return false;
            }
          }
          window.sessionStorage.setItem(
            RELOAD_GUARD_KEY,
            JSON.stringify({ marker, at: Date.now() })
          );
          return true;
        } catch {
          return false;
        }
      };

      if (incomingScript && typeof document !== 'undefined') {
        const activeScript = document
          .querySelector('script[type="module"][src*="/assets/"]')
          ?.getAttribute('src');
        if (activeScript && activeScript !== incomingScript) {
          if (canReloadNow(incomingScript)) {
            void forceRefreshAppShell();
          }
          return;
        }
      }

      if (!incomingRev) return;
      if (!knownRevisionRef.current) {
        knownRevisionRef.current = incomingRev;
        return;
      }
      if (knownRevisionRef.current !== incomingRev) {
        if (canReloadNow(incomingRev)) {
          void forceRefreshAppShell();
        } else {
          knownRevisionRef.current = incomingRev;
        }
      }
    },
    [forceRefreshAppShell]
  );

  const switchTab = useCallback(
    (nextTab: TabId) => {
      if (nextTab === activeTab) return;
      const prevIdx = TAB_ORDER.indexOf(activeTab);
      const nextIdx = TAB_ORDER.indexOf(nextTab);
      setTabDirection(nextIdx >= prevIdx ? 1 : -1);
      setActiveTab(nextTab);
    },
    [activeTab]
  );

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      window.localStorage.setItem('cr41400_theme', 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem('cr41400_theme', 'light');
    }
  }, [darkMode]);

  const loadOverview = useCallback(
    async (force = false, silent = false) => {
      if (!silent) setLoading(true);
      try {
        const url = force ? '/api/ops/overview?refresh=1' : '/api/ops/overview';
        const resp = await fetch(url, { cache: 'no-store' });
        const data = (await resp.json()) as OverviewResponse;
        checkRevisionUpdate(data.appRevision, data.entryScript);
        if (data.dataSignature) {
          knownDataSigRef.current = data.dataSignature;
        }
        if (data.records && data.records.length > 0) {
          setOverview(data);
          setFetchError(data.error || null);
          setSelectedPeriod((prev) =>
            prev && data.periods.includes(prev) ? prev : data.periods[0] || ''
          );
          try {
            window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
          } catch {
            // Ignore storage quota errors
          }
        } else if (!silent) {
          setFetchError(data.error || 'Data operasional belum tersedia.');
        }
      } catch {
        if (!silent) {
          setFetchError('Tidak dapat menjangkau server. Menampilkan data tersimpan.');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [checkRevisionUpdate]
  );

  useEffect(() => {
    if (overview?.periods.length && !selectedPeriod) {
      setSelectedPeriod(overview.periods[0]);
    }
    void loadOverview(false, Boolean(overview));

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void loadOverview(false, true);
      }
    }, 15000);

    const handleResumeSync = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void loadOverview(false, true);
      }
    };

    const handleOnlineSync = () => {
      void loadOverview(true, true);
    };

    document.addEventListener('visibilitychange', handleResumeSync);
    window.addEventListener('focus', handleResumeSync);
    window.addEventListener('online', handleOnlineSync);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleResumeSync);
      window.removeEventListener('focus', handleResumeSync);
      window.removeEventListener('online', handleOnlineSync);
    };
  }, [loadOverview]);

  const periodPrefix = useMemo(() => {
    const sample = overview?.periods?.[0] || '';
    const part = sample.split('/')[0]?.trim();
    return part && /^[A-Z0-9]{1,8}$/i.test(part) ? part.toUpperCase() : 'CL';
  }, [overview?.periods]);

  const loadOcmRealtime = useCallback(
    async (silent = false, force = false) => {
      if (!silent) setOcmLoading(true);
      try {
        const qs = new URLSearchParams({
          year: String(ocmDate.year),
          month: String(ocmDate.month),
          day: String(ocmDate.day),
          prefix: periodPrefix,
        });
        if (force) qs.set('force', '1');
        const resp = await fetch(`/api/ops/ocm-realtime?${qs.toString()}`, {
          cache: 'no-store',
        });
        const data = (await resp.json()) as OcmRealtimeResponse;
        setOcmData(data);
      } catch {
        setOcmData((prev) =>
          prev
            ? {
                ...prev,
                success: false,
                status: 'unreachable',
                errorMessage:
                  'Tidak dapat menghubungi server untuk membaca file data OCM.',
              }
            : null
        );
      } finally {
        if (!silent) setOcmLoading(false);
      }
    },
    [ocmDate.day, ocmDate.month, ocmDate.year, periodPrefix]
  );

  useEffect(() => {
    void loadOcmRealtime(false);

    if (ocmPollSeconds <= 0) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void loadOcmRealtime(true);
      }
    }, ocmPollSeconds * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadOcmRealtime, ocmPollSeconds]);

  useEffect(() => {
    const source = new EventSource('/api/ops/stream');

    const handlePayload = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as LiveOpsState;
        checkRevisionUpdate(parsed.appRevision, parsed.entryScript);
        if (
          parsed.dataSignature &&
          knownDataSigRef.current &&
          parsed.dataSignature !== knownDataSigRef.current
        ) {
          knownDataSigRef.current = parsed.dataSignature;
          void loadOverview(false, true);
        }
        setLiveState(parsed);
        setSseConnected(true);
      } catch {
        // Ignore malformed frame
      }
    };

    const handleDataUpdated = (event: MessageEvent) => {
      try {
        const meta = JSON.parse(event.data) as {
          appRevision?: string;
          entryScript?: string | null;
          dataSignature?: string;
        };
        checkRevisionUpdate(meta.appRevision, meta.entryScript);
        if (meta.dataSignature) {
          knownDataSigRef.current = meta.dataSignature;
        }
      } catch {
        // Ignore
      }
      void loadOverview(false, true);
    };

    const handleOcmUpdated = () => {
      void loadOcmRealtime(true);
    };

    const handleHeartbeat = (event: MessageEvent) => {
      setSseConnected(true);
      try {
        const meta = JSON.parse(event.data) as {
          appRevision?: string;
          entryScript?: string | null;
          dataSignature?: string;
        };
        checkRevisionUpdate(meta.appRevision, meta.entryScript);
        if (
          meta.dataSignature &&
          knownDataSigRef.current &&
          meta.dataSignature !== knownDataSigRef.current
        ) {
          knownDataSigRef.current = meta.dataSignature;
          void loadOverview(false, true);
        }
      } catch {
        // Ignore
      }
    };

    source.addEventListener('snapshot', handlePayload);
    source.addEventListener('live_update', handlePayload);
    source.addEventListener('data_updated', handleDataUpdated);
    source.addEventListener('ocm_updated', handleOcmUpdated);
    source.addEventListener('heartbeat', handleHeartbeat);
    source.onopen = () => setSseConnected(true);
    source.onerror = () => setSseConnected(false);

    return () => {
      source.close();
    };
  }, [checkRevisionUpdate, loadOcmRealtime, loadOverview]);

  const navItems: {
    id: TabId;
    label: string;
    mobileLabel: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'overview', label: 'Ringkasan', mobileLabel: 'Ringkasan', icon: LayoutGrid },
    { id: 'collectors', label: 'Personil', mobileLabel: 'Personil', icon: Users },
    { id: 'live', label: 'Live Ops', mobileLabel: 'Live Ops', icon: Radio },
    { id: 'incentive', label: 'Insentif', mobileLabel: 'Insentif', icon: Wallet },
    { id: 'crcSim', label: 'Simulasi Insentif CRC', mobileLabel: 'Simulasi', icon: Calculator },
  ];

  // Merge OCM ZIP realtime ROLLING & IN% onto dashboard records matched by COLL_ID
  const { records, periods, ocmMatchedCount } = useMemo(() => {
    const baseRecords = overview?.records || [];
    const basePeriods = overview?.periods || [];

    if (!ocmData || !ocmData.success || ocmData.status !== 'ok') {
      return {
        records: baseRecords,
        periods: basePeriods,
        ocmMatchedCount: 0,
      };
    }

    const targetLabel = ocmData.date.periodLabel;
    const metricsMap = ocmData.metricsByCollId || {};
    let matched = 0;

    const hasTargetPeriod = baseRecords.some((r) => r.periode === targetLabel);
    let targetRows: PerformanceRecord[] = [];

    if (hasTargetPeriod) {
      targetRows = baseRecords.filter((r) => r.periode === targetLabel);
    } else if (baseRecords.length > 0) {
      const latestPeriod = basePeriods[0];
      const seen = new Set<string>();
      for (const rec of baseRecords) {
        if (latestPeriod && rec.periode !== latestPeriod) continue;
        const key = `${rec.collId.trim().toUpperCase()}|${rec.ca}`;
        if (seen.has(key)) continue;
        seen.add(key);
        targetRows.push({
          ...rec,
          periode: targetLabel,
          year: String(ocmData.date.year),
          month: ocmData.date.month,
        });
      }
    } else {
      targetRows = Object.values(metricsMap).map((m) => ({
        periode: targetLabel,
        year: String(ocmData.date.year),
        month: ocmData.date.month,
        ca: 'C0',
        collId: m.collId,
        collName: m.collName && m.collName !== '-' ? m.collName : m.collId,
        spvId: '-',
        spvName: '-',
        posId: '-',
        posName: 'REGION_3',
        bahan: m.pkkAwTotal,
        rolling: m.rolling,
        inPercent: m.inPercent,
      }));
    }

    const overlaidTargetRows = targetRows.map((rec) => {
      const key = rec.collId.trim().toUpperCase();
      const hit = metricsMap[key];
      if (!hit) return rec;
      matched += 1;
      return {
        ...rec,
        rolling: hit.rolling,
        bahan: hit.pkkAwTotal,
        inPercent: hit.inPercent,
      };
    });

    const mergedRecords = hasTargetPeriod
      ? baseRecords.map((rec) => {
          if (rec.periode !== targetLabel) return rec;
          const key = rec.collId.trim().toUpperCase();
          const hit = metricsMap[key];
          if (!hit) return rec;
          return {
            ...rec,
            rolling: hit.rolling,
            bahan: hit.pkkAwTotal,
            inPercent: hit.inPercent,
          };
        })
      : [...overlaidTargetRows, ...baseRecords];

    const mergedPeriods = basePeriods.includes(targetLabel)
      ? basePeriods
      : [targetLabel, ...basePeriods];

    return {
      records: mergedRecords,
      periods: mergedPeriods,
      ocmMatchedCount: matched,
    };
  }, [ocmData, overview?.periods, overview?.records]);

  const posList = overview?.posList || [];
  const cycles = overview?.cycles || [];

  const activePeriod =
    selectedPeriod && periods.includes(selectedPeriod)
      ? selectedPeriod
      : periods[0] || '';

  const currentMeta = TAB_META[activeTab];

  const handleEnterDashboard = useCallback((targetTab: DashboardTargetTab) => {
    setActiveTab(targetTab);
    setTabDirection(1);
    setAppMode('dashboard');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      {appMode === 'hero' ? (
        <TacticalHeroPortal
          overview={overview}
          onEnterDashboard={handleEnterDashboard}
        />
      ) : (
      <div className="relative min-h-screen flex flex-col bg-[#F7F6F3] dark:bg-[#090B0F] text-stone-900 dark:text-slate-100 pb-22 lg:pb-10 overflow-x-hidden transition-colors duration-300">
        <KineticBackdrop activeTab={activeTab} />

        {/* Compact Sticky Top Bar (52px, strict 3-zone contract) */}
        <header className="sticky top-0 z-30 h-[52px] bg-[#F7F6F3]/85 dark:bg-[#090B0F]/85 backdrop-blur-xl border-b border-stone-200/80 dark:border-slate-800/80">
          <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setAppMode('hero');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title="Kembali ke Portal Identitas CR 41400"
              className="font-display font-extrabold text-base sm:text-lg tracking-tight text-stone-900 dark:text-white whitespace-nowrap shrink-0"
            >
              CR 41400 <span className="text-amber-600 dark:text-amber-400">Ops</span>
            </a>

            <nav aria-label="Navigasi utama" className="hidden lg:flex items-center gap-4 xl:gap-6">
              <button
                type="button"
                onClick={() => {
                  setAppMode('hero');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="relative py-2 text-sm font-semibold whitespace-nowrap shrink-0 text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Identitas
              </button>
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchTab(item.id)}
                    className={`relative py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                    {isActive && (
                      <motion.span
                        layoutId="desktop-nav-underline"
                        transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                        className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-600 dark:bg-amber-400 rounded-full"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <PWAInstallButton />
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => loadOverview(true)}
                disabled={loading}
                className="hidden sm:inline-flex items-center gap-1.5 min-h-[36px] px-3.5 rounded-xl bg-stone-900 dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>Sinkronkan Data</span>
              </motion.button>
            </div>
          </div>
        </header>

        {/* Main Content Container */}
        <main id="top" className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
          {/* Scrollable Context Header with smooth title & subtitle morph */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`header-${activeTab}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                >
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white">
                    {currentMeta.title}
                  </h1>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                    {currentMeta.subtitle}
                  </p>
                </motion.div>
              </AnimatePresence>
              <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                {sseConnected && liveState.upstreamSocketConnected
                  ? 'Stream Real-Time Aktif'
                  : 'Sinkronisasi Berkala'}{' '}
                <span aria-hidden="true">·</span> Update {formatTimeID(overview?.fetchedAt)}
                {liveState.queueCounts.total > 0 && (
                  <>
                    {' '}
                    <span aria-hidden="true">·</span> Antrean Blast {liveState.queueCounts.success}/
                    {liveState.queueCounts.total}
                  </>
                )}
              </p>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label={darkMode ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
              className="luxury-surface inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl border border-stone-200/90 dark:border-slate-800/90 text-xs font-semibold text-stone-700 dark:text-slate-200 hover:border-amber-500/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={darkMode ? 'sun' : 'moon'}
                  initial={{ rotate: -25, opacity: 0, scale: 0.8 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 25, opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.16 }}
                  className="inline-flex items-center"
                >
                  {darkMode ? (
                    <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  ) : (
                    <Moon className="w-4 h-4 text-stone-600" aria-hidden="true" />
                  )}
                </motion.span>
              </AnimatePresence>
              <span>{darkMode ? 'Mode Siang' : 'Mode Malam'}</span>
            </motion.button>
          </div>

          {/* Directional Shared-Axis Feature Transition */}
          <AnimatePresence mode="wait" custom={tabDirection} initial={false}>
            <motion.div
              key={activeTab}
              custom={tabDirection}
              variants={featureVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {activeTab === 'overview' && (
                <OverviewTab
                  records={records}
                  periods={periods}
                  posList={posList}
                  cycles={cycles}
                  selectedPeriod={activePeriod}
                  onChangePeriod={setSelectedPeriod}
                  loading={loading}
                  stale={Boolean(overview?.stale)}
                  error={fetchError}
                  onRefresh={() => {
                    void loadOverview(true);
                    void loadOcmRealtime(false, true);
                  }}
                  onSelectCollector={(rec) => setSelectedCollector(rec)}
                  ocmDate={ocmDate}
                  onChangeOcmDate={(next) => {
                    setOcmDate(next);
                    const nextLabel = `${periodPrefix}/${String(next.month).padStart(2, '0')}/${next.year}`;
                    setSelectedPeriod(nextLabel);
                  }}
                  ocmPollSeconds={ocmPollSeconds}
                  onChangeOcmPollSeconds={setOcmPollSeconds}
                  ocmData={ocmData}
                  ocmLoading={ocmLoading}
                  ocmMatchedCount={ocmMatchedCount}
                  onRefreshOcm={() => void loadOcmRealtime(false, true)}
                  periodPrefix={periodPrefix}
                />
              )}

              {activeTab === 'collectors' && (
                <CollectorSearchTab
                  allRecords={records}
                  onSelectCollector={(rec) => setSelectedCollector(rec)}
                />
              )}

              {activeTab === 'live' && (
                <LiveOpsTab liveState={liveState} sseConnected={sseConnected} />
              )}

              {activeTab === 'incentive' && <IncentiveTab />}

              {activeTab === 'crcSim' && <CrcSimulationTab />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Thumb-Zone Bottom Tab Bar with spring shared-element indicator */}
        <nav
          aria-label="Navigasi seluler"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/92 dark:bg-[#0D1017]/94 backdrop-blur-xl border-t border-stone-200/80 dark:border-slate-800/80 pb-safe"
        >
          <div className="grid grid-cols-5 h-[60px] px-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => switchTab(item.id)}
                  className={`relative flex flex-col items-center justify-center min-h-[44px] my-1 rounded-xl transition-colors cursor-pointer ${
                    isActive
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="mobile-tab-indicator"
                      transition={{ type: 'spring', stiffness: 520, damping: 36 }}
                      className="absolute inset-0 rounded-xl bg-amber-500/12 dark:bg-amber-400/14"
                      aria-hidden="true"
                    />
                  )}
                  <motion.div
                    animate={isActive ? { y: -1, scale: 1.08 } : { y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                    className="relative z-10"
                  >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </motion.div>
                  <span className="relative z-10 text-[10px] sm:text-[11px] font-semibold tracking-tight mt-0.5 whitespace-nowrap">
                    {item.mobileLabel}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </nav>

        <CollectorDetailSheet
          record={selectedCollector}
          allRecords={records}
          onClose={() => setSelectedCollector(null)}
        />

        <OfflineIndicator />
      </div>
      )}
    </MotionConfig>
  );
}
