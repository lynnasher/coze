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
  async validateDevice(): Promise<DeviceValidationResult> {
    const user = this.getCurrentUser();
    const deviceId = this.getDeviceId();

    console.log(`[DeviceService] 开始验证: userId=${user?.id}, deviceId=${deviceId}`);

    if (!user) {
      console.log('[DeviceService] 用户未登录');
      return { valid: false, error: '未登录' };
    }

    // 如果本地没有 deviceId（旧用户或首次使用），跳过验证
    // 下次登录时会自动设置 deviceId
    if (!deviceId) {
      console.log('[DeviceService] 本地无deviceId，跳过验证');
      return { valid: true };
    }

    try {
      console.log(`[DeviceService] 发送验证请求: userId=${user.id}, deviceId=${deviceId}`);
      const response = await fetch('/api/auth/validate-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, deviceId }),
      });

      const data = await response.json();
      console.log(`[DeviceService] 验证响应: status=${response.status}, success=${data.success}`);

      if (response.status === 403 && data.error === 'DEVICE_KICKED') {
        // 设备被挤下线，清除本地登录状态
        console.log('[DeviceService] 设备被挤下线，清除登录状态');
        this.clearAuthData();
        return { valid: false, kicked: true, error: data.message || '您的账号已在其他设备登录' };
      }

      if (!data.success) {
        console.log(`[DeviceService] 验证失败: ${data.error}`);
        return { valid: false, error: data.error || '设备验证失败' };
      }

      console.log('[DeviceService] 验证通过');
      return { valid: true };
    } catch (error) {
      console.error('[DeviceService] 验证出错:', error);
      return { valid: false, error: '网络错误，无法验证设备' };
    }
  },

  // 清除认证数据（登出）
  clearAuthData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('quiz_user_token');
    localStorage.removeItem('quiz_user_data');
    localStorage.removeItem('quiz_device_id');
    // 清除用户相关的错题数据（避免切换账号时看到之前用户的数据）
    localStorage.removeItem('quiz_records');
    localStorage.removeItem('quiz_wrong_streak');
    localStorage.removeItem('quiz_recent_practice');
    // 触发登出事件
    window.dispatchEvent(new Event('user-auth-change'));
  },

  // 执行登出（调用后端 API 清除数据库中的 device_id）
  async logout(): Promise<void> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('quiz_user_token') : null;
    const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    
    // 优先使用用户 token，如果没有则使用 admin token
    const authToken = token || adminToken;
    
    if (authToken) {
      try {
        console.log('[DeviceService] 调用后端退出 API');
        // 调用后端 API 清除数据库中的 device_id
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        const data = await response.json();
        console.log(`[DeviceService] 后端退出响应: success=${data.success}`);
      } catch (error) {
        console.error('[DeviceService] 后端退出调用失败:', error);
        // 即使后端调用失败，也继续清除本地数据
      }
    }
    
    // 清除本地存储的认证数据
    this.clearAuthData();
  },

  // 同步登出（仅清除本地数据，不调用后端 - 用于被踢下线等场景）
  logoutLocal(): void {
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
