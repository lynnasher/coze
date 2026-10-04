'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Users,
  BookOpen,
  CalendarDays,
  Flame,
  AlertTriangle,
  Activity,
  Loader2,
  History,
  TrendingUp,
} from 'lucide-react';

interface StatsUser {
  id: string;
  phone: string;
  nickname?: string;
  role: string;
  status: string;
  createdAt?: string;
  lastLoginAt?: string;
  activatedCategories: string[];
}

interface StatsSummary {
  total: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  practiceDays: number;
  wrongBookTotal: number;
  maxStreak: number;
  lastActive: string | null;
}

interface TrendPoint {
  date: string;
  count: number;
}

interface Session {
  id?: string;
  bankId?: string;
  bankName: string;
  mode: string;
  currentIndex: number;
  totalCount: number;
  correctCount: number;
  wrongCount: number;
  isCompleted: boolean;
  lastPracticeAt?: number | null;
}

interface RecentRecord {
  id: string;
  questionId: string;
  isCorrect: boolean;
  timestamp?: number | null;
}

interface WrongQuestion {
  id: string;
  count: number;
  content: string;
  type: string;
}

interface StatsResponse {
  success: boolean;
  user: StatsUser;
  stats: StatsSummary;
  trend30: TrendPoint[];
  recentRecords: RecentRecord[];
  sessions: Session[];
  topWrongQuestions: WrongQuestion[];
}

interface UserStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userDesc: string;
}

const TYPE_LABEL: Record<string, string> = {
  single: '单选',
  multiple: '多选',
  'uncertain-choice': '不定项',
  'true-false': '判断',
  'fill-blank': '填空',
  comprehensive: '综合',
};

function formatTime(ts?: number | null): string {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', { hour12: false });
}

