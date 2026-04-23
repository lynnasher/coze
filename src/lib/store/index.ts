/**
 * Store 索引文件
 * 统一导出所有 Zustand stores
 */

// Quiz Store
export { 
  useQuizStore, 
  useCurrentQuestion, 
  useCurrentAnswer, 
  useProgress, 
  useQuizStats,
  type QuizStore 
} from './quiz-store';

// User Store
export { 
  useUserStore, 
  useUser, 
  useIsLoggedIn, 
  useIsAdmin, 
  useActivatedCategories,
  type User,
  type UserStore 
} from './user-store';

// Cache Store
export { 
  useCacheStore, 
  useCachedData, 
  getCacheKey, 
  invalidateCache, 
  invalidateCacheByPrefix,
  CACHE_TTL,
  type CacheStore 
} from './cache-store';
