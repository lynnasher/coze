'use client';

import { useApp } from '@/components/providers/AppProviders';
import StatsView from '@/components/StatsView';

export default function StatsPage() {
  const { mounted, wrongCount } = useApp();

  return (
    <main className="max-w-[970px] mx-auto px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-4 shadow-sm border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/80 backdrop-blur rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-800 tracking-tight">学习统计</h1>
              <p className="text-gray-500 text-xs mt-0.5">追踪你的学习进度</p>
            </div>
          </div>
        </div>
      </div>

      {/* 统计内容 */}
      <StatsView mounted={mounted} wrongCount={wrongCount} />

      {/* 底部安全间距 */}
      <div className="h-8"></div>
    </main>
  );
}
