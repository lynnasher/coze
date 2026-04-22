import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/image-utils';

/**
 * 获取对象存储图片的签名 URL
 * GET /api/image/signed-url?key=upload/image/xxx.jpg
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Missing key parameter' },
        { status: 400 }
      );
    }

    // 安全检查：防止目录遍历
    if (key.includes('..') || key.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid key format' },
        { status: 400 }
      );
    }

    const storage = getStorage();
    const signedUrl = await storage.generatePresignedUrl({ key, expireTime: 3600 }); // 1小时有效期

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error('Failed to get signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}
