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
      
      // 使用 SQL 添加字段
      const { error } = await client.rpc('exec_sql', {
        sql: `
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
          
          CREATE INDEX IF NOT EXISTS users_device_idx ON users(device_id);
        `
      });

      if (error) {
        // 如果 RPC 不存在，尝试直接执行
        const { error: alterError } = await client.from('users').select('device_id').limit(1);
        
        if (alterError && alterError.message.includes('device_id')) {
          // 字段不存在，需要添加
          // 由于 Supabase 不直接支持 ALTER TABLE，这里返回手动操作指南
          return NextResponse.json({
            success: false,
            error: '请手动在 Supabase 控制台执行以下 SQL：',
            sql: `
              ALTER TABLE users ADD COLUMN device_id VARCHAR(100);
              CREATE INDEX users_device_idx ON users(device_id);
            `
          }, { status: 400 });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'device_id 字段添加成功'
      });
    }

    if (operation === 'add_force_password_change') {
      // 添加 force_password_change 字段到 users 表
      const client = getSupabaseAdminClient();
      
      // 使用 SQL 添加字段
      const { error } = await client.rpc('exec_sql', {
        sql: `
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;
        `
      });

      if (error) {
        // 如果 RPC 不存在，尝试直接执行
        const { error: alterError } = await client.from('users').select('force_password_change').limit(1);
        
        if (alterError && alterError.message.includes('force_password_change')) {
          // 字段不存在，需要添加
          return NextResponse.json({
            success: false,
            error: '请手动在 Supabase 控制台执行以下 SQL：',
            sql: `ALTER TABLE users ADD COLUMN force_password_change BOOLEAN DEFAULT FALSE;`
          }, { status: 400 });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'force_password_change 字段添加成功'
      });
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
    const { error: deviceError } = await client.from('users').select('device_id').limit(1);
    const deviceIdColumnExists = !deviceError || !deviceError.message.includes('device_id');
    
    // 检查 force_password_change 字段是否存在
    const { error: forceError } = await client.from('users').select('force_password_change').limit(1);
    const forcePasswordChangeExists = !forceError || !forceError.message.includes('force_password_change');

    return NextResponse.json({
      success: true,
      migrations: {
        device_id_column: deviceIdColumnExists,
        force_password_change_column: forcePasswordChangeExists
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
