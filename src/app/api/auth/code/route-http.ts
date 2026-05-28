import { NextResponse } from 'next/server';
import crypto from 'crypto';

// 验证码存储
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

/**
 * 生成随机验证码
 */
function generateCode(length: number = 6): string {
  return Math.random().toString().slice(2, 2 + length);
}

/**
 * 使用 HTTP 直接调用阿里云号码认证服务
 */
async function sendSmsVerifyCodeHttp(
  phone: string,
  code: string
): Promise<{ success: boolean; message: string; requestId?: string }> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || '速通互联验证码';
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || '100001';

  if (!accessKeyId || !accessKeySecret) {
    return { success: false, message: '阿里云配置缺失' };
  }

  // 特殊URL编码（阿里云要求）
  function percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
      .replace(/%20/g, '%20')
      .replace(/%2F/g, '%2F')
      .replace(/%3A/g, '%3A');
  }

  // 构建请求参数（不包含 Signature）
  const params: Record<string, string> = {
    Action: 'SendSmsVerifyCode',
    Version: '2017-05-25',
    Format: 'JSON',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    RegionId: 'cn-hangzhou',
    PhoneNumber: phone,
    SignName: signName,
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code: code, min: '5' }),
  };

  // 按键排序
  const sortedKeys = Object.keys(params).sort();
  const canonicalQueryString = sortedKeys
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  // 构建签名字符串（POST 方法）
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonicalQueryString)}`;
  const signKey = `${accessKeySecret}&`;
  const signature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('base64');

  // 添加签名到参数
  params.Signature = signature;

  // 构建表单数据
  const formData = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    formData.append(key, value);
  });

  console.log('[号码认证HTTP] 请求参数:', Object.fromEntries(formData.entries()));

  try {
    const response = await fetch('https://dypnsapi.aliyuncs.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: formData.toString(),
    });

    const data = await response.json();
    console.log('[号码认证HTTP] 响应:', JSON.stringify(data, null, 2));

    if (data.Code === 'OK') {
      return {
        success: true,
        message: '短信发送成功',
        requestId: data.RequestId || data.Model?.RequestId,
      };
    } else {
      return {
        success: false,
        message: data.Message || `发送失败: ${data.Code}`,
        requestId: data.RequestId,
      };
    }
  } catch (error) {
    console.error('[号码认证HTTP] 请求异常:', error);
    return {
      success: false,
      message: `请求异常: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ success: false, message: '手机号不能为空' }, { status: 400 });
    }

    // 生成验证码
    const code = generateCode(6);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟过期

    // 存储验证码
    verificationCodes.set(phone, { code, expiresAt });

    console.log(`[HTTP模式] 手机号: ${phone} 验证码: ${code}`);

    // 发送短信
    const result = await sendSmsVerifyCodeHttp(phone, code);

    if (!result.success) {
      console.log(`[HTTP模式] 发送失败: ${result.message}`);
      // 降级到测试模式
      return NextResponse.json({
        success: true,
        message: '验证码已发送（测试模式）',
        testCode: code,
      });
    }

    return NextResponse.json({
      success: true,
      message: '验证码已发送',
    });
  } catch (error) {
    console.error('[HTTP模式] 异常:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}
