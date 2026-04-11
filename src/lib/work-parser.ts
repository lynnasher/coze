import { Question, QuestionType, Difficulty, QuizOption } from './types';
import { generateId } from './quiz-store';

// WORK 题库格式定义
export interface WorkQuestion {
  id?: string | number;
  question?: string;
  content?: string;
  title?: string;
  options?: WorkOptions;
  choice?: WorkOptions;
  answer?: string | string[] | number;
  correct?: string | string[] | number;
  answers?: string | string[] | number;
  type?: string;
  typeName?: string;
  image?: string;
  explain?: string;
  explanation?: string;
  difficulty?: string | number;
  level?: string | number;
  subject?: string | number;
  tags?: string[];
  label?: string[];
  point?: string;
  chapter?: string;
}

export interface WorkOptions {
  A?: string;
  B?: string;
  C?: string;
  D?: string;
  a?: string;
  b?: string;
  c?: string;
  d?: string;
  1?: string;
  2?: string;
  3?: string;
  4?: string;
}

// 解析 WORK 题库选项
const parseOptions = (opt: WorkOptions | undefined): QuizOption[] => {
  if (!opt) return [];
  
  const options: QuizOption[] = [];
  
  // 支持多种选项格式
  if (opt.A || opt.a) {
    if (opt.A) options.push({ id: 'a', text: opt.A });
    else if (opt.a) options.push({ id: 'a', text: opt.a });
  }
  if (opt.B || opt.b) {
    if (opt.B) options.push({ id: 'b', text: opt.B });
    else if (opt.b) options.push({ id: 'b', text: opt.b });
  }
  if (opt.C || opt.c) {
    if (opt.C) options.push({ id: 'c', text: opt.C });
    else if (opt.c) options.push({ id: 'c', text: opt.c });
  }
  if (opt.D || opt.d) {
    if (opt.D) options.push({ id: 'd', text: opt.D });
    else if (opt.d) options.push({ id: 'd', text: opt.d });
  }
  
  // 支持数字索引格式
  if (opt[1]) options.push({ id: 'a', text: opt[1] });
  if (opt[2]) options.push({ id: 'b', text: opt[2] });
  if (opt[3]) options.push({ id: 'c', text: opt[3] });
  if (opt[4]) options.push({ id: 'd', text: opt[4] });
  
  return options;
};

// 解析答案
const parseAnswer = (answer: string | string[] | number | undefined): string | string[] => {
  if (!answer && answer !== 0) return 'a';
  
  // 如果是数字，转换为字母
  if (typeof answer === 'number') {
    const map: Record<number, string> = { 1: 'a', 2: 'b', 3: 'c', 4: 'd' };
    return map[answer] || 'a';
  }
  
  // 如果是字符串
  if (typeof answer === 'string') {
    const lower = answer.toLowerCase().trim();
    
    // 如果是单个字母
    if (/^[abcd]$/.test(lower)) {
      return lower;
    }
    
    // 如果是"正确/错误"格式
    if (['正确', 'true', 'yes', '对', 't'].includes(lower)) {
      return 'true';
    }
    if (['错误', 'false', 'no', '错', 'f'].includes(lower)) {
      return 'false';
    }
    
    // 如果是"A"格式
    if (/^[abcd]$/i.test(answer)) {
      return answer.toLowerCase();
    }
    
    // 如果是数字字符串
    if (/^[1-4]$/.test(answer)) {
      const map: Record<string, string> = { '1': 'a', '2': 'b', '3': 'c', '4': 'd' };
      return map[answer];
    }
    
    return lower;
  }
  
  // 如果是数组（多选题）
  if (Array.isArray(answer)) {
    return answer.map(a => {
      if (typeof a === 'number') {
        const map: Record<number, string> = { 1: 'a', 2: 'b', 3: 'c', 4: 'd' };
        return map[a] || 'a';
      }
      return String(a).toLowerCase();
    });
  }
  
  return 'a';
};

