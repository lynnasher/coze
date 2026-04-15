import { getSupabaseClient } from '@/storage/database/supabase-client';

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

// 用户服务
export const userService = {
  // 通过手机号查找用户
  async findByPhone(phone: string): Promise<DbUser | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('users').select('*').eq('phone', phone).maybeSingle();
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return data as DbUser | null;
  },

  // 通过 ID 查找用户
  async findById(id: string): Promise<DbUser | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return data as DbUser | null;
  },

  // 创建用户
  async create(phone: string, password: string, nickname?: string): Promise<DbUser> {
    const client = getSupabaseClient();
    const hashedPassword = hashPassword(password);
    
    const { data, error } = await client.from('users').insert({
      phone,
      password: hashedPassword,
      nickname: nickname || null,
      role: 'user',
      status: 'active',
      activated_categories: '[]',
    }).select().single();
    
    if (error) {
      if (error.code === '23505') {
        throw new Error('该手机号已注册');
      }
      throw new Error(`创建用户失败: ${error.message}`);
    }
    
    return data as DbUser;
  },

  // 用户登录
  async login(phone: string, password: string): Promise<{ user: DbUser; token: string }> {
    const user = await this.findByPhone(phone);
    
    if (!user) {
      throw new Error('用户不存在');
    }
    
    if (user.status === 'banned') {
      throw new Error('账号已被禁用');
    }
    
    if (!verifyPassword(password, user.password)) {
      throw new Error('密码错误');
    }
    
    // 更新最后登录时间
    const client = getSupabaseClient();
    await client.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    
    const token = generateToken(user.id);
    
    return { user, token };
  },

  // 更新用户激活的分类
  async updateActivatedCategories(userId: string, categoryIds: string[]): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from('users').update({
      activated_categories: JSON.stringify(categoryIds)
    }).eq('id', userId);
    
    if (error) throw new Error(`更新激活分类失败: ${error.message}`);
  },

  // 获取用户激活的分类（检查过期时间）
  async getActivatedCategories(userId: string): Promise<string[]> {
    const client = getSupabaseClient();
    
    // 查询用户的激活记录，过滤掉过期的
    const { data, error } = await client.from('user_activations')
      .select('category_id, expires_at')
      .eq('user_id', userId);
    
    if (error) return [];
    
    const now = new Date();
    const validCategories = (data || [])
      .filter((record: { category_id: string; expires_at: string | null }) => {
        // 如果没有过期时间，则永久有效
        if (!record.expires_at) return true;
        // 检查是否过期
        return new Date(record.expires_at) > now;
      })
      .map((record: { category_id: string }) => record.category_id);
    
    // 去重
    return [...new Set(validCategories)];
  },

  // 管理员登录
  async adminLogin(username: string, password: string): Promise<{ user: DbUser; token: string }> {
    // 管理员特殊逻辑
    if (username === 'admin' && password === 'admin123') {
      let admin = await this.findByPhone('admin');
      
      if (!admin) {
        // 创建管理员账号
        admin = await this.create('admin', 'admin123', '系统管理员');
        if (admin) {
          const client = getSupabaseClient();
          await client.from('users').update({ role: 'admin' }).eq('id', admin.id);
          admin.role = 'admin';
        }
      }
      
      if (admin) {
        const token = generateToken(admin.id);
        return { user: admin, token };
      }
    }
    
    throw new Error('用户名或密码错误');
  },

  // 获取所有用户（管理员）
  async getAllUsers(): Promise<DbUser[]> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return (data || []) as DbUser[];
  },

  // 更新用户状态
  async updateUserStatus(userId: string, status: 'active' | 'banned'): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from('users').update({ status }).eq('id', userId);
    if (error) throw new Error(`更新用户状态失败: ${error.message}`);
  },

  // 更新用户角色
  async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from('users').update({ role }).eq('id', userId);
    if (error) throw new Error(`更新用户角色失败: ${error.message}`);
  },

  // 删除用户
  async deleteUser(userId: string): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from('users').delete().eq('id', userId);
    if (error) throw new Error(`删除用户失败: ${error.message}`);
  },
};

// 初始化默认管理员
export async function initDefaultAdmin(): Promise<void> {
  try {
    const admin = await userService.findByPhone('admin');
    if (!admin) {
      await userService.create('admin', 'admin123', '系统管理员');
      // 更新为管理员
      const client = getSupabaseClient();
      await client.from('users').update({ role: 'admin' }).eq('phone', 'admin');
    }
  } catch (e) {
    console.error('初始化管理员失败:', e);
  }
}
