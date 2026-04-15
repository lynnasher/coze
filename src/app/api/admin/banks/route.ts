import { NextResponse } from 'next/server';
import { bankService } from '@/lib/services/bank-service';

// 验证管理员 token
function verifyToken(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

// GET - 获取所有题库
export async function GET() {
  try {
    // 从数据库获取题库
    const banks = await bankService.getAllBanks();
    return NextResponse.json({ banks });
  } catch (error) {
    console.error('Failed to get banks:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST - 获取题库统计
export async function POST(request: Request) {
  try {
    if (!verifyToken(request)) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const stats = await bankService.getStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Failed to get stats:', error);
    return NextResponse.json({ error: '获取统计失败' }, { status: 500 });
  }
}
