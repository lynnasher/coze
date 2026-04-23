import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';
import { getStorage } from '@/lib/image-utils';
import { requireAdminAuth } from '@/lib/api-auth';
import {
  generateId,
  detectQuestionType,
  processOptions,
  processAnswer,
  processChildOptions,
  processChildAnswer,
  processChildren,
} from '@/lib/import-utils';

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

// 迁移单个图片 URL 到对象存储
async function migrateImageUrl(url: string): Promise<string> {
  const storage = getStorage();
  const bucketEndpoint = process.env.COZE_BUCKET_ENDPOINT_URL || '';
  
  // 跳过已经是对象存储的 URL 或 data URL 或相对路径
  if (url.includes(bucketEndpoint) || url.startsWith('data:') || url.startsWith('/')) {
    return url;
  }
  
  try {
    // 先下载图片内容，再上传到指定路径
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[ImageMigration] Failed to fetch: ${url}`);
      return url;
    }
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    // 从 URL 提取原始文件名
    const urlObj = new URL(url);
    const originalFileName = urlObj.pathname.split('/').pop() || 'image.jpg';
    // 构建目标路径
    const targetPath = `${getImagePath()}/${originalFileName}`;
    const key = await storage.uploadFile({
      fileContent: Buffer.from(buffer),
      fileName: targetPath,
      contentType,
    });
    console.log(`[ImageMigration] Uploaded: ${url} -> ${key}`);
    return key;
  } catch (error) {
    console.error(`[ImageMigration] Failed to upload: ${url}`, error);
    return url;
  }
}

// 迁移题目中的图片
async function migrateQuestionImages(question: {
  content?: string;
  options?: { id: string; text: string }[];
  explanation?: string;
  caseBackground?: string;
  images?: string[];
}) {
  const result: typeof question = {};
  
  // 处理 images 数组：将图片 URL 迁移到对象存储
  let migratedImages: string[] = [];
  if (question.images && question.images.length > 0) {
    migratedImages = await Promise.all(
      question.images.map(async (url) => {
        return await migrateImageUrl(url);
      })
    );
  }
  
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
  if (question.caseBackground) result.caseBackground = await migrateImagesInText(question.caseBackground);
  
  // 将迁移后的图片 URL 添加到 content 中
  if (migratedImages.length > 0) {
    const imagesHtml = migratedImages.map(url => `<img src="${url}" />`).join('\n');
    result.content = (result.content || '') + '\n\n' + imagesHtml;
  }
  
  return result;
}

// API 路由专用的 Question 类型（包含 images 字段）
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
  images?: string[];
}

// API 路由专用的 processChildren（支持 images 字段）
function apiProcessChildren(children: Record<string, unknown>[], parentId: string, bankId: string): Question[] {
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
      difficulty: (child.difficulty as string) || 'medium',
      tags: [],
      bankId,
      createdAt: Date.now(),
      images: (child.images as string[]) || undefined,
    } as Question;
  }).filter(q => q.content);
}

// 处理单个题目
function processQuestion(q: Record<string, unknown>, bankId: string, parentId?: string): Question | null {
  const isExportFormat = !!q.stem;
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
    difficulty: (q.difficulty as string) || 'medium',
    tags: (q.tags as string[]) || [],
    bankId,
    createdAt: Date.now(),
    images: (q.images as string[]) || undefined,
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
      const childQuestions = apiProcessChildren(children, questionId, bankId);
      
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

// POST - 导入 JSON 题目（需要管理员认证）
export async function POST(request: Request) {
  // 验证管理员认证
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

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
          images: q.images,
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
                images: child.images,
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
