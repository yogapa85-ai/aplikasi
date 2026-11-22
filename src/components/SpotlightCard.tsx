import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { EASE_OUT_EXPO } from './MotionPrimitives';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
  active?: boolean;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  onClick,
  interactive = false,
  active = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCoords({ x, y });
  };

  const baseClasses = `relative overflow-hidden rounded-2xl border transition-colors ${
    active
      ? 'border-amber-600/80 dark:border-amber-500/80 bg-amber-50/50 dark:bg-amber-950/25'
      : 'border-stone-200/90 dark:border-slate-800/90 luxury-surface'
  } ${interactive ? 'cursor-pointer' : ''} ${className}`;

  return (
    <motion.div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={onClick}
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { scale: 0.985 } : undefined}
      transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={baseClasses}
    >
      {/* Interactive Specular Sheen Layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(280px circle at ${coords.x}% ${coords.y}%, rgba(245, 158, 11, 0.11), transparent 70%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
};
