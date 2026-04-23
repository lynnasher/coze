/**
 * 题目导入工具函数
 * 用于处理 JSON/Excel 导入时的题目解析
 */

import type { Question, QuestionType } from './types';

// 类型映射
const typeMap: Record<number, QuestionType> = {
  1: 'single',
  2: 'multiple',
  3: 'true-false',
  4: 'fill-blank',
  5: 'comprehensive',
};

// 生成唯一ID
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 检测题型
export function detectQuestionType(qType: unknown): QuestionType {
  if (typeof qType === 'number') {
    return typeMap[qType] || 'single';
  } else if (typeof qType === 'string') {
    const t = qType.toLowerCase().trim();
    if (t === 'single') return 'single';
    else if (t === 'multiple') return 'multiple';
    else if (t === 'true-false' || t === 'truefalse' || t === 'judge') return 'true-false';
    else if (t === 'fill-blank' || t === 'fillblank' || t === 'fill' || t === 'short') return 'fill-blank';
    else if (t === 'comprehensive') return 'comprehensive';
    else if (t.includes('多选')) return 'multiple';
    else if (t.includes('判断')) return 'true-false';
    else if (t.includes('填空') || t.includes('简答') || t.includes('问答')) return 'fill-blank';
    else if (t.includes('综合') || t.includes('案例')) return 'comprehensive';
    return 'single';
  }
  return 'single';
}

// 处理选项
export function processOptions(q: Record<string, unknown>): { id: string; text: string }[] | undefined {
  const isExportFormat = !!q.stem;

  if (isExportFormat) {
    const opts: { id: string; text: string }[] = [];
    if (q.optiona) opts.push({ id: 'a', text: String(q.optiona) });
    if (q.optionb) opts.push({ id: 'b', text: String(q.optionb) });
    if (q.optionc) opts.push({ id: 'c', text: String(q.optionc) });
    if (q.optiond) opts.push({ id: 'd', text: String(q.optiond) });
    return opts.length > 0 ? opts : undefined;
  } else {
    const qOptions = q.options;
    if (qOptions && typeof qOptions === 'object') {
      if (Array.isArray(qOptions)) {
        return qOptions as { id: string; text: string }[];
      } else {
        return Object.entries(qOptions).map(([key, val]) => ({
          id: key.toLowerCase(),
          text: String(val),
        })).sort((a, b) => a.id.localeCompare(b.id));
      }
    }
  }
  return undefined;
}

// 处理子题目选项
export function processChildOptions(child: Record<string, unknown>): { id: string; text: string }[] | undefined {
  const childIsExportFormat = !!child.stem;
  if (childIsExportFormat) {
    const opts: { id: string; text: string }[] = [];
    if (child.optiona) opts.push({ id: 'a', text: String(child.optiona) });
    if (child.optionb) opts.push({ id: 'b', text: String(child.optionb) });
    if (child.optionc) opts.push({ id: 'c', text: String(child.optionc) });
    if (child.optiond) opts.push({ id: 'd', text: String(child.optiond) });
    return opts.length > 0 ? opts : undefined;
  } else {
    const childQOptions = child.options;
    if (childQOptions && typeof childQOptions === 'object') {
      if (Array.isArray(childQOptions)) {
        return childQOptions as { id: string; text: string }[];
      } else {
        return Object.entries(childQOptions).map(([key, val]) => ({
          id: key.toLowerCase(),
          text: String(val),
        })).sort((a, b) => a.id.localeCompare(b.id));
      }
    }
  }
  return undefined;
}

// 处理答案（根据题目类型正确处理）
export function processAnswer(q: Record<string, unknown>, questionType: QuestionType = 'single'): string | string[] {
  let answer: string | string[] = 'a';
  const qAnswer = q.answer || q.ans;
  if (qAnswer) {
    if (typeof qAnswer === 'string') {
      const ans = qAnswer.trim().toLowerCase();

      // 根据题目类型决定答案格式
      if (questionType === 'fill-blank') {
        // 填空题：答案保持为完整字符串，不拆分
        answer = ans;
      } else if (questionType === 'multiple') {
        // 多选题：可能是 "AB" 或 ["A", "B"] 格式
        if (ans.length > 1 && /^[a-z]+$/i.test(ans)) {
          // 纯字母字符串如 "AB" 拆分为数组
          answer = ans.split('').map(c => c.toLowerCase());
        } else {
          answer = ans;
        }
      } else if (questionType === 'true-false') {
        // 判断题：标准化为 true/false
        if (ans === 'true' || ans === 't' || ans === '对' || ans === '正确' || ans === '√') {
          answer = 'true';
        } else {
          answer = 'false';
        }
      } else {
        // 单选题：保持单字符
        answer = ans;
      }
    } else if (Array.isArray(qAnswer)) {
      answer = qAnswer as string[];
    }
  }
  return answer;
}

