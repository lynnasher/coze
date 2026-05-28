import { NextResponse } from 'next/server';
import Dypnsapi20170525, * as $Dypnsapi20170525 from '@alicloud/dypnsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';

// 验证码存储（生产环境应使用Redis）
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// 验证码有效期（5分钟）
const CODE_EXPIRY = 5 * 60 * 1000;

// 使用阿里云号码认证服务发送短信验证码
async function sendSmsCode(phone: string, code: string): Promise<string> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || '阿里云短信测试';
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_215071136';

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('阿里云短信配置不完整，请检查环境变量');
  }

  console.log('[号码认证服务请求参数]', {
    phone,
    signName,
    templateCode,
    accessKeyId: accessKeyId.substring(0, 4) + '****',
  });

  // 创建配置
  const config = new $OpenApi.Config({
    accessKeyId,
    accessKeySecret,
    endpoint: 'dypnsapi.aliyuncs.com',
  });

  // 创建客户端
  const client = new Dypnsapi20170525(config);

  // 构建请求参数
  const request = new $Dypnsapi20170525.SendSmsVerifyCodeRequest({
    phoneNumber: phone,
    signName: signName,
    templateCode: templateCode,
    templateParam: JSON.stringify({ code: '##code##', min: '5' }),
    returnVerifyCode: true,
    codeType: 1, // 纯数字
  });

  console.log('[号码认证服务] 发送请求...');

  let response;
  try {
    response = await client.sendSmsVerifyCode(request);
  } catch (apiError: unknown) {
    const errorDetail = apiError instanceof Error ? apiError.message : String(apiError);
    console.log('[号码认证服务] API调用异常:', errorDetail);
    if (apiError && typeof apiError === 'object' && 'data' in apiError) {
      console.log('[号码认证服务] 错误详情:', JSON.stringify((apiError as Record<string, unknown>).data, null, 2));
    }
    throw new Error(`号码认证服务API调用失败: ${errorDetail}`);
  }

  console.log('[号码认证服务响应] 完整响应:', JSON.stringify(response, null, 2));
  console.log('[号码认证服务响应]', {
    code: response.body?.code,
    message: response.body?.message,
    success: response.body?.success,
    requestId: response.body?.requestId,
    model: response.body?.model,
    verifyCode: response.body?.model?.verifyCode,
  });

  if (response.body?.code !== 'OK') {
    throw new Error(`短信发送失败: ${response.body?.message || '未知错误'}`);
  }

  // 从响应中获取系统生成的验证码
  const verifyCode = response.body?.model?.verifyCode;
  if (!verifyCode) {
    throw new Error('未返回验证码');
  }

  console.log('[号码认证服务] 短信发送成功，验证码:', verifyCode);
  return verifyCode;
}

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, message: '手机号格式不正确' },
        { status: 400 }
      );
    }

    // 生成6位数字验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 发送短信验证码
    let sentCode = code;
    try {
      sentCode = await sendSmsCode(phone, code);
      console.log(`[短信发送成功] 手机号: ${phone}`);
    } catch (smsError: unknown) {
      const errorMessage = smsError instanceof Error ? smsError.message : '短信发送失败';
      console.error('[阿里云短信错误]', errorMessage);

      // 阿里云短信发送失败，降级到测试模式
      console.log(`[测试模式-降级] 手机号: ${phone}, 验证码: ${code}`);
      console.log('[提示] 阿里云短信配置可能有问题，已自动切换到测试模式');
      // 使用系统生成的验证码
      sentCode = code;
    }

    // 存储验证码
    verificationCodes.set(phone, {
      code: sentCode,
      expiresAt: Date.now() + CODE_EXPIRY,
    });

    return NextResponse.json({
      success: true,
      message: '验证码已发送（测试模式）',
      testCode: sentCode, // 测试模式下返回验证码
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    return NextResponse.json(
      { success: false, message: '发送失败，请稍后重试' },
      { status: 500 }
    );
  }
}

// 验证验证码
export function verifyCode(phone: string, code: string): boolean {
  const record = verificationCodes.get(phone);
  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    verificationCodes.delete(phone);
    return false;
  }

  return record.code === code;
}
