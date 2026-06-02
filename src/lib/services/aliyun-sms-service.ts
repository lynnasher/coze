import Dypnsapi20170525, * as $Dypnsapi20170525 from '@alicloud/dypnsapi20170525';
import { $OpenApiUtil } from '@alicloud/openapi-core';
import * as $tea from '@alicloud/tea-util';

type Config = $OpenApiUtil.Config;

// 阿里云配置
const ALIYUN_ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID || '';
const ALIYUN_ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
const ALIYUN_SMS_SIGN_NAME = process.env.ALIYUN_SMS_SIGN_NAME || '阿里云短信测试';  // 预置签名
const ALIYUN_SMS_TEMPLATE_CODE = process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_154950909';  // 预置模板

// 验证码缓存（用于存储已发送的验证码，供校验使用）
const verifyCodeCache = new Map<string, { code: string; expireAt: number }>();

/**
 * 创建阿里云号码认证服务客户端
 */
function createClient(): Dypnsapi20170525 {
  const config = new $OpenApiUtil.Config({
    accessKeyId: ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: ALIYUN_ACCESS_KEY_SECRET,
  });
  // 接入地址
  config.endpoint = 'dypnsapi.aliyuncs.com';
  return new Dypnsapi20170525(config);
}

/**
 * 检查是否配置了阿里云短信服务
 */
export function isAliyunSmsConfigured(): boolean {
  return Boolean(ALIYUN_ACCESS_KEY_ID && ALIYUN_ACCESS_KEY_SECRET);
}

/**
 * 发送短信验证码
 * @param phoneNumber 手机号码
 * @returns 发送结果
 */
export async function sendSmsVerifyCode(phoneNumber: string): Promise<{
  success: boolean;
  codeId?: string;
  error?: string;
}> {
  // 如果未配置阿里云，使用模拟验证码
  if (!isAliyunSmsConfigured()) {
    console.log('[AliyunSMS] 未配置阿里云短信服务，使用模拟验证码');
    const mockCode = Math.random().toString().slice(2, 6);  // 4位随机数字
    verifyCodeCache.set(phoneNumber, {
      code: mockCode,
      expireAt: Date.now() + 5 * 60 * 1000,  // 5分钟过期
    });
    console.log(`[AliyunSMS] 模拟验证码已发送到 ${phoneNumber}: ${mockCode}`);
    return {
      success: true,
      codeId: `mock_${Date.now()}`,
    };
  }

  try {
    const client = createClient();
    const request = new $Dypnsapi20170525.SendSmsVerifyCodeRequest({
      phoneNumber,
      signName: ALIYUN_SMS_SIGN_NAME,
      templateCode: ALIYUN_SMS_TEMPLATE_CODE,
      templateParam: '{"code":"##code##","min":"5"}',  // 必填：验证码变量替换，min表示有效期(分钟)
      codeLength: 6,  // 验证码长度
      validTime: 300, // 有效期300秒
    });

    const response = await client.sendSmsVerifyCode(request);
    
    if (response.statusCode === 200 && response.body?.code === 'OK') {
      console.log(`[AliyunSMS] 验证码发送成功: ${phoneNumber}`);
      return {
        success: true,
        codeId: (response.body as any).model?.bizId || `real_${Date.now()}`,
      };
    } else {
      console.error('[AliyunSMS] 发送失败:', response.body);
      return {
        success: false,
        error: response.body?.message || '发送失败',
      };
    }
  } catch (error: any) {
    console.error('[AliyunSMS] 发送异常:', error.message || error);
    return {
      success: false,
      error: error.message || '发送失败',
    };
  }
}

/**
 * 校验短信验证码
 * @param phoneNumber 手机号码
 * @param verifyCode 验证码
 * @returns 校验结果
 */
export async function checkSmsVerifyCode(phoneNumber: string, verifyCode: string): Promise<{
  success: boolean;
  error?: string;
}> {
  // 如果未配置阿里云，使用模拟验证码校验
  if (!isAliyunSmsConfigured()) {
    console.log('[AliyunSMS] 使用模拟验证码校验');
    const cached = verifyCodeCache.get(phoneNumber);
    if (!cached) {
      return { success: false, error: '验证码已过期，请重新获取' };
    }
    if (cached.expireAt < Date.now()) {
      verifyCodeCache.delete(phoneNumber);
      return { success: false, error: '验证码已过期，请重新获取' };
    }
    if (cached.code !== verifyCode) {
      return { success: false, error: '验证码错误' };
    }
    verifyCodeCache.delete(phoneNumber);
    return { success: true };
  }

  try {
    const client = createClient();
    const request = new $Dypnsapi20170525.CheckSmsVerifyCodeRequest({
      phoneNumber,
      verifyCode,
      signName: ALIYUN_SMS_SIGN_NAME,
      templateCode: ALIYUN_SMS_TEMPLATE_CODE,
    });

    const response = await client.checkSmsVerifyCode(request);
    
    if (response.statusCode === 200 && response.body?.code === 'OK') {
      const verifyResult = (response.body as any).model?.verifyResult;
      const valid = verifyResult === 'PASS' || verifyResult === true || verifyResult === 'true';
      if (valid) {
        console.log(`[AliyunSMS] 验证码校验通过: ${phoneNumber}`);
        return { success: true };
      } else {
        return { success: false, error: '验证码错误' };
      }
    } else {
      console.error('[AliyunSMS] 校验失败:', response.body);
      return {
        success: false,
        error: response.body?.message || '校验失败',
      };
    }
  } catch (error: any) {
    console.error('[AliyunSMS] 校验异常:', error.message || error);
    return {
      success: false,
      error: error.message || '校验失败',
    };
  }
}
