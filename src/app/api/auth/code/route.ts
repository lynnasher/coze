import { NextResponse } from 'next/server';
import { userService } from '@/lib/services/user-service';

// 验证码存储（生产环境应使用Redis）
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// 生成6位数字验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 清理过期验证码
function cleanExpiredCodes() {
  const now = Date.now();
  for (const [key, value] of verificationCodes.entries()) {
    if (value.expiresAt < now) {
      verificationCodes.delete(key);
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, type } = body;

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的手机号' },
        { status: 400 }
      );
    }

    if (type === 'verify') {
      // 验证验证码
      const { code } = body;
      const stored = verificationCodes.get(phone);
      
      if (!stored) {
        return NextResponse.json(
          { success: false, error: '请先获取验证码' },
          { status: 400 }
        );
      }
      
      if (stored.expiresAt < Date.now()) {
        verificationCodes.delete(phone);
        return NextResponse.json(
          { success: false, error: '验证码已过期，请重新获取' },
          { status: 400 }
        );
      }
      
      if (stored.code !== code) {
        return NextResponse.json(
          { success: false, error: '验证码错误' },
          { status: 400 }
        );
      }
      
      // 验证成功后删除验证码
      verificationCodes.delete(phone);
      return NextResponse.json({ success: true });
    } else {
      // 发送验证码
      const { action } = body; // 'register' | 'login' | undefined
      
      // 如果是注册操作，先检查手机号是否已存在
      if (action === 'register') {
        const existingUser = await userService.findByPhone(phone);
        if (existingUser) {
          return NextResponse.json(
            { success: false, error: '该手机号已注册，请直接登录' },
            { status: 400 }
          );
        }
      }
      
      cleanExpiredCodes();
      
      // 检查是否在60秒内重复获取
      const stored = verificationCodes.get(phone);
      if (stored && stored.expiresAt > Date.now() - 60000) {
        const remainingTime = Math.ceil((stored.expiresAt - Date.now() + 60000) / 1000);
        return NextResponse.json(
          { success: false, error: `请${remainingTime}秒后再试` },
          { status: 400 }
        );
      }
      
      const code = generateCode();
      // 验证码5分钟有效
      const expiresAt = Date.now() + 5 * 60 * 1000;
      
      verificationCodes.set(phone, { code, expiresAt });
      
      // 实际项目中这里应该调用短信服务发送验证码
      // 目前模拟发送，返回验证码用于测试
      console.log(`[验证码] 手机号: ${phone}, 验证码: ${code}`);
      
      return NextResponse.json({ 
        success: true, 
        message: '验证码已发送',
        // 测试模式下返回验证码，生产环境应删除
        testCode: code 
      });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
