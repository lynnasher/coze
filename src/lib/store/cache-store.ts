/**
 * Zustand Cache Store - API 数据缓存管理
 * 统一管理 API 数据的缓存策略
 */

import { create } from 'zustand';

// ==================== 类型定义 ====================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStoreState {
  // 缓存存储
  caches: Map<string, CacheEntry<unknown>>;
  
  // 请求去重
  pendingRequests: Map<string, Promise<unknown>>;
}

interface CacheStoreActions {
  // 缓存操作
  get: <T>(key: string) => T | null;
  set: <T>(key: string, data: T, ttlMs: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  clearByPrefix: (prefix: string) => void;
  
  // 请求去重
  getPendingRequest: <T>(key: string) => Promise<T> | null;
  setPendingRequest: <T>(key: string, promise: Promise<T>) => void;
  removePendingRequest: (key: string) => void;
  
  // 工具方法
  isValid: (key: string) => boolean;
  getAge: (key: string) => number;
}

export type CacheStore = CacheStoreState & CacheStoreActions;

// 缓存有效期配置（毫秒）
export const CACHE_TTL = {
  BANKS: 5 * 60 * 1000,      // 题库列表缓存 5 分钟
  CATEGORIES: 5 * 60 * 1000, // 分类缓存 5 分钟
  QUESTIONS: 2 * 60 * 1000,  // 题目缓存 2 分钟
  USER: 1 * 60 * 1000,       // 用户信息缓存 1 分钟
  STATS: 30 * 1000,          // 统计数据缓存 30 秒
};

// ==================== Store 创建 ====================

export const useCacheStore = create<CacheStore>()((set, get) => ({
  caches: new Map(),
  pendingRequests: new Map(),

  // ==================== 缓存操作 ====================
  
  get: <T>(key: string): T | null => {
    const entry = get().caches.get(key);
    if (!entry) return null;
    
    // 检查是否过期
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // 过期，删除缓存
      get().caches.delete(key);
      return null;
    }
    
    return entry.data as T;
  },

  set: <T>(key: string, data: T, ttlMs: number) => {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    };
    
    set((state) => {
      const newCaches = new Map(state.caches);
      newCaches.set(key, entry as CacheEntry<unknown>);
      return { caches: newCaches };
    });
  },

  remove: (key: string) => {
    set((state) => {
      const newCaches = new Map(state.caches);
      newCaches.delete(key);
      return { caches: newCaches };
    });
  },

  clear: () => {
    set({ caches: new Map() });
  },

  clearByPrefix: (prefix: string) => {
    set((state) => {
      const newCaches = new Map();
      state.caches.forEach((value, key) => {
        if (!key.startsWith(prefix)) {
          newCaches.set(key, value);
        }
      });
      return { caches: newCaches };
    });
  },

  // ==================== 请求去重 ====================
  
  getPendingRequest: <T>(key: string): Promise<T> | null => {
    return get().pendingRequests.get(key) as Promise<T> | null;
  },

  setPendingRequest: <T>(key: string, promise: Promise<T>) => {
    set((state) => {
      const newPending = new Map(state.pendingRequests);
      newPending.set(key, promise as Promise<unknown>);
      return { pendingRequests: newPending };
    });
    
    // 请求完成后自动清理
    promise.finally(() => {
      get().removePendingRequest(key);
    });
  },

  removePendingRequest: (key: string) => {
    set((state) => {
      const newPending = new Map(state.pendingRequests);
      newPending.delete(key);
      return { pendingRequests: newPending };
    });
  },

  // ==================== 工具方法 ====================
  
  isValid: (key: string): boolean => {
    const entry = get().caches.get(key);
    if (!entry) return false;
    
    const now = Date.now();
    return now - entry.timestamp <= entry.ttl;
  },

  getAge: (key: string): number => {
    const entry = get().caches.get(key);
    if (!entry) return Infinity;
    return Date.now() - entry.timestamp;
  },
}));

// ==================== 便捷 Hook ====================

/**
 * 带缓存的数据获取 Hook
 */
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = CACHE_TTL.QUESTIONS
): { data: T | null; isLoading: boolean; error: Error | null; refresh: () => void } {
  const cache = useCacheStore();
  const [state, setState] = useState<{
    data: T | null;
    isLoading: boolean;
    error: Error | null;
  }>({
    data: cache.get<T>(key),
    isLoading: !cache.get<T>(key),
    error: null,
  });

  const fetchData = useCallback(async () => {
    // 检查缓存
    const cached = cache.get<T>(key);
    if (cached) {
      setState({ data: cached, isLoading: false, error: null });
      return;
    }

    // 检查是否有正在进行的请求（去重）
    const pending = cache.getPendingRequest<T>(key);
    if (pending) {
      try {
        const data = await pending;
        setState({ data, isLoading: false, error: null });
      } catch (error) {
        setState({ data: null, isLoading: false, error: error as Error });
      }
      return;
    }

    // 发起新请求
    setState((s) => ({ ...s, isLoading: true }));
    const promise = fetcher();
    cache.setPendingRequest(key, promise);

    try {
      const data = await promise;
      cache.set(key, data, ttlMs);
      setState({ data, isLoading: false, error: null });
    } catch (error) {
      setState({ data: null, isLoading: false, error: error as Error });
    }
  }, [key, fetcher, cache, ttlMs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refresh: fetchData,
  };
}

// 需要在文件顶部导入 React hooks
import { useState, useCallback, useEffect } from 'react';

// ==================== 缓存工具函数 ====================

/**
 * 生成缓存 key
 */
export const getCacheKey = (prefix: string, id?: string): string => {
  return id ? `${prefix}_${id}` : prefix;
};

/**
 * 使缓存失效
 */
export const invalidateCache = (key: string) => {
  useCacheStore.getState().remove(key);
};

/**
 * 批量使缓存失效
 */
export const invalidateCacheByPrefix = (prefix: string) => {
  useCacheStore.getState().clearByPrefix(prefix);
};
