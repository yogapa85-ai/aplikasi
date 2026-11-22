import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, LogOut, Search } from 'lucide-react';
import { IncentiveRecord } from '../types/ops';
import { formatFullIDR, parsePeriodSortKey } from '../utils/format';
import { CollectorAvatar } from './CollectorAvatar';
import { TrendChart } from './TrendChart';
import { SpotlightCard } from './SpotlightCard';
import { AnimatedNumber, EASE_OUT_EXPO } from './MotionPrimitives';

export const IncentiveTab: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeNpk, setActiveNpk] = useState<string | null>(null);
  const [rawRecords, setRawRecords] = useState<IncentiveRecord[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNpk = username.trim();
    if (!cleanNpk || !password) {
      setAuthError('Harap masukkan User/NPK dan Password.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      const loginResp = await fetch('/api/ops/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanNpk, password }),
      });
      const loginData = (await loginResp.json()) as { success?: boolean; message?: string };
      if (!loginResp.ok || !loginData.success) {
        setAuthError(loginData.message || 'User atau password tidak sesuai.');
        setAuthLoading(false);
        return;
      }

      const incResp = await fetch(`/api/ops/incentive/${encodeURIComponent(cleanNpk)}`);
      const incData = (await incResp.json()) as {
        success: boolean;
        message?: string;
        records?: IncentiveRecord[];
      };

      if (!incData.success || !incData.records) {
        setAuthError(incData.message || 'Data insentif tidak ditemukan.');
        setAuthLoading(false);
        return;
      }

      const isBranchAdmin = cleanNpk === '67837';
      const scoped = isBranchAdmin
        ? incData.records
        : incData.records.filter((r) => String(r.npk).trim() === cleanNpk);

      if (scoped.length === 0) {
        setAuthError(`Data insentif untuk NPK ${cleanNpk} belum tersedia.`);
        setAuthLoading(false);
        return;
      }

      setActiveNpk(cleanNpk);
      setRawRecords(scoped);
      setPassword('');
    } catch {
      setAuthError('Gagal terhubung ke server autentikasi.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setActiveNpk(null);
    setRawRecords([]);
    setAdminSearch('');
    setSelectedPeriod('');
    setSelectedYear('');
    setAuthError(null);
  };

  const isAdmin = activeNpk === '67837';

  const filteredRecords = useMemo(() => {
    if (!isAdmin || !adminSearch.trim()) return rawRecords;
    const kw = adminSearch.trim().toLowerCase();
    return rawRecords.filter(
      (r) => r.nama.toLowerCase().includes(kw) || r.npk.toLowerCase().includes(kw)
    );
  }, [rawRecords, isAdmin, adminSearch]);

  const periods = useMemo(() => {
    return Array.from(new Set(filteredRecords.map((r) => r.periode).filter(Boolean))).sort(
      (a, b) => parsePeriodSortKey(b) - parsePeriodSortKey(a)
    );
  }, [filteredRecords]);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const p of periods) {
      const parts = p.split('/');
      if (parts.length > 2) set.add(parts[2]);
    }
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [periods]);

  const activePeriod = periods.includes(selectedPeriod) ? selectedPeriod : periods[0] || '';
  const activeYear = years.includes(selectedYear) ? selectedYear : years[0] || '';

  const currentRecord = useMemo(() => {
    return filteredRecords.find((r) => r.periode === activePeriod) || filteredRecords[0] || null;
  }, [filteredRecords, activePeriod]);

  const yearRecords = useMemo(() => {
    return filteredRecords
      .filter((r) => (activeYear ? r.periode.includes(activeYear) : true))
      .sort((a, b) => parsePeriodSortKey(a.periode) - parsePeriodSortKey(b.periode));
  }, [filteredRecords, activeYear]);

  const yearTotal = useMemo(
    () => yearRecords.reduce((sum, r) => sum + r.finalIncColl, 0),
    [yearRecords]
  );
  const yearAvg = yearRecords.length > 0 ? yearTotal / yearRecords.length : 0;

  return (
    <AnimatePresence mode="wait">
      {!activeNpk ? (
        <motion.div
          key="incentive-login"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
          className="max-w-md mx-auto"
        >
          <SpotlightCard className="p-6">
            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-white">
                  Portal Insentif Personil
                </h2>
                <p className="text-xs text-stone-500 dark:text-slate-400">
                  Masuk menggunakan NPK &amp; password akun CR 41400
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="inc-user"
                  className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1"
                >
                  NPK / User ID
                </label>
                <input
                  id="inc-user"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan NPK Anda..."
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label
                  htmlFor="inc-pass"
                  className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1"
                >
                  Password
                </label>
                <input
                  id="inc-pass"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {authError && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {authError}
                </p>
              )}

              <motion.button
                type="submit"
                whileTap={{ scale: 0.98 }}
                disabled={authLoading}
                className="w-full min-h-[48px] rounded-xl bg-stone-900 dark:bg-amber-500 text-white dark:text-slate-950 text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
              >
                {authLoading ? 'Memverifikasi...' : 'Masuk & Lihat Insentif'}
              </motion.button>
            </form>
          </SpotlightCard>
        </motion.div>
      ) : (
        <motion.div
          key="incentive-dashboard"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
          className="space-y-5"
        >
          <SpotlightCard className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <CollectorAvatar name={currentRecord?.nama || 'CR 41400'} size="lg" />
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-stone-900 dark:text-white truncate">
                    {isAdmin && !adminSearch.trim()
                      ? 'Akses Cabang Keseluruhan'
                      : currentRecord?.nama || 'Personil'}
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                    NPK {currentRecord?.npk || activeNpk} <span aria-hidden="true">·</span> Handling Cycle{' '}
                    {currentRecord?.handlingCycle || '-'}
                  </p>
                </div>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={handleLogout}
                className="min-h-[44px] px-4 rounded-xl border border-stone-200 dark:border-slate-700 text-xs font-semibold text-stone-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-800 inline-flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Keluar</span>
              </motion.button>
            </div>
          </SpotlightCard>

          {isAdmin && (
            <div className="luxury-surface border border-stone-200/90 dark:border-slate-800/90 rounded-2xl p-4">
              <label
                htmlFor="admin-coll-search"
                className="block text-xs font-medium text-stone-500 dark:text-slate-400 mb-1.5"
              >
                Cari Nama Kolektor (Akses Cabang)
              </label>
              <div className="relative">
                <Search
                  className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="admin-coll-search"
                  type="search"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder="Ketik nama atau NPK kolektor..."
                  className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SpotlightCard className="p-5 flex flex-col justify-between space-y-4">
              <div>
                <label
                  htmlFor="inc-period"
                  className="block text-xs font-medium text-stone-500 dark:text-slate-400 mb-1.5"
                >
                  Pilih Periode Insentif
                </label>
                <select
                  id="inc-period"
                  value={activePeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
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
                <p className="text-xs text-stone-500 dark:text-slate-400">Final Insentif Kolektor</p>
                <p className="text-2xl font-extrabold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-1">
                  <AnimatedNumber value={currentRecord?.finalIncColl || 0} formatter={formatFullIDR} />
                </p>
              </div>
            </SpotlightCard>

            <SpotlightCard className="md:col-span-2 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                    Ringkasan Tahunan ({activeYear || '-'})
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                    Total:{' '}
                    <strong className="font-mono text-stone-900 dark:text-white">
                      <AnimatedNumber value={yearTotal} formatter={formatFullIDR} />
                    </strong>{' '}
                    <span aria-hidden="true">·</span> Rata-rata:{' '}
                    <strong className="font-mono text-stone-900 dark:text-white">
                      <AnimatedNumber value={yearAvg} formatter={formatFullIDR} />
                    </strong>
                  </p>
                </div>
                <select
                  aria-label="Filter tahun insentif"
                  value={activeYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="min-h-[40px] px-3 rounded-xl bg-stone-50 dark:bg-slate-800/90 border border-stone-200 dark:border-slate-700 text-xs font-semibold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <TrendChart
                points={yearRecords.map((r) => ({
                  label: r.periode,
                  value: r.finalIncColl,
                  subLabel: r.handlingCycle,
                }))}
                valueFormatter={(v) => formatFullIDR(v)}
                unitLabel="Insentif"
              />
            </SpotlightCard>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
