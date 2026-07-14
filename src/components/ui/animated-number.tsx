import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

const docLocale = (): string => {
  if (typeof document === 'undefined') return 'fr-FR';
  const lang = (document.documentElement.lang || 'fr').toLowerCase();
  return lang.startsWith('fr') ? 'fr-FR' : 'en-US';
};

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}

/**
 * Smoothly animates a number from its previous value to the new one.
 */
/**
 * Smoothly animates a number from its previous value to the new one.
 *
 * Rules to avoid inconsistent transient values:
 *  - On the very first mount, the display starts already at `value` (no 0 → value flash).
 *  - Subsequent updates spring from the last committed value to the new one.
 *  - When the animation ends (or when |Δ| is tiny), the display is snapped to the
 *    exact target so it never gets stuck one franc/cent off.
 */
export const AnimatedNumber = ({ value, format, className, duration = 0.8 }: AnimatedNumberProps) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const motionValue = useMotionValue(safeValue);
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });
  const formatRef = useRef(format);
  formatRef.current = format;
  const renderValue = (n: number) => {
    const fn = formatRef.current;
    return fn ? fn(n) : Math.round(n).toLocaleString(docLocale());
  };
  const [display, setDisplay] = useState(() => renderValue(safeValue));
  const prevValue = useRef(safeValue);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      // First mount → land directly on target, no 0-flash.
      mounted.current = true;
      motionValue.jump(safeValue);
      prevValue.current = safeValue;
      setDisplay(renderValue(safeValue));
      return;
    }
    // Below a 1-unit change (e.g. rounding drift), snap without animation.
    if (Math.abs(safeValue - prevValue.current) < 1) {
      motionValue.jump(safeValue);
      prevValue.current = safeValue;
      setDisplay(renderValue(safeValue));
      return;
    }
    motionValue.set(prevValue.current);
    const timeout = setTimeout(() => motionValue.set(safeValue), 50);
    prevValue.current = safeValue;
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeValue]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      setDisplay(renderValue(latest));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spring]);

  // Snap to the exact target once the spring settles — avoids "1 999" instead of "2 000".
  useEffect(() => {
    const t = window.setTimeout(() => setDisplay(renderValue(safeValue)), duration * 1000 + 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeValue, duration]);

  return (
    <motion.span
      className={`tabular-nums amount-display ${className || ''}`}
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {display}
    </motion.span>
  );
};