// 处理子题目答案
export function processChildAnswer(child: Record<string, unknown>, childType: QuestionType = 'single'): string | string[] {
  let answer: string | string[] = 'a';
  const childQAnswer = child.answer || child.ans;
  if (childQAnswer) {
    if (typeof childQAnswer === 'string') {
      const ans = childQAnswer.trim().toLowerCase();

      // 根据子题类型决定答案格式
      if (childType === 'fill-blank') {
        // 填空题：答案保持为完整字符串
        answer = ans;
      } else if (childType === 'multiple') {
        // 多选题
        if (ans.length > 1 && /^[a-z]+$/i.test(ans)) {
          answer = ans.split('').map(c => c.toLowerCase());
        } else {
          answer = ans;
        }
      } else if (childType === 'true-false') {
        // 判断题
        if (ans === 'true' || ans === 't' || ans === '对' || ans === '正确' || ans === '√') {
          answer = 'true';
        } else {
          answer = 'false';
        }
      } else {
        // 单选题
        answer = ans;
      }
    } else if (Array.isArray(childQAnswer)) {
      answer = childQAnswer as string[];
    }
  }
  return answer;
}

// 处理子题目
export function processChildren(
  children: Record<string, unknown>[],
  parentId: string,
  bankId: string,
  generateIdFn: () => string = generateId
): Question[] {
  return children.map((child) => {
    const childContent = (child.question as string) || (child.content as string) || (child.stem as string) || '';
    const childQType = child.type || child.qtype;
    const childType = detectQuestionType(childQType);
    return {
      id: generateIdFn(),
      parentId: parentId,
      type: childType,
      content: childContent,
      options: processChildOptions(child),
      answer: processChildAnswer(child, childType),
      explanation: ((child.explanation as string) || (child.parsetext as string)) || undefined,
      difficulty: (child.difficulty as string) || 'medium',
      tags: [],
      bankId,
      createdAt: Date.now(),
    } as Question;
  }).filter(q => q.content);
}

// 处理单个题目
export function processQuestion(
  q: Record<string, unknown>,
  bankId: string,
  parentId?: string,
  generateIdFn: () => string = generateId
): Question | null {
  const qType = q.type || q.qtype;
  const questionType = detectQuestionType(qType);

  const options = processOptions(q);
  const answer = processAnswer(q, questionType);
  const questionId = generateIdFn();
  const content = (q.question as string) || (q.content as string) || (q.stem as string) || '';
  const explanation = (q.explanation as string) || (q.parsetext as string) || '';

  // 处理子题目
  let children: Question[] | undefined;
  if (q.children && Array.isArray(q.children)) {
    children = processChildren(q.children as Record<string, unknown>[], questionId, bankId, generateIdFn);
  }

  return {
    id: questionId,
    parentId,
    type: questionType,
    content,
    options,
    answer,
    explanation: explanation || undefined,
    difficulty: (q.difficulty as string) || 'medium',
    tags: (q.tags as string[]) || [],
    bankId,
    createdAt: Date.now(),
    children,
  } as Question;
}

/**
 * 将嵌套的综合题（包含子题）扁平化处理
 * @param questions 原始题目数组（可能包含带 children 的综合题）
 * @param bankId 题库ID
 * @returns 扁平化后的题目数组
 */
export function flattenQuestions(
  questions: unknown[],
  bankId: string
): Question[] {
  const result: Question[] = [];

  for (const q of questions) {
    if (!q || typeof q !== 'object') continue;

    const question = q as Record<string, unknown>;
    
    // 处理综合题的子题
    const rawChildren = question.children;
    let processedChildren: Question[] | undefined;
    
    if (Array.isArray(rawChildren) && rawChildren.length > 0) {
      processedChildren = rawChildren.map((child, index) => {
        const childObj = child as Record<string, unknown>;
        const childType = detectQuestionType(childObj.type);
        return {
          id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_child_${index}`,
          parentId: String(question.id || `temp_${index}`),
          type: childType,
          content: String(childObj.content || childObj.question || ''),
          options: childType === 'fill-blank' ? undefined : processChildOptions(childObj),
          answer: processChildAnswer(childObj, childType),
          explanation: String(childObj.explanation || childObj.analysis || ''),
          difficulty: 'medium',
          tags: [],
          bankId,
          createdAt: Date.now(),
        } as Question;
      });
    }

    // 处理父题
    const questionType = detectQuestionType(question.type);
    const processedQuestion: Question = {
      id: String(question.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
      type: questionType,
      content: String(question.content || question.question || ''),
      options: questionType === 'fill-blank' ? undefined : processOptions(question),
      answer: processAnswer(question, questionType),
      explanation: String(question.explanation || question.analysis || ''),
      difficulty: (question.difficulty === 'easy' || question.difficulty === 'hard') ? question.difficulty : 'medium',
      tags: Array.isArray(question.tags) ? question.tags as string[] : [],
      bankId,
      caseBackground: question.caseBackground ? String(question.caseBackground) : undefined,
      createdAt: Date.now(),
      children: processedChildren,
    };

    result.push(processedQuestion);
  }

  return result;
}
