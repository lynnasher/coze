import { NextResponse } from 'next/server';

// 简单的管理员认证
// 在生产环境中应该使用数据库和加密密码
const ADMIN_CREDENTIALS = {
  username: 'admin',
  // 实际生产中应该使用哈希密码
  password: 'admin123'
};

// 生成简单的 token（实际生产中应使用 JWT）
function generateToken(user: { username: string }): string {
  const payload = {
    username: user.username,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24小时后过期
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: '请提供用户名和密码' },
        { status: 400 }
      );
    }

    // 验证凭据
    if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    const token = generateToken({ username });
    
    return NextResponse.json({
      success: true,
      token,
      user: { username, role: 'admin' }
    });
  } catch (error) {
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
