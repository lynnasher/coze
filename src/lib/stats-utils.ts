import { PracticeRecord } from './types';

/**
 * 判断答题记录是否有有效答案
 */
export function hasValidAnswer(r: PracticeRecord): boolean {
  if (!r.selectedAnswer) return false;
  const answer = Array.isArray(r.selectedAnswer) ? r.selectedAnswer : String(r.selectedAnswer);
  return answer.length > 0;
}

/**
 * 重新计算错题数据（统一逻辑）
 * - 遍历所有有效答题记录，找出错题
 * - 对每道错题从最近一次答题向前计算连续正确次数
 * - 连续正确 ≥3 次的自动移出错题本（删除其错误记录）
 * - 更新 wrongStreakStore
 * - 返回当前错题数量
 */
export function recalculateWrongData(
  allRecords: PracticeRecord[],
  saveRecords: (records: PracticeRecord[]) => void,
  saveStreaks: (streaks: Record<string, number>) => void,
  getWrongCount: () => number
): number {
  // 找出所有答错过的题目
  const wrongQuestionIds = new Set<string>();
  allRecords.forEach(r => {
    if (!hasValidAnswer(r)) return;
    if (!r.isCorrect) {
      wrongQuestionIds.add(r.questionId);
    }
  });

  // 重新计算每道错题的连续正确次数
  const newStreaks: Record<string, number> = {};
  const masteredIds: string[] = [];

  wrongQuestionIds.forEach(qId => {
    const questionRecords = allRecords
      .filter(r => r.questionId === qId && hasValidAnswer(r))
      .sort((a, b) => a.timestamp - b.timestamp);

    let streak = 0;
    for (let i = questionRecords.length - 1; i >= 0; i--) {
      if (questionRecords[i].isCorrect) {
        streak++;
      } else {
        break;
      }
    }

    if (streak >= 3) {
      masteredIds.push(qId);
    } else {
      newStreaks[qId] = streak;
    }
  });

  // 移除已掌握的错题的错误记录
  if (masteredIds.length > 0) {
    const filteredRecords = allRecords.filter(
      r => !(masteredIds.includes(r.questionId) && !r.isCorrect)
    );
    saveRecords(filteredRecords);
  }

  // 更新连续正确次数
  saveStreaks(newStreaks);

  return getWrongCount();
}

/**
 * 计算连续学习天数统计
 */
export function calculateStreakStats(records: PracticeRecord[]) {
  // 过滤掉空答题记录
  const validRecords = records.filter(r => {
    if (!r.selectedAnswer) return false;
    const answer = Array.isArray(r.selectedAnswer) ? r.selectedAnswer : String(r.selectedAnswer);
    return answer.length > 0;
  });
  
  if (validRecords.length === 0) {
    return { current: 0, longest: 0, weekly: 0, goal: 7 };
  }
  
  // 使用本地时区获取日期字符串（修复时区问题）
  const getLocalDateString = (timestamp: number): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const studyDates = new Set(
    validRecords.map(r => getLocalDateString(r.timestamp))
  );
  const sortedDates = Array.from(studyDates).sort();
  
  // 获取本地时区的今天和昨天
  const today = getLocalDateString(Date.now());
  const yesterday = getLocalDateString(Date.now() - 24 * 60 * 60 * 1000);
  
  // 当前连续天数（从最后一天向前计算）
  let current = 0;
  const lastDate = sortedDates[sortedDates.length - 1];
  if (lastDate === today || lastDate === yesterday) {
    current = 1;
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const currDate = new Date(sortedDates[i + 1]);
      const prevDate = new Date(sortedDates[i]);
      // 计算日期差（考虑时区）
      const currDay = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
      const prevDay = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
      if ((currDay.getTime() - prevDay.getTime()) / (24 * 60 * 60 * 1000) === 1) {
        current++;
      } else break;
    }
  }
  
  // 最长连续天数
  let longest = 1, temp = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const currDate = new Date(sortedDates[i]);
    const prevDate = new Date(sortedDates[i - 1]);
    const currDay = new Date(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
    const prevDay = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
    if ((currDay.getTime() - prevDay.getTime()) / (24 * 60 * 60 * 1000) === 1) {
      temp++;
      longest = Math.max(longest, temp);
    } else temp = 1;
  }
  
  // 本周进度（从周一开始计算）
  const now = new Date();
  const nowDay = now.getDay();
  // 周一作为一周开始（getDay() 周日=0，周一=1）
  const mondayOffset = nowDay === 0 ? -6 : 1 - nowDay;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  
  let weekly = 0;
  for (let d = 0; d < 7; d++) {
    const d2 = new Date(weekStart);
    d2.setDate(weekStart.getDate() + d);
    if (studyDates.has(getLocalDateString(d2.getTime()))) weekly++;
  }
  
  return { current, longest, weekly, goal: 7 };
}

/**
 * 计算近7天学习趋势
 */
export function calculateTrendData(records: PracticeRecord[]) {
  // 过滤掉空答题记录
  const validRecords = records.filter(r => {
    if (!r.selectedAnswer) return false;
    const answer = Array.isArray(r.selectedAnswer) ? r.selectedAnswer : String(r.selectedAnswer);
    return answer.length > 0;
  });
  
  // 使用本地时区获取日期字符串
  const getLocalDateString = (timestamp: number): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = getLocalDateString(date.getTime());
    const count = validRecords.filter(
      r => getLocalDateString(r.timestamp) === dateStr
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
