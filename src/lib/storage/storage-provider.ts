/**
 * Storage Provider - 数据持久化层抽象
 * 统一封装 localStorage/IndexedDB/云端同步
 */

// ==================== 类型定义 ====================

export type StorageType = 'memory' | 'localStorage' | 'indexedDB' | 'cloud';

export interface StorageAdapter<T = unknown> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface StorageConfig {
  prefix?: string;
  encryption?: boolean;
  compression?: boolean;
  syncInterval?: number;
  maxSize?: number;
}

// ==================== Memory Storage ====================

class MemoryStorage<T> implements StorageAdapter<T> {
  private store = new Map<string, T>();
  
  async get(key: string): Promise<T | null> {
    return this.store.get(key) ?? null;
  }
  
  async set(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  
  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
  
  async clear(): Promise<void> {
    this.store.clear();
  }
  
  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

// ==================== LocalStorage Adapter ====================

class LocalStorageAdapter<T> implements StorageAdapter<T> {
  private prefix: string;
  
  constructor(config: StorageConfig = {}) {
    this.prefix = config.prefix || '';
  }
  
  private getKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }
  
  async get(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(this.getKey(key));
      if (!item) return null;
      return JSON.parse(item);
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  }
  
  async set(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(value));
    } catch (error) {
      // localStorage 空间不足
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded');
        // 可以在这里实现 LRU 清理策略
      }
      throw error;
    }
  }
  
  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.getKey(key));
  }
  
  async clear(): Promise<void> {
    if (this.prefix) {
      // 只清除带有前缀的键
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } else {
      localStorage.clear();
    }
  }
  
  async keys(): Promise<string[]> {
    const keys: string[] = [];
    const prefixLen = this.prefix ? this.prefix.length + 1 : 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        if (!this.prefix || key.startsWith(this.prefix)) {
          keys.push(key.slice(prefixLen));
        }
      }
    }
    
    return keys;
  }
  
  // 获取已用空间（字节）
  getSize(): number {
    let size = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (!this.prefix || key.startsWith(this.prefix))) {
        size += key.length + (localStorage.getItem(key)?.length || 0);
      }
    }
    return size * 2; // UTF-16 编码，每个字符 2 字节
  }
}

// ==================== IndexedDB Adapter ====================

const DB_NAME = 'QuizAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'data';

class IndexedDBAdapter<T> implements StorageAdapter<T> {
  private db: IDBDatabase | null = null;
  private prefix: string;
  private initPromise: Promise<void> | null = null;
  
  constructor(config: StorageConfig = {}) {
    this.prefix = config.prefix || '';
  }
  
  private getKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }
  
  private async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
    
    return this.initPromise;
  }
  
  async get(key: string): Promise<T | null> {
    await this.init();
    if (!this.db) return null;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(this.getKey(key));
      
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }
  
  async set(key: string, value: T): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('IndexedDB not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, this.getKey(key));
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async remove(key: string): Promise<void> {
    await this.init();
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(this.getKey(key));
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;
    
    if (this.prefix) {
      // 只清除带有前缀的键
      const keys = await this.keys();
      for (const key of keys) {
        await this.remove(key);
      }
    } else {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
  
  async keys(): Promise<string[]> {
    await this.init();
    if (!this.db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      
      request.onsuccess = () => {
        const keys = (request.result as string[])
          .filter(k => !this.prefix || k.startsWith(this.prefix))
          .map(k => this.prefix ? k.slice(this.prefix.length + 1) : k);
        resolve(keys);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// ==================== Storage Provider ====================

export class StorageProvider<T = unknown> {
  private adapter: StorageAdapter<T>;
  private config: StorageConfig;
  
  constructor(type: StorageType = 'localStorage', config: StorageConfig = {}) {
    this.config = config;
    
    switch (type) {
      case 'memory':
        this.adapter = new MemoryStorage<T>();
        break;
      case 'indexedDB':
        this.adapter = new IndexedDBAdapter<T>(config);
        break;
      case 'localStorage':
      default:
        this.adapter = new LocalStorageAdapter<T>(config);
        break;
    }
  }
  
  // 基础操作
  async get(key: string): Promise<T | null> {
    return this.adapter.get(key);
  }
  
  async set(key: string, value: T): Promise<void> {
    await this.adapter.set(key, value);
  }
  
  async remove(key: string): Promise<void> {
    await this.adapter.remove(key);
  }
  
  async clear(): Promise<void> {
    await this.adapter.clear();
  }
  
  async keys(): Promise<string[]> {
    return this.adapter.keys();
  }
  
  // 批量操作
  async getMany(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    for (const key of keys) {
      results.set(key, await this.get(key));
    }
    return results;
  }
  
  async setMany(entries: Map<string, T>): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value);
    }
  }
  
  // 对象操作
  async getObject<K extends keyof T>(
    key: string,
    field: K
  ): Promise<T[K] | null> {
    const data = await this.get(key);
    if (!data) return null;
    return (data as Record<string, unknown>)[field as string] as T[K];
  }
  
  async setObject<K extends keyof T>(
    key: string,
    field: K,
    value: T[K]
  ): Promise<void> {
    const data = (await this.get(key)) || ({} as T);
    (data as Record<string, unknown>)[field as string] = value;
    await this.set(key, data);
  }
  
  // 列表操作
  async getList(key: string): Promise<T[]> {
    const data = await this.get(key);
    return Array.isArray(data) ? data : [];
  }
  
  async appendToList(key: string, item: T): Promise<void> {
    const list = await this.getList(key);
    list.push(item);
    await this.set(key, list as unknown as T);
  }
  
  async removeFromList(key: string, predicate: (item: T) => boolean): Promise<void> {
    const list = await this.getList(key);
    const filtered = list.filter(item => !predicate(item));
    await this.set(key, filtered as unknown as T);
  }
}

// ==================== 便捷函数 ====================

// 默认实例
let defaultStorage: StorageProvider | null = null;

export function getStorage<T>(type?: StorageType, config?: StorageConfig): StorageProvider<T> {
  if (!defaultStorage || type) {
    return new StorageProvider<T>(type, config);
  }
  return defaultStorage as StorageProvider<T>;
}

export function initStorage(type: StorageType = 'localStorage', config?: StorageConfig): void {
  defaultStorage = new StorageProvider(type, config);
}

// 便捷访问函数
export const storage = {
  get: <T>(key: string) => getStorage<T>().get(key),
  set: <T>(key: string, value: T) => getStorage<T>().set(key, value),
  remove: (key: string) => getStorage().remove(key),
  clear: () => getStorage().clear(),
};
