import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { TOTP } from 'otpauth';

// 验证 2FA 代码（登录流程中使用）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tempToken, code } = body;

    if (!tempToken || !code) {
      return NextResponse.json(
        { error: '请提供临时令牌和验证码' },
        { status: 400 }
      );
    }

    // 验证临时令牌（JWT 格式：userId.exp.signature）
    const [payloadStr, signature] = tempToken.split('.');
    if (!payloadStr || !signature) {
      return NextResponse.json(
        { error: '无效的临时令牌' },
        { status: 400 }
      );
    }

    // 解码 payload
    let payload;
    try {
      payload = JSON.parse(Buffer.from(payloadStr, 'base64').toString());
    } catch {
      return NextResponse.json(
        { error: '无效的临时令牌' },
        { status: 400 }
      );
    }

    // 检查临时令牌是否过期（5分钟有效）
    if (Date.now() > payload.exp) {
      return NextResponse.json(
        { error: '登录会话已过期，请重新登录' },
        { status: 401 }
      );
    }

    const supabase = await getSupabaseClient();

    // 查询管理员信息
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('two_factor_secret, two_factor_enabled, two_factor_backup_codes')
      .eq('id', payload.userId)
      .single();

    if (error || !admin) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 如果没有启用 2FA，直接返回成功
    if (!admin.two_factor_enabled) {
      return NextResponse.json({
        success: true,
        need2FA: false,
      });
    }

    // 检查是否是备用码
    if (admin.two_factor_backup_codes?.includes(code.toUpperCase())) {
      // 从备用码列表中移除已使用的码
      const updatedCodes = admin.two_factor_backup_codes.filter(
        (c: string) => c !== code.toUpperCase()
      );
      await supabase
        .from('admin_users')
        .update({ two_factor_backup_codes: updatedCodes })
        .eq('id', payload.userId);

      return NextResponse.json({
        success: true,
        need2FA: true,
        verified: true,
        message: '使用备用码验证成功，建议重新生成备用码',
      });
    }

    // 验证 TOTP 代码
    if (!admin.two_factor_secret) {
      return NextResponse.json(
        { error: '2FA 配置错误' },
        { status: 500 }
      );
    }

    const totp = new TOTP({
      issuer: '押题100',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: admin.two_factor_secret,
    });

    // 验证代码（允许前后 1 个时间窗口的偏移）
    const isValid = totp.validate({ token: code, window: 1 }) !== null;

    if (!isValid) {
      return NextResponse.json(
        { error: '验证码错误，请重试' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      need2FA: true,
      verified: true,
    });
  } catch (error) {
    console.error('2FA 验证错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
