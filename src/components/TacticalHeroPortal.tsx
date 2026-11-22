import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import {
  ArrowUpRight,
  ArrowDown,
  Shield,
  Target,
  Activity,
  Calculator,
  Users,
  MapPin,
  Menu,
  X,
} from 'lucide-react';
import rhinoMascotImg from '../assets/images/rhino_commander_mascot_1795335720940.jpg';
import { OverviewResponse } from '../types/ops';
import { formatCompactIDR, formatPercentID } from '../utils/format';
import { EASE_OUT_EXPO } from './MotionPrimitives';

export type DashboardTargetTab = 'overview' | 'collectors' | 'live' | 'incentive' | 'crcSim';

interface TacticalHeroPortalProps {
  overview: OverviewResponse | null;
  onEnterDashboard: (targetTab: DashboardTargetTab) => void;
}

const TICKER_ITEMS = [
  'STRATEGY FIRST',
  'COLLECTION EXCELLENCE',
  'ONE TEAM ONE PURPOSE',
  'KARESIDENAN PATI',
  'MOVE FORWARD',
  'TEAM 41400',
  'STRATEGY FIRST',
  'COLLECTION EXCELLENCE',
];

const NAV_LINKS = [
  { label: 'IDENTITAS', href: '#identitas' },
  { label: 'KEUNGGULAN', href: '#keunggulan' },
  { label: 'MISI', href: '#misi' },
  { label: 'TEAM 41400', href: '#team-41400' },
];

