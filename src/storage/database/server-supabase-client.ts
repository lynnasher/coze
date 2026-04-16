import { createClient } from '@supabase/supabase-js';

// 服务端 Supabase 客户端
// 服务端使用不带 NEXT_PUBLIC_ 前缀的环境变量

function getSupabaseCredentials() {
  const url = process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  console.log('[DEBUG] Server Supabase Config:');
  console.log('  COZE_SUPABASE_URL:', url ? 'SET (' + url.substring(0, 30) + '...)' : 'NOT SET');
  console.log('  COZE_SUPABASE_ANON_KEY:', anonKey ? 'SET (' + anonKey.substring(0, 20) + '...)' : 'NOT SET');
  console.log('  COZE_SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? 'SET' : 'NOT SET');

  if (!url || !anonKey) {
    // 如果服务端变量没有设置，尝试从环境变量文件读取
    // Next.js 会自动将 .env 文件中的变量加载到 process.env
    const fallbackUrl = process.env.NEXT_PUBLIC_COZE_SUPABASE_URL;
    const fallbackKey = process.env.NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY;
    
    console.log('[DEBUG] Falling back to NEXT_PUBLIC_ vars:');
    console.log('  NEXT_PUBLIC_COZE_SUPABASE_URL:', fallbackUrl ? 'SET' : 'NOT SET');
    console.log('  NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY:', fallbackKey ? 'SET' : 'NOT SET');
    
    if (fallbackUrl && fallbackKey) {
      return { url: fallbackUrl, anonKey: fallbackKey, serviceRoleKey: process.env.NEXT_PUBLIC_COZE_SUPABASE_SERVICE_ROLE_KEY };
    }
    
    throw new Error('Supabase configuration is missing: COZE_SUPABASE_URL=' + (url || 'unset') + ', COZE_SUPABASE_ANON_KEY=' + (anonKey ? 'SET' : 'unset'));
  }

  return { url, anonKey, serviceRoleKey };
}

export function getSupabaseClient(token?: string) {
  const { url, anonKey, serviceRoleKey } = getSupabaseCredentials();
  const key = token ? (serviceRoleKey ?? anonKey) : anonKey;

  return createClient(url, key, {
    global: token ? {
      headers: { Authorization: `Bearer ${token}` },
    } : undefined,
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
