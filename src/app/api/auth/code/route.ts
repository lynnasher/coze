import { NextResponse } from 'next/server';
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import OpenApi, * as $OpenApi from '@alicloud/openapi-client';

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

// 创建阿里云短信客户端
function createSmsClient(): Dysmsapi20170525 {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || '';
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || '';

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('阿里云短信配置缺失，请设置 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET 环境变量');
  }

  const config = new $OpenApi.Config({
    accessKeyId,
    accessKeySecret,
  });
  config.endpoint = 'dysmsapi.aliyuncs.com';

  return new Dysmsapi20170525(config);
}

// 发送短信验证码
async function sendSmsCode(phone: string, code: string): Promise<void> {
  const client = createSmsClient();

  const sendSmsRequest = new $Dysmsapi20170525.SendSmsRequest({
    phoneNumbers: phone,
    signName: process.env.ALIYUN_SMS_SIGN_NAME || '阿里云短信测试',
    templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_215071136',
    templateParam: JSON.stringify({ code }),
  });

  const response = await client.sendSms(sendSmsRequest);

  if (response.body.code !== 'OK') {
    throw new Error(`短信发送失败: ${response.body.message}`);
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
      
      // 检查是否配置了阿里云短信
      const hasAliyunConfig = process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET;
      
      if (hasAliyunConfig) {
        // 生产环境：使用阿里云短信
        try {
          await sendSmsCode(phone, code);
          verificationCodes.set(phone, { code, expiresAt });
          return NextResponse.json({ 
            success: true, 
            message: '验证码已发送，请注意查收短信'
          });
        } catch (smsError) {
          console.error('[短信发送失败]', smsError);
          return NextResponse.json(
            { success: false, error: '短信发送失败，请稍后重试' },
            { status: 500 }
          );
        }
      } else {
        // 开发/测试环境：控制台输出验证码
        console.log(`[验证码] 手机号: ${phone}, 验证码: ${code}`);
        console.log('[提示] 如需使用真实短信，请配置阿里云短信环境变量');
        
        verificationCodes.set(phone, { code, expiresAt });
        return NextResponse.json({ 
          success: true, 
          message: '验证码已发送（测试模式）',
          testCode: code // 仅在未配置阿里云时返回，用于开发测试
        });
      }
    }
  } catch (error) {
    console.error('[验证码接口错误]', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
