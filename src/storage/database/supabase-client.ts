import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 从环境变量直接获取配置（Next.js 会在客户端正确处理这些变量）
function getSupabaseCredentials(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_COZE_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_COZE_SUPABASE_URL is not set');
  }
  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY is not set');
  }

  return { url, anonKey };
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  if (token) {
    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      db: {
        timeout: 60000,
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return createClient(url, anonKey, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export { getSupabaseClient };
