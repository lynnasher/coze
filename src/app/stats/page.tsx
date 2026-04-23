'use client';

import StatsView from '@/components/StatsView';

export default function StatsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[970px] mx-auto px-4 pt-3 pb-24">
        <StatsView />
      </div>
    </div>
  );
}
