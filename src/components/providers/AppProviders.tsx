'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { getCurrentUser as getStoredUser } from '@/components/AuthModal';
import { useDeviceValidation } from '@/hooks/use-device-validation';
import { cloudSyncService, forceSync, forceSyncBeacon, recordStore, wrongStreakStore } from '@/lib/quiz-store';
import { recalculateWrongData as recalculateWrongDataUtil } from '@/lib/stats-utils';

// 用户状态类型
interface User {
  id: string;
  phone: string;
  nickname?: string;
  role: string;
  activatedCategories?: string[];
}

// 应用状态上下文类型
interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  wrongCount: number;
  setWrongCount: (count: number) => void;
  refreshUser: () => void;
  syncFromCloud: (skipPush?: boolean) => Promise<void>;
  isSyncing: boolean;
  kicked: boolean;
  kickMessage: string;
  handleKicked: () => void;
  mounted: boolean;
}

// 创建上下文
const AppContext = createContext<AppContextType | undefined>(undefined);

// 提供者组件
export function AppProviders({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 设备验证（单设备登录）
  const { kicked, kickMessage, clearKickState } = useDeviceValidation({
    interval: 30000,
    validateOnFocus: true,
  });

  // 处理被踢下线
  const handleKicked = () => {
    setCurrentUser(null);
    clearKickState();
    window.location.reload();
  };

  // 刷新用户状态
  const refreshUser = useCallback(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser({
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        role: user.role,
        activatedCategories: user.activated_categories || [],
      });
    } else {
      setCurrentUser(null);
    }
  }, []);

  // 从云端同步数据
  const syncFromCloud = useCallback(async (skipPush: boolean = false) => {
    const user = getStoredUser();
    if (!user) {
      setWrongCount(0);
      return;
    }
    setIsSyncing(true);
    try {
      const cloudData = await cloudSyncService.pullData(user.id);
      if (cloudData) {
        recordStore.save(cloudData.records);
        wrongStreakStore.save(cloudData.streaks);
      }
      if (!skipPush) {
        await cloudSyncService.saveRecordsAndStreaks(user.id, recordStore.getAll(), wrongStreakStore.getAll());
      }
      // 重新计算错题数
      const wrongCountResult = recalculateWrongDataUtil(
        recordStore.getAll(),
        (records) => recordStore.save(records),
        (streaks) => wrongStreakStore.save(streaks),
        () => 0
      );
      setWrongCount(wrongCountResult);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // 初始化
  useEffect(() => {
    refreshUser();
    const user = getStoredUser();
    if (user) {
      syncFromCloud(true);
    }
    setMounted(true);

    // 页面卸载时同步
    const handleBeforeUnload = () => {
      if (cloudSyncService.hasPendingSync()) {
        forceSyncBeacon();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (cloudSyncService.hasPendingSync()) {
        forceSync();
      }
    };
  }, [refreshUser, syncFromCloud]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        authModalOpen,
        setAuthModalOpen,
        wrongCount,
        setWrongCount,
        refreshUser,
        syncFromCloud,
        isSyncing,
        kicked,
        kickMessage,
        handleKicked,
        mounted,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// 自定义 Hook
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProviders');
  }
  return context;
}
