import { NextResponse } from 'next/server';
import { userService } from '@/lib/services/user-service';

/**
 * 验证设备ID接口
 * 用于检查当前设备是否仍然有效（未被其他设备挤下线）
 * POST /api/auth/validate-device
 * Body: { userId: string, deviceId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, deviceId } = body;

    if (!userId || !deviceId) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少必要参数' 
      }, { status: 400 });
    }

    // 验证设备ID是否匹配
    const isValid = await userService.validateDevice(userId, deviceId);

    if (!isValid) {
      return NextResponse.json({ 
        success: false, 
        error: 'DEVICE_KICKED', // 设备被挤下线的特定错误码
        message: '您的账号已在其他设备登录' 
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      message: '设备验证通过'
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
