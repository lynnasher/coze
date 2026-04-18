/**
 * 设备验证服务
 * 用于单设备登录功能，确保一个用户只能在一台设备上在线
 */

// 设备验证响应类型
export interface DeviceValidationResult {
  valid: boolean;
  kicked?: boolean;
  error?: string;
}

// 设备验证服务
export const deviceService = {
  // 获取存储的设备ID
  getDeviceId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('quiz_device_id');
  },

  // 获取当前用户信息
  getCurrentUser(): { id: string; phone: string } | null {
    if (typeof window === 'undefined') return null;
    const userData = localStorage.getItem('quiz_user_data');
    if (!userData) return null;
    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  },

  // 验证当前设备是否有效
  async validateDevice(retryCount = 0): Promise<DeviceValidationResult> {
    const user = this.getCurrentUser();
    const deviceId = this.getDeviceId();

    if (!user || !deviceId) {
      return { valid: false, error: '未登录或缺少设备信息' };
    }

    try {
      const response = await fetch('/api/auth/validate-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, deviceId }),
      });

      const data = await response.json();

      if (response.status === 403 && data.error === 'DEVICE_KICKED') {
        // 设备被挤下线，但先不重试，直接返回错误让 UI 处理
        // 清除本地登录状态
        this.clearAuthData();
        return { valid: false, kicked: true, error: data.message || '您的账号已在其他设备登录' };
      }

      if (!data.success) {
        // 如果是服务器错误且未超过重试次数，进行重试
        if (response.status >= 500 && retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return this.validateDevice(retryCount + 1);
        }
        return { valid: false, error: data.error || '设备验证失败' };
      }

      return { valid: true };
    } catch (error) {
      // 网络错误，进行重试
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.validateDevice(retryCount + 1);
      }
      return { valid: false, error: '网络错误，无法验证设备' };
    }
  },

  // 清除认证数据（登出）
  clearAuthData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('quiz_user_token');
    localStorage.removeItem('quiz_user_data');
    localStorage.removeItem('quiz_device_id');
    // 触发登出事件
    window.dispatchEvent(new Event('user-auth-change'));
  },

  // 执行登出
  logout(): void {
    this.clearAuthData();
  },
};

// 设备验证 Hook 类型
export interface UseDeviceValidationReturn {
  validateDevice: () => Promise<DeviceValidationResult>;
  isValidating: boolean;
  kicked: boolean;
  kickMessage: string;
}
