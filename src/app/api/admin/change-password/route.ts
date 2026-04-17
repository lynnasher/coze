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

    const admin = getAdminConfig();

    // 验证用户名
    if (admin.username !== username) {
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
    admin.password = newPassword;
    admin.isDefaultPassword = false;
    admin.lastChanged = Date.now();

    // 持久化保存
    const saved = saveAdminConfig(admin);
    if (!saved) {
      return NextResponse.json(
        { error: '密码保存失败，请重试' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '密码修改成功',
    });
  } catch (error) {
    console.error('修改密码错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
