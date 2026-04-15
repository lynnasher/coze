import { NextResponse } from 'next/server';

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

// 读取现有数据
function getData() {
  if (typeof window === 'undefined') {
    return { questions: [], banks: [] };
  }
  
  const questions = JSON.parse(localStorage.getItem('questions') || '[]');
  const banks = JSON.parse(localStorage.getItem('questionBanks') || '[]');
  return { questions, banks };
}

// 保存数据
function saveData(questions: unknown[], banks: unknown[]) {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('questions', JSON.stringify(questions));
  localStorage.setItem('questionBanks', JSON.stringify(banks));
}

// 生成 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// GET - 获取所有题库
export async function GET() {
  try {
    const { banks } = getData();
    return NextResponse.json({ banks });
  } catch (error) {
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
