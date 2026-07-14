import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook that returns a ref and visibility state for scroll-triggered animations.
 * Uses IntersectionObserver for performance.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: { threshold?: number; rootMargin?: string; once?: boolean }
) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { threshold = 0.1, rootMargin = '0px 0px -40px 0px', once = true } = options || {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion — reveal immediately.
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // If IntersectionObserver is unavailable, reveal immediately.
    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    // If element is already in viewport at mount, reveal immediately (no wait for scroll).
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    if (rect.top < vh && rect.bottom > 0 && rect.left < vw && rect.right > 0) {
      setIsVisible(true);
      if (once) return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);

    // Safety fallback: never leave content hidden — force reveal after 1.2s.
    const fallback = window.setTimeout(() => setIsVisible(true), 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [threshold, rootMargin, once]);

  return { ref, isVisible };
}

/**
 * Component wrapper that applies scroll-triggered fade-in animation to its children.
 */
import React from 'react';
import { cn } from '@/lib/utils';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-500 ease-out',
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-4 scale-[0.98]',
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
