/**
 * 题目处理共享工具模块
 * 统一前后台和API的题目解析、答案判断等逻辑
 */

import { QuestionType, Question, Difficulty } from './types';

// ==================== 题型识别 ====================

/** 题型编号映射 */
export const typeMap: Record<number, QuestionType> = {
  1: 'single',
  2: 'multiple',
  3: 'true-false',
  4: 'fill-blank',
  5: 'comprehensive',
};

/**
 * 检测题型（从各种格式中统一识别）
 */
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

// ==================== 答案处理 ====================

/**
 * 处理答案（根据题目类型正确处理，避免填空题答案被错误拆分）
 */
export function processAnswer(q: Record<string, unknown>, questionType: QuestionType = 'single'): string | string[] {
  let answer: string | string[] = 'a';
  const qAnswer = q.answer || q.ans;
  if (qAnswer) {
    if (typeof qAnswer === 'string') {
      answer = normalizeAnswer(qAnswer, questionType);
    } else if (Array.isArray(qAnswer)) {
      answer = qAnswer as string[];
    }
  }
  return answer;
}

/**
 * 标准化答案字符串（根据题型决定是否拆分）
 */
export function normalizeAnswer(ansStr: string, questionType: QuestionType): string | string[] {
  const ans = ansStr.trim().toLowerCase();

  if (questionType === 'fill-blank') {
    // 填空题：答案保持为完整字符串，不拆分
    return ans;
  } else if (questionType === 'multiple') {
    // 多选题：纯字母字符串如 "AB" 拆分为数组
    if (ans.length > 1 && /^[a-z]+$/i.test(ans)) {
      return ans.split('').map(c => c.toLowerCase());
    }
    return ans;
  } else if (questionType === 'true-false') {
    // 判断题：标准化为 true/false
    if (ans === 'true' || ans === 't' || ans === '对' || ans === '正确' || ans === '√') {
      return 'true';
    }
    return 'false';
  }

  // 单选题：保持单字符
  return ans;
}

/**
 * 处理子题目答案（与 processAnswer 逻辑一致）
 */
export function processChildAnswer(child: Record<string, unknown>, childType: QuestionType = 'single'): string | string[] {
  return processAnswer(child, childType);
}

// ==================== 选项处理 ====================

/**
 * 处理选项（支持多种格式，包括 stem 导出格式的 optiona/optionb 字段）
 */
export function processOptions(q: Record<string, unknown>): { id: string; text: string }[] | undefined {
  // 优先检查 stem 导出格式 (optiona, optionb, optionc, optiond)
  const isExportFormat = !!q.stem;
  if (isExportFormat) {
    const opts: { id: string; text: string }[] = [];
    if (q.optiona) opts.push({ id: 'a', text: String(q.optiona) });
    if (q.optionb) opts.push({ id: 'b', text: String(q.optionb) });
    if (q.optionc) opts.push({ id: 'c', text: String(q.optionc) });
    if (q.optiond) opts.push({ id: 'd', text: String(q.optiond) });
    if (opts.length > 0) return opts;
  }

  const rawOptions = q.options || q.alternatives;

  if (Array.isArray(rawOptions)) {
    // 如果是数组格式
    return rawOptions.map((opt: Record<string, unknown>, i: number) => {
      if (typeof opt === 'string') {
        const id = String.fromCharCode(97 + i); // a, b, c, d
        return { id, text: opt };
      }
      return {
        id: (opt.id as string) || String.fromCharCode(97 + i),
        text: (opt.text as string) || (opt.content as string) || (opt.label as string) || '',
      };
    });
  }

  // 如果是对象格式 {A: "选项A", B: "选项B"}
  if (rawOptions && typeof rawOptions === 'object') {
    const result: { id: string; text: string }[] = [];
    const optionKeys = Object.keys(rawOptions).sort();
    for (const key of optionKeys) {
      const val = (rawOptions as Record<string, unknown>)[key];
      if (typeof val === 'string') {
        result.push({ id: key.toLowerCase(), text: val });
      } else if (typeof val === 'object' && val !== null) {
        result.push({
          id: key.toLowerCase(),
          text: ((val as Record<string, unknown>).text as string) || ((val as Record<string, unknown>).content as string) || '',
        });
      }
    }
    if (result.length > 0) return result;
  }

  // 从 A/B/C/D 字段提取
  const optionFields = ['A', 'B', 'C', 'D', 'E', 'F', 'a', 'b', 'c', 'd', 'e', 'f'];
  const extracted: { id: string; text: string }[] = [];
  for (const field of optionFields) {
    const val = q[field];
    if (val && typeof val === 'string') {
      extracted.push({ id: field.toLowerCase(), text: val });
    }
  }
  if (extracted.length > 0) return extracted;

  return undefined;
}

