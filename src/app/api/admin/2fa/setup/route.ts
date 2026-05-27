import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireAdminAuth } from '@/lib/api-auth';
import { TOTP } from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';

// 生成随机密钥
function generateSecret(): string {
  return crypto.randomBytes(20).toString('hex');
}

// 生成备用码
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

// 获取或创建 2FA 设置
export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const supabase = await getSupabaseClient();

    // 查询当前管理员的 2FA 状态
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('two_factor_enabled, two_factor_secret')
      .eq('id', auth.userId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: '获取 2FA 状态失败' },
        { status: 500 }
      );
    }

    // 如果已启用 2FA，只返回状态
    if (admin.two_factor_enabled) {
      return NextResponse.json({
        enabled: true,
        message: '二次验证已启用',
      });
    }

    // 生成新的密钥
    const secret = generateSecret();

    // 创建 TOTP 对象
    const totp = new TOTP({
      issuer: '押题100',
      label: auth.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret,
    });

    // 生成二维码 URL
    const qrCodeUrl = totp.toString();

    // 生成二维码图片
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    // 生成备用码
    const backupCodes = generateBackupCodes();

    // 临时存储密钥（未启用状态）
    await supabase
      .from('admin_users')
      .update({
        two_factor_secret: secret,
        two_factor_backup_codes: backupCodes,
      })
      .eq('id', auth.userId);

    return NextResponse.json({
      enabled: false,
      secret: secret,
      qrCode: qrCodeDataUrl,
      backupCodes: backupCodes,
      manualEntryKey: secret.toUpperCase().replace(/(.{4})/g, '$1 ').trim(),
    });
  } catch (error) {
    console.error('2FA 设置错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 验证并启用 2FA
export async function POST(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: '请输入6位验证码' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseClient();

    // 获取当前管理员的 2FA 密钥
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('two_factor_secret, two_factor_backup_codes')
      .eq('id', auth.userId)
      .single();

    if (error || !admin.two_factor_secret) {
      return NextResponse.json(
        { error: '请先获取 2FA 二维码' },
        { status: 400 }
      );
    }

    // 创建 TOTP 对象验证代码
    const totp = new TOTP({
      issuer: '押题100',
      label: auth.username,
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

    // 启用 2FA
    await supabase
      .from('admin_users')
      .update({ two_factor_enabled: true })
      .eq('id', auth.userId);

    return NextResponse.json({
      success: true,
      message: '二次验证已启用',
      backupCodes: admin.two_factor_backup_codes,
    });
  } catch (error) {
    console.error('2FA 启用错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 禁用 2FA
export async function DELETE(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: '请输入6位验证码' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseClient();

    // 获取当前管理员的 2FA 密钥
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('two_factor_secret')
      .eq('id', auth.userId)
      .single();

    if (error || !admin.two_factor_secret) {
      return NextResponse.json(
        { error: '未启用二次验证' },
        { status: 400 }
      );
    }

    // 创建 TOTP 对象验证代码
    const totp = new TOTP({
      issuer: '押题100',
      label: auth.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: admin.two_factor_secret,
    });

    // 验证代码
    const isValid = totp.validate({ token: code, window: 1 }) !== null;

    if (!isValid) {
      return NextResponse.json(
        { error: '验证码错误，请重试' },
        { status: 400 }
      );
    }

    // 禁用 2FA
    await supabase
      .from('admin_users')
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_backup_codes: null,
      })
      .eq('id', auth.userId);

    return NextResponse.json({
      success: true,
      message: '二次验证已禁用',
    });
  } catch (error) {
    console.error('2FA 禁用错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
