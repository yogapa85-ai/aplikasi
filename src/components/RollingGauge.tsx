import React from 'react';
import { motion } from 'motion/react';
import { formatPercentID, getPerformanceStatus } from '../utils/format';
import { AnimatedNumber, EASE_OUT_EXPO } from './MotionPrimitives';

interface RollingGaugeProps {
  value: number;
  cycle?: string;
  size?: number;
}

export const RollingGauge: React.FC<RollingGaugeProps> = ({ value, cycle, size = 152 }) => {
  const status = getPerformanceStatus(value, cycle);
  const limit = status.limit;
  const clamped = Math.min(25, Math.max(0, value));
  const ratio = clamped / 25;

  const strokeColor =
    status.tone === 'emerald'
      ? '#059669'
      : status.tone === 'amber'
      ? '#D97706'
      : '#E11D48';

  const textTone =
    status.tone === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-400'
      : status.tone === 'amber'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-rose-700 dark:text-rose-400';

  const cx = 80;
  const cy = 80;
  const r = 60;
  // 240-degree sweep arc from 150deg to 390deg
  const startAngle = 150;
  const sweepAngle = 240;

  const polar = (angleDeg: number, radius: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const describeArc = (start: number, end: number, radius: number) => {
    const s = polar(start, radius);
    const e = polar(end, radius);
    const largeArc = end - start <= 180 ? '0' : '1';
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x.toFixed(
      2
    )} ${e.y.toFixed(2)}`;
  };

  const trackPath = describeArc(startAngle, startAngle + sweepAngle, r);
  const activeEnd = startAngle + Math.max(4, sweepAngle * ratio);
  const activePath = describeArc(startAngle, activeEnd, r);
  const markerPos = polar(activeEnd, r);

  const ticks = [0, 5, limit, 15, 20, 25];

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 160 160" className="w-full h-full overflow-visible" aria-hidden="true">
        {/* Outer graduation ticks */}
        {ticks.map((t, idx) => {
          const ang = startAngle + (t / 25) * sweepAngle;
          const p1 = polar(ang, r + 9);
          const p2 = polar(ang, r + (t === limit ? 15 : 13));
          return (
            <line
              key={`${t}-${idx}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              className={
                t === limit
                  ? 'stroke-emerald-600 dark:stroke-emerald-400'
                  : 'stroke-stone-300 dark:stroke-slate-700'
              }
              strokeWidth={t === limit ? 2.25 : 1.25}
              strokeLinecap="round"
            />
          );
        })}

        {/* Track Arc */}
        <path
          d={trackPath}
          fill="none"
          className="stroke-stone-200 dark:stroke-slate-800"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Safe threshold zone marker at cycle limit (C0: 9%, C1: 11%) */}
        <path
          d={describeArc(startAngle, startAngle + (limit / 25) * sweepAngle, r)}
          fill="none"
          stroke="#10B981"
          strokeOpacity="0.22"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Animated Value Sweep */}
        <motion.path
          key={Math.round(value * 10)}
          d={activePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          initial={{ pathLength: 0.05, opacity: 0.6 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.75, ease: EASE_OUT_EXPO }}
        />

        {/* Glowing Needle Bead */}
        <motion.circle
          cx={markerPos.x}
          cy={markerPos.y}
          r="5.5"
          fill={strokeColor}
          className="stroke-white dark:stroke-slate-900"
          strokeWidth="2.5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 420, damping: 24 }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
          Rolling IN%
        </span>
        <span className={`text-2xl font-extrabold font-mono tabular-nums tracking-tight ${textTone}`}>
          <AnimatedNumber value={value} formatter={formatPercentID} />
        </span>
        <span className={`text-[11px] font-bold mt-0.5 ${textTone}`}>
          {status.label}
        </span>
      </div>
    </div>
  );
};
