import { S3Storage } from 'coze-coding-dev-sdk';

// 初始化存储客户端（单例复用，避免每次请求都创建新实例）
let _storage: S3Storage | null = null;
export const getStorage = () => {
  if (!_storage) {
    _storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }
  return _storage;
};

// ==================== 签名 URL 缓存 ====================
interface CachedSignedUrl {
  url: string;
  expiresAt: number;
}

// 内存缓存：key -> 签名 URL（服务端复用，避免重复调用 S3）
const signedUrlCache = new Map<string, CachedSignedUrl>();
// 缓存有效期：签名 URL 有效期1小时，提前10分钟过期以确保 URL 仍然有效
const CACHE_MARGIN_MS = 10 * 60 * 1000;
// 最大缓存条目数，防止内存泄漏
const MAX_CACHE_SIZE = 2000;

function getCachedSignedUrl(key: string): string | null {
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now() + CACHE_MARGIN_MS) {
    return cached.url;
  }
  if (cached) {
    signedUrlCache.delete(key);
  }
  return null;
}

function setCachedSignedUrl(key: string, url: string, expireTime: number): void {
  // LRU 淘汰：超过上限时删除最早的条目
  if (signedUrlCache.size >= MAX_CACHE_SIZE) {
    const firstKey = signedUrlCache.keys().next().value;
    if (firstKey) signedUrlCache.delete(firstKey);
  }
  signedUrlCache.set(key, {
    url,
    expiresAt: Date.now() + expireTime * 1000,
  });
}

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

// 将文本中的图片 key 转换为签名 URL（带缓存）
export async function convertImageKeysToUrls(text: string, expireTime: number = 3600): Promise<string> {
  if (!text) return text;
  
  const storage = getStorage();
  let result = text;
  
  const urls = extractImageUrls(text);
  // 批量处理：先检查缓存，只对未缓存的 key 生成签名
  const uncachedKeys: string[] = [];
  const cachedResults: Record<string, string> = {};
  
  for (const url of urls) {
    if (isObjectStorageKey(url)) {
      const cached = getCachedSignedUrl(url);
      if (cached) {
        cachedResults[url] = cached;
      } else {
        uncachedKeys.push(url);
      }
    }
  }
  
  // 并行生成未缓存的签名 URL
  if (uncachedKeys.length > 0) {
    const signedResults = await Promise.allSettled(
      uncachedKeys.map(async (key) => {
        const signedUrl = await storage.generatePresignedUrl({ key, expireTime });
        setCachedSignedUrl(key, signedUrl, expireTime);
        return { key, signedUrl };
      })
    );
    
    for (const res of signedResults) {
      if (res.status === 'fulfilled') {
        cachedResults[res.value.key] = res.value.signedUrl;
      } else {
        console.error(`[ImageUtils] Failed to generate URL for key`, res.reason);
      }
    }
  }
  
  // 替换文本中的 key 为签名 URL
  for (const [key, signedUrl] of Object.entries(cachedResults)) {
    result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), signedUrl);
  }
  
  return result;
}

// 将对象中的图片 key 转换为签名 URL（带缓存）
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