/**
 * 处理子题目选项（与 processOptions 逻辑一致）
 */
export function processChildOptions(child: Record<string, unknown>): { id: string; text: string }[] | undefined {
  return processOptions(child);
}

// ==================== ID 生成 ====================

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

// ==================== 题目处理 ====================

/**
 * 处理子题目列表
 */
export function processChildren(children: Record<string, unknown>[], parentId: string, bankId: string): Question[] {
  return children.map((child) => {
    const childContent = (child.question as string) || (child.content as string) || (child.stem as string) || '';
    const childQType = child.type || child.qtype;
    const childType = detectQuestionType(childQType);
    return {
      id: generateId(),
      parentId: parentId,
      type: childType,
      content: childContent,
      options: processChildOptions(child),
      answer: processChildAnswer(child, childType),
      explanation: ((child.explanation as string) || (child.parsetext as string)) || undefined,
      difficulty: (child.difficulty as Difficulty) || 'medium',
      tags: [],
      bankId,
      createdAt: Date.now(),
      images: (child.images as string[]) || undefined,
    } as Question;
  }).filter(q => q.content);
}

/**
 * 处理单个题目
 */
export function processQuestion(q: Record<string, unknown>, bankId: string, parentId?: string): Question | null {
  const qType = q.type || q.qtype;
  const questionType = detectQuestionType(qType);
  
  const options = processOptions(q);
  const answer = processAnswer(q, questionType);
  const questionId = generateId();
  const content = (q.question as string) || (q.content as string) || (q.stem as string) || '';
  const explanation = (q.explanation as string) || (q.parsetext as string) || '';
  
  return {
    id: questionId,
    parentId,
    type: questionType,
    content,
    options,
    answer,
    explanation,
    difficulty: (q.difficulty as Difficulty) || 'medium',
    tags: (q.tags as string[]) || [],
    bankId,
    createdAt: Date.now(),
    images: (q.images as string[]) || undefined,
  };
}

// ==================== 答案判断 ====================

/**
 * 检查用户答案是否正确（统一判断逻辑）
 * 用于做题页面、答题卡、交卷统计等场景
 */
export function checkAnswerCorrect(question: Question, userAnswer: string | string[] | undefined): {
  isCorrect: boolean;
  isWrong: boolean;
  isUnanswered: boolean;
} {
  // 判断是否未答
  const isUnanswered = 
    userAnswer === undefined || 
    userAnswer === '' || 
    userAnswer === null ||
    (Array.isArray(userAnswer) && userAnswer.length === 0);

  if (isUnanswered) {
    return { isCorrect: false, isWrong: false, isUnanswered: true };
  }

  const correctAnswer = question.answer;

  // 填空题：精确匹配（区分大小写）
  if (question.type === 'fill-blank') {
    const isCorrect = String(userAnswer) === String(correctAnswer);
    return { isCorrect, isWrong: !isCorrect, isUnanswered: false };
  }

  // 多选题
  if (Array.isArray(correctAnswer)) {
    const userArr = Array.isArray(userAnswer) 
      ? userAnswer.map(a => String(a).toLowerCase()).sort()
      : [String(userAnswer).toLowerCase()];
    const correctArr = correctAnswer.map(a => String(a).toLowerCase()).sort();
    const isCorrect = userArr.length === correctArr.length && 
      userArr.every((a, i) => a === correctArr[i]);
    return { isCorrect, isWrong: !isCorrect, isUnanswered: false };
  }

  // 单选/判断题
  const isCorrect = String(userAnswer).toLowerCase() === String(correctAnswer).toLowerCase();
  return { isCorrect, isWrong: !isCorrect, isUnanswered: false };
}
