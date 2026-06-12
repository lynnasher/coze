import { NextResponse } from 'next/server';

// 验证码存储（内存，token → { code, expiresAt }）
const captchaStore = new Map<string, { code: string; expiresAt: number }>();

// 定期清理过期验证码
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of captchaStore) {
    if (now > data.expiresAt) captchaStore.delete(token);
  }
}, 60_000);

// 生成随机 token
function generateToken(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

// 生成验证码字符
const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
function generateCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

/**
 * GET /api/admin/captcha - 生成验证码
 * 返回 { token, code } - token 用于后续校验，code 用于前端渲染
 */
export async function GET() {
  const code = generateCode(4);
  const token = generateToken();
  captchaStore.set(token, {
    code: code.toLowerCase(),
    expiresAt: Date.now() + 5 * 60 * 1000, // 5分钟过期
  });

  return NextResponse.json({ token, code });
}

/**
 * 校验验证码（供 login 路由调用）
 * @returns true 表示验证通过
 */
export function verifyCaptchaToken(token: string, input: string): boolean {
  const data = captchaStore.get(token);
  if (!data) return false;
  if (Date.now() > data.expiresAt) {
    captchaStore.delete(token);
    return false;
  }
  // 验证后立即删除，防止重复使用
  captchaStore.delete(token);
  return input.toLowerCase().trim() === data.code;
}
