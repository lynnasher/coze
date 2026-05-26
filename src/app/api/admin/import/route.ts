import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';
import { getStorage } from '@/lib/image-utils';
import { requireAdminAuth } from '@/lib/api-auth';

// 转义正则表达式特殊字符
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 从文本中提取所有图片 URL
function extractImageUrls(text: string): string[] {
  const urls: string[] = [];
  // HTML img 标签
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  // Markdown 图片
  const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  // 自定义格式 [img:url]
  const customImgRegex = /\[img:([^\]]+)\]/gi;
  let match;
  while ((match = htmlImgRegex.exec(text)) !== null) {
    if (match[1] && !match[1].startsWith('data:')) urls.push(match[1]);
  }
  while ((match = mdImgRegex.exec(text)) !== null) {
    if (match[2] && !match[2].startsWith('data:')) urls.push(match[2]);
  }
  while ((match = customImgRegex.exec(text)) !== null) {
    if (match[1] && !match[1].startsWith('data:')) urls.push(match[1]);
  }
  return [...new Set(urls)];
}

// 将 [img:url] 格式转换为 <img> 标签
function convertCustomImgTags(text: string): string {
  return text.replace(/\[img:([^\]]+)\]/gi, '<img src="$1" />');
}

// 迁移文本中的图片到对象存储
async function migrateImagesInText(text: string): Promise<string> {
  if (!text) return text;
  // 先将 [img:url] 格式转换为 <img> 标签
  text = convertCustomImgTags(text);
  const urls = extractImageUrls(text);
  if (urls.length === 0) return text;
  
  let result = text;
  const storage = getStorage();
  const bucketEndpoint = process.env.COZE_BUCKET_ENDPOINT_URL || '';
  
  for (const originalUrl of urls) {
    try {
      if (originalUrl.includes(bucketEndpoint) || 
          originalUrl.startsWith('data:') ||
          originalUrl.startsWith('/')) {
        continue;
      }
      // 先下载图片内容，再上传到指定路径
      const response = await fetch(originalUrl);
      if (!response.ok) {
        console.error(`[ImageMigration] Failed to fetch: ${originalUrl}`);
        continue;
      }
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      // 从 URL 提取原始文件名
      const urlObj = new URL(originalUrl);
      const originalFileName = urlObj.pathname.split('/').pop() || 'image.jpg';
      // 构建目标路径
      const targetPath = `${getImagePath()}/${originalFileName}`;
      const key = await storage.uploadFile({
        fileContent: Buffer.from(buffer),
        fileName: targetPath,
        contentType,
      });
      result = result.replace(new RegExp(escapeRegExp(originalUrl), 'g'), key);
      console.log(`[ImageMigration] Uploaded: ${originalUrl} -> ${key}`);
    } catch (error) {
      console.error(`[ImageMigration] Failed to upload: ${originalUrl}`, error);
    }
  }
  return result;
}

// 获取图片存储路径（按年月）
function getImagePath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `upload/image/${year}-${month}-${day}`;
}

// 迁移题目中的图片
async function migrateQuestionImages(question: {
  content?: string;
  options?: { id: string; text: string }[];
  explanation?: string;
}) {
  const result: typeof question = {};
  if (question.content) result.content = await migrateImagesInText(question.content);
  if (question.options) {
    result.options = await Promise.all(
      question.options.map(async (opt) => ({
        id: opt.id,
        text: await migrateImagesInText(opt.text),
      }))
    );
  }
  if (question.explanation) result.explanation = await migrateImagesInText(question.explanation);
  return result;
}

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
    .replace(/↵/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n');  // 将 <br/> 或 <br> 转换为换行符

  // 将连续的换行符替换为单个换行符，并去除首尾空白
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

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

// POST - 导入题库（需要管理员认证）
export async function POST(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

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

    // 生成题目 ID 并类型转换
    const questionsWithIds = parsedQuestions.map(q => ({
      ...q,
      id: generateId(),
      type: q.type as 'single' | 'multiple' | 'true-false' | 'fill-blank' | 'comprehensive'
    }));

    // 迁移题目中的图片到对象存储
    const questionsWithMigratedImages = await Promise.all(
      questionsWithIds.map(async (q) => {
        const migrated = await migrateQuestionImages({
          content: q.content,
          options: q.options,
          explanation: q.explanation,
        });
        return {
          ...q,
          ...migrated,
        };
      })
    );

    // 创建题库到数据库
    const newBank = await bankService.createBank(
      bankName,
      `从 ${fileName} 导入`,
      file.name
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
        description: `从 ${fileName} 导入`,
        sourceFile: file.name,
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
    console.error('Import error:', error);
    return NextResponse.json(
      { error: '导入失败，请检查文件格式' },
      { status: 500 }
    );
  }
}