// 判断题目类型
const identifyType = (q: WorkQuestion, options: QuizOption[]): QuestionType => {
  const typeStr = (q.type || q.typeName || '').toLowerCase();
  const content = (q.content || q.question || q.title || '').toLowerCase();
  
  // 类型关键词判断
  if (typeStr.includes('判断') || typeStr.includes('judge') || typeStr.includes('tf') || typeStr.includes('truefalse')) {
    return 'true-false';
  }
  if (typeStr.includes('多选') || typeStr.includes('multi') || typeStr.includes('multiple')) {
    return 'multiple';
  }
  if (typeStr.includes('填空') || typeStr.includes('fill') || typeStr.includes('blank')) {
    return 'fill-blank';
  }
  
  // 内容关键词判断
  if (/对错|正确错误|真假|是非|判断|对\s*错/i.test(content)) {
    return 'true-false';
  }
  if (/多选|哪些|选择.*正确|选出|选择.*以下/i.test(content)) {
    return 'multiple';
  }
  
  // 选项数量判断
  if (options.length === 2 && (options[0].text.includes('正确') || options[0].text.includes('对') || options[0].text.includes('true'))) {
    return 'true-false';
  }
  
  return 'single';
};

// 判断难度
const identifyDifficulty = (q: WorkQuestion): Difficulty => {
  const level = q.difficulty || q.level;
  
  if (typeof level === 'number') {
    if (level <= 1) return 'easy';
    if (level === 2) return 'medium';
    return 'hard';
  }
  
  const levelStr = String(level || '').toLowerCase();
  if (levelStr.includes('easy') || levelStr.includes('简单') || levelStr === '1') return 'easy';
  if (levelStr.includes('medium') || levelStr.includes('中等') || levelStr === '2') return 'medium';
  if (levelStr.includes('hard') || levelStr.includes('困难') || levelStr === '3') return 'hard';
  
  // 根据题目特征判断（驾考场景）
  if (levelStr.includes('科目一') || levelStr.includes('1')) return 'easy';
  if (levelStr.includes('科目四') || levelStr.includes('4')) return 'medium';
  
  return 'medium';
};

// 获取标签
const getTags = (q: WorkQuestion): string[] => {
  const tags: string[] = [];
  
  if (q.subject) {
    const subjectNum = Number(q.subject);
    if (subjectNum === 1) tags.push('科目一');
    else if (subjectNum === 4) tags.push('科目四');
  }
  
  if (q.tags && Array.isArray(q.tags)) {
    tags.push(...q.tags);
  }
  
  if (q.label && Array.isArray(q.label)) {
    tags.push(...q.label);
  }
  
  if (q.chapter) tags.push(String(q.chapter));
  if (q.point) tags.push(String(q.point));
  
  return [...new Set(tags)]; // 去重
};

// 解析单个题目
const parseWorkQuestion = (item: WorkQuestion): Question | null => {
  try {
    const content = item.content || item.question || item.title;
    if (!content) return null;
    
    const options = parseOptions(item.options || item.choice);
    const type = identifyType(item, options);
    const answer = parseAnswer(item.answer || item.correct || item.answers);
    const difficulty = identifyDifficulty(item);
    const tags = getTags(item);
    
    // 特殊处理判断题
    let processedOptions = options;
    let processedAnswer = answer;
    
    if (type === 'true-false' && options.length === 0) {
      processedOptions = [
        { id: 'true', text: '正确' },
        { id: 'false', text: '错误' },
      ];
      // 如果答案是 a/b/c/d 格式，转换为 true/false
      if (typeof processedAnswer === 'string' && /^[abcd]$/.test(processedAnswer)) {
        processedAnswer = processedAnswer === 'a' ? 'true' : 'false';
      }
    }
    
    return {
      id: item.id ? String(item.id) : generateId(),
      type,
      content: content.trim(),
      options: processedOptions.length > 0 ? processedOptions : undefined,
      answer: processedAnswer,
      explanation: item.explain || item.explanation,
      tags,
      difficulty,
      createdAt: Date.now(),
    };
  } catch (error) {
    console.error('解析题目失败:', error);
    return null;
  }
};

