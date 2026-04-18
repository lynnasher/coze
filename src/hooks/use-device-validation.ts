'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { deviceService, DeviceValidationResult } from '@/lib/services/device-service';

export interface UseDeviceValidationReturn {
  validateDevice: () => Promise<DeviceValidationResult>;
  isValidating: boolean;
  kicked: boolean;
  kickMessage: string;
  clearKickState: () => void;
}

/**
 * 设备验证 Hook
 * 用于单设备登录功能，定期验证当前设备是否被挤下线
 * @param options.interval 验证间隔（毫秒），默认 30000（30秒）
 * @param options.validateOnFocus 窗口重新获得焦点时是否验证，默认 true
 */
export function useDeviceValidation(options?: {
  interval?: number;
  validateOnFocus?: boolean;
}): UseDeviceValidationReturn {
  const { interval = 30000, validateOnFocus = true } = options || {};
  
  const [isValidating, setIsValidating] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [kickMessage, setKickMessage] = useState('');
  
  // 使用 ref 存储最新的验证函数
  const validateRef = useRef<(() => Promise<void>) | null>(null);

  // 执行设备验证
  const validateDevice = useCallback(async (): Promise<DeviceValidationResult> => {
    // 检查是否有登录信息
    const user = deviceService.getCurrentUser();
    if (!user) {
      return { valid: false, error: '未登录' };
    }

    setIsValidating(true);
    try {
      const result = await deviceService.validateDevice();
      
      if (result.kicked) {
        setKicked(true);
        setKickMessage(result.error || '您的账号已在其他设备登录');
      }
      
      return result;
    } finally {
      setIsValidating(false);
    }
  }, []);

  // 清除被踢状态
  const clearKickState = useCallback(() => {
    setKicked(false);
    setKickMessage('');
  }, []);

  // 保存验证函数到 ref
  useEffect(() => {
    validateRef.current = async () => {
      await validateDevice();
    };
  }, [validateDevice]);

  // 定期验证
  useEffect(() => {
    // 首次验证
    validateDevice();

    // 设置定时器
    const timer = setInterval(() => {
      if (validateRef.current) {
        validateRef.current();
      }
    }, interval);

    return () => clearInterval(timer);
  }, [interval, validateDevice]);

  // 窗口重新获得焦点时验证
  useEffect(() => {
    if (!validateOnFocus) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && validateRef.current) {
        validateRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [validateOnFocus]);

  return {
    validateDevice,
    isValidating,
    kicked,
    kickMessage,
    clearKickState,
  };
}
