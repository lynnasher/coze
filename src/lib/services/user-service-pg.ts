/**
 * 用户服务 - PostgreSQL 版本
 * 适配火山引擎 PostgreSQL
 */
import { query, transaction } from '@/lib/db/postgres-client';
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
function getTokenSecret(): string {
  const envSecret = process.env.TOKEN_SECRET;
  if (envSecret) return envSecret;
  
  // 从数据库连接字符串派生密钥
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (dbUrl) {
    return createHmac('sha256', 'quiz_token_secret_derivation')
      .update(dbUrl)
      .digest('hex');
  }
  
  // 开发环境回退
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[SECURITY] TOKEN_SECRET 未设置，使用开发环境回退值');
    return 'dev_only_unsafe_key_please_set_token_secret';
  }
  
  console.warn('[SECURITY] TOKEN_SECRET 未设置，使用随机密钥（重启后 token 将失效）');
  return randomBytes(32).toString('hex');
}

const TOKEN_SECRET = getTokenSecret();

// 生成带签名的 Token
export function generateToken(userId: string, role?: string): string {
  const payload = {
    userId,
    role: role || 'user',
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    iat: Date.now(),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = createHmac('sha256', TOKEN_SECRET).update(payloadStr).digest('hex');
  return `${payloadStr}.${signature}`;
}

// 验证 Token
export function verifyToken(token: string): { userId: string | null; role: string | null; expired: boolean } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { userId: null, role: null, expired: false };
    
    const [payloadStr, signature] = parts;
    const expectedSig = createHmac('sha256', TOKEN_SECRET).update(payloadStr).digest('hex');
    
    if (signature !== expectedSig) {
      return { userId: null, role: null, expired: false };
    }
    
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64').toString());
    
    if (payload.exp && Date.now() > payload.exp) {
      return { userId: null, role: null, expired: true };
    }
    
    return { userId: payload.userId, role: payload.role || null, expired: false };
  } catch {
    return { userId: null, role: null, expired: false };
  }
}

