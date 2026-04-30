import { getSupabaseClient, getSupabaseAdminClient } from '@/storage/database/supabase-client';
import { createHmac, scryptSync, randomBytes } from 'crypto';

// 用户类型定义
export interface DbUser {
  id: string;
  phone: string;
  password: string;
  nickname: string | null;
  role: string;
  status: string;
  activated_categories: string | null;
  device_id: string | null;
  created_at: string;
  last_login_at: string | null;
}

// 生成设备ID
export function generateDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Token 签名密钥
// 优先使用环境变量 TOKEN_SECRET
// 若未设置，则基于 SUPABASE_URL + SUPABASE_ANON_KEY 派生（保证同一项目密钥一致）
// 这样既避免了硬编码，又确保了每次重启密钥不变
function getTokenSecret(): string {
  const envSecret = process.env.TOKEN_SECRET;
  if (envSecret) return envSecret;
  
  // 从 Supabase 配置派生密钥（每个项目唯一）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  if (supabaseUrl && supabaseKey) {
    // 使用 HMAC 派生一个 32 字节的密钥
    return createHmac('sha256', 'quiz_token_secret_derivation')
      .update(`${supabaseUrl}:${supabaseKey}`)
      .digest('hex');
  }
  
  // 开发环境回退：使用固定值（仅开发）
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[SECURITY] TOKEN_SECRET 未设置，使用开发环境回退值');
    return 'dev_only_unsafe_key_please_set_token_secret';
  }
  
  // 生产环境无任何配置时，使用随机值（重启后 token 失效）
  console.warn('[SECURITY] TOKEN_SECRET 未设置且无法派生，使用随机密钥（重启后 token 将失效）');
  return randomBytes(32).toString('hex');
}

const TOKEN_SECRET = getTokenSecret();

// 生成带签名的 Token（HMAC-SHA256）
export function generateToken(userId: string, role?: string): string {
  const payload = {
    userId,
    role: role || 'user',
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7天过期
    iat: Date.now(),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64');
  const secret = TOKEN_SECRET || 'dev_only_unsafe_key';
  const signature = createHmac('sha256', secret).update(payloadStr).digest('hex');
  return `${payloadStr}.${signature}`;
}

// 验证 Token 签名
export function verifyToken(token: string): { userId: string | null; role: string | null; expired: boolean } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { userId: null, role: null, expired: false };
    
    const [payloadStr, signature] = parts;
    const secret = TOKEN_SECRET || 'dev_only_unsafe_key';
    const expectedSig = createHmac('sha256', secret).update(payloadStr).digest('hex');
    
    if (signature !== expectedSig) {
      return { userId: null, role: null, expired: false }; // 签名不匹配 = 伪造
    }
    
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64').toString());
    
    if (payload.exp && Date.now() > payload.exp) {
      return { userId: null, role: null, expired: true }; // 过期
    }
    
    return { userId: payload.userId, role: payload.role || null, expired: false };
  } catch {
    return { userId: null, role: null, expired: false };
  }
}

