import { NextResponse } from 'next/server';
import { userService } from '@/lib/services/user-service';
import { sendSmsVerifyCode, checkSmsVerifyCode, isAliyunSmsConfigured } from '@/lib/services/aliyun-sms-service';

// 本地验证码存储（用于降级模式）
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
    const { phone, type, code, action } = body;

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的手机号' },
        { status: 400 }
      );
    }

    // ========== 发送验证码 ==========
    if (type === 'send') {
      // 注册时检查手机号是否已存在
      if (action === 'register') {
        const existingUser = await userService.findByPhone(phone);
        if (existingUser) {
          return NextResponse.json(
            { success: false, error: '该手机号已注册，请直接登录' },
            { status: 400 }
          );
        }
      }

      // 优先使用阿里云短信服务
      if (isAliyunSmsConfigured()) {
        console.log('[验证码] 使用阿里云短信服务发送');
        const result = await sendSmsVerifyCode(phone);
        if (result.success) {
          return NextResponse.json({
            success: true,
            message: '验证码已发送',
            provider: 'aliyun',
          });
        } else {
          // 阿里云发送失败，降级到本地验证码
          console.log('[验证码] 阿里云发送失败，降级到本地验证码:', result.error);
        }
      }

      // 本地验证码（降级模式）
      cleanExpiredCodes();
      const newCode = generateCode();
      verificationCodes.set(phone, {
        code: newCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5分钟过期
      });

      console.log(`[验证码] 本地验证码已生成: ${phone} -> ${newCode}`);

      return NextResponse.json({
        success: true,
        message: '验证码已发送',
        provider: 'local',
        // 开发环境返回验证码方便测试
        ...(process.env.NODE_ENV === 'development' && { debugCode: newCode }),
      });
    }

    // ========== 验证验证码 ==========
    if (type === 'verify') {
      if (!code) {
        return NextResponse.json(
          { success: false, error: '请输入验证码' },
          { status: 400 }
        );
      }

      // 优先使用阿里云短信服务验证
      if (isAliyunSmsConfigured()) {
        console.log('[验证码] 使用阿里云短信服务验证');
        const result = await checkSmsVerifyCode(phone, code);
        if (result.success) {
          return NextResponse.json({ success: true });
        }
        // 阿里云验证失败，继续尝试本地验证
        console.log('[验证码] 阿里云验证失败，尝试本地验证:', result.error);
      }

      // 本地验证码验证
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

      // 验证成功，删除验证码
      verificationCodes.delete(phone);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: '无效的操作类型' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[验证码] 处理异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
