import { momDelta } from '@/lib/categoryAnalytics';

interface Props {
  values: number[];
  color: string;
  className?: string;
}

export const CategorySparkline = ({ values, color, className }: Props) => {
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${100 - (v / max) * 85 - 5}`).join(' ');
  const delta = momDelta(values);
  const positive = (delta ?? 0) >= 0;

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-16 h-7">
        <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {delta !== null && (
        <span className={`text-[10px] font-semibold tabular-nums ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>
          {positive ? '+' : ''}{delta}%
        </span>
      )}
    </div>
  );
};