// 密码哈希（使用 scrypt，比简单 base64 安全得多）
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${key}`;
}

// 验证密码（兼容旧格式 base64、新格式 scrypt 和明文密码）
export function verifyPassword(password: string, hashed: string): boolean {
  // 检测是否为新格式 scrypt 哈希（包含冒号分隔符）
  if (hashed.includes(':')) {
    const [salt, key] = hashed.split(':');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');
    return derivedKey === key;
  }
  // 兼容旧格式（base64 编码）
  if (Buffer.from(password + '_salt_key_2024').toString('base64') === hashed) {
    return true;
  }
  // 兼容明文密码（过渡期，登录后自动升级为 scrypt）
  if (password === hashed) {
    return true;
  }
  return false;
}

// 用户服务
export const userService = {
  // 获取当前用户 ID（从 localStorage 的 token 中解析）
  getCurrentUserId(): string | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('user_token');
    if (!token) return null;
    try {
      // Token 格式: base64payload.signature (HMAC-SHA256)
      const payloadStr = token.split('.')[0];
      const payload = JSON.parse(atob(payloadStr));
      return payload.userId || null;
    } catch {
      return null;
    }
  },

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

  // 注册用户
  async register(phone: string, password: string, nickname?: string): Promise<{ user: DbUser; token: string; deviceId: string }> {
    const client = getSupabaseClient();
    const adminClient = getSupabaseAdminClient();

    // 检查手机号是否已存在
    const existing = await client.from('users').select('id').eq('phone', phone).maybeSingle();
    if (existing && existing.data) {
      throw new Error('该手机号已注册');
    }

    // 创建设备ID
    const deviceId = generateDeviceId();

    // 创建用户（使用 admin client 确保可以写入 device_id）
    const hashedPassword = hashPassword(password);
    const { data, error } = await adminClient.from('users').insert({
      phone,
      password: hashedPassword,
      nickname: nickname || null,
      role: 'user',
      status: 'active',
      activated_categories: null,
      device_id: deviceId,
    }).select().single();

    if (error) throw new Error(`注册失败: ${error.message}`);
    const user = data as DbUser;
    const token = generateToken(user.id, user.role);

    return { user, token, deviceId };
  },

  // 登录
  async login(phone: string, password: string): Promise<{ user: DbUser; token: string; deviceId: string }> {
    const client = getSupabaseClient();
    const adminClient = getSupabaseAdminClient();

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

    // 如果密码是旧格式（base64 或明文），自动升级为 scrypt 哈希
    if (!user.password.includes(':')) {
      const newHash = hashPassword(password);
      await adminClient.from('users').update({ password: newHash }).eq('id', user.id);
    }

    // 检查用户状态
    if (user.status === 'banned') {
      throw new Error('账号已被禁用');
    }

    // 生成新的设备ID（单设备登录：新设备挤掉旧设备）
    const deviceId = generateDeviceId();

    // 更新最后登录时间和设备ID（使用 admin client 确保可以更新）
    const { error: updateError } = await adminClient.from('users').update({ 
      last_login_at: new Date().toISOString(),
      device_id: deviceId 
    }).eq('id', user.id);

    if (updateError) {
      // 继续登录流程，不因设备ID更新失败而阻止登录
    }

    // 更新内存中的用户信息
    user.device_id = deviceId;

    // 生成 token
    const token = generateToken(user.id, user.role);

    return { user, token, deviceId };
  },

  // 验证设备ID（检查当前设备是否有效）
  async validateDevice(userId: string, deviceId: string): Promise<boolean> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('users')
      .select('device_id')
      .eq('id', userId)
      .maybeSingle();
    
    console.log(`[ValidateDevice] userId=${userId}, match=${data?.device_id === deviceId}`);
    
    if (error || !data) {
      return false;
    }
    
    // 如果数据库中没有 device_id（旧用户），允许当前设备通过验证
    if (!data.device_id) {
      return true;
    }
    
    // 如果 device_id 匹配，验证通过
    if (data.device_id === deviceId) {
      return true;
    }
    
    // device_id 不匹配，说明设备被挤下线
    return false;
  },

  // 管理员登录
  async adminLogin(username: string, password: string): Promise<{ user: DbUser; token: string; deviceId: string }> {
    const client = getSupabaseClient();
    const adminClient = getSupabaseAdminClient();

    // 查找管理员用户（通过昵称或特定字段）
    const { data, error } = await client.from('users').select('*').eq('nickname', username).maybeSingle();
    if (error) throw new Error(`管理员登录失败: ${error.message}`);
    if (!data) {
      throw new Error('管理员账号不存在');
    }

    const user = data as DbUser;

    // 验证是否为管理员
    if (user.role !== 'admin') {
      throw new Error('该账号不是管理员');
    }

    // 验证密码
    if (!verifyPassword(password, user.password)) {
      throw new Error('密码错误');
    }

    // 如果密码是旧格式（base64 或明文），自动升级为 scrypt 哈希
    if (!user.password.includes(':')) {
      const newHash = hashPassword(password);
      await adminClient.from('users').update({ password: newHash }).eq('id', user.id);
    }

    // 检查用户状态
    if (user.status === 'banned') {
      throw new Error('账号已被禁用');
    }

    // 生成新的设备ID（单设备登录：新设备挤掉旧设备）
    const deviceId = generateDeviceId();

    // 更新最后登录时间和设备ID（使用 admin client 确保可以更新）
    const { error: updateError } = await adminClient.from('users').update({ 
      last_login_at: new Date().toISOString(),
      device_id: deviceId 
    }).eq('id', user.id);

    if (updateError) {
      console.error('更新设备ID失败:', updateError);
      // 继续登录流程，不因设备ID更新失败而阻止登录
    }

    // 更新内存中的用户信息
    user.device_id = deviceId;

    // 生成 token
    const token = generateToken(user.id, user.role);

    return { user, token, deviceId };
  },

  // 更新用户激活的分类
  async updateActivatedCategories(userId: string, categoryIds: string[]): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.from('users').update({
      activated_categories: JSON.stringify(categoryIds),
    }).eq('id', userId);
    if (error) throw new Error(`更新用户分类失败: ${error.message}`);
  },

  // 获取所有用户（管理员）
  async getAllUsers(): Promise<DbUser[]> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return (data || []) as DbUser[];
  },

  // 更新用户状态
  async updateUserStatus(userId: string, status: 'active' | 'banned'): Promise<void> {
    const client = getSupabaseAdminClient();
    const { error } = await client.from('users').update({ status }).eq('id', userId);
    if (error) throw new Error(`更新用户状态失败: ${error.message}`);
  },

  // 更新用户角色
  async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
    const client = getSupabaseAdminClient();
    const { error } = await client.from('users').update({ role }).eq('id', userId);
    if (error) throw new Error(`更新用户角色失败: ${error.message}`);
  },

  // 更新用户密码（管理员重置）
  async updateUserPassword(userId: string, password: string): Promise<void> {
    const client = getSupabaseAdminClient();
    const hashedPassword = hashPassword(password);
    const { error } = await client.from('users').update({ password: hashedPassword }).eq('id', userId);
    if (error) throw new Error(`更新用户密码失败: ${error.message}`);
  },

  // 删除用户
  async deleteUser(userId: string): Promise<void> {
    const client = getSupabaseAdminClient();
    const { error } = await client.from('users').delete().eq('id', userId);
    if (error) throw new Error(`删除用户失败: ${error.message}`);
  },

  // 用户修改自己的密码
  async changePassword(userId: string, newPassword: string): Promise<void> {
    const client = getSupabaseClient();
    const hashedPassword = hashPassword(newPassword);
    const { error } = await client.from('users').update({ password: hashedPassword }).eq('id', userId);
    if (error) throw new Error(`修改密码失败: ${error.message}`);
  },

  // 获取用户的激活记录
  async getUserActivationCodes(userId: string): Promise<Array<{
    id: string;
    category_id: string;
    category_name: string;
    activated_at: string;
    expires_at: string | null;
  }>> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('user_activations')
      .select('*')
      .eq('user_id', userId);
    if (error) throw new Error(`查询激活记录失败: ${error.message}`);
    return (data || []) as Array<{
      id: string;
      category_id: string;
      category_name: string;
      activated_at: string;
      expires_at: string | null;
    }>;
  },
};

// 初始化默认管理员
export async function initDefaultAdmin(): Promise<void> {
  const client = getSupabaseAdminClient();

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
