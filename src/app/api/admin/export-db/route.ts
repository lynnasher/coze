import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '../../../../storage/database/supabase-client';

/**
 * 转义 SQL 字符串中的特殊字符
 */
function escapeSql(str: string): string {
  if (str === null || str === undefined) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

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

    // 解析请求体获取要导出的表
    // 注意：banks 和 questions 存储在 localStorage，不在数据库中
    let tables: string[] = ['users', 'activation_codes', 'user_activations', 'categories'];
    try {
      const body = await request.json();
      if (body.tables && Array.isArray(body.tables) && body.tables.length > 0) {
        tables = body.tables;
      }
    } catch {
      // 如果没有请求体或解析失败，使用默认全部表
    }

    const client = getSupabaseAdminClient();
    let sql = '';
    const stats: Record<string, number> = {};

    // 先查询数据库中实际存在的表
    let availableTables = tables;
    try {
      const { data: existingTables, error: tablesError } = await client
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

      if (tablesError) {
        console.error('查询表列表失败:', tablesError);
      } else {
        const dbTables = new Set(existingTables?.map(t => t.table_name) || []);
        console.log('数据库中存在的表:', Array.from(dbTables));
        // 过滤出实际存在的表
        availableTables = tables.filter(t => dbTables.has(t));
        console.log('可用的表:', availableTables);
      }
    } catch (schemaError) {
      console.error('查询 information_schema 失败:', schemaError);
      // 如果查询失败，使用请求的表列表继续尝试
    }

    // 1. 导出 users 表
    if (availableTables.includes('users')) {
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
    console.log('开始导出 users 表...');
    const { data: users, error: usersError } = await client
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });

    if (usersError) {
      console.error('导出 users 失败:', usersError);
      sql += `-- 导出 users 数据失败: ${usersError.message}\n\n`;
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
    } else {
      sql += `-- users 表暂无数据\n\n`;
    }
    stats['users'] = users?.length || 0;
    console.log(`users 表导出完成: ${stats['users']} 条记录`);
    } // end if (tables.includes('users'))

    // 2. 导出 activation_codes 表
    if (availableTables.includes('activation_codes')) {
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
    stats['activationCodes'] = codes?.length || 0;
    } // end if (tables.includes('activation_codes'))

    // 3. 导出 user_activations 表
    if (availableTables.includes('user_activations')) {
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
    stats['userActivations'] = activations?.length || 0;
    } // end if (tables.includes('user_activations'))

    // 4. 导出 categories 表
    if (availableTables.includes('categories')) {
    sql += `-- 创建 categories 表\n`;
    sql += `CREATE TABLE IF NOT EXISTS categories (\n`;
    sql += `  id VARCHAR(100) PRIMARY KEY,\n`;
    sql += `  name VARCHAR(100) NOT NULL,\n`;
    sql += `  color VARCHAR(20) DEFAULT 'blue',\n`;
    sql += `  order_num INTEGER DEFAULT 0,\n`;
    sql += `  parent_id VARCHAR(100),\n`;
    sql += `  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n`;
    sql += `);\n\n`;

    // 导出 categories 数据
    const { data: categories, error: categoriesError } = await client
      .from('categories')
      .select('*')
      .order('order', { ascending: true });

    if (categoriesError) {
      console.error('导出 categories 失败:', categoriesError);
    } else if (categories && categories.length > 0) {
      sql += `-- categories 表数据 (${categories.length} 条)\n`;
      for (const cat of categories) {
        sql += `INSERT INTO categories (id, name, color, order_num, parent_id, created_at) VALUES (`;
        sql += `'${cat.id}', `;
        sql += `'${cat.name.replace(/'/g, "''")}', `;
        sql += `'${cat.color || 'blue'}', `;
        sql += `${cat.order || 0}, `;
        sql += `${cat.parent_id ? `'${cat.parent_id}'` : 'NULL'}, `;
        sql += `${cat.created_at ? `'${cat.created_at}'` : 'NOW()'});
`;
      }
      sql += `\n`;
    }
    stats['categories'] = categories?.length || 0;
    } // end if (tables.includes('categories'))

    // 导出 admin_users 表
    if (tables.includes('admin_users')) {
      sql += `-- 导出 admin_users 表\n`;
      const { data: adminUsers, error: adminUsersError } = await client.from('admin_users').select('*');
      if (adminUsersError) {
        sql += `-- 导出 admin_users 失败: ${adminUsersError.message}\n`;
      } else if (adminUsers && adminUsers.length > 0) {
        sql += `TRUNCATE TABLE admin_users CASCADE;\n`;
        for (const user of adminUsers) {
          sql += `INSERT INTO admin_users (id, username, password, created_at, updated_at) VALUES (`;
          sql += `'${escapeSql(user.id)}', `;
          sql += `'${escapeSql(user.username)}', `;
          sql += `'${escapeSql(user.password)}', `;
          sql += `'${user.created_at}', `;
          sql += `'${user.updated_at}'`;
          sql += `);\n`;
        }
      }
      sql += `\n`;
      stats['admin_users'] = adminUsers?.length || 0;
    }

    // 导出 user_data 表
    if (tables.includes('user_data')) {
      sql += `-- 导出 user_data 表\n`;
      const { data: userData, error: userDataError } = await client.from('user_data').select('*');
      if (userDataError) {
        sql += `-- 导出 user_data 失败: ${userDataError.message}\n`;
      } else if (userData && userData.length > 0) {
        sql += `TRUNCATE TABLE user_data CASCADE;\n`;
        for (const data of userData) {
          sql += `INSERT INTO user_data (id, user_id, data_key, data_value, created_at, updated_at) VALUES (`;
          sql += `'${escapeSql(data.id)}', `;
          sql += `'${escapeSql(data.user_id)}', `;
          sql += `'${escapeSql(data.data_key)}', `;
          sql += `'${escapeSql(JSON.stringify(data.data_value))}', `;
          sql += `'${data.created_at}', `;
          sql += `'${data.updated_at}'`;
          sql += `);\n`;
        }
      }
      sql += `\n`;
      stats['user_data'] = userData?.length || 0;
    }

    // 导出 health_check 表
    if (tables.includes('health_check')) {
      sql += `-- 导出 health_check 表\n`;
      const { data: healthChecks, error: healthCheckError } = await client.from('health_check').select('*');
      if (healthCheckError) {
        sql += `-- 导出 health_check 失败: ${healthCheckError.message}\n`;
      } else if (healthChecks && healthChecks.length > 0) {
        sql += `TRUNCATE TABLE health_check CASCADE;\n`;
        for (const check of healthChecks) {
          sql += `INSERT INTO health_check (id, status, checked_at, details) VALUES (`;
          sql += `'${escapeSql(check.id)}', `;
          sql += `'${escapeSql(check.status)}', `;
          sql += `'${check.checked_at}', `;
          sql += `'${escapeSql(check.details || '')}'`;
          sql += `);\n`;
        }
      }
      sql += `\n`;
      stats['health_check'] = healthChecks?.length || 0;
    }

    // 导出 question_banks 表
    if (tables.includes('question_banks')) {
      sql += `-- 导出 question_banks 表\n`;
      const { data: banks, error: banksError } = await client.from('question_banks').select('*');
      if (banksError) {
        sql += `-- 导出 question_banks 失败: ${banksError.message}\n`;
      } else if (banks && banks.length > 0) {
        sql += `TRUNCATE TABLE question_banks CASCADE;\n`;
        for (const bank of banks) {
          sql += `INSERT INTO question_banks (id, name, description, source_file, question_count, category_id, status, created_at, updated_at) VALUES (`;
          sql += `'${escapeSql(bank.id)}', `;
          sql += `'${escapeSql(bank.name)}', `;
          sql += `${bank.description ? `'${escapeSql(bank.description)}'` : 'NULL'}, `;
          sql += `${bank.source_file ? `'${escapeSql(bank.source_file)}'` : 'NULL'}, `;
          sql += `${bank.question_count || 0}, `;
          sql += `${bank.category_id ? `'${escapeSql(bank.category_id)}'` : 'NULL'}, `;
          sql += `'${escapeSql(bank.status || 'active')}', `;
          sql += `'${bank.created_at || new Date().toISOString()}', `;
          sql += `'${bank.updated_at || new Date().toISOString()}'`;
          sql += `);\n`;
        }
      }
      sql += `\n`;
      stats['question_banks'] = banks?.length || 0;
    }

    // 导出 questions 表
    if (tables.includes('questions')) {
      sql += `-- 导出 questions 表\n`;
      const { data: questions, error: questionsError } = await client.from('questions').select('*');
      if (questionsError) {
        sql += `-- 导出 questions 失败: ${questionsError.message}\n`;
      } else if (questions && questions.length > 0) {
        sql += `TRUNCATE TABLE questions CASCADE;\n`;
        for (const q of questions) {
          sql += `INSERT INTO questions (id, bank_id, parent_id, type, content, options, answer, explanation, difficulty, tags, case_background, case_context, status, created_at) VALUES (`;
          sql += `'${escapeSql(q.id)}', `;
          sql += `'${escapeSql(q.bank_id)}', `;
          sql += `${q.parent_id ? `'${escapeSql(q.parent_id)}'` : 'NULL'}, `;
          sql += `'${escapeSql(q.type)}', `;
          sql += `'${escapeSql(q.content)}', `;
          sql += `${q.options ? `'${escapeSql(JSON.stringify(q.options))}'` : 'NULL'}, `;
          sql += `'${escapeSql(q.answer)}', `;
          sql += `${q.explanation ? `'${escapeSql(q.explanation)}'` : 'NULL'}, `;
          sql += `'${escapeSql(q.difficulty || 'medium')}', `;
          sql += `${q.tags ? `'${escapeSql(JSON.stringify(q.tags))}'` : `'[]'`}, `;
          sql += `${q.case_background ? `'${escapeSql(q.case_background)}'` : 'NULL'}, `;
          sql += `${q.case_context ? `'${escapeSql(q.case_context)}'` : 'NULL'}, `;
          sql += `'${escapeSql(q.status || 'active')}', `;
          sql += `'${q.created_at || new Date().toISOString()}'`;
          sql += `);\n`;
        }
      }
      sql += `\n`;
      stats['questions'] = questions?.length || 0;
    }

    // 导出 admin_users 表
    if (tables.includes('admin_users')) {
      sql += `-- 导出 admin_users 表\n`;
      const { data: adminUsers, error: adminUsersError } = await client.from('admin_users').select('*');
      if (adminUsersError) {
        sql += `-- 导出 admin_users 失败: ${adminUsersError.message}\n`;
      } else if (adminUsers && adminUsers.length > 0) {
        sql += `TRUNCATE TABLE admin_users CASCADE;\n`;
        for (const admin of adminUsers) {
          sql += `INSERT INTO admin_users (id, username, password, is_first_login, created_at, updated_at) VALUES (`;
          sql += `'${escapeSql(admin.id)}', `;
          sql += `'${escapeSql(admin.username)}', `;
          sql += `'${escapeSql(admin.password)}', `;
          sql += `${admin.is_first_login !== undefined ? admin.is_first_login : 'true'}, `;
          sql += `'${admin.created_at || new Date().toISOString()}', `;
          sql += `'${admin.updated_at || new Date().toISOString()}'`;
          sql += `);\n`;
        }
      }
      sql += `\n`;
      stats['admin_users'] = adminUsers?.length || 0;
    }

    // 导出 user_data 表
    if (tables.includes('user_data')) {
      sql += `-- 导出 user_data 表\n`;
      const { data: userDataList, error: userDataError } = await client.from('user_data').select('*');
      if (userDataError) {
        sql += `-- 导出 user_data 失败: ${userDataError.message}\n`;
      } else if (userDataList && userDataList.length > 0) {
        sql += `TRUNCATE TABLE user_data CASCADE;\n`;
        for (const ud of userDataList) {
          sql += `INSERT INTO user_data (id, user_id, data_type, data_value, created_at, updated_at) VALUES (`;
          sql += `'${escapeSql(ud.id)}', `;
          sql += `'${escapeSql(ud.user_id)}', `;
          sql += `'${escapeSql(ud.data_type)}', `;
          sql += `'${escapeSql(JSON.stringify(ud.data_value))}', `;
          sql += `'${ud.created_at || new Date().toISOString()}', `;
          sql += `'${ud.updated_at || new Date().toISOString()}'`;
          sql += `);\n`;
        }
      }
      sql += `\n`;
      stats['user_data'] = userDataList?.length || 0;
    }

    // 导出 health_check 表
    if (tables.includes('health_check')) {
      sql += `-- 导出 health_check 表\n`;
      const { data: healthChecks, error: healthError } = await client.from('health_check').select('*');
      if (healthError) {
        sql += `-- 导出 health_check 失败: ${healthError.message}\n`;
      } else if (healthChecks && healthChecks.length > 0) {
        sql += `TRUNCATE TABLE health_check CASCADE;\n`;
        for (const hc of healthChecks) {
          sql += `INSERT INTO health_check (id, status, checked_at) VALUES (`;
          sql += `'${escapeSql(hc.id)}', `;
          sql += `'${escapeSql(hc.status)}', `;
          sql += `'${hc.checked_at || new Date().toISOString()}'`;
          sql += `);\n`;
        }
      }
      sql += `\n`;
      stats['health_check'] = healthChecks?.length || 0;
    }

    // 添加注释
    sql += `-- 导出完成\n`;
    sql += `-- 导出表: ${tables.join(', ')}\n`;  // 添加换行
    sql += `-- 导出时间: ${new Date().toISOString()}\n`;  // 添加导出时间注释
    sql += `-- ================================\n`;  // 添加分隔线注释
    
    return NextResponse.json({  // 返回JSON响应
      success: true,  // 标记成功
      sql,  // SQL内容
      stats  // 统计信息
    });  // 结束JSON响应对象
  } catch (error) {  // 捕获错误
    console.error('导出数据库失败:', error);  // 打印错误日志
    return NextResponse.json(  // 返回错误响应
      { error: '导出失败: ' + (error as Error).message },  // 错误信息
      { status: 500 }  // HTTP 500状态码
    );  // 结束错误响应
  }  // 结束try-catch
}  // 结束POST函数

