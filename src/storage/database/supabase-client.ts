import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 获取 Supabase 配置 - 支持多种环境变量命名方式
function getSupabaseConfig(): { url: string; anonKey: string; serviceRoleKey?: string } {
  // 优先级1: 环境变量（API routes 中 process.env 直接访问）
  let url = process.env.COZE_SUPABASE_URL;
  let anonKey = process.env.COZE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  // 优先级2: NEXT_PUBLIC_ 前缀（客户端兼容）
  if (!url) url = process.env.NEXT_PUBLIC_COZE_SUPABASE_URL;
  if (!anonKey) anonKey = process.env.NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase configuration is missing. Please set COZE_SUPABASE_URL and COZE_SUPABASE_ANON_KEY environment variables.');
  }

  return { url, anonKey, serviceRoleKey };
}

// 获取客户端（用于管理员操作，绕过 RLS）
function getSupabaseAdminClient(): SupabaseClient {
  const { url, anonKey, serviceRoleKey } = getSupabaseConfig();
  
  // 优先使用 service role key（绕过 RLS）
  const key = serviceRoleKey || anonKey;

  return createClient(url, key, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// 获取客户端（用于用户操作，需要 RLS）
function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey, serviceRoleKey } = getSupabaseConfig();

  // 如果有 token 且有 service role key，使用 service role key
  let key = anonKey;
  if (token && serviceRoleKey) {
    key = serviceRoleKey;
  }

  const options: Parameters<typeof createClient>[2] = {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  };

  if (token) {
    options.global = {
      headers: { Authorization: `Bearer ${token}` },
    };
  }

  return createClient(url, key, options);
}

export { getSupabaseClient, getSupabaseAdminClient, getSupabaseConfig };