export function UserStatsDialog({ open, onOpenChange, userId, userDesc }: UserStatsDialogProps) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    setError('');
    setData(null);
    const token = localStorage.getItem('admin_token');
    fetch(`/api/admin/users/${userId}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json?.success) {
          setData(json as StatsResponse);
        } else {
          setError(json?.error || '加载统计数据失败');
        }
      })
      .catch(() => setError('加载统计数据失败'))
      .finally(() => setLoading(false));
  }, [open, userId]);

  const maxTrend = data?.trend30?.reduce((m, p) => Math.max(m, p.count), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>答题数据</DialogTitle>
          <DialogDescription>{userDesc}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> 加载中...
            </div>
          )}

          {!loading && error && <div className="py-16 text-center text-gray-500">{error}</div>}

          {!loading && data && (
            <div className="space-y-5">
              {/* 用户信息 */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <span className="font-medium text-gray-800">{data.user.nickname || '未设置昵称'}</span>
                <span>{data.user.phone}</span>
                <Badge variant={data.user.role === 'admin' ? 'default' : 'secondary'}>
                  {data.user.role === 'admin' ? '管理员' : '普通用户'}
                </Badge>
                <Badge variant={data.user.status === 'active' ? 'default' : 'destructive'}>
                  {data.user.status === 'active' ? '正常' : '禁用'}
                </Badge>
                <span className="text-xs text-gray-400">
                  注册于 {data.user.createdAt ? new Date(data.user.createdAt).toLocaleDateString() : '-'}
                </span>
              </div>

              {/* 指标卡片 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  icon={<BookOpen className="w-4 h-4" />}
                  label="累计答题"
                  value={data.stats.total}
                  tone="indigo"
                />
                <StatCard
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  label="答对 / 答错"
                  value={`${data.stats.correctCount} / ${data.stats.wrongCount}`}
                  tone="green"
                />
                <StatCard icon={<Activity className="w-4 h-4" />} label="正确率" value={`${data.stats.accuracy}%`} tone="blue" />
                <StatCard
                  icon={<CalendarDays className="w-4 h-4" />}
                  label="参与天数"
                  value={data.stats.practiceDays}
                  tone="gray"
                />
                <StatCard
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label="错题数"
                  value={data.stats.wrongBookTotal}
                  tone="amber"
                />
                <StatCard
                  icon={<Flame className="w-4 h-4" />}
                  label="连续正确(峰)"
                  value={data.stats.maxStreak}
                  tone="rose"
                />
                <StatCard
                  icon={<Users className="w-4 h-4" />}
                  label="最近活跃"
                  value={data.stats.lastActive ?? '-'}
                  small
                  tone="gray"
                />
              </div>

              {/* 近30天做题趋势 */}
              {data.trend30 && data.trend30.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" /> 近30天做题趋势
                  </h3>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-end gap-[2px] h-24">
                      {data.trend30.map((point) => (
                        <div
                          key={point.date}
                          className="flex-1 flex flex-col items-center justify-end h-full"
                          title={`${point.date}：${point.count} 题`}
                        >
                          <div
                            className="w-full bg-indigo-100 hover:bg-indigo-400 transition-colors rounded-t-sm"
                            style={{
                              height: maxTrend > 0 ? `${Math.max((point.count / maxTrend) * 100, 3)}%` : '3%',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>{data.trend30[0]?.date}</span>
                      <span>每日</span>
                      <span>{data.trend30[data.trend30.length - 1]?.date}</span>
                    </div>
                  </div>
                </section>
              )}

              {/* 学习进度 */}
              {data.sessions && data.sessions.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-2">
                    <BookOpen className="w-4 h-4 text-indigo-500" /> 最近练习会话
                  </h3>
                  <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
                    <table className="w-full text-sm min-w-[520px]">
                      <thead className="bg-gray-50 text-left text-xs text-gray-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">题库</th>
                          <th className="px-3 py-2 font-medium">进度</th>
                          <th className="px-3 py-2 font-medium">对/错</th>
                          <th className="px-3 py-2 font-medium">状态</th>
                          <th className="px-3 py-2 font-medium">最近做题</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.sessions.map((s, i) => (
                          <tr key={s.id || i}>
                            <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate">{s.bankName}</td>
                            <td className="px-3 py-2 text-gray-600">
                              {s.currentIndex}/{s.totalCount}
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-green-600">{s.correctCount}</span>
                              <span className="text-gray-300 mx-0.5">/</span>
                              <span className="text-red-500">{s.wrongCount}</span>
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={s.isCompleted ? 'default' : 'outline'} className="text-[11px]">
                                {s.isCompleted ? '已完成' : '进行中'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{formatTime(s.lastPracticeAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* 薄弱点：Top 错题 */}
              {data.topWrongQuestions && data.topWrongQuestions.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> 薄弱点 - 高频错题
                  </h3>
                  <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                    {data.topWrongQuestions.map((q) => (
                      <div key={q.id} className="px-3 py-2 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <Badge
                            variant="outline"
                            className="shrink-0 mt-0.5 text-[10px] text-indigo-600 bg-indigo-50 border-indigo-100"
                          >
                            {TYPE_LABEL[q.type] || q.type}
                          </Badge>
                          <span className="text-sm text-gray-700 line-clamp-2">{q.content}</span>
                        </div>
                        <span className="shrink-0 text-xs text-red-500 font-medium">
                          {q.count} 次
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 最近答题记录 */}
              {data.recentRecords && data.recentRecords.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-2">
                    <History className="w-4 h-4 text-indigo-500" /> 最近答题（最近 {data.recentRecords.length} 条）
                  </h3>
                  <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
                    <table className="w-full text-sm min-w-[420px]">
                      <thead className="bg-gray-50 text-left text-xs text-gray-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">题目</th>
                          <th className="px-3 py-2 font-medium">结果</th>
                          <th className="px-3 py-2 font-medium">时间</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.recentRecords.map((r) => (
                          <tr key={r.id}>
                            <td className="px-3 py-2 text-gray-600 max-w-[240px] truncate" title={r.questionId}>
                              {r.questionId}
                            </td>
                            <td className="px-3 py-2">
                              {r.isCorrect ? (
                                <span className="inline-flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> 正确
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-500">
                                  <XCircle className="w-3.5 h-3.5" /> 错误
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{formatTime(r.timestamp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {!data.stats.total &&
                data.sessions.length === 0 &&
                data.topWrongQuestions.length === 0 &&
                data.recentRecords.length === 0 && (
                  <div className="text-center py-12 text-gray-400">该用户暂无做题数据</div>
                )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: 'indigo' | 'green' | 'blue' | 'amber' | 'rose' | 'gray';
  small?: boolean;
}

const TONE_CLASS: Record<StatCardProps['tone'], string> = {
  indigo: 'text-indigo-600 bg-indigo-50',
  green: 'text-green-600 bg-green-50',
  blue: 'text-blue-600 bg-blue-50',
  amber: 'text-amber-600 bg-amber-50',
  rose: 'text-rose-600 bg-rose-50',
  gray: 'text-gray-600 bg-gray-100',
};

function StatCard({ icon, label, value, tone, small }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        <span className={`p-1 rounded ${TONE_CLASS[tone]}`}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`font-semibold text-gray-800 ${small ? 'text-sm' : 'text-lg'}`}>{value}</div>
    </div>
  );
}