// 密码哈希
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${key}`;
}

// 验证密码
export function verifyPassword(password: string, hashed: string): boolean {
  if (hashed.includes(':')) {
    const [salt, key] = hashed.split(':');
    const derivedKey = scryptSync(password, salt, 64).toString('hex');
    return derivedKey === key;
  }
  // 兼容旧格式
  if (Buffer.from(password + '_salt_key_2024').toString('base64') === hashed) {
    return true;
  }
  if (password === hashed) {
    return true;
  }
  return false;
}

// 用户服务
export const userService = {
  // 获取当前用户 ID
  getCurrentUserId(): string | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('user_token');
    if (!token) return null;
    try {
      const payloadStr = token.split('.')[0];
      const payload = JSON.parse(atob(payloadStr));
      return payload.userId || null;
    } catch {
      return null;
    }
  },

  // 通过手机号查找用户
  async findByPhone(phone: string): Promise<DbUser | null> {
    const result = await query<DbUser>(
      'SELECT * FROM users WHERE phone = $1 LIMIT 1',
      [phone]
    );
    return result.rows[0] || null;
  },

  // 通过 ID 查找用户
  async findById(id: string): Promise<DbUser | null> {
    const result = await query<DbUser>(
      'SELECT * FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    return result.rows[0] || null;
  },

  // 注册用户
  async register(phone: string, password: string, nickname?: string): Promise<{ user: DbUser; token: string; deviceId: string }> {
    // 检查手机号是否已存在
    const existing = await this.findByPhone(phone);
    if (existing) {
      throw new Error('该手机号已注册');
    }

    const deviceId = generateDeviceId();
    const hashedPassword = hashPassword(password);

    const result = await query<DbUser>(
      `INSERT INTO users (phone, password, nickname, role, status, device_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [phone, hashedPassword, nickname || null, 'user', 'active', deviceId]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.role);

    return { user, token, deviceId };
  },

  // 登录
  async login(phone: string, password: string): Promise<{ user: DbUser; token: string; deviceId: string }> {
    const user = await this.findByPhone(phone);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (!verifyPassword(password, user.password)) {
      throw new Error('密码错误');
    }

    // 自动升级密码格式
    if (!user.password.includes(':')) {
      const newHash = hashPassword(password);
      await query('UPDATE users SET password = $1 WHERE id = $2', [newHash, user.id]);
    }

    if (user.status === 'banned') {
      throw new Error('账号已被禁用');
    }

    const deviceId = generateDeviceId();

    await query(
      'UPDATE users SET last_login_at = NOW(), device_id = $1 WHERE id = $2',
      [deviceId, user.id]
    );

    user.device_id = deviceId;
    const token = generateToken(user.id, user.role);

    return { user, token, deviceId };
  },

  // 验证设备ID
  async validateDevice(userId: string, deviceId: string): Promise<boolean> {
    const result = await query<{ device_id: string }>(
      'SELECT device_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) return false;
    
    const dbDeviceId = result.rows[0].device_id;
    if (!dbDeviceId) return true;
    
    return dbDeviceId === deviceId;
  },

  // 管理员登录
  async adminLogin(username: string, password: string): Promise<{ user: DbUser; token: string; deviceId: string }> {
    // 通过昵称查找管理员
    const result = await query<DbUser>(
      'SELECT * FROM users WHERE nickname = $1 AND role = $2 LIMIT 1',
      [username, 'admin']
    );
    
    if (result.rows.length === 0) {
      throw new Error('管理员账号不存在');
    }

    const user = result.rows[0];

    if (!verifyPassword(password, user.password)) {
      throw new Error('密码错误');
    }

    if (!user.password.includes(':')) {
      const newHash = hashPassword(password);
      await query('UPDATE users SET password = $1 WHERE id = $2', [newHash, user.id]);
    }

    if (user.status === 'banned') {
      throw new Error('账号已被禁用');
    }

    const deviceId = generateDeviceId();

    await query(
      'UPDATE users SET last_login_at = NOW(), device_id = $1 WHERE id = $2',
      [deviceId, user.id]
    );

    user.device_id = deviceId;
    const token = generateToken(user.id, user.role);

    return { user, token, deviceId };
  },

  // 更新用户激活的分类
  async updateActivatedCategories(userId: string, categoryIds: string[]): Promise<void> {
    await query(
      'UPDATE users SET activated_categories = $1 WHERE id = $2',
      [JSON.stringify(categoryIds), userId]
    );
  },

  // 获取所有用户（管理员）
  async getAllUsers(): Promise<DbUser[]> {
    const result = await query<DbUser>(
      'SELECT * FROM users ORDER BY created_at DESC'
    );
    return result.rows;
  },

  // 更新用户状态
  async updateUserStatus(userId: string, status: 'active' | 'banned'): Promise<void> {
    await query('UPDATE users SET status = $1 WHERE id = $2', [status, userId]);
  },

  // 更新用户角色
  async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
  },

  // 更新用户密码（管理员重置）
  async updateUserPassword(userId: string, password: string): Promise<void> {
    const hashedPassword = hashPassword(password);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
  },

  // 删除用户
  async deleteUser(userId: string): Promise<void> {
    await query('DELETE FROM users WHERE id = $1', [userId]);
  },

  // 用户修改自己的密码
  async changePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = hashPassword(newPassword);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
  },

  // 获取用户的激活记录
  async getUserActivationCodes(userId: string): Promise<Array<{
    id: string;
    category_id: string;
    category_name: string;
    activated_at: string;
    expires_at: string | null;
  }>> {
    const result = await query(
      'SELECT * FROM user_activations WHERE user_id = $1',
      [userId]
    );
    return result.rows as any[];
  },
};

// 初始化默认管理员
export async function initDefaultAdmin(): Promise<void> {
  // 检查是否已存在管理员
  const result = await query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
  if (result.rows.length > 0) return;

  // 创建默认管理员
  const adminPassword = hashPassword('admin123');
  await query(
    `INSERT INTO users (phone, password, nickname, role, status, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    ['admin', adminPassword, '管理员', 'admin', 'active']
  );
}
