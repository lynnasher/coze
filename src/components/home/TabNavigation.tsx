'use client';

import { Home, Library, BarChart3 } from 'lucide-react';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
      {[
        { key: 'practice', icon: Home, label: '首页' },
        { key: 'library', icon: Library, label: '题库' },
        { key: 'stats', icon: BarChart3, label: '统计' },
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === tab.key
              ? 'bg-white text-slate-700 shadow-sm'
              : 'text-slate-500 hover:bg-white/50'
          }`}
        >
          <tab.icon className="w-4 h-4" />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
