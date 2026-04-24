/**
 * Zustand User Store - 用户状态管理
 * 管理用户登录状态、激活分类等信息
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ==================== 类型定义 ====================

export interface User {
  id: string;
  phone: string;
  nickname?: string;
  role: 'admin' | 'user';
  activatedCategories?: string[];
  deviceId?: string;
}

interface UserStoreState {
  // 用户信息
  user: User | null;
  token: string | null;
  
  // 加载状态
  isLoading: boolean;
  
  // 设备验证状态
  isDeviceValid: boolean;
  lastValidationTime: number;
  
  // 持久化恢复状态
  hasHydrated: boolean;
}

interface UserStoreActions {
  // 登录/登出
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  
  // 激活分类
  setActivatedCategories: (categories: string[]) => void;
  addActivatedCategory: (categoryId: string) => void;
  removeActivatedCategory: (categoryId: string) => void;
  hasActivatedCategory: (categoryId: string) => boolean;
  
  // 状态更新
  setLoading: (loading: boolean) => void;
  setDeviceValid: (valid: boolean) => void;
  updateValidationTime: () => void;
  
  // 获取器
  getToken: () => string | null;
  getUserId: () => string | null;
  isAdmin: () => boolean;
  isLoggedIn: () => boolean;
}

export type UserStore = UserStoreState & UserStoreActions;

// ==================== 初始状态 ====================

const initialState: Omit<UserStoreState, keyof UserStoreActions> = {
  user: null,
  token: null,
  isLoading: false,
  isDeviceValid: true,
  lastValidationTime: 0,
  hasHydrated: false,
};

// ==================== Store 创建 ====================

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ==================== 登录/登出 ====================
      
      login: (user, token) => {
        set({
          user,
          token,
          isDeviceValid: true,
          lastValidationTime: Date.now(),
        });
      },

      logout: () => {
        set({
          ...initialState,
          isLoading: false,
        });
      },

      updateUser: (updates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }));
      },

      // ==================== 激活分类 ====================
      
      setActivatedCategories: (categories) => {
        set((state) => ({
          user: state.user 
            ? { ...state.user, activatedCategories: categories }
            : null,
        }));
      },

      addActivatedCategory: (categoryId) => {
        set((state) => {
          if (!state.user) return state;
          const current = state.user.activatedCategories || [];
          if (current.includes(categoryId)) return state;
          return {
            user: {
              ...state.user,
              activatedCategories: [...current, categoryId],
            },
          };
        });
      },

      removeActivatedCategory: (categoryId) => {
        set((state) => {
          if (!state.user) return state;
          const current = state.user.activatedCategories || [];
          return {
            user: {
              ...state.user,
              activatedCategories: current.filter(id => id !== categoryId),
            },
          };
        });
      },

      hasActivatedCategory: (categoryId) => {
        const state = get();
        if (!state.user) return false;
        const categories = state.user.activatedCategories || [];
        return categories.includes(categoryId);
      },

      // ==================== 状态更新 ====================
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setDeviceValid: (valid) => set({ isDeviceValid: valid }),
      
      updateValidationTime: () => {
        set({ lastValidationTime: Date.now() });
      },

      // ==================== 获取器 ====================
      
      getToken: () => get().token,
      
      getUserId: () => get().user?.id || null,
      
      isAdmin: () => get().user?.role === 'admin',
      
      isLoggedIn: () => !!get().user && !!get().token,
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isDeviceValid: state.isDeviceValid,
        lastValidationTime: state.lastValidationTime,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true;
        }
      },
    }
  )
);

// ==================== Selector Hooks ====================

export const useUser = () => useUserStore((state) => state.user);
export const useIsLoggedIn = () => useUserStore((state) => state.isLoggedIn());
export const useIsAdmin = () => useUserStore((state) => state.isAdmin());
export const useActivatedCategories = () => 
  useUserStore((state) => state.user?.activatedCategories || []);
