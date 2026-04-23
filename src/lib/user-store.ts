import { User, UserSession } from './types';

// 用户存储 Keys
const USER_STORAGE_KEYS = {
  USERS: 'quiz_users',
  SESSION: 'quiz_session',
};

// 生成随机 ID
export const generateUserId = (): string => {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 生成 Token
export const generateToken = (): string => {
  return `token_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
};

// 简单密码加密（实际生产应使用更安全的方式）
export const hashPassword = (password: string): string => {
  // 简单 Base64 编码，实际生产应使用 bcrypt 或类似加密
  return btoa(password + '_salt_key_2024');
};

// 验证密码
export const verifyPassword = (password: string, hashed: string): boolean => {
  return hashPassword(password) === hashed;
};

// 用户管理
export const userStore = {
  getAll: (): User[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(USER_STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  save: (users: User[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(USER_STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {
      console.error('保存用户失败:', e);
    }
  },

  add: (user: User): User => {
    const users = userStore.getAll();
    users.push(user);
    userStore.save(users);
    return user;
  },

  getById: (id: string): User | undefined => {
    return userStore.getAll().find(u => u.id === id);
  },

  getByPhone: (phone: string): User | undefined => {
    return userStore.getAll().find(u => u.phone === phone);
  },

  update: (user: User): User => {
    const users = userStore.getAll();
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = user;
      userStore.save(users);
    }
    return user;
  },

  remove: (id: string): void => {
    const users = userStore.getAll().filter(u => u.id !== id);
    userStore.save(users);
  },

  exists: (phone: string): boolean => {
    return userStore.getAll().some(u => u.phone === phone);
  },

  updateStatus: (id: string, status: 'active' | 'banned'): User | undefined => {
    const user = userStore.getById(id);
    if (user) {
      user.status = status;
      return userStore.update(user);
    }
    return undefined;
  },

  updateRole: (id: string, role: 'user' | 'admin'): User | undefined => {
    const user = userStore.getById(id);
    if (user) {
      user.role = role;
      return userStore.update(user);
    }
    return undefined;
  },

  // 激活分类
  activateCategory: (id: string, categoryId: string): User | undefined => {
    const user = userStore.getById(id);
    if (user) {
      if (!user.activatedCategories) {
        user.activatedCategories = [];
      }
      if (!user.activatedCategories.includes(categoryId)) {
        user.activatedCategories.push(categoryId);
      }
      return userStore.update(user);
    }
    return undefined;
  },

  // 取消激活分类
  deactivateCategory: (id: string, categoryId: string): User | undefined => {
    const user = userStore.getById(id);
    if (user && user.activatedCategories) {
      user.activatedCategories = user.activatedCategories.filter(c => c !== categoryId);
      return userStore.update(user);
    }
    return undefined;
  },

  // 批量激活分类（用于初始化）
  activateCategories: (id: string, categoryIds: string[]): User | undefined => {
    const user = userStore.getById(id);
    if (user) {
      user.activatedCategories = [...new Set([...(user.activatedCategories || []), ...categoryIds])];
      return userStore.update(user);
    }
    return undefined;
  },

  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(USER_STORAGE_KEYS.USERS);
  },
};

// 会话管理
export const sessionStore = {
  get: (): UserSession | null => {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(USER_STORAGE_KEYS.SESSION);
      if (!data) return null;
      const session: UserSession = JSON.parse(data);
      // 检查是否过期
      if (session.expiresAt < Date.now()) {
        sessionStore.clear();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  save: (session: UserSession) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(USER_STORAGE_KEYS.SESSION, JSON.stringify(session));
    } catch (e) {
      console.error('保存会话失败:', e);
    }
  },

  create: (userId: string): UserSession => {
    const session: UserSession = {
      userId,
      token: generateToken(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 天过期
    };
    sessionStore.save(session);
    return session;
  },

  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(USER_STORAGE_KEYS.SESSION);
  },

  isLoggedIn: (): boolean => {
    return sessionStore.get() !== null;
  },

  getCurrentUser: (): User | null => {
    const session = sessionStore.get();
    if (!session) return null;
    return userStore.getById(session.userId) || null;
  },
};

// 初始化默认管理员账号
export const initDefaultAdmin = () => {
  if (!userStore.exists('admin')) {
    userStore.add({
      id: generateUserId(),
      phone: 'admin',
      nickname: '管理员',
      password: hashPassword('admin123'),
      createdAt: Date.now(),
      role: 'admin',
      status: 'active',
    });
  }
};

// 注册新用户
export const registerUser = (phone: string, password: string, nickname?: string): { success: boolean; user?: User; error?: string } => {
  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return { success: false, error: '请输入正确的手机号' };
  }

  // 验证密码长度
  if (password.length < 6) {
    return { success: false, error: '密码长度至少6位' };
  }

  // 检查手机号是否已注册
  if (userStore.exists(phone)) {
    return { success: false, error: '该手机号已注册' };
  }

  const user: User = {
    id: generateUserId(),
    phone,
    nickname: nickname || `用户${phone.slice(-4)}`,
    password: hashPassword(password),
    createdAt: Date.now(),
    role: 'user',
    status: 'active',
  };

  userStore.add(user);
  
  // 自动登录
  sessionStore.create(user.id);

  return { success: true, user };
};

// 用户登录
export const loginUser = (phone: string, password: string): { success: boolean; user?: User; error?: string } => {
  const user = userStore.getByPhone(phone);
  
  if (!user) {
    return { success: false, error: '用户不存在' };
  }

  if (user.status === 'banned') {
    return { success: false, error: '账号已被禁用' };
  }

  if (!verifyPassword(password, user.password)) {
    return { success: false, error: '密码错误' };
  }

  // 更新最后登录时间
  user.lastLoginAt = Date.now();
  userStore.update(user);

  // 创建会话
  sessionStore.create(user.id);

  return { success: true, user };
};

// 用户登出
export const logoutUser = () => {
  sessionStore.clear();
  
  // 清除用户相关的错题数据（避免切换账号时看到之前用户的数据）
  if (typeof window !== 'undefined') {
    localStorage.removeItem('quiz_records');
    localStorage.removeItem('quiz_wrong_streak');
    localStorage.removeItem('quiz_recent_practice');
  }
};
