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

// 模块级单例缓存，避免每次请求重建连接
let adminClientCache: SupabaseClient | null = null;
let defaultClientCache: SupabaseClient | null = null;

// 获取客户端（用于管理员操作，绕过 RLS）
function getSupabaseAdminClient(): SupabaseClient {
  if (adminClientCache) return adminClientCache;

  const { url, anonKey, serviceRoleKey } = getSupabaseConfig();
  const key = serviceRoleKey || anonKey;

  adminClientCache = createClient(url, key, {
    db: { timeout: 60000 },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return adminClientCache;
}

// 获取客户端（用于用户操作，需要 RLS）
function getSupabaseClient(token?: string): SupabaseClient {
  // 无 token 时复用默认单例
  if (!token && defaultClientCache) return defaultClientCache;

  const { url, anonKey, serviceRoleKey } = getSupabaseConfig();

  let key = anonKey;
  if (token && serviceRoleKey) {
    key = serviceRoleKey;
  }

  const options: Parameters<typeof createClient>[2] = {
    db: { timeout: 60000 },
    auth: { autoRefreshToken: false, persistSession: false },
  };

  if (token) {
    options.global = {
      headers: { Authorization: `Bearer ${token}` },
    };
  }

  const client = createClient(url, key, options);

  // 缓存无 token 的默认客户端
  if (!token) {
    defaultClientCache = client;
  }

  return client;
}

export { getSupabaseClient, getSupabaseAdminClient, getSupabaseConfig };
