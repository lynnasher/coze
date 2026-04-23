/**
 * User Storage - 用户数据持久化封装
 * 管理用户偏好设置、设备ID等数据的存储
 */

import { getStorage } from './storage-provider';

const STORAGE_KEYS = {
  USER_PREFERENCES: 'user_preferences',
  DEVICE_ID: 'device_id',
  AUTH_TOKEN: 'auth_token',
  USER_INFO: 'user_info',
  ACTIVATED_CATEGORIES: 'activated_categories',
  LAST_SYNC_TIME: 'last_sync_time',
};

// ==================== 用户偏好设置 ====================

export interface UserPreferences {
  // 界面设置
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  
  // 学习设置
  dailyGoal: number; // 每日目标题数
  autoShowAnswer: boolean; // 自动显示答案
  soundEnabled: boolean; // 音效开关
  
  // 提醒设置
  reminderEnabled: boolean;
  reminderTime: string; // HH:mm 格式
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  fontSize: 'medium',
  dailyGoal: 50,
  autoShowAnswer: false,
  soundEnabled: true,
  reminderEnabled: false,
  reminderTime: '20:00',
};

export async function getUserPreferences(): Promise<UserPreferences> {
  const storage = getStorage<UserPreferences>();
  const prefs = await storage.get(STORAGE_KEYS.USER_PREFERENCES);
  return { ...DEFAULT_PREFERENCES, ...prefs };
}

export async function setUserPreferences(
  prefs: Partial<UserPreferences>
): Promise<void> {
  const storage = getStorage<UserPreferences>();
  const current = await getUserPreferences();
  await storage.set(STORAGE_KEYS.USER_PREFERENCES, { ...current, ...prefs });
}

export async function updateUserPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): Promise<void> {
  const storage = getStorage<UserPreferences>();
  const current = await getUserPreferences();
  current[key] = value;
  await storage.set(STORAGE_KEYS.USER_PREFERENCES, current);
}

// ==================== 设备ID ====================

export async function getDeviceId(): Promise<string | null> {
  const storage = getStorage<string>();
  return await storage.get(STORAGE_KEYS.DEVICE_ID);
}

export async function setDeviceId(deviceId: string): Promise<void> {
  const storage = getStorage<string>();
  await storage.set(STORAGE_KEYS.DEVICE_ID, deviceId);
}

export function generateDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== 认证Token ====================

export async function getAuthToken(): Promise<string | null> {
  const storage = getStorage<string>();
  return await storage.get(STORAGE_KEYS.AUTH_TOKEN);
}

export async function setAuthToken(token: string): Promise<void> {
  const storage = getStorage<string>();
  await storage.set(STORAGE_KEYS.AUTH_TOKEN, token);
}

export async function removeAuthToken(): Promise<void> {
  const storage = getStorage<string>();
  await storage.remove(STORAGE_KEYS.AUTH_TOKEN);
}

// ==================== 已激活分类 ====================

export async function getActivatedCategories(): Promise<string[]> {
  const storage = getStorage<string[]>();
  return await storage.get(STORAGE_KEYS.ACTIVATED_CATEGORIES) || [];
}

export async function setActivatedCategories(categories: string[]): Promise<void> {
  const storage = getStorage<string[]>();
  await storage.set(STORAGE_KEYS.ACTIVATED_CATEGORIES, categories);
}

export async function addActivatedCategory(categoryId: string): Promise<void> {
  const storage = getStorage<string[]>();
  const categories = await getActivatedCategories();
  if (!categories.includes(categoryId)) {
    categories.push(categoryId);
    await storage.set(STORAGE_KEYS.ACTIVATED_CATEGORIES, categories);
  }
}

export async function removeActivatedCategory(categoryId: string): Promise<void> {
  const storage = getStorage<string[]>();
  const categories = await getActivatedCategories();
  const filtered = categories.filter(id => id !== categoryId);
  await storage.set(STORAGE_KEYS.ACTIVATED_CATEGORIES, filtered);
}

// ==================== 同步时间戳 ====================

export async function getLastSyncTime(): Promise<number> {
  const storage = getStorage<number>();
  return await storage.get(STORAGE_KEYS.LAST_SYNC_TIME) || 0;
}

export async function setLastSyncTime(timestamp: number = Date.now()): Promise<void> {
  const storage = getStorage<number>();
  await storage.set(STORAGE_KEYS.LAST_SYNC_TIME, timestamp);
}

export async function shouldSync(minIntervalMs: number = 60000): Promise<boolean> {
  const lastSync = await getLastSyncTime();
  return Date.now() - lastSync >= minIntervalMs;
}

// ==================== 清理数据 ====================

export async function clearAllUserData(): Promise<void> {
  const storage = getStorage();
  for (const key of Object.values(STORAGE_KEYS)) {
    await storage.remove(key);
  }
}

export async function clearSensitiveData(): Promise<void> {
  const storage = getStorage();
  await storage.remove(STORAGE_KEYS.AUTH_TOKEN);
  await storage.remove(STORAGE_KEYS.DEVICE_ID);
  await storage.remove(STORAGE_KEYS.USER_INFO);
}
