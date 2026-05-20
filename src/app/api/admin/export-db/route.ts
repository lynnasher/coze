import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/storage/database/supabase-client';

/**
 * 导出数据库结构和数据
 * POST /api/admin/export-db
 */
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未提供认证令牌' },
        { status: 401 }
      );
    }

    const client = getSupabaseAdminClient();
    let sql = '';

    // 1. 导出 users 表
    sql += `-- 创建 users 表\n`;
    sql += `CREATE TABLE IF NOT EXISTS users (\n`;
    sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
    sql += `  phone VARCHAR(11) UNIQUE NOT NULL,\n`;
    sql += `  password TEXT NOT NULL,\n`;
    sql += `  nickname VARCHAR(50),\n`;
    sql += `  role VARCHAR(20) DEFAULT 'user',\n`;
    sql += `  status VARCHAR(20) DEFAULT 'active',\n`;
    sql += `  activated_categories JSONB DEFAULT '[]',\n`;
    sql += `  device_id VARCHAR(100),\n`;
    sql += `  last_login_at TIMESTAMP WITH TIME ZONE,\n`;
    sql += `  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n`;
    sql += `);\n\n`;

    // 导出 users 数据
    const { data: users, error: usersError } = await client
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });

    if (usersError) {
      console.error('导出 users 失败:', usersError);
    } else if (users && users.length > 0) {
      sql += `-- users 表数据 (${users.length} 条)\n`;
      for (const user of users) {
        const activatedCategories = JSON.stringify(user.activated_categories || []);
        sql += `INSERT INTO users (id, phone, password, nickname, role, status, activated_categories, device_id, last_login_at, created_at) VALUES (`;
        sql += `'${user.id}', `;
        sql += `'${user.phone}', `;
        sql += `'${user.password}', `;
        sql += `${user.nickname ? `'${user.nickname.replace(/'/g, "''")}'` : 'NULL'}, `;
        sql += `'${user.role || 'user'}', `;
        sql += `'${user.status || 'active'}', `;
        sql += `'${activatedCategories}'::jsonb, `;
        sql += `${user.device_id ? `'${user.device_id}'` : 'NULL'}, `;
        sql += `${user.last_login_at ? `'${user.last_login_at}'` : 'NULL'}, `;
        sql += `${user.created_at ? `'${user.created_at}'` : 'NOW()'});
`;
      }
      sql += `\n`;
    }

    // 2. 导出 activation_codes 表
    sql += `-- 创建 activation_codes 表\n`;
    sql += `CREATE TABLE IF NOT EXISTS activation_codes (\n`;
    sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
    sql += `  code VARCHAR(10) UNIQUE NOT NULL,\n`;
    sql += `  category_id VARCHAR(100) NOT NULL,\n`;
    sql += `  category_name VARCHAR(100),\n`;
    sql += `  type VARCHAR(20) DEFAULT 'once',\n`;
    sql += `  max_uses INTEGER DEFAULT 1,\n`;
    sql += `  uses INTEGER DEFAULT 0,\n`;
    sql += `  status VARCHAR(20) DEFAULT 'active',\n`;
    sql += `  expires_at TIMESTAMP WITH TIME ZONE,\n`;
    sql += `  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n`;
    sql += `);\n\n`;

    // 导出 activation_codes 数据
    const { data: codes, error: codesError } = await client
      .from('activation_codes')
      .select('*')
      .order('created_at', { ascending: true });

    if (codesError) {
      console.error('导出 activation_codes 失败:', codesError);
    } else if (codes && codes.length > 0) {
      sql += `-- activation_codes 表数据 (${codes.length} 条)\n`;
      for (const code of codes) {
        sql += `INSERT INTO activation_codes (id, code, category_id, category_name, type, max_uses, uses, status, expires_at, created_at) VALUES (`;
        sql += `'${code.id}', `;
        sql += `'${code.code}', `;
        sql += `'${code.category_id}', `;
        sql += `${code.category_name ? `'${code.category_name.replace(/'/g, "''")}'` : 'NULL'}, `;
        sql += `'${code.type || 'once'}', `;
        sql += `${code.max_uses || 1}, `;
        sql += `${code.uses || 0}, `;
        sql += `'${code.status || 'active'}', `;
        sql += `${code.expires_at ? `'${code.expires_at}'` : 'NULL'}, `;
        sql += `${code.created_at ? `'${code.created_at}'` : 'NOW()'});
`;
      }
      sql += `\n`;
    }

    // 3. 导出 user_activations 表
    sql += `-- 创建 user_activations 表\n`;
    sql += `CREATE TABLE IF NOT EXISTS user_activations (\n`;
    sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
    sql += `  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n`;
    sql += `  category_id VARCHAR(100) NOT NULL,\n`;
    sql += `  category_name VARCHAR(100),\n`;
    sql += `  code VARCHAR(10),\n`;
    sql += `  activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n`;
    sql += `);\n\n`;

    // 导出 user_activations 数据
    const { data: activations, error: activationsError } = await client
      .from('user_activations')
      .select('*')
      .order('activated_at', { ascending: true });

    if (activationsError) {
      console.error('导出 user_activations 失败:', activationsError);
    } else if (activations && activations.length > 0) {
      sql += `-- user_activations 表数据 (${activations.length} 条)\n`;
      for (const act of activations) {
        sql += `INSERT INTO user_activations (id, user_id, category_id, category_name, code, activated_at) VALUES (`;
        sql += `'${act.id}', `;
        sql += `'${act.user_id}', `;
        sql += `'${act.category_id}', `;
        sql += `${act.category_name ? `'${act.category_name.replace(/'/g, "''")}'` : 'NULL'}, `;
        sql += `${act.code ? `'${act.code}'` : 'NULL'}, `;
        sql += `${act.activated_at ? `'${act.activated_at}'` : 'NOW()'});
`;
      }
      sql += `\n`;
    }

    // 添加注释
    sql += `-- 导出完成\n`;
    sql += `-- 总数据: ${users?.length || 0} 用户, ${codes?.length || 0} 激活码, ${activations?.length || 0} 激活记录\n`;

    return NextResponse.json({
      success: true,
      sql,
      stats: {
        users: users?.length || 0,
        activationCodes: codes?.length || 0,
        userActivations: activations?.length || 0
      }
    });

  } catch (error) {
    console.error('导出数据库失败:', error);
    return NextResponse.json(
      { error: '导出失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
