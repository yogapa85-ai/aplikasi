import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface AnimatedNumberProps {
  value: number;
  formatter: (val: number) => string;
  durationMs?: number;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  formatter,
  durationMs = 360,
}) => {
  const [displayVal, setDisplayVal] = useState<number>(value);
  const prevValRef = useRef<number>(value);

  useEffect(() => {
    const startVal = prevValRef.current;
    const endVal = value;
    if (startVal === endVal) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      prevValRef.current = endVal;
      setDisplayVal(endVal);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = startVal + (endVal - startVal) * eased;
      setDisplayVal(current);

      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        prevValRef.current = endVal;
        setDisplayVal(endVal);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      prevValRef.current = endVal;
    };
  }, [value, durationMs]);

  return <>{formatter(displayVal)}</>;
};

interface StaggerGridProps {
  children: React.ReactNode;
  className?: string;
}

export const StaggerGrid: React.FC<StaggerGridProps> = ({ children, className = '' }) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.035,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export const StaggerItem: React.FC<StaggerItemProps> = ({ children, className = '' }) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10, scale: 0.98 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration: 0.22,
            ease: EASE_OUT_EXPO,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
