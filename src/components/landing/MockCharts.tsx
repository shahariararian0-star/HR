import React from 'react';

// Small static charts for the landing page product previews. They draw sample data only;
// nothing here reads real organization data.

export interface DonutSlice {
  label: string;
  value: number; // percent, slices should add up to 100
  color: string;
}

export const DEPARTMENT_SLICES: DonutSlice[] = [
  { label: 'Engineering', value: 32, color: '#1677FF' },
  { label: 'Marketing', value: 18, color: '#8B5CF6' },
  { label: 'Sales', value: 20, color: '#F59E0B' },
  { label: 'Operations', value: 15, color: '#06B6D4' },
  { label: 'HR', value: 10, color: '#10B981' },
  { label: 'Finance', value: 5, color: '#EC4899' },
];

export const Donut: React.FC<{ slices: DonutSlice[]; total: string; caption: string; size?: number }> = ({
  slices,
  total,
  caption,
  size = 120,
}) => {
  let offset = 25; // start at 12 o'clock
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 42 42" className="w-full h-full" aria-hidden="true">
        <circle cx="21" cy="21" r="15.915" fill="none" stroke="currentColor" strokeWidth="6" className="text-dl-hair-soft" />
        {slices.map((s) => {
          const circle = (
            <circle
              key={s.label}
              cx="21"
              cy="21"
              r="15.915"
              fill="none"
              stroke={s.color}
              strokeWidth="6"
              strokeDasharray={`${s.value} ${100 - s.value}`}
              strokeDashoffset={offset}
            />
          );
          offset -= s.value;
          return circle;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-dl-display font-bold text-dl-ink leading-none" style={{ fontSize: size / 6 }}>{total}</span>
        <span className="text-dl-muted mt-0.5" style={{ fontSize: Math.max(8, size / 14) }}>{caption}</span>
      </div>
    </div>
  );
};

export const DonutLegend: React.FC<{ slices: DonutSlice[]; compact?: boolean }> = ({ slices, compact }) => (
  <ul className={`flex-1 min-w-0 ${compact ? 'space-y-1' : 'space-y-2'}`}>
    {slices.map((s) => (
      <li key={s.label} className={`flex items-center justify-between gap-2 ${compact ? 'text-[10px]' : 'text-xs'} text-dl-muted`}>
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
          <span className="truncate">{s.label}</span>
        </span>
        <span className="font-semibold text-dl-ink">{s.value}%</span>
      </li>
    ))}
  </ul>
);

/** Vertical bars; each value is a percentage of the chart height. */
export const Bars: React.FC<{ values: number[]; labels: string[]; height?: number; stacked?: boolean }> = ({
  values,
  labels,
  height = 110,
  stacked,
}) => (
  <div>
    <div className="flex items-end justify-between gap-1.5" style={{ height }}>
      {values.map((v, i) => (
        <div key={labels[i]} className="flex-1 flex flex-col justify-end h-full">
          <div
            className="w-full max-w-[22px] mx-auto rounded-t-md overflow-hidden flex flex-col"
            style={{ height: `${v}%` }}
          >
            {stacked ? (
              <>
                <div className="bg-[#1677FF]" style={{ height: '45%' }} />
                <div className="flex-1 bg-gradient-to-b from-[#14C38E] to-[#0FA97A]" />
              </>
            ) : (
              <div className="flex-1 bg-gradient-to-b from-[#3B8BFF] to-[#1660E0]" />
            )}
          </div>
        </div>
      ))}
    </div>
    <div className="flex justify-between gap-1.5 mt-2">
      {labels.map((l) => (
        <span key={l} className="flex-1 text-center text-[10px] text-dl-soft">{l}</span>
      ))}
    </div>
  </div>
);

/** Round avatar with initials, coloured by a fixed palette. */
export const Initials: React.FC<{ name: string; size?: number; tone?: number }> = ({ name, size = 36, tone = 0 }) => {
  const tones = [
    'from-[#1677FF] to-[#5AA2FF]',
    'from-[#8B5CF6] to-[#B794FF]',
    'from-[#10B981] to-[#5EE0B5]',
    'from-[#F59E0B] to-[#FFC65C]',
    'from-[#EC4899] to-[#F78FC4]',
  ];
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br ${tones[tone % tones.length]} text-white font-semibold shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
};
