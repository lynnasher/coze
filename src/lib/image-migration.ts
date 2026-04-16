import { S3Storage } from 'coze-coding-dev-sdk';

// 初始化存储客户端
const getStorage = () => {
  return new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    bucketName: process.env.COZE_BUCKET_NAME,
    region: 'cn-beijing',
  });
};

// 获取年月文件夹路径
function getYearMonthPath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `upload/${year}/${month}`;
}

// 从文本中提取所有图片 URL
export function extractImageUrls(text: string): string[] {
  const urls: string[] = [];
  
  // HTML img 标签
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = htmlImgRegex.exec(text)) !== null) {
    if (match[1] && !match[1].startsWith('data:')) {
      urls.push(match[1]);
    }
  }
  
  // Markdown 图片
  const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = mdImgRegex.exec(text)) !== null) {
    if (match[2] && !match[2].startsWith('data:')) {
      urls.push(match[2]);
    }
  }
  
  return [...new Set(urls)]; // 去重
}

// 迁移文本中的图片到对象存储
export async function migrateImagesInText(text: string): Promise<string> {
  if (!text) return text;
  
  const urls = extractImageUrls(text);
  if (urls.length === 0) return text;
  
  let result = text;
  const storage = getStorage();
  
  for (const originalUrl of urls) {
    try {
      // 跳过已经是对象存储的 URL 或 data URL 或相对路径
      if (originalUrl.includes(process.env.COZE_BUCKET_ENDPOINT_URL || '') || 
          originalUrl.startsWith('data:') ||
          originalUrl.startsWith('/')) {
        continue;
      }
      
      // 从 URL 下载并上传到对象存储，返回的 key 包含 UUID 前缀
      const key = await storage.uploadFromUrl({
        url: originalUrl,
        timeout: 30000,
      });
      
      // 替换文本中的 URL 为新的对象存储路径
      result = result.replace(new RegExp(escapeRegExp(originalUrl), 'g'), key);
      
      console.log(`[ImageMigration] Uploaded: ${originalUrl} -> ${key}`);
    } catch (error) {
      console.error(`[ImageMigration] Failed to upload image: ${originalUrl}`, error);
      // 失败时保留原 URL
    }
  }
  
  return result;
}

// 转义正则表达式特殊字符
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 处理题目数据中的图片
export async function migrateQuestionImages(question: {
  content?: string;
  options?: { id: string; text: string }[];
  explanation?: string;
  caseBackground?: string;
}): Promise<{
  content?: string;
  options?: { id: string; text: string }[];
  explanation?: string;
  caseBackground?: string;
}> {
  const result: typeof question = {};
  
  if (question.content) {
    result.content = await migrateImagesInText(question.content);
  }
  
  if (question.options) {
    result.options = await Promise.all(
      question.options.map(async (opt) => ({
        id: opt.id,
        text: await migrateImagesInText(opt.text),
      }))
    );
  }
  
  if (question.explanation) {
    result.explanation = await migrateImagesInText(question.explanation);
  }
  
  if (question.caseBackground) {
    result.caseBackground = await migrateImagesInText(question.caseBackground);
  }
  
  return result;
}
