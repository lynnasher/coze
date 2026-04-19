import { PracticeRecord } from './types';

/**
 * 计算连续学习天数统计
 */
export function calculateStreakStats(records: PracticeRecord[]) {
  if (records.length === 0) {
    return { current: 0, longest: 0, weekly: 0, goal: 5 };
  }
  
  const studyDates = new Set(
    records.map(r => new Date(r.timestamp).toISOString().split('T')[0])
  );
  const sortedDates = Array.from(studyDates).sort();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // 当前连续天数
  let current = 0;
  const lastDate = sortedDates[sortedDates.length - 1];
  if (lastDate === today || lastDate === yesterday) {
    current = 1;
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const curr = new Date(sortedDates[i + 1]);
      const prev = new Date(sortedDates[i]);
      if ((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000) === 1) {
        current++;
      } else break;
    }
  }
  
  // 最长连续天数
  let longest = 1, temp = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const curr = new Date(sortedDates[i]);
    const prev = new Date(sortedDates[i - 1]);
    if ((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000) === 1) {
      temp++;
      longest = Math.max(longest, temp);
    } else temp = 1;
  }
  
  // 本周进度
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  let weekly = 0;
  for (let d = 0; d < 7; d++) {
    const d2 = new Date(weekStart);
    d2.setDate(weekStart.getDate() + d);
    if (studyDates.has(d2.toISOString().split('T')[0])) weekly++;
  }
  
  return { current, longest, weekly, goal: 5 };
}

/**
 * 计算近7天学习趋势
 */
export function calculateTrendData(records: PracticeRecord[]) {
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const count = records.filter(
      r => new Date(r.timestamp).toISOString().split('T')[0] === dateStr
    ).length;
    trend.push({ day: date.getDate(), count });
  }
  return trend;
}

/**
 * 计算筛选后的统计数据
 */
export function calculateFilteredStats(
  records: PracticeRecord[],
  filter: 'day' | 'week' | 'month' | 'all'
) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let filteredRecords = records;
  
  if (filter === 'day') {
    filteredRecords = records.filter(r => now - r.timestamp < dayMs);
  } else if (filter === 'week') {
    filteredRecords = records.filter(r => now - r.timestamp < 7 * dayMs);
  } else if (filter === 'month') {
    filteredRecords = records.filter(r => now - r.timestamp < 30 * dayMs);
  }
  
  const answeredRecords = filteredRecords.filter(r => {
    if (!r.selectedAnswer) return false;
    const answer = Array.isArray(r.selectedAnswer) ? r.selectedAnswer : String(r.selectedAnswer);
    return answer.length > 0;
  });
  
  const totalCount = answeredRecords.length;
  const correctCount = answeredRecords.filter(r => r.isCorrect).length;
  const wrongCount = totalCount - correctCount;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  
  return { totalCount, correctCount, wrongCount, accuracy };
}
