/**
 * Storage 索引文件
 * 统一导出所有存储相关功能
 */

export {
  StorageProvider,
  getStorage,
  initStorage,
  storage,
  type StorageAdapter,
  type StorageConfig,
  type StorageType,
} from './storage-provider';

// 业务相关的存储封装
export * from './quiz-storage';
export * from './user-storage';
