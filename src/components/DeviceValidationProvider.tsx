'use client';

import { useDeviceValidation } from '@/hooks/use-device-validation';
import { DeviceKickedDialog } from './DeviceKickedDialog';
import { deviceService } from '@/lib/services/device-service';

/**
 * 设备验证 Provider
 * 在应用顶层统一处理单设备登录验证，避免多个页面重复验证
 */
export function DeviceValidationProvider({ children }: { children: React.ReactNode }) {
  const { kicked, kickMessage, clearKickState } = useDeviceValidation({
    interval: 30000, // 30秒验证一次
    validateOnFocus: true,
  });

  const handleConfirm = () => {
    // 清除登录状态并刷新页面
    deviceService.clearAuthData();
    clearKickState();
    window.location.reload();
  };

  return (
    <>
      {children}
      <DeviceKickedDialog open={kicked} message={kickMessage} onConfirm={handleConfirm} />
    </>
  );
}
