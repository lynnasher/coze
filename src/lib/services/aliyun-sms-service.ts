import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import { $OpenApiUtil } from '@alicloud/openapi-core';
import * as $tea from '@alicloud/tea-util';

type Config = $OpenApiUtil.Config;

// 阿里云配置
const ALIYUN_ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID || '';
const ALIYUN_ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
const ALIYUN_SMS_SIGN_NAME = process.env.ALIYUN_SMS_SIGN_NAME || '阿里云短信测试';
const ALIYUN_SMS_TEMPLATE_CODE = process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_154950909';

// 验证码缓存（用于存储已发送的验证码，供校验使用）
const verifyCodeCache = new Map<string, { code: string; expireAt: number }>();

/**
 * 创建阿里云短信服务客户端
 */
function createClient(): Dysmsapi20170525 {
  const config = new $OpenApiUtil.Config({
    accessKeyId: ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: ALIYUN_ACCESS_KEY_SECRET,
  });
  // 短信服务接入地址
  config.endpoint = 'dysmsapi.aliyuncs.com';
  return new Dysmsapi20170525(config);
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
    const mockCode = Math.random().toString().slice(2, 8);  // 6位随机数字
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
    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 存储验证码供后续校验
    verifyCodeCache.set(phoneNumber, {
      code,
      expireAt: Date.now() + 5 * 60 * 1000,
    });

    const client = createClient();
    const request = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phoneNumber,
      signName: ALIYUN_SMS_SIGN_NAME,
      templateCode: ALIYUN_SMS_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code, min: '5' }),  // 模板变量：验证码和有效期(分钟)
    });

    const response = await client.sendSms(request);
    
    if (response.statusCode === 200 && response.body?.code === 'OK') {
      console.log(`[AliyunSMS] 验证码发送成功: ${phoneNumber}, Code=${response.body.code}`);
      return {
        success: true,
        codeId: response.body?.bizId || `real_${Date.now()}`,
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

  // 使用本地缓存的验证码校验（阿里云短信服务不支持服务端校验，需自行校验）
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
  
  // 验证成功，删除验证码
  verifyCodeCache.delete(phoneNumber);
  console.log(`[AliyunSMS] 验证码校验通过: ${phoneNumber}`);
  return { success: true };
}
