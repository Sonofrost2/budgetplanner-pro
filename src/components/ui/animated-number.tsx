import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}

/**
 * Smoothly animates a number from its previous value to the new one.
 */
export const AnimatedNumber = ({ value, format, className, duration = 0.8 }: AnimatedNumberProps) => {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });
  const [display, setDisplay] = useState(format ? format(value) : String(value));
  const prevValue = useRef(0);

  useEffect(() => {
    motionValue.set(prevValue.current);
    const timeout = setTimeout(() => {
      motionValue.set(value);
    }, 50);
    prevValue.current = value;
    return () => clearTimeout(timeout);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      setDisplay(format ? format(latest) : Math.round(latest).toLocaleString());
    });
    return unsubscribe;
  }, [spring, format]);

  return (
    <motion.span
      className={`tabular-nums ${className || ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {display}
    </motion.span>
  );
};
