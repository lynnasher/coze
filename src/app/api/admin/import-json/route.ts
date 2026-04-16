import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';
import { migrateQuestionImages } from '@/lib/image-migration';

// 生成 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

type QuestionType = 'single' | 'multiple' | 'true-false' | 'fill-blank' | 'comprehensive';

interface Question {
  id: string;
  parentId?: string;
  type: QuestionType;
  content: string;
  options?: { id: string; text: string }[];
  answer: string | string[];
  explanation?: string;
  difficulty: string;
  tags: string[];
  bankId?: string;
  createdAt: number;
  caseBackground?: string;
  children?: Question[];
}

// 类型映射
const typeMap: Record<number, QuestionType> = {
  1: 'single',
  2: 'multiple',
  3: 'true-false',
  4: 'fill-blank',
  5: 'comprehensive',
};

// 检测题型
function detectQuestionType(qType: unknown): QuestionType {
  if (typeof qType === 'number') {
    return typeMap[qType] || 'single';
  } else if (typeof qType === 'string') {
    const t = qType.toLowerCase().trim();
    if (t === 'single') return 'single';
    else if (t === 'multiple') return 'multiple';
    else if (t === 'true-false' || t === 'truefalse' || t === 'judge') return 'true-false';
    else if (t === 'fill-blank' || t === 'fillblank' || t === 'fill') return 'fill-blank';
    else if (t === 'comprehensive') return 'comprehensive';
    else if (t.includes('多选')) return 'multiple';
    else if (t.includes('判断')) return 'true-false';
    else if (t.includes('填空')) return 'fill-blank';
    else if (t.includes('综合') || t.includes('案例')) return 'comprehensive';
    return 'single';
  }
  return 'single';
}

// 处理选项
function processOptions(q: Record<string, unknown>): { id: string; text: string }[] | undefined {
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

// 处理答案
function processAnswer(q: Record<string, unknown>): string | string[] {
  let answer: string | string[] = 'a';
  const qAnswer = q.answer || q.ans;
  if (qAnswer) {
    if (typeof qAnswer === 'string') {
      const ans = qAnswer.trim().toLowerCase();
      if (ans.length > 1) {
        answer = ans.split('');
      } else {
        answer = ans;
      }
    } else if (Array.isArray(qAnswer)) {
      answer = qAnswer as string[];
    }
  }
  return answer;
}

// 处理子题目选项
function processChildOptions(child: Record<string, unknown>): { id: string; text: string }[] | undefined {
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

// 处理子题目答案
function processChildAnswer(child: Record<string, unknown>): string | string[] {
  let answer: string | string[] = 'a';
  const childQAnswer = child.answer || child.ans;
  if (childQAnswer) {
    if (typeof childQAnswer === 'string') {
      const ans = childQAnswer.trim().toLowerCase();
      if (ans.length > 1) {
        answer = ans.split('');
      } else {
        answer = ans;
      }
    } else if (Array.isArray(childQAnswer)) {
      answer = childQAnswer as string[];
    }
  }
  return answer;
}

// 处理子题目
function processChildren(children: Record<string, unknown>[], parentId: string, bankId: string): Question[] {
  return children.map((child) => {
    const childContent = (child.question as string) || (child.content as string) || (child.stem as string) || '';
    const childQType = child.type || child.qtype;
    return {
      id: generateId(),
      parentId: parentId,
      type: detectQuestionType(childQType),
      content: childContent,
      options: processChildOptions(child),
      answer: processChildAnswer(child),
      explanation: ((child.explanation as string) || (child.parsetext as string)) || undefined,
      difficulty: (child.difficulty as string) || 'medium',
      tags: [],
      bankId,
      createdAt: Date.now(),
    } as Question;
  }).filter(q => q.content);
}

// 处理单个题目
function processQuestion(q: Record<string, unknown>, bankId: string, parentId?: string): Question | null {
  const isExportFormat = !!q.stem;
  const qType = q.type || q.qtype;
  const questionType = detectQuestionType(qType);
  
  const options = processOptions(q);
  const answer = processAnswer(q);
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
    difficulty: (q.difficulty as string) || 'medium',
    tags: (q.tags as string[]) || [],
    bankId,
    createdAt: Date.now(),
  };
}

// 扁平化处理题目（支持综合题）
function flattenQuestions(questions: Record<string, unknown>[], bankId: string): Question[] {
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

// POST - 导入 JSON 题目
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { questions, bankName, categoryId } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: '请提供有效的题目数据' },
        { status: 400 }
      );
    }

    // 创建题库到数据库
    const newBank = await bankService.createBank(
      bankName || `题库_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`,
      '从 JSON 文件导入',
      undefined,
      categoryId
    );

    // 处理题目
    const processedQuestions = flattenQuestions(questions, newBank.id);

    if (processedQuestions.length === 0) {
      return NextResponse.json(
        { error: 'JSON 中没有有效的题目' },
        { status: 400 }
      );
    }

    // 迁移题目中的图片到对象存储
    const questionsWithMigratedImages = await Promise.all(
      processedQuestions.map(async (q) => {
        // 迁移主题目
        const migrated = await migrateQuestionImages({
          content: q.content,
          options: q.options,
          explanation: q.explanation,
          caseBackground: q.caseBackground,
        });

        // 迁移子题目（综合题）
        let migratedChildren: Question[] | undefined;
        if (q.children && q.children.length > 0) {
          migratedChildren = await Promise.all(
            q.children.map(async (child) => {
              const childMigrated = await migrateQuestionImages({
                content: child.content,
                options: child.options,
                explanation: child.explanation,
              });
              return {
                ...child,
                ...childMigrated,
              };
            })
          );
        }

        return {
          ...q,
          ...migrated,
          children: migratedChildren,
        };
      })
    );

    // 保存题目到数据库
    const questionCount = await bankService.createQuestions(questionsWithMigratedImages, newBank.id);

    // 在客户端环境下同步保存到 localStorage（兼容前端）
    if (typeof window !== 'undefined') {
      const existingQuestions = JSON.parse(localStorage.getItem('questions') || '[]');
      const existingBanks = JSON.parse(localStorage.getItem('questionBanks') || '[]');

      const localBank = {
        id: newBank.id,
        name: newBank.name,
        description: '从 JSON 文件导入',
        questionIds: questionsWithMigratedImages.map(q => q.id),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      localStorage.setItem('questions', JSON.stringify([...existingQuestions, ...questionsWithMigratedImages]));
      localStorage.setItem('questionBanks', JSON.stringify([...existingBanks, localBank]));
    }

    return NextResponse.json({
      success: true,
      count: questionCount,
      bankId: newBank.id,
      bankName: newBank.name
    });
  } catch (error) {
    console.error('JSON import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导入失败，请检查 JSON 格式是否正确' },
      { status: 500 }
    );
  }
}