/**
 * 获取数据库中可用的表列表
 * GET /api/admin/export-db
 */
/**
 * 获取数据库中可用的表列表
 * GET /api/admin/export-db
 */
export async function GET(request: NextRequest) {
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
    
    // 定义可能存在的表
    const tableInfo: Record<string, { name: string; color: string }> = {
      users: { name: '用户账号', color: 'bg-blue-100 text-blue-600' },
      activation_codes: { name: '激活码', color: 'bg-green-100 text-green-600' },
      user_activations: { name: '激活记录', color: 'bg-purple-100 text-purple-600' },
      categories: { name: '分类', color: 'bg-orange-100 text-orange-600' },
      question_banks: { name: '题库', color: 'bg-cyan-100 text-cyan-600' },
      questions: { name: '题目', color: 'bg-rose-100 text-rose-600' },
      admin_users: { name: '管理员', color: 'bg-red-100 text-red-600' },
      user_data: { name: '用户数据', color: 'bg-indigo-100 text-indigo-600' },
      health_check: { name: '健康检查', color: 'bg-gray-100 text-gray-600' }
    };

    // 检查每个表是否存在（通过尝试查询）
    const availableTables: Array<{ id: string; name: string; color: string }> = [];
    
    for (const [tableName, info] of Object.entries(tableInfo)) {
      try {
        const { error } = await client
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        // 如果没有错误，说明表存在
        if (!error) {
          availableTables.push({
            id: tableName,
            name: info.name,
            color: info.color
          });
        } else {
          console.log(`表 ${tableName} 检查失败:`, error);
        }
      } catch (err) {
        console.log(`表 ${tableName} 查询异常:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      tables: availableTables
    });

  } catch (error) {
    console.error('获取表列表失败:', error);
    return NextResponse.json(
      { error: '获取失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
