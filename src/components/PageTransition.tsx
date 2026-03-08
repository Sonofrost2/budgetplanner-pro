import { motion } from 'framer-motion';
import { ReactNode } from 'react';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.25,
  ease: [0.25, 0.1, 0.25, 1],
};

export const PageTransition = ({ children, className }: { children: ReactNode; className?: string }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={pageTransition}
    className={className}
  >
    {children}
  </motion.div>
);
