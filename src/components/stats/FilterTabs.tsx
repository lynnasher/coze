'use client';

interface FilterTabsProps {
  value: 'day' | 'week' | 'month' | 'all';
  onChange: (value: 'day' | 'week' | 'month' | 'all') => void;
}

const filters = [
  { key: 'day', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'all', label: '全部' },
] as const;

export function FilterTabs({ value, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onChange(filter.key)}
          className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
            value === filter.key
              ? 'bg-slate-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
