import { S3Storage } from 'coze-coding-dev-sdk';

// 初始化存储客户端
const getStorage = () => {
  return new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    bucketName: process.env.COZE_BUCKET_NAME,
    region: 'cn-beijing',
  });
};

// 判断是否为对象存储的 key（需要在显示时转换为签名 URL）
function isObjectStorageKey(url: string): boolean {
  // 跳过已经是完整 URL 的
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return false;
  }
  // 跳过 data URL 和相对路径
  if (url.startsWith('data:') || url.startsWith('/')) {
    return false;
  }
  return true;
}

// 提取文本中的所有图片 URL
export function extractImageUrls(text: string): string[] {
  if (!text) return [];
  const urls: string[] = [];
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = htmlImgRegex.exec(text)) !== null) {
    if (match[1]) urls.push(match[1]);
  }
  while ((match = mdImgRegex.exec(text)) !== null) {
    if (match[2]) urls.push(match[2]);
  }
  return [...new Set(urls)];
}

// 将文本中的图片 key 转换为签名 URL
export async function convertImageKeysToUrls(text: string, expireTime: number = 3600): Promise<string> {
  if (!text) return text;
  
  const storage = getStorage();
  const bucketEndpoint = process.env.COZE_BUCKET_ENDPOINT_URL || '';
  let result = text;
  
  const urls = extractImageUrls(text);
  for (const url of urls) {
    // 检查是否需要转换（是 key 而不是完整 URL）
    if (isObjectStorageKey(url)) {
      try {
        const signedUrl = await storage.generatePresignedUrl({ key: url, expireTime });
        result = result.replace(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), signedUrl);
      } catch (error) {
        console.error(`[ImageUtils] Failed to generate URL for key: ${url}`, error);
      }
    }
  }
  
  return result;
}

// 将对象中的图片 key 转换为签名 URL
export async function convertQuestionImageKeys(
  question: {
    content?: string;
    options?: { id: string; text: string }[];
    explanation?: string;
    caseBackground?: string;
  },
  expireTime: number = 3600
): Promise<typeof question> {
  const result: typeof question = {};
  
  if (question.content) {
    result.content = await convertImageKeysToUrls(question.content, expireTime);
  }
  if (question.options) {
    result.options = await Promise.all(
      question.options.map(async (opt) => ({
        id: opt.id,
        text: await convertImageKeysToUrls(opt.text, expireTime),
      }))
    );
  }
  if (question.explanation) {
    result.explanation = await convertImageKeysToUrls(question.explanation, expireTime);
  }
  if (question.caseBackground) {
    result.caseBackground = await convertImageKeysToUrls(question.caseBackground, expireTime);
  }
  
  return result;
}
