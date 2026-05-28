import { NextResponse } from 'next/server';
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import OpenApi, * as $OpenApi from '@alicloud/openapi-client';

// 验证码存储（生产环境应使用Redis）
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// 生成6位随机验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 创建短信客户端
function createSmsClient() {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || '';
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || '';

  console.log('[阿里云配置]', {
    hasAccessKeyId: !!accessKeyId,
    hasAccessKeySecret: !!accessKeySecret,
    accessKeyIdPrefix: accessKeyId ? accessKeyId.substring(0, 4) + '****' : '未配置',
  });

  const config = new $OpenApi.Config({
    accessKeyId,
    accessKeySecret,
  });
  config.endpoint = 'dysmsapi.aliyuncs.com';

  return new Dysmsapi20170525(config);
}

// 发送短信验证码
async function sendSmsCode(phone: string, code: string): Promise<void> {
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || '阿里云短信测试';
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_215071136';

  console.log('[短信发送参数]', {
    phone,
    signName,
    templateCode,
    templateParam: JSON.stringify({ code, min: '5' }),
  });

  const smsClient = createSmsClient();

  const sendSmsRequest = new $Dysmsapi20170525.SendSmsRequest({
    phoneNumbers: phone,
    signName: signName,
    templateCode: templateCode,
    templateParam: JSON.stringify({ code, min: '5' }),
  });

  console.log('[普通短信服务] 发送请求:', {
    phoneNumbers: phone,
    signName,
    templateCode,
  });

  try {
    const response = await smsClient.sendSms(sendSmsRequest);

    console.log('[普通短信服务响应]', {
      code: response.body.code,
      message: response.body.message,
      requestId: response.body.requestId,
      bizId: response.body.bizId,
    });

    if (response.body.code !== 'OK') {
      throw new Error(`短信发送失败: ${response.body.message}`);
    }

    console.log('[普通短信服务] 短信发送成功');
  } catch (error: unknown) {
    console.error('[短信发送异常]', error);
    if (error instanceof Error) {
      console.error('[短信发送异常详情]', {
        message: error.message,
        name: error.name,
      });
    }
    throw error;
  }
}

// 发送验证码接口
export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, message: '手机号格式不正确' },
        { status: 400 }
      );
    }

    // 生成验证码
    const code = generateCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟有效期

    // 存储验证码
    verificationCodes.set(phone, { code, expiresAt });

    console.log('[验证码生成]', { phone, code, expiresAt });

    // 发送短信
    try {
      await sendSmsCode(phone, code);
      return NextResponse.json({
        success: true,
        message: '验证码已发送',
      });
    } catch (smsError: unknown) {
      console.error('[短信发送失败]', smsError);

      // 如果配置了阿里云但发送失败，降级到测试模式
      if (process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET) {
        console.log('[降级] 阿里云短信发送失败，切换到测试模式');
      }

      // 测试模式：直接返回验证码
      console.log('[测试模式] 手机号:', phone, '验证码:', code);
      return NextResponse.json({
        success: true,
        message: '验证码已发送（测试模式）',
        testCode: code,
      });
    }
  } catch (error) {
    console.error('[发送验证码错误]', error);
    return NextResponse.json(
      { success: false, message: '发送失败，请稍后重试' },
      { status: 500 }
    );
  }
}

// 验证验证码（供注册接口使用）
export function verifyCode(phone: string, code: string): boolean {
  const record = verificationCodes.get(phone);

  if (!record) {
    return false;
  }

  if (Date.now() > record.expiresAt) {
    verificationCodes.delete(phone);
    return false;
  }

  if (record.code !== code) {
    return false;
  }

  // 验证成功后删除验证码
  verificationCodes.delete(phone);
  return true;
}

// 定期清理过期验证码
setInterval(() => {
  const now = Date.now();
  for (const [phone, record] of verificationCodes.entries()) {
    if (now > record.expiresAt) {
      verificationCodes.delete(phone);
    }
  }
}, 60 * 1000); // 每分钟清理一次
