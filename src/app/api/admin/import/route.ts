import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';

// 解析 Word 文档（使用 mammoth.js 格式）
async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

// 解析 PDF 文档
async function parsePdf(buffer: ArrayBuffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(Buffer.from(buffer));
  return data.text;
}

interface ParsedOption {
  id: string;
  text: string;
}

interface ParsedQuestion {
  type: string;
  content: string;
  options?: ParsedOption[];
  answer: string | string[];
  explanation?: string;
  difficulty: string;
  tags: string[];
  createdAt: number;
}

// 解析题目文本
function parseQuestions(text: string): { questions: ParsedQuestion[]; bankName: string } {
  const questions: ParsedQuestion[] = [];

  // 清理文本
  let cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/↵/g, '\n');

  // 移除页眉页脚
  cleanText = cleanText.replace(/第\s*\d+\s*页/gi, '');
  cleanText = cleanText.replace(/^\s*\d+\s*\/.*$/gm, '');

  // 按空行分割题目块
  const blocks = cleanText.split(/\n\s*\n/);

  let currentQuestion: {
    type: string;
    content: string;
    options: ParsedOption[];
    answer: string | string[];
    explanation?: string;
    difficulty: string;
    tags: string[];
  } | null = null;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // 检测是否为新题目
    const questionMatch = trimmed.match(/^[\d一二三四五六七八九十]+[.、)）]\s*([\s\S]+)/);
    
    if (questionMatch) {
      // 保存上一题
      if (currentQuestion && currentQuestion.content && currentQuestion.answer) {
        questions.push({
          ...currentQuestion,
          type: currentQuestion.type || detectQuestionType(currentQuestion),
          createdAt: Date.now()
        });
      }

      // 开始新题目
      currentQuestion = {
        type: 'single',
        content: questionMatch[1].trim(),
        options: [],
        answer: '',
        difficulty: 'medium',
        tags: []
      };
      continue;
    }

    // 处理选项
    const optionMatch = trimmed.match(/^([A-D])[.、)）]\s*([\s\S]+)/);
    if (optionMatch && currentQuestion) {
      currentQuestion.options.push({
        id: optionMatch[1],
        text: optionMatch[2].replace(/\n/g, ' ').trim()
      });
      continue;
    }

    // 处理答案
    const answerMatch = trimmed.match(/^正确答案[：:]\s*([A-Da-d]+)/);
    if (answerMatch && currentQuestion) {
      currentQuestion.answer = answerMatch[1].toUpperCase();
      continue;
    }

    // 处理多选题答案
    const multiAnswerMatch = trimmed.match(/^正确答案[：:]\s*([A-Da-d,，]+)/);
    if (multiAnswerMatch && currentQuestion) {
      const answers = multiAnswerMatch[1]
        .split(/[,，]/)
        .map((a: string) => a.trim().toUpperCase())
        .filter((a: string) => a);
      currentQuestion.answer = answers;
      if (answers.length > 1) {
        currentQuestion.type = 'multiple';
      }
      continue;
    }

    // 处理解析
    const explanationMatch = trimmed.match(/^(名师解析|答案解析|解析)[：:]\s*([\s\S]+)/);
    if (explanationMatch && currentQuestion) {
      currentQuestion.explanation = explanationMatch[2].trim();
      continue;
    }

    // 判断题识别
    const trueFalseMatch = trimmed.match(/^[对错][.、)）]\s*(.+)/);
    if (trueFalseMatch) {
      if (currentQuestion && currentQuestion.content && currentQuestion.answer) {
        questions.push({
          ...currentQuestion,
          type: currentQuestion.type || detectQuestionType(currentQuestion),
          createdAt: Date.now()
        });
      }
      currentQuestion = {
        type: 'true-false',
        content: trueFalseMatch[1].trim(),
        options: [],
        answer: trimmed.startsWith('对') ? 'true' : 'false',
        difficulty: 'medium',
        tags: []
      };
      questions.push({
        ...currentQuestion,
        createdAt: Date.now()
      });
      currentQuestion = null;
      continue;
    }

    // 追加内容到当前题目
    if (currentQuestion && !currentQuestion.answer) {
      currentQuestion.content += ' ' + trimmed;
    }
  }

  // 保存最后一题
  if (currentQuestion && currentQuestion.content && currentQuestion.answer) {
    questions.push({
      ...currentQuestion,
      type: currentQuestion.type || detectQuestionType(currentQuestion),
      createdAt: Date.now()
    });
  }

  // 生成题库名称
  const bankName = `题库_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`;

  return { questions, bankName };
}

// 检测题型
function detectQuestionType(question: { options?: ParsedOption[]; answer: string | string[] }): string {
  if (!question.options || question.options.length === 0) {
    return 'fill-blank';
  }

  if (Array.isArray(question.answer) && question.answer.length > 1) {
    return 'multiple';
  }

  if (question.answer === 'true' || question.answer === 'false') {
    return 'true-false';
  }

  return 'single';
}

// 生成 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// POST - 导入题库
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    let text = '';
    const fileName = file.name.replace(/\.(docx|pdf)$/i, '');

    // 根据文件类型解析
    if (file.name.toLowerCase().endsWith('.docx')) {
      text = await parseDocx(buffer);
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
      text = await parsePdf(buffer);
    } else {
      return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 });
    }

    // 解析题目
    const { questions: parsedQuestions, bankName } = parseQuestions(text);

    if (parsedQuestions.length === 0) {
      return NextResponse.json(
        { error: '未能解析出题目，请检查文件格式' },
        { status: 400 }
      );
    }

    // 生成题目 ID
    const questionsWithIds = parsedQuestions.map(q => ({
      ...q,
      id: generateId()
    }));

    // 创建题库到数据库
    const newBank = await bankService.createBank(
      bankName,
      `从 ${fileName} 导入`,
      file.name
    );

    // 保存题目到数据库
    const questionCount = await bankService.createQuestions(questionsWithIds, newBank.id);

    // 在客户端环境下同步保存到 localStorage（兼容前端）
    if (typeof window !== 'undefined') {
      const existingQuestions = JSON.parse(localStorage.getItem('questions') || '[]');
      const existingBanks = JSON.parse(localStorage.getItem('questionBanks') || '[]');

      const localBank = {
        id: newBank.id,
        name: newBank.name,
        description: `从 ${fileName} 导入`,
        sourceFile: file.name,
        questionIds: questionsWithIds.map(q => q.id),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      localStorage.setItem('questions', JSON.stringify([...existingQuestions, ...questionsWithIds]));
      localStorage.setItem('questionBanks', JSON.stringify([...existingBanks, localBank]));
    }

    return NextResponse.json({
      success: true,
      count: questionCount,
      bankId: newBank.id,
      bankName: newBank.name
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: '导入失败，请检查文件格式' },
      { status: 500 }
    );
  }
}
