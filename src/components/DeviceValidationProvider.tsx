'use client';

import { useDeviceValidation } from '@/hooks/use-device-validation';
import { DeviceKickedDialog } from './DeviceKickedDialog';

/**
 * 设备验证 Provider
 * 在应用顶层统一处理单设备登录验证，避免多个页面重复验证
 */
export function DeviceValidationProvider({ children }: { children: React.ReactNode }) {
  const { kicked, kickMessage, clearKickState } = useDeviceValidation({
    interval: 30000, // 30秒验证一次
    validateOnFocus: true,
  });

  return (
    <>
      {children}
      <DeviceKickedDialog open={kicked} message={kickMessage} onConfirm={clearKickState} />
    </>
  );
}
