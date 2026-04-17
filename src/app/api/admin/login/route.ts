import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'admin-config.json');

// 读取管理员配置
function getAdminConfig() {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // 配置文件不存在或读取失败，使用环境变量中的默认值
    return {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      isDefaultPassword: true,
      lastChanged: null,
    };
  }
}

// 保存管理员配置
function saveAdminConfig(config: any): boolean {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('保存管理员配置失败:', error);
    return false;
  }
}

// 生成 token
function generateToken(user: { username: string }): string {
  const payload = {
    username: user.username,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24小时后过期
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

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
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: '请提供用户名和密码' },
        { status: 400 }
      );
    }

    const admin = getAdminConfig();

    // 验证用户名
    if (admin.username !== username) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 验证密码
    if (admin.password !== password) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    const token = generateToken({ username });

    // 检查是否需要强制修改密码
    const needChangePassword = admin.isDefaultPassword;

    return NextResponse.json({
      success: true,
      token,
      user: { username, role: 'admin' },
      needChangePassword,
    });
  } catch (error) {
    console.error('登录错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 导出方法供其他路由使用
export { getAdminConfig, saveAdminConfig, validatePasswordStrength };
