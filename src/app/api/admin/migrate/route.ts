import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';

/**
 * 数据库迁移接口
 * 用于执行数据库结构变更
 * POST /api/admin/migrate
 * Body: { operation: 'add_device_id' }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { operation } = body;

    if (operation === 'add_device_id') {
      // 添加 device_id 字段到 users 表
      const client = getSupabaseAdminClient();
      
      // 尝试使用 supabase-js 的 schema 方法添加字段
      // 注意：Supabase JS 客户端不直接支持 ALTER TABLE
      // 我们需要通过 raw SQL 或其他方式
      
      // 首先检查字段是否已存在
      const { error: checkError } = await client
        .from('users')
        .select('device_id')
        .limit(1);
      
      // 如果错误包含 "Could not find the 'device_id' column"，说明字段不存在
      if (checkError && checkError.message && checkError.message.includes("Could not find the 'device_id' column")) {
        // 字段不存在，需要通过其他方式添加
        // 返回手动操作指南
        return NextResponse.json({
          success: false,
          error: '数据库字段不存在',
          message: '请在 Supabase 控制台执行以下 SQL：',
          sql: `ALTER TABLE users ADD COLUMN device_id VARCHAR(100);
CREATE INDEX users_device_idx ON users(device_id);`,
          instructions: [
            '1. 登录 Supabase 控制台 (https://app.supabase.com)',
            '2. 选择你的项目',
            '3. 点击左侧 "SQL Editor"',
            '4. 创建 New query',
            '5. 粘贴上面的 SQL',
            '6. 点击 Run',
            '7. 刷新页面重试登录'
          ]
        }, { status: 400 });
      }
      
      // 如果没有错误，说明字段已存在
      if (!checkError) {
        return NextResponse.json({
          success: true,
          message: 'device_id 字段已存在'
        });
      }
      
      // 其他错误
      return NextResponse.json({
        success: false,
        error: checkError.message
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: false, 
      error: '未知的迁移操作' 
    }, { status: 400 });

  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * 获取迁移状态
 * GET /api/admin/migrate
 */
export async function GET() {
  try {
    const client = getSupabaseAdminClient();
    
    // 检查 device_id 字段是否存在
    const { error } = await client.from('users').select('device_id').limit(1);
    
    const deviceIdColumnExists = !error || !error.message.includes('device_id');

    return NextResponse.json({
      success: true,
      migrations: {
        device_id_column: deviceIdColumnExists
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
