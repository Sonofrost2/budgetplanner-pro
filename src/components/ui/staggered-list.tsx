import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface StaggeredListProps {
  children: ReactNode[];
  className?: string;
  staggerDelay?: number;
}

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

export const StaggeredList = ({ children, className }: StaggeredListProps) => (
  <motion.div
    variants={container}
    initial="hidden"
    animate="show"
    className={className}
  >
    {children.map((child, i) => (
      <motion.div key={i} variants={item}>
        {child}
      </motion.div>
    ))}
  </motion.div>
);