// 主解析函数
export const parseWorkJson = (jsonStr: string): Question[] => {
  try {
    const data = JSON.parse(jsonStr);
    let items: WorkQuestion[] = [];
    
    // 处理多种数据格式
    if (Array.isArray(data)) {
      items = data;
    } else if (typeof data === 'object' && data !== null) {
      // 题库可能在 various 字段中
      if (data.result) items = Array.isArray(data.result) ? data.result : [];
      else if (data.data) items = Array.isArray(data.data) ? data.data : [];
      else if (data.questions) items = Array.isArray(data.questions) ? data.questions : [];
      else if (data.items) items = Array.isArray(data.items) ? data.items : [];
      else if (data.list) items = Array.isArray(data.list) ? data.list : [];
      else if (data.bank) items = Array.isArray(data.bank) ? data.bank : [];
      else if (data.records) items = Array.isArray(data.records) ? data.records : [];
      else if (data.subject1) items = Array.isArray(data.subject1) ? data.subject1 : [];
      else if (data.subject4) items = Array.isArray(data.subject4) ? data.subject4 : [];
      else {
        // 尝试找到第一个数组属性
        for (const key of Object.keys(data)) {
          if (Array.isArray(data[key])) {
            items = data[key];
            break;
          }
        }
      }
    }
    
    const questions: Question[] = [];
    for (const item of items) {
      const question = parseWorkQuestion(item);
      if (question) {
        questions.push(question);
      }
    }
    
    return questions;
  } catch (error) {
    console.error('WORK 题库 JSON 解析失败:', error);
    return [];
  }
};

// 从文本导入 WORK 格式题库（支持多种格式）
export const parseWorkText = (text: string): Question[] => {
  const questions: Question[] = [];
  const lines = text.split('\n');
  let currentQuestion: Partial<WorkQuestion> = {};
  let currentOptions: WorkOptions = {};
  let currentAnswer = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 检测题目开始
    const questionMatch = trimmed.match(/^(\d+)[.、)]\s*(.+)/);
    if (questionMatch) {
      // 保存上一题
      if (currentQuestion.content || currentQuestion.question) {
        const q = parseWorkQuestion({
          ...currentQuestion,
          options: currentOptions,
          answer: currentAnswer,
        });
        if (q) questions.push(q);
      }
      
      currentQuestion = {
        id: questionMatch[1],
        content: questionMatch[2],
      };
      currentOptions = {};
      currentAnswer = '';
      continue;
    }
    
    // 检测选项
    const optionMatch = trimmed.match(/^([A-Da-d])[.、)]\s*(.+)/);
    if (optionMatch) {
      const key = optionMatch[1].toLowerCase();
      currentOptions[key as keyof WorkOptions] = optionMatch[2];
      continue;
    }
    
    // 检测答案
    const answerMatch = trimmed.match(/^答案[：:]\s*(.+)/i);
    if (answerMatch) {
      currentAnswer = answerMatch[1].trim();
      continue;
    }
    
    // 如果不是题目行、选项行、答案行，可能是题目的延续
    if (currentQuestion.content && Object.keys(currentOptions).length === 0) {
      currentQuestion.content += ' ' + trimmed;
    }
  }
  
  // 保存最后一题
  if (currentQuestion.content || currentQuestion.question) {
    const q = parseWorkQuestion({
      ...currentQuestion,
      options: currentOptions,
      answer: currentAnswer,
    });
    if (q) questions.push(q);
  }
  
  return questions;
};

// 导出解析函数供 API 使用
export const parseWorkBank = (content: string, isJson: boolean): Question[] => {
  if (isJson) {
    return parseWorkJson(content);
  }
  return parseWorkText(content);
};
