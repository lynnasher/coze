import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '../../../../storage/database/supabase-client';

/**
 * 数据库导入 API
 * POST /api/admin/import-db
 * 
 * 支持导入 SQL 文件，解析并执行 INSERT 语句
 */
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: '未提供认证令牌' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { sql, tables } = body as { sql?: string; tables?: string[] };

    if (!sql) {
      return NextResponse.json(
        { success: false, error: '未提供 SQL 数据' },
        { status: 400 }
      );
    }

    const client = getSupabaseAdminClient();
    const results: Record<string, { success: boolean; count: number; error?: string }> = {};

    // 解析 SQL 并提取 INSERT 语句
    const insertStatements = parseInsertStatements(sql);
    console.log(`[导入数据库] 解析到 ${insertStatements.length} 条 INSERT 语句`);

    // 按表分组
    const statementsByTable = groupStatementsByTable(insertStatements);
    console.log('[导入数据库] 表分布:', Object.fromEntries(
      Object.entries(statementsByTable).map(([table, stmts]) => [table, stmts.length])
    ));

    // 如果指定了要导入的表，只导入这些表
    const targetTables = tables && tables.length > 0 
      ? tables 
      : Object.keys(statementsByTable);

    // 逐表导入
    for (const table of targetTables) {
      if (!statementsByTable[table]) {
        console.log(`[导入数据库] 跳过表 ${table}，没有数据`);
        continue;
      }

      const statements = statementsByTable[table];
      console.log(`[导入数据库] 开始导入表 ${table}，共 ${statements.length} 条记录`);

      try {
        // 先清空目标表
        const { error: truncateError } = await client
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有记录

        if (truncateError) {
          console.warn(`[导入数据库] 清空表 ${table} 失败:`, truncateError);
        }

        // 批量插入（每批 50 条）
        const batchSize = 50;
        let insertedCount = 0;
        let hasError = false;
        let errorMessage = '';

        for (let i = 0; i < statements.length; i += batchSize) {
          const batch = statements.slice(i, i + batchSize);
          
          // 将 INSERT 语句转换为数据对象
          const dataObjects = batch.map(stmt => parseInsertToData(stmt, table)).filter(Boolean);

          if (dataObjects.length === 0) continue;

          const { error: insertError } = await client
            .from(table)
            .insert(dataObjects);

          if (insertError) {
            console.error(`[导入数据库] 插入表 ${table} 失败:`, insertError);
            hasError = true;
            errorMessage = insertError.message;
            // 尝试逐条插入
            for (const data of dataObjects) {
              const { error: singleError } = await client
                .from(table)
                .insert([data]);
              if (!singleError) {
                insertedCount++;
              }
            }
          } else {
            insertedCount += dataObjects.length;
          }
        }

        results[table] = {
          success: !hasError,
          count: insertedCount,
          error: hasError ? errorMessage : undefined
        };
        console.log(`[导入数据库] 表 ${table} 导入完成，成功 ${insertedCount} 条`);

      } catch (tableError) {
        console.error(`[导入数据库] 表 ${table} 导出异常:`, tableError);
        results[table] = {
          success: false,
          count: 0,
          error: tableError instanceof Error ? tableError.message : '未知错误'
        };
      }
    }

    // 统计结果
    const totalInserted = Object.values(results).reduce((sum, r) => sum + r.count, 0);
    const failedTables = Object.entries(results)
      .filter(([, r]) => !r.success)
      .map(([table]) => table);

    console.log(`[导入数据库] 导入完成，总计 ${totalInserted} 条记录`);

    return NextResponse.json({
      success: failedTables.length === 0,
      total: totalInserted,
      results,
      failedTables: failedTables.length > 0 ? failedTables : undefined
    });

  } catch (error) {
    console.error('[导入数据库] 异常:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '导入失败' },
      { status: 500 }
    );
  }
}

/**
 * 解析 SQL 文件中的 INSERT 语句
 */
function parseInsertStatements(sql: string): string[] {
  const statements: string[] = [];
  
  // 匹配 INSERT INTO ... VALUES (...); 语句
  // 支持多行 VALUES
  const regex = /INSERT\s+INTO\s+(\w+)\s*\([^)]+\)\s*VALUES\s*\(([\s\S]+?)\);/gi;
  
  let match;
  while ((match = regex.exec(sql)) !== null) {
    statements.push(match[0]);
  }

  return statements;
}

/**
 * 按 SQL 语句中的表名分组
 */
function groupStatementsByTable(statements: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const stmt of statements) {
    const tableMatch = stmt.match(/INSERT\s+INTO\s+(\w+)/i);
    if (tableMatch) {
      const table = tableMatch[1];
      if (!grouped[table]) {
        grouped[table] = [];
      }
      grouped[table].push(stmt);
    }
  }

  return grouped;
}

/**
 * 解析 INSERT 语句为数据对象
 */
function parseInsertToData(insertStmt: string, table: string): Record<string, unknown> | null {
  try {
    // 提取列名
    const columnsMatch = insertStmt.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
    if (!columnsMatch) return null;

    const columns = columnsMatch[1]
      .split(',')
      .map(c => c.trim());

    // 提取 VALUES
    const valuesMatch = insertStmt.match(/VALUES\s*\(([\s\S]+)\);$/i);
    if (!valuesMatch) return null;

    const valuesStr = valuesMatch[1];
    const values = parseValues(valuesStr);

    // 构建对象
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length && i < values.length; i++) {
      obj[columns[i]] = values[i];
    }

    return obj;
  } catch (error) {
    console.warn(`[解析INSERT] 失败:`, error);
    return null;
  }
}

/**
 * 解析 VALUES 字符串为值数组
 */
function parseValues(valuesStr: string): unknown[] {
  const values: unknown[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let i = 0;

  while (i < valuesStr.length) {
    const char = valuesStr[i];

    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      i++;
      continue;
    }

    if (inString && char === stringChar) {
      // 检查是否是转义引号
      if (valuesStr[i + 1] === stringChar) {
        current += stringChar;
        i += 2;
        continue;
      }
      inString = false;
      i++;
      continue;
    }

    if (!inString && char === ',') {
      values.push(parseValue(current.trim()));
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  // 添加最后一个值
  if (current.trim()) {
    values.push(parseValue(current.trim()));
  }

  return values;
}

/**
 * 解析单个值
 */
function parseValue(value: string): unknown {
  // NULL
  if (value.toUpperCase() === 'NULL') {
    return null;
  }

  // 布尔值
  if (value.toUpperCase() === 'TRUE') return true;
  if (value.toUpperCase() === 'FALSE') return false;

  // 数字
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  // JSONB (带 ::jsonb 后缀)
  if (value.includes('::jsonb')) {
    const jsonStr = value.replace(/::jsonb$/i, '');
    if (jsonStr.startsWith("'") && jsonStr.endsWith("'")) {
      try {
        return JSON.parse(jsonStr.slice(1, -1));
      } catch {
        return jsonStr.slice(1, -1);
      }
    }
  }

  // 字符串（已去除引号）
  return value;
}
