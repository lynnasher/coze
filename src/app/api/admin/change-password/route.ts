import { NextResponse } from 'next/server';

// 管理员凭据存储（与 login/route.ts 共享）
interface AdminCredential {
  password: string;
  isDefaultPassword: boolean;
  lastChanged?: number;
}

const adminCredentials: Record<string, AdminCredential> = {
  admin: {
    password: 'admin123',
    isDefaultPassword: true,
  },
};

// 验证密码强度（至少8位，包含大小写字母和数字）
function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码长度至少8位' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码需包含小写字母' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码需包含大写字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码需包含数字' };
  }
  return { valid: true };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, oldPassword, newPassword } = body;

    // 验证请求参数
    if (!username || !oldPassword || !newPassword) {
      return NextResponse.json(
        { error: '请提供完整的参数' },
        { status: 400 }
      );
    }

    const admin = adminCredentials[username];
    if (!admin) {
      return NextResponse.json(
        { error: '管理员不存在' },
        { status: 404 }
      );
    }

    // 验证旧密码
    if (admin.password !== oldPassword) {
      return NextResponse.json(
        { error: '当前密码错误' },
        { status: 401 }
      );
    }

    // 验证新密码强度
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 }
      );
    }

    // 更新密码
    adminCredentials[username].password = newPassword;
    adminCredentials[username].isDefaultPassword = false;
    adminCredentials[username].lastChanged = Date.now();

    return NextResponse.json({
      success: true,
      message: '密码修改成功',
    });
  } catch (error) {
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
