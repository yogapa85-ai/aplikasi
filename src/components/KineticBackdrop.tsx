import React from 'react';
import { motion } from 'motion/react';

type FeatureTab = 'overview' | 'collectors' | 'live' | 'incentive' | 'crcSim';

interface KineticBackdropProps {
  activeTab: FeatureTab;
}

const TAB_AURA_STYLES: Record<FeatureTab, { primary: string; secondary: string; xShift: number }> = {
  overview: {
    primary: 'rgba(217, 119, 6, 0.14)',
    secondary: 'rgba(15, 23, 42, 0.06)',
    xShift: 0,
  },
  collectors: {
    primary: 'rgba(14, 165, 233, 0.13)',
    secondary: 'rgba(217, 119, 6, 0.07)',
    xShift: 60,
  },
  live: {
    primary: 'rgba(16, 185, 129, 0.14)',
    secondary: 'rgba(245, 158, 11, 0.07)',
    xShift: 120,
  },
  incentive: {
    primary: 'rgba(245, 158, 11, 0.16)',
    secondary: 'rgba(234, 88, 12, 0.07)',
    xShift: 180,
  },
  crcSim: {
    primary: 'rgba(217, 119, 6, 0.18)',
    secondary: 'rgba(16, 185, 129, 0.08)',
    xShift: 220,
  },
};

export const KineticBackdrop: React.FC<KineticBackdropProps> = ({ activeTab }) => {
  const aura = TAB_AURA_STYLES[activeTab];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden z-0"
    >
      {/* Subtle Architectural Hairline Grid */}
      <div
        className="absolute inset-0 opacity-[0.38] dark:opacity-[0.16]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(120, 113, 108, 0.22) 1px, transparent 0)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
        }}
      />

      {/* Primary Drifting Aura */}
      <motion.div
        animate={{
          x: aura.xShift,
          scale: [1, 1.06, 1],
        }}
        transition={{
          x: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
          scale: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute -top-36 left-1/2 -translate-x-1/2 w-[680px] h-[340px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${aura.primary} 0%, transparent 70%)`,
        }}
      />

      {/* Secondary Ambient Accent */}
      <motion.div
        animate={{
          x: -aura.xShift * 0.6,
          y: [0, 14, 0],
        }}
        transition={{
          x: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
          y: { duration: 11, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute top-24 right-0 w-[420px] h-[300px] rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${aura.secondary} 0%, transparent 70%)`,
        }}
      />
    </div>
  );
};
