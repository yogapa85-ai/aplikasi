import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { EASE_OUT_EXPO } from './MotionPrimitives';

export interface TrendPoint {
  label: string;
  value: number;
  subLabel?: string;
}

interface TrendChartProps {
  points: TrendPoint[];
  valueFormatter?: (v: number) => string;
  unitLabel?: string;
  benchmarkValue?: number;
  benchmarkLabel?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  points,
  valueFormatter = (v) => `${v.toFixed(2).replace('.', ',')}%`,
  unitLabel = 'Nilai',
  benchmarkValue,
  benchmarkLabel = 'Batas Aman',
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(points.length > 0 ? points.length - 1 : 0);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center rounded-xl border border-dashed border-stone-200 dark:border-slate-800 text-xs text-stone-500 dark:text-slate-400">
        Belum ada data tren periode untuk ditampilkan.
      </div>
    );
  }

  const width = 560;
  const height = 204;
  const padLeft = 48;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const vals = points.map((p) => p.value);
  if (benchmarkValue !== undefined) vals.push(benchmarkValue);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const minVal = Math.max(0, rawMin * 0.8);
  const maxVal = rawMax === minVal ? minVal + 10 : rawMax * 1.12;
  const range = maxVal - minVal || 1;

  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? padLeft + chartW / 2
        : padLeft + (idx / (points.length - 1)) * chartW;
    const y = padTop + chartH - ((p.value - minVal) / range) * chartH;
    return { x, y, ...p };
  });

  const handleScrub = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || coords.length <= 1) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let nearestIdx = 0;
    let minDist = Infinity;
    coords.forEach((c, idx) => {
      const dist = Math.abs(c.x - relX);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = idx;
      }
    });
    setActiveIndex(nearestIdx);
  };

  const linePath =
    coords.length > 1
      ? `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)} ` +
        coords
          .slice(1)
          .map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
          .join(' ')
      : '';

  const areaPath =
    coords.length > 1
      ? `M ${coords[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} ` +
        coords.map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ') +
        ` L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`
      : '';

  const safeActive = Math.min(activeIndex, coords.length - 1);
  const activePoint = coords[safeActive];
  const chartKey = points.map((p) => `${p.label}:${p.value}`).join('|');

  const gridSteps = [0, 0.5, 1];
  const benchmarkY =
    benchmarkValue !== undefined
      ? padTop + chartH - ((benchmarkValue - minVal) / range) * chartH
      : null;

  return (
    <div className="w-full">
      {activePoint && (
        <div className="flex items-center justify-between gap-2 mb-2 text-xs">
          <span className="text-stone-500 dark:text-slate-400 font-medium">
            {unitLabel} · {activePoint.label}
            {activePoint.subLabel ? ` (${activePoint.subLabel})` : ''}
          </span>
          <motion.span
            key={`${activePoint.label}-${activePoint.value}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
            className="font-mono font-bold text-amber-700 dark:text-amber-400 tabular-nums"
          >
            {valueFormatter(activePoint.value)}
          </motion.span>
        </div>
      )}
      <div className="w-full overflow-hidden">
        <svg
          ref={svgRef}
          key={chartKey}
          viewBox={`0 0 ${width} ${height}`}
          onPointerMove={handleScrub}
          className="w-full h-auto select-none touch-pan-y cursor-crosshair"
          role="img"
          aria-label="Grafik tren performa interaktif"
        >
          <defs>
            <linearGradient id="crOpsLuxuryArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D97706" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {gridSteps.map((ratio) => {
            const y = padTop + chartH * (1 - ratio);
            const gridVal = minVal + range * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  className="stroke-stone-200 dark:stroke-slate-800"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-stone-400 dark:fill-slate-500 text-[10px] font-mono"
                >
                  {gridVal >= 1000000
                    ? `${(gridVal / 1000000).toFixed(1)}Jt`
                    : gridVal.toFixed(0)}
                </text>
              </g>
            );
          })}

          {benchmarkY !== null && benchmarkY >= padTop && benchmarkY <= padTop + chartH && (
            <g>
              <line
                x1={padLeft}
                y1={benchmarkY}
                x2={width - padRight}
                y2={benchmarkY}
                stroke="#10B981"
                strokeOpacity="0.55"
                strokeDasharray="4 4"
                strokeWidth="1.25"
              />
              <text
                x={width - padRight}
                y={benchmarkY - 5}
                textAnchor="end"
                className="fill-emerald-700 dark:fill-emerald-400 text-[9px] font-semibold"
              >
                {benchmarkLabel}
              </text>
            </g>
          )}

          {/* Vertical Crosshair Guide */}
          {activePoint && (
            <motion.line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={padTop}
              y2={padTop + chartH}
              stroke="#D97706"
              strokeOpacity="0.35"
              strokeWidth="1"
              strokeDasharray="2 3"
              initial={false}
              animate={{ x1: activePoint.x, x2: activePoint.x }}
              transition={{ type: 'spring', stiffness: 450, damping: 35 }}
            />
          )}

          {areaPath && (
            <motion.path
              d={areaPath}
              fill="url(#crOpsLuxuryArea)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
            />
          )}

          {linePath && (
            <motion.path
              d={linePath}
              fill="none"
              stroke="#D97706"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0.4 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
            />
          )}

          {coords.map((c, idx) => {
            const isSelected = idx === safeActive;
            return (
              <g
                key={`${c.label}-${idx}`}
                className="cursor-pointer"
                onClick={() => setActiveIndex(idx)}
              >
                <circle cx={c.x} cy={c.y} r="16" fill="transparent" />
                {isSelected && (
                  <motion.circle
                    cx={c.x}
                    cy={c.y}
                    r="11"
                    fill="#D97706"
                    fillOpacity="0.18"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  />
                )}
                <motion.circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 5.5 : 3.5}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: Math.min(0.35, idx * 0.03),
                    duration: 0.2,
                    ease: EASE_OUT_EXPO,
                  }}
                  className={
                    isSelected
                      ? 'fill-amber-600 stroke-white dark:stroke-slate-900'
                      : 'fill-white dark:fill-slate-900 stroke-amber-600'
                  }
                  strokeWidth="2.5"
                />
                {(coords.length <= 8 || idx === 0 || idx === coords.length - 1 || idx % 2 === 0) && (
                  <text
                    x={c.x}
                    y={height - 10}
                    textAnchor="middle"
                    className={`text-[10px] font-mono ${
                      isSelected
                        ? 'fill-stone-900 dark:fill-white font-bold'
                        : 'fill-stone-400 dark:fill-slate-500'
                    }`}
                  >
                    {c.label.replace('CL/', '')}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
