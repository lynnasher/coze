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

// 判断题答案标准化辅助函数
// 判断题答案保持字母格式（a/b），与用户选择保持一致
function normalizeTrueFalseAnswer(
  ans: string,
  options?: { id: string; text: string }[]
): string {
  const normalizedAns = ans.toLowerCase().trim();
  
  // 如果答案已经是字母格式，直接返回
  if (/^[a-d]$/.test(normalizedAns)) {
    return normalizedAns;
  }
  
  // 如果答案是 true/false 相关关键词，需要根据选项映射回字母
  const isTrueAnswer = 
    normalizedAns === 'true' || normalizedAns === 't' || 
    normalizedAns === '对' || normalizedAns === '正确' || normalizedAns === '√' ||
    normalizedAns === '是' || normalizedAns === 'yes';
  
  const isFalseAnswer = 
    normalizedAns === 'false' || normalizedAns === 'f' || 
    normalizedAns === '错' || normalizedAns === '错误' || normalizedAns === '×' ||
    normalizedAns === '否' || normalizedAns === 'no';
  
  if (isTrueAnswer && options && options.length > 0) {
    // 查找"正确"对应的选项字母
    for (const opt of options) {
      const optText = opt.text.replace(/[。，、；：！？（）\s]/g, '').toLowerCase().trim();
      if (optText === '正确' || optText === '对' || optText === '√' || 
          optText === '是' || optText === 'yes' || optText === 'true') {
        return opt.id.toLowerCase();
      }
    }
    // 默认返回 'a'（通常 A 是正确）
    return 'a';
  }
  
  if (isFalseAnswer && options && options.length > 0) {
    // 查找"错误"对应的选项字母
    for (const opt of options) {
      const optText = opt.text.replace(/[。，、；：！？（）\s]/g, '').toLowerCase().trim();
      if (optText === '错误' || optText === '错' || optText === '×' || 
          optText === '否' || optText === 'no' || optText === 'false') {
        return opt.id.toLowerCase();
      }
    }
    // 默认返回 'b'（通常 B 是错误）
    return 'b';
  }
  
  // 无法识别时，默认返回 'a'
  return 'a';
}

// 处理答案（根据题目类型正确处理）
export function processAnswer(
  q: Record<string, unknown>, 
  questionType: QuestionType = 'single',
  options?: { id: string; text: string }[]
): string | string[] {
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
        // 保持答案大小写与选项 id 一致，检查选项 id 的大小写
        if (options && options.length > 0) {
          const firstOptionId = options[0]?.id || '';
          const useUpperCase = firstOptionId === firstOptionId.toUpperCase();
          if (ans.length > 1 && /^[a-z]+$/i.test(ans)) {
            // 纯字母字符串如 "AB" 拆分为数组，保持与选项 id 一致的大小写
            answer = useUpperCase 
              ? ans.split('').map(c => c.toUpperCase()) 
              : ans.split('').map(c => c.toLowerCase());
          } else {
            answer = useUpperCase ? ans.toUpperCase() : ans;
          }
        } else {
          // 没有选项信息时，保持大写
          if (ans.length > 1 && /^[a-z]+$/i.test(ans)) {
            answer = ans.split('').map(c => c.toUpperCase());
          } else {
            answer = ans;
          }
        }
      } else if (questionType === 'true-false') {
        // 判断题：保持字母格式（a/b），与用户选择保持一致
        answer = normalizeTrueFalseAnswer(ans, options);
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
export function processChildAnswer(
  child: Record<string, unknown>, 
  childType: QuestionType = 'single',
  options?: { id: string; text: string }[]
): string | string[] {
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
        // 保持答案大小写与选项 id 一致
        if (options && options.length > 0) {
          const firstOptionId = options[0]?.id || '';
          const useUpperCase = firstOptionId === firstOptionId.toUpperCase();
          if (ans.length > 1 && /^[a-z]+$/i.test(ans)) {
            answer = useUpperCase 
              ? ans.split('').map(c => c.toUpperCase()) 
              : ans.split('').map(c => c.toLowerCase());
          } else {
            answer = useUpperCase ? ans.toUpperCase() : ans;
          }
        } else {
          // 没有选项信息时，保持大写
          if (ans.length > 1 && /^[a-z]+$/i.test(ans)) {
            answer = ans.split('').map(c => c.toUpperCase());
          } else {
            answer = ans;
          }
        }
      } else if (childType === 'true-false') {
        // 判断题：保持字母格式（a/b）
        answer = normalizeTrueFalseAnswer(ans, options);
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
    const childOptions = processChildOptions(child);
    return {
      id: generateIdFn(),
      parentId: parentId,
      type: childType,
      content: childContent,
      options: childOptions,
      answer: processChildAnswer(child, childType, childOptions),
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
  const answer = processAnswer(q, questionType, options);
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
 * 检查答案是否正确（共享方法）
 * 用于统一答题校验逻辑
 */
export function checkAnswer(question: Question, selectedAnswer: string | string[] | undefined): boolean {
  if (!selectedAnswer) return false;
  
  if (Array.isArray(question.answer)) {
    // 正确答案本身是多选项
    if (Array.isArray(selectedAnswer)) {
      // 用户答案也是数组
      return (
        question.answer.length === selectedAnswer.length &&
        question.answer.every(a => selectedAnswer.includes(a))
      );
    }
    // 用户只选了一个但标准答案多选 → 错
    return false;
  }
  
  // 正确答案不是数组（单选/判断/填空）
  if (Array.isArray(selectedAnswer)) {
    // 用户选了多个但标准答案单选 → 错
    return selectedAnswer.length === 1 && selectedAnswer[0] === question.answer;
  }
  
  return selectedAnswer === question.answer;
}

/**
 * 扁平化处理题目（支持综合题）
 * 将包含子题的综合题转换为父题+子题的扁平结构
 */
export function flattenQuestions(questions: Record<string, unknown>[], bankId: string): Question[] {
  const result: Question[] = [];
  
  for (const q of questions) {
    const children = q.children as Record<string, unknown>[] | undefined;
    const hasChildren = Array.isArray(children) && children.length > 0;
    
    const qType = q.type || q.qtype;
    const isComprehensive = 
      (typeof qType === 'number' && qType === 5) ||
      (typeof qType === 'string' && (qType.toLowerCase().trim() === 'comprehensive' || qType.includes('综合') || qType.includes('案例')));
    
    if (hasChildren && isComprehensive) {
      // 综合题
      const questionId = generateId();
      const caseBackground = (q.question as string) || (q.content as string) || (q.stem as string) || '';
      const childQuestions = processChildren(children, questionId, bankId);
      
      const comprehensiveQuestion: Question = {
        id: questionId,
        parentId: undefined,
        type: 'comprehensive',
        content: '',
        caseBackground,
        children: childQuestions,
        options: undefined,
        answer: '',
        explanation: '',
        difficulty: 'medium',
        tags: [],
        bankId,
        createdAt: Date.now(),
      };
      
      result.push(comprehensiveQuestion);
    } else {
      const processed = processQuestion(q, bankId);
      if (processed) {
        result.push(processed);
      }
    }
  }
  
  return result;
}
