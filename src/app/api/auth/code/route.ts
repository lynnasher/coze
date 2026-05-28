import { NextResponse } from 'next/server';
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import Dypnsapi20170525, * as $Dypnsapi20170525 from '@alicloud/dypnsapi20170525';
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

// 创建阿里云短信客户端（普通短信服务）
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

// 创建号码认证客户端（号码认证服务）
function createPnsClient(): Dypnsapi20170525 {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || '';
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || '';

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('阿里云配置缺失，请设置 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET 环境变量');
  }

  const config = new $OpenApi.Config({
    accessKeyId,
    accessKeySecret,
  });
  // 号码认证服务的 endpoint
  config.endpoint = 'dypnsapi.aliyuncs.com';

  return new Dypnsapi20170525(config);
}

// 发送短信验证码（使用号码认证服务）
async function sendSmsCode(phone: string, code: string): Promise<void> {
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_215071136';
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || '阿里云短信测试';

  console.log('[短信发送参数]', {
    phone,
    signName,
    templateCode,
    templateParam: JSON.stringify({ code, min: '5' }),
  });

  // 优先尝试使用号码认证服务发送短信
  try {
    const pnsClient = createPnsClient();

    // 号码认证服务的短信发送 API
    const request = new $Dypnsapi20170525.SendSmsVerificationCodeRequest({
      phoneNumber: phone,
      signName: signName,
      templateCode: templateCode,
      templateParam: JSON.stringify({ code, min: '5' }),
    });

    console.log('[号码认证服务] 发送短信...');
    const response = await pnsClient.sendSmsVerificationCode(request);

    console.log('[号码认证服务响应]', {
      code: response.body.code,
      message: response.body.message,
      requestId: response.body.requestId,
    });

    if (response.body.code === 'OK') {
      console.log('[号码认证服务] 短信发送成功');
      return;
    }

    // 如果号码认证服务失败，降级到普通短信服务
    console.log('[号码认证服务] 失败，尝试普通短信服务...');
    throw new Error(`号码认证服务失败: ${response.body.message}`);
  } catch (pnsError) {
    console.log('[号码认证服务错误]', pnsError);
    console.log('[降级] 使用普通短信服务...');

    // 使用普通短信服务
    const smsClient = createSmsClient();

    const sendSmsRequest = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phone,
      signName: signName,
      templateCode: templateCode,
      templateParam: JSON.stringify({ code, min: '5' }),
    });

    const response = await smsClient.sendSms(sendSmsRequest);

    console.log('[普通短信服务响应]', {
      code: response.body.code,
      message: response.body.message,
      requestId: response.body.requestId,
      bizId: response.body.bizId,
    });

    if (response.body.code !== 'OK') {
      console.error('[阿里云短信错误]', {
        code: response.body.code,
        message: response.body.message,
        requestId: response.body.requestId,
        templateCode,
        signName,
      });
      throw new Error(`短信发送失败: ${response.body.message}`);
    }
  }
}

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, message: '请输入正确的手机号码' },
        { status: 400 }
      );
    }

    // 清理过期验证码
    cleanExpiredCodes();

    // 生成验证码
    const code = generateCode();

    // 检查是否配置了阿里云
    const hasAliyunConfig = process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET;

    if (hasAliyunConfig) {
      try {
        await sendSmsCode(phone, code);
        console.log(`[阿里云短信] 发送成功: ${phone}, 验证码: ${code}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[阿里云短信错误]', errorMessage);

        // 降级到测试模式
        console.log(`[测试模式-降级] 手机号: ${phone}, 验证码: ${code}`);
        console.log('[提示] 阿里云短信配置可能有问题，已自动切换到测试模式');

        return NextResponse.json({
          success: true,
          message: '验证码已发送（测试模式）',
          testCode: code,
        });
      }
    } else {
      // 测试模式：直接返回验证码
      console.log(`[测试模式] 手机号: ${phone}, 验证码: ${code}`);
    }

    // 存储验证码（5分钟有效）
    verificationCodes.set(phone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return NextResponse.json({
      success: true,
      message: hasAliyunConfig ? '验证码已发送' : '验证码已发送（测试模式）',
      testCode: hasAliyunConfig ? undefined : code,
    });
  } catch (error) {
    console.error('发送验证码错误:', error);
    return NextResponse.json(
      { success: false, message: '发送失败，请稍后重试' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { phone, code } = await request.json();

    if (!phone || !code) {
      return NextResponse.json(
        { success: false, message: '请输入手机号和验证码' },
        { status: 400 }
      );
    }

    const record = verificationCodes.get(phone);

    if (!record) {
      return NextResponse.json(
        { success: false, message: '验证码已过期，请重新获取' },
        { status: 400 }
      );
    }

    if (record.expiresAt < Date.now()) {
      verificationCodes.delete(phone);
      return NextResponse.json(
        { success: false, message: '验证码已过期，请重新获取' },
        { status: 400 }
      );
    }

    if (record.code !== code) {
      return NextResponse.json(
        { success: false, message: '验证码错误' },
        { status: 400 }
      );
    }

    // 验证成功，删除验证码
    verificationCodes.delete(phone);

    return NextResponse.json({
      success: true,
      message: '验证成功',
    });
  } catch (error) {
    console.error('验证验证码错误:', error);
    return NextResponse.json(
      { success: false, message: '验证失败，请稍后重试' },
      { status: 500 }
    );
  }
}