export const TacticalHeroPortal: React.FC<TacticalHeroPortalProps> = ({
  overview,
  onEnterDashboard,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // Subtle interactive parallax for the Rhino Commander showcase
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 120, damping: 24 });
  const smoothY = useSpring(mouseY, { stiffness: 120, damping: 24 });
  const imgX = useTransform(smoothX, [-0.5, 0.5], [-8, 8]);
  const imgY = useTransform(smoothY, [-0.5, 0.5], [-6, 6]);
  const crestX = useTransform(smoothX, [-0.5, 0.5], [10, -10]);

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleStageMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const scrollToSection = (href: string) => {
    setMobileMenuOpen(false);
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Derive live summary figures for below-the-fold sections (zero fabricated numbers)
  const activePeriod = overview?.periods?.[0] || '';
  const periodRecords = activePeriod
    ? (overview?.records || []).filter((r) => r.periode === activePeriod)
    : [];
  const totalBahan = periodRecords.reduce((s, r) => s + r.bahan, 0);
  const totalRolling = periodRecords.reduce((s, r) => s + r.rolling, 0);
  const weightedRollingPct = totalBahan > 0 ? (totalRolling / totalBahan) * 100 : 0;

  const posSummary = Array.from(
    periodRecords.reduce((acc, rec) => {
      const key = rec.posName || 'POS Lainnya';
      const cur = acc.get(key) || { posName: key, collectors: 0, bahan: 0, rolling: 0 };
      cur.collectors += 1;
      cur.bahan += rec.bahan;
      cur.rolling += rec.rolling;
      acc.set(key, cur);
      return acc;
    }, new Map<string, { posName: string; collectors: number; bahan: number; rolling: number }>())
  )
    .map(([, v]) => ({
      ...v,
      inPct: v.bahan > 0 ? (v.rolling / v.bahan) * 100 : 0,
    }))
    .sort((a, b) => a.inPct - b.inPct);

  return (
    <div className="min-h-screen bg-[#0E0A06] text-[#F5F0EB] selection:bg-[#FF6A00]/30 selection:text-amber-200 overflow-x-hidden">
      {/* Global Atmospheric Chiaroscuro Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div
          className="absolute -top-40 right-[-10%] w-[780px] h-[780px] rounded-full opacity-25 blur-[140px]"
          style={{
            background:
              'radial-gradient(circle, rgba(255,106,0,0.55) 0%, rgba(245,158,11,0.2) 45%, transparent 72%)',
          }}
        />
        <div
          className="absolute top-[25%] -left-48 w-[560px] h-[560px] rounded-full opacity-15 blur-[130px]"
          style={{
            background:
              'radial-gradient(circle, rgba(245,158,11,0.4) 0%, rgba(120,53,15,0.2) 50%, transparent 75%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,179,71,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,179,71,0.35) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 h-[68px] bg-[#0E0A06]/88 backdrop-blur-xl border-b border-amber-500/15">
        <div className="max-w-[1400px] mx-auto h-full px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-4 lg:gap-8">
          {/* Left: Orange-framed tactical emblem + stacked Karesidenan Pati / CR 41400 */}
          <a
            href="#hero-top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 shrink-0 group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF6A00] rounded-lg"
          >
            <div className="w-10 h-10 rounded-xl border border-[#FF6A00]/70 bg-[#1B1209] flex items-center justify-center shadow-[0_0_20px_rgba(255,106,0,0.22)] group-hover:border-[#F59E0B] transition-colors">
              <Shield className="w-5 h-5 text-[#FF6A00]" aria-hidden="true" />
            </div>
            <div className="leading-tight whitespace-nowrap">
              <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#F59E0B]">
                KARESIDENAN PATI
              </div>
              <div className="text-sm sm:text-base font-extrabold tracking-wide text-white font-display">
                CR 41400
              </div>
            </div>
          </a>

          {/* Center: Single-line Nav Links */}
          <nav
            aria-label="Navigasi Portal Identitas"
            className="hidden lg:flex items-center gap-7 xl:gap-9"
          >
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => scrollToSection(link.href)}
                className="relative py-2 text-xs font-bold tracking-[0.16em] text-[#C8BEB3] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF6A00] rounded"
              >
                <span>{link.label}</span>
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 bottom-0 h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left bg-gradient-to-r from-[#FF6A00] to-[#F59E0B]"
                />
              </button>
            ))}
          </nav>

          {/* Right: Masuk Wilayah & Performance CTAs */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onEnterDashboard('collectors')}
              className="hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-[#1A130C] hover:bg-[#241A10] border border-amber-500/30 hover:border-[#FF6A00]/70 text-[11px] font-bold tracking-[0.12em] text-[#F5EFE8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>MASUK WILAYAH</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#F59E0B]" aria-hidden="true" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onEnterDashboard('overview')}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 sm:px-5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#F59E0B] hover:brightness-110 text-[#0E0A06] text-[11px] font-extrabold tracking-[0.12em] shadow-[0_0_24px_rgba(255,106,0,0.38)] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>PERFORMANCE</span>
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
            </motion.button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu navigasi'}
              className="lg:hidden min-h-[40px] min-w-[40px] rounded-xl bg-[#1A130C] border border-amber-500/25 flex items-center justify-center text-amber-300 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#130D08]/98 backdrop-blur-xl border-b border-amber-500/20 px-4 py-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => scrollToSection(link.href)}
                  className="min-h-[44px] px-3 rounded-xl bg-[#1B130C] border border-amber-500/20 text-xs font-bold tracking-[0.12em] text-[#EDE5DC] text-left cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onEnterDashboard('collectors')}
              className="w-full min-h-[44px] px-4 rounded-xl bg-[#1B130C] border border-amber-500/35 text-xs font-bold tracking-[0.12em] text-amber-300 flex items-center justify-between cursor-pointer"
            >
              <span>MASUK WILAYAH</span>
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </header>

      {/* Hero Section (Widescreen 16:9 2-Column Split + Bottom Ticker) */}
      <section
        id="hero-top"
        aria-label="Hero CR 41400 Karesidenan Pati"
        className="relative z-10 flex flex-col justify-between min-h-[calc(100vh-68px)]"
      >
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10 lg:py-12 flex-1 flex items-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center w-full">
            {/* LEFT COLUMN: Typography & CTA */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.48, ease: EASE_OUT_EXPO }}
              className="lg:col-span-5 space-y-6 lg:pr-4 z-10"
            >
              {/* Accent Line + Wide-Tracked Uppercase Subtitle */}
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="w-9 h-[2px] bg-gradient-to-r from-[#FF6A00] to-[#F59E0B] shrink-0"
                />
                <p className="text-[11px] sm:text-xs font-semibold tracking-[0.26em] uppercase text-[#F59E0B]">
                  KARESIDENAN PATI · COLLECTION DIVISION
                </p>
              </div>

              {/* Super Massive Bold Display Headline */}
              <h1 className="font-display font-extrabold tracking-tight leading-[0.86] select-none">
                <span className="block text-[clamp(4.25rem,8.5vw,7.25rem)] text-[#FAF6F1]">
                  CR
                </span>
                <span
                  className="block text-[clamp(4.25rem,8.5vw,7.25rem)] bg-gradient-to-r from-[#FFD07B] via-[#FF7A18] to-[#FF5500] bg-clip-text text-transparent"
                  style={{
                    filter: 'drop-shadow(0 6px 28px rgba(255, 106, 0, 0.36))',
                  }}
                >
                  41400
                </span>
              </h1>

              {/* Description Paragraph */}
              <p className="max-w-[46ch] text-sm sm:text-base leading-relaxed text-[#CFC8BF] font-normal">
                Disiplin dalam langkah. Tangguh dalam tantangan. Satu tim yang bergerak dengan strategi, fokus, dan semangat untuk hasil terbaik.
              </p>

              {/* Dual Side-by-Side CTAs */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => scrollToSection('#identitas')}
                  className="min-h-[46px] px-6 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#F59E0B] hover:brightness-110 text-[#0E0A06] text-xs font-extrabold tracking-[0.14em] inline-flex items-center gap-2 shadow-[0_10px_30px_-6px_rgba(255,106,0,0.5)] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>JELAJAHI IDENTITAS</span>
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => scrollToSection('#misi')}
                  className="min-h-[46px] px-6 rounded-xl bg-[#16100A]/90 hover:bg-[#21180F] border border-[#F59E0B]/30 hover:border-[#FF6A00]/65 text-[#EFE9E2] text-xs font-bold tracking-[0.14em] inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>LIHAT MISI TIM</span>
                  <ArrowDown className="w-4 h-4 text-[#F59E0B]" aria-hidden="true" />
                </motion.button>
              </div>
            </motion.div>

            {/* RIGHT COLUMN: Rhino Commander 3D/Cinematic Stage + Glowing Overlays */}
            <motion.div
              ref={stageRef}
              onMouseMove={handleStageMouseMove}
              onMouseLeave={handleStageMouseLeave}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
              className="lg:col-span-7 relative flex flex-col items-center"
            >
              {/* Atmospheric Amber Halo Behind Rhino */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-[12%] top-[10%] bottom-[8%] rounded-full blur-[90px] opacity-55"
                style={{
                  background:
                    'radial-gradient(circle at 52% 42%, rgba(255,106,0,0.48), rgba(245,158,11,0.16) 55%, transparent 78%)',
                }}
              />

              <div className="relative w-full max-w-[820px] rounded-3xl overflow-hidden border border-amber-500/20 bg-[#120D08] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95)]">
                {/* Top Crown Typography Layer Behind/Above Rhino's Head */}
                <motion.div
                  style={{ x: crestX }}
                  className="relative z-10 pt-5 sm:pt-7 px-4 text-center select-none pointer-events-none"
                >
                  <div className="text-xs sm:text-sm font-semibold tracking-[0.28em] uppercase text-[#F5C57B]">
                    Karesidenan Pati
                  </div>
                  <div
                    className="mt-0.5 font-display font-black tracking-[0.06em] leading-none text-[clamp(2.6rem,6vw,5.25rem)] bg-gradient-to-b from-[#FFE1A8] via-[#FF8C1A] to-[#B83B00] bg-clip-text text-transparent"
                    style={{
                      filter: 'drop-shadow(0 0 28px rgba(255, 106, 0, 0.55))',
                    }}
                  >
                    CR 41400
                  </div>
                </motion.div>

                {/* Rhino Mascot Artwork (Overlapping cleanly under the glowing CR 41400 crest) */}
                <div className="relative -mt-6 sm:-mt-10 aspect-[4/3] w-full overflow-hidden">
                  {!imgFailed ? (
                    <motion.img
                      src={rhinoMascotImg}
                      alt="Maskot Badak Komandan Strategis CR 41400 Karesidenan Pati mengenakan zirah gelap dan syal motif tradisional"
                      referrerPolicy="no-referrer"
                      onError={() => setImgFailed(true)}
                      style={{
                        x: imgX,
                        y: imgY,
                        maskImage:
                          'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.95) 14%, black 82%, rgba(0,0,0,0.88) 100%)',
                        WebkitMaskImage:
                          'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.95) 14%, black 82%, rgba(0,0,0,0.88) 100%)',
                      }}
                      className="w-full h-full object-cover object-top scale-[1.03]"
                    />
                  ) : (
                    /* Styled Fallback Container per Zero-Broken-Image Policy */
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#1D140C] to-[#0E0A06] p-8 text-center">
                      <Shield className="w-16 h-16 text-[#FF6A00] mb-3" aria-hidden="true" />
                      <p className="text-lg font-extrabold tracking-wide text-white">
                        CR 41400 RHINO COMMANDER
                      </p>
                      <p className="text-xs text-amber-400/80 mt-1">
                        Karesidenan Pati · Collection Division
                      </p>
                    </div>
                  )}

                  {/* Measured Edge & Bottom Scrim for High-Contrast Typography */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0E0A06] via-[#0E0A06]/25 to-transparent"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0E0A06]/50 via-transparent to-[#0E0A06]/45"
                  />

                  {/* Bottom-Right Overlay: TEAM 41400 / STRONGER TOGETHER MOVE FORWARD */}
                  <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 text-right select-none">
                    <div className="text-base sm:text-xl font-extrabold tracking-[0.14em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                      TEAM 41400
                    </div>
                    <div className="mt-1 font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.22em] text-[#F59E0B] whitespace-pre">
                      STRONGER TOGETHER   MOVE FORWARD
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom Horizontal Ticker Bar */}
        <div
          aria-label="Slogan Strategis CR 41400"
          className="relative w-full border-y border-amber-500/20 bg-[#150E08]/95 py-3 overflow-hidden"
        >
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
            className="flex items-center w-max will-change-transform"
          >
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center shrink-0">
                {TICKER_ITEMS.map((item, idx) => (
                  <React.Fragment key={`${dup}-${idx}`}>
                    <span className="px-5 text-[11px] sm:text-xs font-bold tracking-[0.22em] text-[#E6DDD3] whitespace-nowrap">
                      {item}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-[#FF6A00] text-xs select-none"
                    >
                      ◆
                    </span>
                  </React.Fragment>
                ))}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Section 1: IDENTITAS */}
      <section
        id="identitas"
        className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-20 border-b border-white/8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-3">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#FF6A00]">
              01. Identitas Divisi
            </p>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white [text-wrap:balance]">
              Karakter Badak Komandan Karesidenan Pati
            </h2>
            <p className="text-sm text-[#B8AEA3] leading-relaxed">
              Terinspirasi dari ketangguhan badak bercula dalam menjaga teritori: berkulit tebal menghadapi tekanan lapangan, bergerak terukur berbasis data, serta menjunjung nilai kebersamaan Jawa di wilayah Karesidenan Pati.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#16100A] border border-amber-500/18">
              <p className="text-xs text-[#A59A8E]">Periode Terpantau</p>
              <p className="mt-2 text-2xl font-extrabold font-mono tabular-nums text-white">
                {activePeriod || 'Siap Sinkron'}
              </p>
              <p className="mt-1.5 text-xs text-[#F59E0B]">
                {periodRecords.length > 0
                  ? `${periodRecords.length} Personil aktif tercatat`
                  : 'Terhubung langsung dengan server operasional'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#16100A] border border-amber-500/18">
              <p className="text-xs text-[#A59A8E]">Total Beban Aktif</p>
              <p className="mt-2 text-2xl font-extrabold font-mono tabular-nums text-white">
                {totalBahan > 0 ? formatCompactIDR(totalBahan) : 'Real-Time'}
              </p>
              <p className="mt-1.5 text-xs text-[#C8BEB3]">
                {totalRolling > 0
                  ? `Rolling ${formatCompactIDR(totalRolling)}`
                  : 'Pembaruan otomatis lintas POS'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#16100A] border border-amber-500/18">
              <p className="text-xs text-[#A59A8E]">Rasio Rolling Cabang</p>
              <p className="mt-2 text-2xl font-extrabold font-mono tabular-nums text-[#FF6A00]">
                {totalBahan > 0 ? formatPercentID(weightedRollingPct) : 'C0 ≤ 9%'}
              </p>
              <p className="mt-1.5 text-xs text-[#C8BEB3]">
                Disiplin batas C0 ≤ 9% dan C1 ≤ 11%
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: KEUNGGULAN (Bento Grid wired directly to Live Dashboard Tabs) */}
      <section
        id="keunggulan"
        className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-20 border-b border-white/8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#FF6A00]">
              02. Keunggulan Sistem Komando
            </p>
            <h2 className="mt-1.5 font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Kendali Lapangan Berbasis Data Nyata
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onEnterDashboard('overview')}
            className="min-h-[42px] px-4 rounded-xl bg-[#1A130C] border border-amber-500/30 hover:border-[#FF6A00] text-xs font-bold tracking-[0.1em] text-[#F59E0B] inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <span>BUKA DASHBOARD LENGKAP</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onEnterDashboard('overview')}
            className="md:col-span-2 text-left p-6 rounded-2xl bg-[#16100A] hover:bg-[#1C140C] border border-amber-500/20 hover:border-[#FF6A00]/60 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-3">
              <Target className="w-5 h-5 text-[#FF6A00]" aria-hidden="true" />
              <ArrowUpRight
                className="w-4 h-4 text-[#A59A8E] group-hover:text-[#FF6A00] transition-colors"
                aria-hidden="true"
              />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">
              Monitoring Rasio Rolling IN% (C0 ≤ 9% · C1 ≤ 11%)
            </h3>
            <p className="mt-2 text-sm text-[#B8AEA3] leading-relaxed">
              Pemantauan langsung performa tiap kolektor, SPV, dan wilayah POS sehingga indikasi lonjakan rolling dapat segera dikendalikan sebelum membengkak.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onEnterDashboard('crcSim')}
            className="text-left p-6 rounded-2xl bg-[#16100A] hover:bg-[#1C140C] border border-amber-500/20 hover:border-[#FF6A00]/60 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-3">
              <Calculator className="w-5 h-5 text-[#F59E0B]" aria-hidden="true" />
              <ArrowUpRight
                className="w-4 h-4 text-[#A59A8E] group-hover:text-[#F59E0B] transition-colors"
                aria-hidden="true"
              />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">
              Simulasi Insentif CRC (C0 / C1 / C0C1)
            </h3>
            <p className="mt-2 text-sm text-[#B8AEA3] leading-relaxed">
              Kalkulasi otomatis kelas beban dari IN Amount, pembobotan Reguler/Finatra, pengali level fase PS 1 hingga Closing, dan Indeks RB 1.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onEnterDashboard('live')}
            className="text-left p-6 rounded-2xl bg-[#16100A] hover:bg-[#1C140C] border border-amber-500/20 hover:border-[#FF6A00]/60 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-3">
              <Activity className="w-5 h-5 text-[#FF6A00]" aria-hidden="true" />
              <ArrowUpRight
                className="w-4 h-4 text-[#A59A8E] group-hover:text-[#FF6A00] transition-colors"
                aria-hidden="true"
              />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">
              Live Stream &amp; Antrean Operasional
            </h3>
            <p className="mt-2 text-sm text-[#B8AEA3] leading-relaxed">
              Pantau koneksi gateway, antrean blast, dan pembaruan batch data Command Center secara seketika.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onEnterDashboard('collectors')}
            className="md:col-span-2 text-left p-6 rounded-2xl bg-[#16100A] hover:bg-[#1C140C] border border-amber-500/20 hover:border-[#FF6A00]/60 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between gap-3">
              <Users className="w-5 h-5 text-[#F59E0B]" aria-hidden="true" />
              <ArrowUpRight
                className="w-4 h-4 text-[#A59A8E] group-hover:text-[#F59E0B] transition-colors"
                aria-hidden="true"
              />
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">
              Profil Personil &amp; Tren Historis Lintas Periode
            </h3>
            <p className="mt-2 text-sm text-[#B8AEA3] leading-relaxed">
              Telusuri rekam jejak setiap anggota tim lapangan lengkap dengan grafik tren bulanan dan evaluasi posisi terhadap target cycle.
            </p>
          </button>
        </div>
      </section>

      {/* Section 3: MISI */}
      <section
        id="misi"
        className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-20 border-b border-white/8"
      >
        <div className="max-w-2xl mb-8">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#FF6A00]">
            03. Misi Tim 41400
          </p>
          <h2 className="mt-1.5 font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            Tiga Pilar Eksekusi Lapangan
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              no: '01.',
              title: 'Disiplin Awal Periode (PS 1 & PS 2)',
              desc: 'Menjaga ritme penagihan sejak fase pertama agar beban tidak menumpuk di akhir bulan dan capaian selalu melampaui batas aman 85%.',
            },
            {
              no: '02.',
              title: 'Pengendalian Ketat Rolling C0 & C1',
              desc: 'Mengunci rasio Rolling IN% tetap di bawah batas 9% (C0) dan 11% (C1) melalui pemantauan harian per POS dan intervensi dini.',
            },
            {
              no: '03.',
              title: 'Solidaritas Satu Komando Team 41400',
              desc: 'Sinkronisasi antara CRC, SPV, dan seluruh tim kolektor Karesidenan Pati untuk menjaga kualitas portofolio Reguler maupun Finatra.',
            },
          ].map((pillar) => (
            <div
              key={pillar.no}
              className="p-6 rounded-2xl bg-[#16100A] border border-white/10 space-y-3"
            >
              <span className="font-mono text-sm font-bold text-[#FF6A00]">{pillar.no}</span>
              <h3 className="text-lg font-bold text-white">{pillar.title}</h3>
              <p className="text-sm text-[#B8AEA3] leading-relaxed">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: TEAM 41400 & Sebaran Wilayah POS */}
      <section
        id="team-41400"
        className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-20"
      >
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#FF6A00]">
              04. Team 41400 · Karesidenan Pati
            </p>
            <h2 className="mt-1.5 font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
              Sebaran Wilayah &amp; Akses Cepat
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onEnterDashboard('overview')}
            className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#F59E0B] hover:brightness-110 text-[#0E0A06] text-xs font-extrabold tracking-[0.12em] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>MASUK COMMAND CENTER</span>
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          </button>
        </div>

        {posSummary.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {posSummary.map((pos) => (
              <button
                key={pos.posName}
                type="button"
                onClick={() => onEnterDashboard('collectors')}
                className="text-left p-5 rounded-2xl bg-[#16100A] hover:bg-[#1D150D] border border-amber-500/20 hover:border-[#FF6A00]/65 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white">
                    <MapPin className="w-4 h-4 text-[#FF6A00]" aria-hidden="true" />
                    {pos.posName}
                  </span>
                  <span className="font-mono text-xs font-bold tabular-nums text-[#F59E0B]">
                    {formatPercentID(pos.inPct)}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-white/8 flex items-center justify-between text-xs text-[#A59A8E] font-mono tabular-nums">
                  <span>{pos.collectors} Personil</span>
                  <span>{formatCompactIDR(pos.bahan)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-[#16100A] border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[#B8AEA3]">
              Wilayah operasional Karesidenan Pati siap dipantau secara real-time melalui Command Center CR 41400.
            </p>
            <button
              type="button"
              onClick={() => onEnterDashboard('collectors')}
              className="min-h-[42px] px-4 rounded-xl bg-[#241A10] border border-amber-500/40 text-xs font-bold text-amber-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>LIHAT PERSONIL</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Quiet Footer */}
        <footer className="mt-16 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#8E847A]">
          <span className="font-semibold text-[#D6CEC5]">
            CR 41400 · Karesidenan Pati Collection Division
          </span>
          <span>Stronger Together · Move Forward</span>
        </footer>
      </section>
    </div>
  );
};
