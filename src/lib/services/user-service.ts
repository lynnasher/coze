import { createClient } from '@supabase/supabase-js';

// 用户类型定义
export interface DbUser {
  id: string;
  phone: string;
  password: string;
  nickname: string | null;
  role: string;
  status: string;
  activated_categories: string | null;
  created_at: string;
  last_login_at: string | null;
}

// 简单密码加密
function hashPassword(password: string): string {
  // 简单 Base64 编码 + 盐，实际生产应使用 bcrypt
  return Buffer.from(password + '_salt_key_2024').toString('base64');
}

// 验证密码
function verifyPassword(password: string, hashed: string): boolean {
  return hashPassword(password) === hashed;
}

// 生成 Token
function generateToken(userId: string): string {
  const payload = {
    userId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天过期
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// 获取 Supabase URL 和 Anon Key
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_COZE_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_COZE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase configuration is missing');
  }

  return { url, anonKey, serviceRoleKey };
}

// 创建 Supabase 客户端
function createSupabaseClient(token?: string) {
  const { url, anonKey, serviceRoleKey } = getSupabaseConfig();
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

// 用户服务
export const userService = {
  // 获取当前用户 ID（从 localStorage 的 token 中解析）
  getCurrentUserId(): string | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('user_token');
    if (!token) return null;
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      return payload.userId || null;
    } catch {
      return null;
    }
  },

  // 通过手机号查找用户
  async findByPhone(phone: string): Promise<DbUser | null> {
    const client = createSupabaseClient();
    const { data, error } = await client.from('users').select('*').eq('phone', phone).maybeSingle();
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return data as DbUser | null;
  },

  // 通过 ID 查找用户
  async findById(id: string): Promise<DbUser | null> {
    const client = createSupabaseClient();
    const { data, error } = await client.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return data as DbUser | null;
  },

  // 注册用户
  async register(phone: string, password: string, nickname?: string): Promise<{ user: DbUser; token: string }> {
    const client = createSupabaseClient();

    // 检查手机号是否已存在
    const existing = await client.from('users').select('id').eq('phone', phone).maybeSingle();
    if (existing) {
      throw new Error('该手机号已注册');
    }

    // 创建用户
    const hashedPassword = hashPassword(password);
    const { data, error } = await client.from('users').insert({
      phone,
      password: hashedPassword,
      nickname: nickname || null,
      role: 'user',
      status: 'active',
      activated_categories: null,
    }).select().single();

    if (error) throw new Error(`注册失败: ${error.message}`);
    const user = data as DbUser;
    const token = generateToken(user.id);

    return { user, token };
  },

  // 登录
  async login(phone: string, password: string): Promise<{ user: DbUser; token: string }> {
    const client = createSupabaseClient();

    // 查找用户
    const { data, error } = await client.from('users').select('*').eq('phone', phone).maybeSingle();
    if (error) throw new Error(`登录失败: ${error.message}`);
    if (!data) {
      throw new Error('用户不存在');
    }

    const user = data as DbUser;

    // 验证密码
    if (!verifyPassword(password, user.password)) {
      throw new Error('密码错误');
    }

    // 检查用户状态
    if (user.status === 'banned') {
      throw new Error('账号已被禁用');
    }

    // 更新最后登录时间
    await client.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

    // 生成 token
    const token = generateToken(user.id);

    return { user, token };
  },

  // 更新用户激活的分类
  async updateActivatedCategories(userId: string, categoryIds: string[]): Promise<void> {
    const client = createSupabaseClient();
    const { error } = await client.from('users').update({
      activated_categories: JSON.stringify(categoryIds),
    }).eq('id', userId);
    if (error) throw new Error(`更新用户分类失败: ${error.message}`);
  },

  // 获取所有用户（管理员）
  async getAllUsers(): Promise<DbUser[]> {
    const client = createSupabaseClient();
    const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return (data || []) as DbUser[];
  },

  // 更新用户状态
  async updateUserStatus(userId: string, status: 'active' | 'banned'): Promise<void> {
    const client = createSupabaseClient();
    const { error } = await client.from('users').update({ status }).eq('id', userId);
    if (error) throw new Error(`更新用户状态失败: ${error.message}`);
  },

  // 更新用户角色
  async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
    const client = createSupabaseClient();
    const { error } = await client.from('users').update({ role }).eq('id', userId);
    if (error) throw new Error(`更新用户角色失败: ${error.message}`);
  },

  // 删除用户
  async deleteUser(userId: string): Promise<void> {
    const client = createSupabaseClient();
    const { error } = await client.from('users').delete().eq('id', userId);
    if (error) throw new Error(`删除用户失败: ${error.message}`);
  },
};

// 初始化默认管理员
export async function initDefaultAdmin(): Promise<void> {
  const client = createSupabaseClient();

  // 检查是否已存在管理员
  const { data: existingAdmin } = await client.from('users').select('id').eq('role', 'admin').maybeSingle();
  if (existingAdmin) return;

  // 创建默认管理员
  const adminPassword = hashPassword('admin123');
  await client.from('users').insert({
    phone: 'admin',
    password: adminPassword,
    nickname: '管理员',
    role: 'admin',
    status: 'active',
    activated_categories: null,
  });
}
